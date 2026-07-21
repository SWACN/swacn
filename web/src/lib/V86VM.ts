import { Terminal } from '@xterm/xterm';
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
  prompt:  (id: string) => `swacn_vm_prompt_${id}`,  // persists initial prompt for late joiners
};

// ---------------------------------------------------------------------------
// fetchAssetWithCache — exported for Lab.tsx recording fetch
// ---------------------------------------------------------------------------
const fetchPromises = new Map<string, Promise<Uint8Array>>();

export function clearAssetCache(urlPrefix?: string) {
  if (!urlPrefix) {
    fetchPromises.clear();
  } else {
    for (const key of fetchPromises.keys()) {
      if (key.includes(urlPrefix)) {
        fetchPromises.delete(key);
      }
    }
  }
}

export async function fetchAssetWithCache(url: string, useProxy = true): Promise<Uint8Array> {
  if (fetchPromises.has(url)) return new Uint8Array(await fetchPromises.get(url)!);
  const p = (async () => {
    const cacheName = 'swacn-assets-v1';
    
    interface CachedInfo {
      buffer: Uint8Array;
      etag?: string;
      lastModified?: string;
    }

    const checkCache = async (): Promise<CachedInfo | null> => {
      try {
        if ('caches' in window) {
          const cache = await caches.open(cacheName);
          const hit = await cache.match(url);
          if (hit) {
            return {
              buffer: new Uint8Array(await hit.arrayBuffer()),
              etag: hit.headers.get('ETag') || undefined,
              lastModified: hit.headers.get('Last-Modified') || undefined
            };
          }
        }
      } catch (_) {}
      return null;
    };

    let cachedInfo = await checkCache();

    const performFetch = async (conditionalHeaders: Record<string, string> = {}) => {
      const fetchUrl = useProxy ? `/api/v1/proxy?url=${encodeURIComponent(url)}` : url;
      const res = await fetch(fetchUrl, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache',
          ...conditionalHeaders
        }
      });

      if (res.status === 304 && cachedInfo) {
        console.log(`[V86VM] Cache validated (304 Not Modified): ${url}`);
        return cachedInfo.buffer;
      }

      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(`Fetch failed: ${res.status} ${body}`);
      }

      const buffer = await res.arrayBuffer();
      try {
        if ('caches' in window) {
          const cache = await caches.open(cacheName);
          const headers: Record<string, string> = {
            'Content-Type': res.headers.get('Content-Type') || 'application/octet-stream'
          };
          const etag = res.headers.get('ETag');
          if (etag) headers['ETag'] = etag;
          const lm = res.headers.get('Last-Modified');
          if (lm) headers['Last-Modified'] = lm;

          await cache.put(url, new Response(buffer, { headers }));
        }
      } catch (_) {}
      return new Uint8Array(buffer);
    };

    if (url.includes('/uploads/')) {
      if (cachedInfo) {
        console.log(`[V86VM] Validating cached upload: ${url}`);
        const condHeaders: Record<string, string> = {};
        if (cachedInfo.etag) condHeaders['If-None-Match'] = cachedInfo.etag;
        if (cachedInfo.lastModified) condHeaders['If-Modified-Since'] = cachedInfo.lastModified;

        try {
          if ('locks' in navigator) {
            return await navigator.locks.request(`swacn_fetch_${url}`, async () => {
              return await performFetch(condHeaders);
            });
          }
          return await performFetch(condHeaders);
        } catch (err) {
          console.warn(`[V86VM] Cache validation failed, falling back to cache:`, err);
          return cachedInfo.buffer;
        }
      } else {
        console.log(`[V86VM] Cache miss for upload: ${url}`);
        if ('locks' in navigator) {
          return await navigator.locks.request(`swacn_fetch_${url}`, async () => {
            return await performFetch();
          });
        }
        return await performFetch();
      }
    } else {
      if (cachedInfo) {
        console.log(`[V86VM] Cache hit: ${url}`);
        return cachedInfo.buffer;
      }
      console.log(`[V86VM] Cache miss: ${url}`);
      if ('locks' in navigator) {
        return await navigator.locks.request(`swacn_fetch_${url}`, async () => {
          const c = await checkCache(); return c ? c.buffer : await performFetch();
        });
      }
      return await performFetch();
    }
  })();
  fetchPromises.set(url, p);
  try {
    const result = new Uint8Array(await p);
    fetchPromises.delete(url);
    return result;
  } catch (err) {
    fetchPromises.delete(url);
    throw err;
  }
}

// ---------------------------------------------------------------------------
// MessageChannel-based async helpers — immune to cross-origin iframe throttling
// Chrome throttles setTimeout/setInterval in cross-origin iframes (file:// parent,
// different-origin parent). MessageChannel postMessage fires unthrottled tasks.
// ---------------------------------------------------------------------------
function mcSleep(ms: number): Promise<void> {
  // For > 0ms: use MessageChannel for the first tick, then fall back to
  // native setTimeout for the bulk of the wait (>10ms isn't meaningfully throttled).
  // For 0ms / tiny delays: pure MessageChannel.
  if (ms <= 4) {
    return new Promise(resolve => { const mc = new MessageChannel(); mc.port2.onmessage = () => resolve(); mc.port1.postMessage(null); });
  }
  return new Promise(resolve => setTimeout(resolve, ms));
}

function mcPoll(check: () => boolean, intervalMs: number): Promise<void> {
  // Poll `check()` using MessageChannel ticks rather than setInterval.
  // Each tick posts a message and re-checks on receipt — no throttling.
  return new Promise(resolve => {
    const mc = new MessageChannel();
    const tick = () => {
      if (check()) { resolve(); return; }
      setTimeout(() => mc.port1.postMessage(null), intervalMs);
    };
    mc.port2.onmessage = tick;
    mc.port1.postMessage(null);
  });
}

// ---------------------------------------------------------------------------
// WASM module — compiled once per iframe context from CacheStorage-cached bytes.
// IDB cannot store WebAssembly.Module under COEP:require-corp (DataCloneError).
// ---------------------------------------------------------------------------
let wasmModulePromise: Promise<WebAssembly.Module> | null = null;

async function getWasmModule(): Promise<WebAssembly.Module> {
  if (wasmModulePromise) return wasmModulePromise;
  wasmModulePromise = (async () => {
    const bytes = await fetchAssetWithCache(wasmURL, false);
    console.log('[V86VM] WASM module: compiling from cached bytes...');
    const module = await WebAssembly.compile(bytes.buffer as ArrayBuffer);
    console.log('[V86VM] WASM module: ready');
    return module;
  })();
  return wasmModulePromise;
}

// ---------------------------------------------------------------------------
// Tab-scoped ID — same for all same-origin iframes within one browsing tab,
// different for different tabs. Used to scope master election and the relay
// SharedWorker so each tab elects its OWN master independently.
//
// For same-origin iframes: window.parent is the shared root — we read/write
// __swacnTabId on it. For top-level windows: use the window itself.
// For cross-origin parents: accessing window.parent throws — fall back to a
// per-window ID (each iframe becomes its own mini-master, relay still works).
// ---------------------------------------------------------------------------
function getTabScopeId(): string {
  if (window.self === window.top) {
    // Top-level tab: assign an ID to this window
    if (!(window as any).__swacnTabId) (window as any).__swacnTabId = Math.random().toString(36).slice(2, 10);
    return (window as any).__swacnTabId as string;
  }
  try {
    // Same-origin iframe: derive ID from the parent window.
    // All iframes on the same page share window.parent → same ID → same master.
    const parent: any = window.parent;
    if (!parent.__swacnTabId) parent.__swacnTabId = Math.random().toString(36).slice(2, 10);
    return parent.__swacnTabId as string;
  } catch {
    // Cross-origin parent (file://, different-domain): can't access parent.
    // Return '' so all same-origin cross-origin-embedded iframes share a
    // single GLOBAL master lock for each project (1 VM, not N).
    return '';
  }
}

export class V86VM {
  private xterm: Terminal;
  private projectId: string;
  private disposed = false;
  private role: 'master' | 'client' | null = null;

  // Master state
  private worker: Worker | null = null;
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
  // SharedWorker relay port — low-latency IPC for real-time input/output.
  // Falls back to localStorage-only if SharedWorker is unavailable.
  private relayPort: MessagePort | null = null;

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
    // Yield one microtask tick before requesting the lock.
    // React Strict Mode runs effect → cleanup → effect synchronously.
    // queueMicrotask resolves after the current synchronous block but before
    // any pending tasks — Strict Mode's cleanup (dispose) runs in the same
    // synchronous block, so render #1 will see disposed=true here and exit.
    // Unlike setTimeout(0), this has ~zero actual delay in a busy event loop.
    await new Promise(r => queueMicrotask(r as () => void));
    if (this.disposed) return;

    // Connect to SharedWorker relay for low-latency IPC.
    // Scoped by projectId + tabId so each tab gets its own isolated broadcast group.
    // Different tabs → different SharedWorker instances → no cross-tab interference.
    const tabId = getTabScopeId();
    try {
      const sw = new SharedWorker(
        new URL('./relay-worker.ts', import.meta.url),
        { type: 'module', name: `swacn-relay-${this.projectId}-${tabId}` }
      );
      sw.port.start();
      this.relayPort = sw.port;
    } catch (e) {
      console.warn('[V86VM] SharedWorker unavailable, falling back to localStorage IPC:', e);
    }

    // Scope the master lock to the current tab (tabId) so each tab elects
    // its own master independently — main site tab and embed-test.html tab
    // don't compete and don't relay input/output across tabs.
    navigator.locks.request(`swacn-vm-master-${this.projectId}-${tabId}`, { ifAvailable: true }, async (lock) => {
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
       K.output(this.projectId), K.input(this.projectId),
       K.prompt(this.projectId)].forEach(k => localStorage.removeItem(k));
      localStorage.setItem(K.master(this.projectId), 'alive');

      await this.runAsMaster(manifestUrl, baselineUrl, onStatus, onManifest, tabId);
      if (!this.disposed) {
        await new Promise<void>(res => { this.disposeResolve = res; });
      }
      // Lock released when this callback returns
    });
  }

  // ── CLIENT ────────────────────────────────────────────────────────────────

  private runAsClient(onStatus: (s: VMStatus) => void) {
    console.log('[V86VM] Running as client');

    // ── Real-time relay via SharedWorker (fast, ~0.1ms latency) ──────────────
    if (this.relayPort) {
      // Send keyboard input directly to master via relay
      this.xtermDataListener = this.xterm.onData(d =>
        this.relayPort!.postMessage({ type: 'INPUT', data: d }));

      // Receive output + status from master via relay
      this.relayPort.onmessage = (e) => {
        if (this.disposed) return;
        const msg = e.data;
        if (msg.type === 'STATUS') { onStatus(msg.status); }
        else if (msg.type === 'CLEAR') { this.xterm.clear(); }
        else if (msg.type === 'READY') {
          if (msg.data) this.xterm.write(msg.data);
          onStatus('ready');
        } else if (msg.type === 'DATA') { this.xterm.write(msg.data); }
      };
    } else {
      // ── Fallback: localStorage IPC (SharedWorker unavailable) ──────────────
      this.xtermDataListener = this.xterm.onData(d =>
        localStorage.setItem(K.input(this.projectId), JSON.stringify({ seq: Date.now(), data: d })));

      const lsListener = (e: StorageEvent) => {
        if (this.disposed) return;
        if (e.key === K.output(this.projectId) && e.newValue) {
          try {
            const msg = JSON.parse(e.newValue);
            if (msg.type === 'clear') { this.xterm.clear(); }
            else if (msg.type === 'ready') { if (msg.data) this.xterm.write(msg.data); onStatus('ready'); }
            else if (msg.type === 'data') { this.xterm.write(msg.data); }
          } catch (_) {}
        }
      };
      this.storageListener = lsListener;
      window.addEventListener('storage', lsListener);
    }

    // ── Late-join: apply state from localStorage if master already booted ─────
    // (Works for both relay and fallback paths — relay has no stored state)
    const masterAlive = localStorage.getItem(K.master(this.projectId)) === 'alive';
    if (masterAlive) {
      const stored = localStorage.getItem(K.status(this.projectId));
      if (stored) {
        try {
          const { status } = JSON.parse(stored);
          onStatus(status);
          if (status === 'ready') {
            const p = localStorage.getItem(K.prompt(this.projectId));
            if (p) { const { data } = JSON.parse(p); this.xterm.clear(); if (data) this.xterm.write(data); }
          }
        } catch (_) {}
      }
    }

    // ── Status updates via localStorage (persisted for late joiners) ──────────
    const statusListener = (e: StorageEvent) => {
      if (this.disposed || e.key !== K.status(this.projectId) || !e.newValue) return;
      try { onStatus(JSON.parse(e.newValue).status); } catch (_) {}
    };
    this.storageListener = statusListener;
    window.addEventListener('storage', statusListener);
  } // end runAsClient

  // ── MASTER ────────────────────────────────────────────────────────────────

  private setStatus(status: VMStatus) {
    if (this.disposed) return;
    this.currentStatus = status;
    // Write to localStorage for late-joiner persistence
    localStorage.setItem(K.status(this.projectId), JSON.stringify({ status }));
    // Broadcast to live clients via relay (fast)
    this.relayPort?.postMessage({ type: 'STATUS', status });
  }

  private broadcastOutput(msg: Record<string, unknown>) {
    if (this.disposed) return;
    // Relay port: primary fast path
    this.relayPort?.postMessage({ ...msg, seq: this.outputSeq });
    // localStorage: fallback for clients without relay (and late-join)
    if (!this.relayPort) {
      localStorage.setItem(K.output(this.projectId), JSON.stringify({ seq: this.outputSeq, ...msg }));
    }
    this.outputSeq++;
  }

  private consoleOut = (chunk: string) => {
    if (this.disposed) return;
    if (this.isInteractiveMode) {
      this.xterm.write(chunk);
      // Batch output — flush every 16ms
      this.pendingOutput += chunk;
      if (!this.outputFlushTimer) {
        // 4ms flush via MessageChannel — much faster than 16ms setTimeout
        this.outputFlushTimer = setTimeout(() => {
          if (this.pendingOutput) this.broadcastOutput({ type: 'DATA', data: this.pendingOutput });
          this.pendingOutput = '';
          this.outputFlushTimer = null;
        }, 4);
      }
    } else {
      console.log('[V86VM] Received chunk from worker:', chunk);
      this.outputBuffer += chunk;
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
    if (!this.worker || this.disposed) return '';
    this.outputBuffer = '';
    const nonce = Math.random().toString(36).substring(2, 10);
    const startMarker = `__S${nonce}__`;
    const endMarker = `__E${nonce}__`;
    this.currentMarker = endMarker;
    return new Promise<string>(async resolve => {
      this.resolveCommand = () => {
        const parts = this.outputBuffer.split(startMarker);
        if (parts.length < 2) { 
          this.currentMarker = null; resolve(''); return; 
        }
        const out = parts[1].split(endMarker)[0].trim();
        this.currentMarker = null; resolve(out);
      };
      const full = `printf "${startMarker}"; ${cmd}; printf "${endMarker}"\n`;
      for (let i = 0; i < full.length; i += 64) {
        if (this.disposed) { resolve(''); return; }
        const chunk = full.substring(i, i + 64);
        this.worker?.postMessage({ type: 'SERIAL_SEND', payload: { data: chunk } });
        await mcSleep(0);
      }
    });
  }

  private async runAsMaster(
    manifestUrl: string | null, baselineUrl: string | null,
    onStatus: (s: VMStatus) => void, onManifest: ((m: any) => void) | undefined,
    tabId: string
  ) {
    console.log('[V86VM] Running as master');

    const handleClientInput = (data: string) => {
      if (this.disposed || !this.isInteractiveMode) return;
      this.worker?.postMessage({ type: 'SERIAL_SEND', payload: { data } });
    };

    // Primary: relay port (fast, ~0.1ms)
    if (this.relayPort) {
      this.relayPort.onmessage = (e) => {
        if (this.disposed) return;
        if (e.data?.type === 'INPUT') handleClientInput(e.data.data);
        else if (e.data?.type === 'RESIZE') this.setTerminalSize(e.data.cols, e.data.rows);
      };
    }
    // Fallback: localStorage storage events (for clients without relay)
    const inputListener = (e: StorageEvent) => {
      if (this.disposed || e.key !== K.input(this.projectId) || !e.newValue) return;
      try { const { data } = JSON.parse(e.newValue); handleClientInput(data); } catch (_) {}
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
      let baselinePromise: Promise<Uint8Array | null> | null = null;
      if (manifestUrl) {
        manifestPromise = fetchAssetWithCache(manifestUrl, false).then(data => {
          const m = JSON.parse(new TextDecoder().decode(data));
          if (onManifest) onManifest(m); return m;
        });
        if (baselineUrl) {
          baselinePromise = fetchAssetWithCache(baselineUrl, false).catch(err => {
            console.warn('[V86VM] baseline.tar.gz not found or failed to load. Proceeding with fresh boot.', err);
            return null; 
          });
        }
      }

      emit('booting_kernel');
      const [biosData, vgabiosData, bzimageData] = await osFetchPromise;
      if (this.disposed) return;


      const wasmModule = await getWasmModule();

      this.worker = new Worker(new URL('./v86-worker.ts', import.meta.url), { type: 'module' });
      this.worker.onmessage = (e) => {
        if (e.data.type === 'OUTPUT_STR') {
          this.consoleOut(e.data.data);
        } else if (e.data.type === 'ERROR') {
          console.error('[V86VM] Worker reported error:', e.data.data);
          emit('error');
        }
      };

      this.worker.postMessage({
        type: 'INIT',
        payload: { 
          bios: biosData, vgabios: vgabiosData, bzimage: bzimageData, wasmModule,
          projectId: this.projectId, tabId
        }
      });


      await mcPoll(() =>
        this.disposed ||
        this.outputBuffer.includes('Welcome to Buildroot') ||
        this.outputBuffer.endsWith('# ') ||
        this.outputBuffer.endsWith('% '), 50);
      if (this.disposed) return;

      // ── Initial setup: disable echo first to avoid command echoing into markers ──
      this.worker?.postMessage({ type: 'SERIAL_SEND', payload: { data: 'stty -echo\n' } });
      await mcSleep(200);

      await this.execWait(
        'mkdir -p /home/swacn; cd /home/swacn; ' +
        'mountpoint -q /mnt || mount -t 9p -o trans=virtio host9p /mnt/ 2>/dev/null || mount | grep -q "/mnt" || true; ' +
        '(while true; do if [ -f /mnt/winsize ]; then stty $(cat /mnt/winsize) < /dev/ttyS0 2>/dev/null; rm /mnt/winsize; fi; sleep 0.5; done &) '
      );

      let manifestEnv: Record<string, string> = {};
      if (manifestPromise) {
        const manifest = await manifestPromise;
        manifestEnv = manifest.env ?? manifest.environment?.env ?? {};

        if (manifest.baseline && baselinePromise) {
          emit('downloading_baseline');
          try {
            const bd = await baselinePromise;
            if (!bd) throw new Error("Baseline data is null");
            emit('extracting_baseline');
            this.worker?.postMessage({ type: 'CREATE_FILE', payload: { name: 'baseline.tar.gz', data: bd } });
            // Combine extract + cleanup into one round-trip. 
            // We use a small loop to wait for the file to appear in the 9p mount (dynamic update might have a tiny delay).
            await this.execWait('for i in $(seq 1 20); do if [ -f /mnt/baseline.tar.gz ]; then break; fi; sleep 0.1; done; gunzip -c /mnt/baseline.tar.gz | tar -xf - -C /home/swacn; rm /mnt/baseline.tar.gz');
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
              const dir = ip.substring(0, ip.lastIndexOf('/'));
              this.worker?.postMessage({ type: 'CREATE_FILE', payload: { name: fn, data } });
              
              // Wait for file to appear, then extract/copy
              const isTarGz = fn.endsWith('.tar.gz') || fn.endsWith('.tgz');
              const isGz = fn.endsWith('.gz') && !isTarGz;
              
              let installCmd = `for i in $(seq 1 20); do if [ -f /mnt/${fn} ]; then break; fi; sleep 0.1; done; mkdir -p ${dir}; `;
              if (isTarGz) {
                // For tarballs, we extract to root and then ensure the binary is at the expected path
                // Using gunzip pipe because the VM's BusyBox tar doesn't support -z
                installCmd += `gunzip -c /mnt/${fn} | tar -C / -xf -; [ -f ${ip} ] || find / -name ${tool.name} -type f -exec cp {} ${ip} \\; 2>/dev/null; `;
              } else if (isGz) {
                installCmd += `gunzip -c /mnt/${fn} > ${ip}; `;
              } else {
                installCmd += `cp /mnt/${fn} ${ip}; `;
              }
              installCmd += `chmod +x ${ip} 2>/dev/null || true; rm -f /mnt/${fn}`;
              
              await this.execWait(installCmd);
            }
          } catch (err) { console.error('[V86VM] tools failed', err); }
        }
      }

      const welcome = manifestUrl ? await this.execWait('cat welcome.txt 2>/dev/null') : null;
      const initOutput = manifestUrl ? await this.execWait('sh init.sh 2>/dev/null') : null;

      // ── Batch env vars + PS1 + stty into ONE round-trip ──────────────────
      const envSetup = Object.entries(manifestEnv).length > 0
        ? `mkdir -p /etc/profile.d; printf '${
            Object.entries(manifestEnv).map(([k, v]) => `export ${k}="${v}"`).join('\\n')
          }\\n' > /etc/profile.d/swacn.sh; . /etc/profile.d/swacn.sh; `
        : '';
      await this.execWait(
        `${envSetup}export PS1='swacn@sandbox:~$ '; stty cols ${this.xterm.cols} rows ${this.xterm.rows}; stty echo`
      );
      await mcSleep(100);


      if (this.heartbeatInterval) { clearInterval(this.heartbeatInterval); this.heartbeatInterval = null; }

      this.xterm.clear();
      const PROMPT = 'swacn@sandbox:~$ ';
      
      let initial = '';
      if (welcome?.trim()) {
        initial += welcome.trim();
      }
      if (initOutput?.trim()) {
        if (initial) initial += '\r\n\r\n';
        initial += initOutput.trim();
      }
      if (initial) {
        initial += '\r\n\r\n';
      }
      initial += PROMPT;
      
      this.xterm.write(initial);

      this.isInteractiveMode = true;
      this.xtermDataListener = this.xterm.onData(data => {
        if (!this.isInteractiveMode || !this.worker) return;
        this.worker.postMessage({ type: 'SERIAL_SEND', payload: { data } });
      });

      // Tell clients: clear, write initial output, mark ready
      this.broadcastOutput({ type: 'CLEAR' });
      this.broadcastOutput({ type: 'READY', data: initial });
      // Persist prompt for late-joining clients (those that connect after boot completes)
      localStorage.setItem(K.prompt(this.projectId), JSON.stringify({ data: initial }));
      emit('ready');

    } catch (err: any) {
      console.error('[V86VM] Boot failed', err);
      onStatus('error'); this.setStatus('error');
    }
  }

  public setTerminalSize(cols?: number, rows?: number) {
    if (this.role === 'client' && this.relayPort) {
      this.relayPort.postMessage({ type: 'RESIZE', cols, rows });
      return;
    }
    if (!this.worker || !this.isInteractiveMode) return;
    const c = cols ?? this.xterm.cols, r = rows ?? this.xterm.rows;

    // Use a side-channel via the 9p filesystem to set terminal size.
    // This avoids injecting 'stty' commands into the user's serial input stream,
    // which previously corrupted the shell's line buffer and broke backspace.
    const data = new TextEncoder().encode(`cols ${c} rows ${r}`);
    this.worker.postMessage({ type: 'CREATE_FILE', payload: { name: 'winsize', data } });
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
      if (this.worker) {
        this.worker.postMessage({ type: 'STOP' });
        this.worker.terminate();
      }
      this.worker = null;
      this.disposeResolve?.();
    }
  }
}
