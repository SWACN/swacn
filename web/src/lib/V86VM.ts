import { Terminal } from '@xterm/xterm';
// @ts-ignore
import { V86 } from 'v86';
import wasmURL from 'v86/build/v86.wasm?url';

export type VMStatus =
  | 'initializing' | 'booting_kernel' | 'downloading_baseline'
  | 'extracting_baseline' | 'downloading_tools' | 'installing_tools'
  | 'ready' | 'error';

// ---------------------------------------------------------------------------
// Storage keys — all cross-iframe messaging via localStorage + storage events
// (BroadcastChannel breaks with COOP:same-origin in embedded iframes)
// ---------------------------------------------------------------------------
const K = {
  master:  (id: string) => `swacn_vm_master_${id}`,
  status:  (id: string) => `swacn_vm_status_${id}`,
  output:  (id: string) => `swacn_vm_output_${id}`,
  input:   (id: string) => `swacn_vm_input_${id}`,
};

// ---------------------------------------------------------------------------
// fetchAssetWithCache — exported for Lab.tsx recording fetch
// ---------------------------------------------------------------------------
const fetchPromises = new Map<string, Promise<Uint8Array>>();

export async function fetchAssetWithCache(url: string, useProxy = true): Promise<Uint8Array> {
  if (fetchPromises.has(url)) return new Uint8Array(await fetchPromises.get(url)!);
  const p = (async () => {
    const cacheName = 'swacn-assets-v1';
    const checkCache = async (): Promise<Uint8Array | null> => {
      try {
        if ('caches' in window) {
          const cache = await caches.open(cacheName);
          const hit = await cache.match(url);
          if (hit) return new Uint8Array(await hit.arrayBuffer());
        }
      } catch (_) {}
      return null;
    };
    let cached = await checkCache();
    if (cached) { console.log(`[V86VM] Cache hit: ${url}`); return cached; }
    console.log(`[V86VM] Cache miss: ${url}`);
    const performFetch = async () => {
      const fetchUrl = useProxy ? `/dev-proxy?url=${encodeURIComponent(url)}` : url;
      const res = await fetch(fetchUrl);
      if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
      const buffer = await res.arrayBuffer();
      try {
        if ('caches' in window) {
          const cache = await caches.open(cacheName);
          await cache.put(url, new Response(buffer, {
            headers: { 'Content-Type': res.headers.get('Content-Type') || 'application/octet-stream' }
          }));
        }
      } catch (_) {}
      return new Uint8Array(buffer);
    };
    if ('locks' in navigator) {
      return await navigator.locks.request(`swacn_fetch_${url}`, async () => {
        const c = await checkCache(); return c ?? await performFetch();
      });
    }
    return await performFetch();
  })();
  fetchPromises.set(url, p);
  try { return new Uint8Array(await p); } catch (err) { fetchPromises.delete(url); throw err; }
}

// ---------------------------------------------------------------------------
// V86VM — master/client via navigator.locks election + localStorage messaging
// ---------------------------------------------------------------------------

// NOTE: WebAssembly.Module cannot be stored in IDB or postMessage'd across
// iframes when COEP:require-corp is active (DataCloneError by design — Spectre
// mitigation). Each master context compiles its own instance. The .wasm bytes
// ARE cached in CacheStorage by fetchAssetWithCache, so the network round-trip
// is eliminated and only the JIT step (~100-200ms) repeats per master.
//
// Module-level promise deduplicates concurrent compile requests within one context.
let wasmModulePromise: Promise<WebAssembly.Module> | null = null;

async function getWasmModule(): Promise<WebAssembly.Module> {
  if (wasmModulePromise) return wasmModulePromise;
  wasmModulePromise = (async () => {
    // Fetch bytes via our asset cache (CacheStorage) — no network if already cached
    const bytes = await fetchAssetWithCache(wasmURL, false);
    console.log('[V86VM] WASM module: compiling from cached bytes...');
    const module = await WebAssembly.compile(bytes.buffer as ArrayBuffer);
    console.log('[V86VM] WASM module: ready');
    return module;
  })();
  return wasmModulePromise;
}


export class V86VM {
  private xterm: Terminal;
  private projectId: string;
  private disposed = false;
  private role: 'master' | 'client' | null = null;

  // Master state
  private emulator: any = null;
  private outputBuffer = '';
  private resolveCommand: (() => void) | null = null;
  private currentMarker: string | null = null;
  private isInteractiveMode = false;
  private disposeResolve: (() => void) | null = null;
  private currentStatus: VMStatus = 'initializing';
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private outputSeq = 0;

  // Client state
  private xtermDataListener: { dispose: () => void } | null = null;
  private storageListener: ((e: StorageEvent) => void) | null = null;

  constructor(xterm: Terminal, projectId: string) {
    this.xterm = xterm;
    this.projectId = projectId;
  }

  public boot(
    manifestUrl: string | null, baselineUrl: string | null,
    onStatus: (s: VMStatus) => void, onManifest?: (m: any) => void,
  ) { this._boot(manifestUrl, baselineUrl, onStatus, onManifest); }

  private async _boot(
    manifestUrl: string | null, baselineUrl: string | null,
    onStatus: (s: VMStatus) => void, onManifest?: (m: any) => void,
  ) {
    // Yield to the event loop BEFORE requesting the lock.
    // React Strict Mode runs effect → cleanup → effect in quick succession.
    // This pause lets the cleanup (dispose) run, so render #1 sees disposed=true
    // and exits here — leaving render #2 to request the lock uncontested.
    await new Promise(r => setTimeout(r, 0));
    if (this.disposed) return;

    // Use only navigator.locks for election — it is session-scoped and never
    // goes stale (unlike localStorage which persists across page loads).
    navigator.locks.request(`swacn-vm-master-${this.projectId}`, { ifAvailable: true }, async (lock) => {
      if (this.disposed) return;

      if (!lock) {
        // Another iframe holds the lock → become a client
        this.role = 'client';
        this.runAsClient(onStatus);
        return;
      }

      // We hold the lock → we are the master
      this.role = 'master';
      // Wipe stale keys from any previous session before writing fresh state
      [K.master(this.projectId), K.status(this.projectId),
       K.output(this.projectId), K.input(this.projectId)].forEach(k => localStorage.removeItem(k));
      localStorage.setItem(K.master(this.projectId), 'alive');

      await this.runAsMaster(manifestUrl, baselineUrl, onStatus, onManifest);
      if (!this.disposed) {
        await new Promise<void>(res => { this.disposeResolve = res; });
      }
      // Lock released when this callback returns
    });
  }

  // ── CLIENT ────────────────────────────────────────────────────────────────

  private runAsClient(onStatus: (s: VMStatus) => void) {
    console.log('[V86VM] Running as client (localStorage mode)');

    // Immediately apply any status already written by master
    const existingStatus = localStorage.getItem(K.status(this.projectId));
    if (existingStatus) {
      try { onStatus(JSON.parse(existingStatus).status); } catch (_) {}
    }

    const listener = (e: StorageEvent) => {
      if (this.disposed) return;
      if (e.key === K.status(this.projectId) && e.newValue) {
        try { onStatus(JSON.parse(e.newValue).status); } catch (_) {}
      }
      if (e.key === K.output(this.projectId) && e.newValue) {
        try {
          const msg = JSON.parse(e.newValue);
          if (msg.type === 'clear') { this.xterm.clear(); }
          else if (msg.type === 'ready') {
            if (msg.data) this.xterm.write(msg.data);
            this.xtermDataListener = this.xterm.onData(data =>
              localStorage.setItem(K.input(this.projectId),
                JSON.stringify({ seq: Date.now(), data })));
            onStatus('ready');
          } else if (msg.type === 'data') {
            this.xterm.write(msg.data);
          }
        } catch (_) {}
      }
    };

    this.storageListener = listener;
    window.addEventListener('storage', listener);
  }

  // ── MASTER ────────────────────────────────────────────────────────────────

  private setStatus(status: VMStatus) {
    if (this.disposed) return;
    this.currentStatus = status;
    localStorage.setItem(K.status(this.projectId), JSON.stringify({ status }));
  }

  private broadcastOutput(msg: object) {
    if (this.disposed) return;
    localStorage.setItem(K.output(this.projectId), JSON.stringify({ seq: this.outputSeq++, ...msg }));
  }

  private consoleOut = (byte: number) => {
    if (this.disposed) return;
    const char = String.fromCharCode(byte);
    if (this.isInteractiveMode) {
      this.xterm.write(char);
      // Batch output — flush every 16ms
      this.pendingOutput += char;
      if (!this.outputFlushTimer) {
        this.outputFlushTimer = setTimeout(() => {
          if (this.pendingOutput) this.broadcastOutput({ type: 'data', data: this.pendingOutput });
          this.pendingOutput = '';
          this.outputFlushTimer = null;
        }, 16);
      }
    } else {
      this.outputBuffer += char;
      if (this.resolveCommand && this.currentMarker &&
          this.outputBuffer.includes(this.currentMarker) &&
          (this.outputBuffer.endsWith('# ') || this.outputBuffer.endsWith('% ') || this.outputBuffer.endsWith('$ '))) {
        const r = this.resolveCommand; this.resolveCommand = null; r();
      }
      if (this.outputBuffer.length > 1024 * 1024)
        this.outputBuffer = this.outputBuffer.substring(this.outputBuffer.length - 1000);
    }
  };
  private pendingOutput = '';
  private outputFlushTimer: ReturnType<typeof setTimeout> | null = null;

  private async execWait(cmd: string): Promise<string> {
    if (!this.emulator || this.disposed) return '';
    this.outputBuffer = '';
    const nonce = Math.random().toString(36).substring(2, 10);
    this.currentMarker = `__SWACN_${nonce}__`;
    return new Promise<string>(async resolve => {
      this.resolveCommand = () => {
        const out = this.outputBuffer.split(this.currentMarker || '')[0].replace(cmd, '').trim();
        this.currentMarker = null; resolve(out);
      };
      const full = `${cmd} ; printf "${this.currentMarker}"\n`;
      for (let i = 0; i < full.length; i++) {
        if (this.disposed) { resolve(''); return; }
        this.emulator?.serial0_send(full[i]);
        if (i > 0 && i % 64 === 0) await new Promise(r => setTimeout(r, 1));
      }
    });
  }

  private async runAsMaster(
    manifestUrl: string | null, baselineUrl: string | null,
    onStatus: (s: VMStatus) => void, onManifest?: (m: any) => void,
  ) {
    console.log('[V86VM] Running as master (localStorage mode)');

    // Listen for keyboard input from clients via localStorage
    const inputListener = (e: StorageEvent) => {
      if (this.disposed || !this.isInteractiveMode || e.key !== K.input(this.projectId) || !e.newValue) return;
      try {
        const { data } = JSON.parse(e.newValue);
        for (let i = 0; i < data.length; i++) this.emulator?.serial0_send(data[i]);
      } catch (_) {}
    };
    window.addEventListener('storage', inputListener);
    this.storageListener = inputListener;

    const emit = (status: VMStatus) => { onStatus(status); this.setStatus(status); };

    try {
      emit('initializing');

      // Heartbeat: re-write status every 1.5s so clients that load mid-boot catch up
      this.heartbeatInterval = setInterval(() => {
        if (this.disposed || this.isInteractiveMode) return;
        this.setStatus(this.currentStatus);
      }, 1500);

      const osFetchPromise = Promise.all([
        fetchAssetWithCache('/v86-assets/v86/bios/seabios.bin', false),
        fetchAssetWithCache('/v86-assets/v86/bios/vgabios.bin', false),
        fetchAssetWithCache('/i-copy-sh/buildroot-bzimage.bin', false),
      ]);

      let manifestPromise: Promise<any> | null = null;
      let baselinePromise: Promise<Uint8Array> | null = null;
      if (manifestUrl) {
        manifestPromise = fetchAssetWithCache(manifestUrl, false).then(data => {
          const m = JSON.parse(new TextDecoder().decode(data));
          if (onManifest) onManifest(m); return m;
        });
        if (baselineUrl) baselinePromise = fetchAssetWithCache(baselineUrl, false);
      }

      emit('booting_kernel');
      const [biosData, vgabiosData, bzimageData] = await osFetchPromise;
      if (this.disposed) return;

      this.emulator = new V86({
        wasm_fn: async (imports: any) => {
          const module = await getWasmModule();
          return (await WebAssembly.instantiate(module, imports)).exports;
        },
        memory_size: 256 * 1024 * 1024, vga_memory_size: 8 * 1024 * 1024,
        bios: { buffer: biosData.buffer as ArrayBuffer },
        vga_bios: { buffer: vgabiosData.buffer as ArrayBuffer },
        bzimage: { buffer: bzimageData.buffer as ArrayBuffer },
        filesystem: {},
        cmdline: 'tsc=reliable mitigations=off random.trust_cpu=on rw init=/bin/sh root=/dev/root rootfstype=ext2 console=ttyS0',
        autostart: true, disable_keyboard: true, disable_mouse: true, disable_speaker: true,
      });
      this.emulator.add_listener('serial0-output-byte', this.consoleOut);

      await new Promise<void>(resolve => {
        const iv = setInterval(() => {
          if (this.disposed) { clearInterval(iv); resolve(); return; }
          if (this.outputBuffer.includes('Welcome to Buildroot') ||
              this.outputBuffer.endsWith('# ') || this.outputBuffer.endsWith('% '))
            { clearInterval(iv); resolve(); }
        }, 500);
      });
      if (this.disposed) return;

      await new Promise(r => setTimeout(r, 1000));
      await this.execWait('stty -echo');
      await this.execWait('mkdir -p /home/swacn && cd /home/swacn');
      const mountOut = await this.execWait('mountpoint -q /mnt || mount -t 9p -o trans=virtio host9p /mnt/');
      if (mountOut) console.log('[V86VM] mount:', mountOut);

      let manifestEnv: Record<string, string> = {};
      if (manifestPromise) {
        const manifest = await manifestPromise;
        manifestEnv = manifest.env ?? manifest.environment?.env ?? {};
        if (manifest.baseline && baselinePromise) {
          emit('downloading_baseline');
          try {
            const bd = await baselinePromise; emit('extracting_baseline');
            this.emulator?.create_file('baseline.tar.gz', bd);
            await this.execWait('zcat /mnt/baseline.tar.gz | tar -xf - -C /home/swacn');
            await this.execWait('rm /mnt/baseline.tar.gz');
          } catch (err) { console.error('[V86VM] baseline failed', err); }
        }
        const bins = manifest.binaries?.x86_32 ?? manifest.environment?.binaries?.x86_32 ??
                     manifest.binaries?.i386   ?? manifest.environment?.binaries?.i386   ??
                     manifest.binaries?.x86_64 ?? manifest.environment?.binaries?.x86_64 ?? [];
        if (bins.length > 0) {
          emit('downloading_tools');
          try {
            const results = await Promise.all(bins.map(async (t: any) => ({ tool: t, data: await fetchAssetWithCache(t.url) })));
            emit('installing_tools');
            for (const { tool, data } of results) {
              const fn = tool.url.split('/').pop() || 'tool';
              let ip = tool.install_path || '/usr/bin';
              if (!ip.endsWith(tool.name)) ip = ip.endsWith('/') ? `${ip}${tool.name}` : `${ip}/${tool.name}`;
              this.emulator?.create_file(fn, data);
              await this.execWait(`mkdir -p ${ip.substring(0, ip.lastIndexOf('/'))}`);
              await this.execWait(`cp /mnt/${fn} ${ip}`);
              await this.execWait(`chmod +x ${ip}`);
              await this.execWait(`rm /mnt/${fn}`);
            }
          } catch (err) { console.error('[V86VM] tools failed', err); }
        }
      }

      const welcome = manifestUrl ? await this.execWait('cat welcome.txt 2>/dev/null') : null;
      if (Object.keys(manifestEnv).length > 0) {
        await this.execWait('mkdir -p /etc/profile.d && rm -f /etc/profile.d/swacn.sh');
        for (const [k, v] of Object.entries(manifestEnv))
          await this.execWait(`echo 'export ${k}="${v}"' >> /etc/profile.d/swacn.sh`);
        await this.execWait('. /etc/profile.d/swacn.sh');
      }
      await this.execWait("export PS1='swacn@sandbox:~$ '");
      await this.execWait(`stty cols ${this.xterm.cols} rows ${this.xterm.rows}`);
      await this.execWait('stty echo');
      await new Promise(r => setTimeout(r, 300));

      if (this.heartbeatInterval) { clearInterval(this.heartbeatInterval); this.heartbeatInterval = null; }

      this.xterm.clear();
      const PROMPT = 'swacn@sandbox:~$ ';
      const initial = (welcome?.trim()) ? welcome.trim() + '\r\n\r\n' + PROMPT : PROMPT;
      this.xterm.write(initial);

      this.isInteractiveMode = true;
      this.xtermDataListener = this.xterm.onData(data => {
        if (!this.isInteractiveMode || !this.emulator) return;
        this.emulator.serial0_send(data);
      });

      // Tell clients: clear, write initial output, mark ready
      this.broadcastOutput({ type: 'clear' });
      this.broadcastOutput({ type: 'ready', data: initial });
      emit('ready');

    } catch (err: any) {
      console.error('[V86VM] Boot failed', err);
      onStatus('error'); this.setStatus('error');
    }
  }

  public setTerminalSize(cols?: number, rows?: number) {
    if (!this.emulator || !this.isInteractiveMode) return;
    const c = cols ?? this.xterm.cols, r = rows ?? this.xterm.rows;
    const cmd = ` stty -echo; stty cols ${c} rows ${r}; stty echo\n`;
    for (let i = 0; i < cmd.length; i++) this.emulator.serial0_send(cmd[i]);
  }

  public dispose() {
    this.disposed = true;
    if (this.heartbeatInterval) { clearInterval(this.heartbeatInterval); this.heartbeatInterval = null; }
    if (this.outputFlushTimer) { clearTimeout(this.outputFlushTimer); this.outputFlushTimer = null; }
    if (this.storageListener) { window.removeEventListener('storage', this.storageListener); this.storageListener = null; }
    this.xtermDataListener?.dispose();
    if (this.role === 'master') {
      localStorage.removeItem(K.master(this.projectId));
      localStorage.removeItem(K.status(this.projectId));
      if (this.emulator) this.emulator.stop();
      this.emulator = null;
      this.disposeResolve?.();
    }
  }
}
