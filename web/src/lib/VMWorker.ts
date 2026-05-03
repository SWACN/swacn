/// <reference lib="webworker" />
declare const self: SharedWorkerGlobalScope;

// @ts-ignore
import { V86 } from 'v86';
import wasmURL from 'v86/build/v86.wasm?url';

export type VMStatus =
  | 'initializing'
  | 'booting_kernel'
  | 'downloading_baseline'
  | 'extracting_baseline'
  | 'downloading_tools'
  | 'installing_tools'
  | 'ready'
  | 'error';

// ─── Port Registry ────────────────────────────────────────────────────────────
const connectedPorts = new Set<MessagePort>();

function broadcast(msg: any) {
  for (const port of connectedPorts) {
    try { port.postMessage(msg); } catch (_) { connectedPorts.delete(port); }
  }
}

function broadcastStatus(status: VMStatus) {
  currentStatus = status;
  broadcast({ type: 'STATUS', status });
}

// ─── VM State ─────────────────────────────────────────────────────────────────
let bootStarted = false;
let isInteractiveMode = false;
let currentStatus: VMStatus = 'initializing';
let emulator: any = null;

// ─── Output Batching ─────────────────────────────────────────────────────────
// During boot we buffer silently; after handover we broadcast at ~60fps
let bootOutputBuffer = '';
let pendingBroadcast = '';
let flushTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleFlush() {
  if (!flushTimer) {
    flushTimer = setTimeout(() => {
      if (pendingBroadcast) {
        broadcast({ type: 'OUTPUT', data: pendingBroadcast });
        pendingBroadcast = '';
      }
      flushTimer = null;
    }, 16);
  }
}

// ─── Serial Output Handler ────────────────────────────────────────────────────
let resolveCommand: (() => void) | null = null;
let currentMarker: string | null = null;

const consoleOut = (byte: number) => {
  const char = String.fromCharCode(byte);

  if (isInteractiveMode) {
    pendingBroadcast += char;
    scheduleFlush();
  } else {
    bootOutputBuffer += char;

    if (resolveCommand && currentMarker &&
        bootOutputBuffer.includes(currentMarker) &&
        (bootOutputBuffer.endsWith('# ') || bootOutputBuffer.endsWith('% ') || bootOutputBuffer.endsWith('$ '))) {
      const resolve = resolveCommand;
      resolveCommand = null;
      resolve();
    }

    if (bootOutputBuffer.length > 1024 * 1024) {
      bootOutputBuffer = bootOutputBuffer.substring(bootOutputBuffer.length - 1000);
    }
  }
};

// ─── Asset Fetching ───────────────────────────────────────────────────────────
const fetchPromises = new Map<string, Promise<Uint8Array>>();
let globalWasmModulePromise: Promise<WebAssembly.Module> | null = null;

async function fetchAsset(url: string, useProxy = false): Promise<Uint8Array> {
  if (fetchPromises.has(url)) {
    return new Uint8Array(await fetchPromises.get(url)!);
  }

  const p = (async () => {
    const cacheName = 'swacn-assets-v1';

    const checkCache = async (): Promise<Uint8Array | null> => {
      try {
        const cache = await caches.open(cacheName);
        const hit = await cache.match(url);
        if (hit) return new Uint8Array(await hit.arrayBuffer());
      } catch (_) {}
      return null;
    };

    let cached = await checkCache();
    if (cached) { console.log(`[VMWorker] Cache hit: ${url}`); return cached; }

    const performFetch = async () => {
      const fetchUrl = useProxy ? `/dev-proxy?url=${encodeURIComponent(url)}` : url;
      const res = await fetch(fetchUrl);
      if (!res.ok) throw new Error(`Fetch failed: ${res.status} for ${url}`);
      const buffer = await res.arrayBuffer();
      try {
        const cache = await caches.open(cacheName);
        await cache.put(url, new Response(buffer.slice(0), {
          headers: {
            'Content-Type': res.headers.get('Content-Type') || 'application/octet-stream',
            'Content-Length': buffer.byteLength.toString()
          }
        }));
      } catch (_) {}
      return new Uint8Array(buffer);
    };

    if ('locks' in navigator) {
      return await (navigator as any).locks.request(`swacn_fetch_${url}`, async () => {
        cached = await checkCache();
        return cached ?? await performFetch();
      });
    }
    return await performFetch();
  })();

  fetchPromises.set(url, p);
  try {
    return new Uint8Array(await p);
  } catch (err) {
    fetchPromises.delete(url);
    throw err;
  }
}

// ─── Command Execution ────────────────────────────────────────────────────────
async function execWait(cmd: string): Promise<string> {
  if (!emulator) return '';
  bootOutputBuffer = '';
  const nonce = Math.random().toString(36).substring(2, 10);
  currentMarker = `__SWACN_${nonce}__`;

  return new Promise<string>(async (resolve) => {
    resolveCommand = () => {
      const cleanOutput = bootOutputBuffer
        .split(currentMarker || '')[0]
        .replace(cmd, '')
        .trim();
      currentMarker = null;
      resolve(cleanOutput);
    };
    const fullCmd = `${cmd} ; printf "${currentMarker}"\n`;
    for (let i = 0; i < fullCmd.length; i++) {
      emulator?.serial0_send(fullCmd[i]);
      if (i > 0 && i % 64 === 0) await new Promise(r => setTimeout(r, 1));
    }
  });
}

// ─── Boot Sequence ────────────────────────────────────────────────────────────
async function boot(manifestUrl: string | null, baselineUrl: string | null) {
  try {
    broadcastStatus('initializing');

    const osFetchPromise = Promise.all([
      fetchAsset('/v86-assets/v86/bios/seabios.bin'),
      fetchAsset('/v86-assets/v86/bios/vgabios.bin'),
      fetchAsset('/i-copy-sh/buildroot-bzimage.bin'),
    ]);

    let manifestPromise: Promise<any> | null = null;
    let baselinePromise: Promise<Uint8Array> | null = null;

    if (manifestUrl) {
      manifestPromise = fetchAsset(manifestUrl).then(data => {
        const m = JSON.parse(new TextDecoder().decode(data));
        broadcast({ type: 'MANIFEST', manifest: m });
        return m;
      });
      if (baselineUrl) {
        baselinePromise = fetchAsset(baselineUrl);
      }
    }

    broadcastStatus('booting_kernel');

    const [biosData, vgabiosData, bzimageData] = await osFetchPromise;

    emulator = new V86({
      wasm_fn: async (imports: any) => {
        if (!globalWasmModulePromise) {
          globalWasmModulePromise = WebAssembly.compileStreaming(fetch(wasmURL)).catch(async () => {
            const res = await fetch(wasmURL);
            return WebAssembly.compile(await res.arrayBuffer());
          });
        }
        const module = await globalWasmModulePromise;
        return (await WebAssembly.instantiate(module, imports)).exports;
      },
      memory_size: 256 * 1024 * 1024,
      vga_memory_size: 8 * 1024 * 1024,
      bios: { buffer: biosData.buffer as ArrayBuffer },
      vga_bios: { buffer: vgabiosData.buffer as ArrayBuffer },
      bzimage: { buffer: bzimageData.buffer as ArrayBuffer },
      filesystem: {},
      cmdline: 'tsc=reliable mitigations=off random.trust_cpu=on rw init=/bin/sh root=/dev/root rootfstype=ext2 console=ttyS0',
      autostart: true,
      disable_keyboard: true,
      disable_mouse: true,
      disable_speaker: true,
    });

    emulator.add_listener('serial0-output-byte', consoleOut);

    // Wait for shell prompt
    await new Promise<void>((resolve) => {
      const interval = setInterval(() => {
        if (bootOutputBuffer.includes('Welcome to Buildroot') || bootOutputBuffer.endsWith('# ') || bootOutputBuffer.endsWith('% ')) {
          clearInterval(interval);
          resolve();
        }
      }, 500);
    });

    await new Promise(r => setTimeout(r, 1000));

    await execWait('stty -echo');
    await execWait('mkdir -p /home/swacn && cd /home/swacn');
    const mountOut = await execWait('mountpoint -q /mnt || mount -t 9p -o trans=virtio host9p /mnt/');
    if (mountOut) console.log('[VMWorker] mount output:', mountOut);

    let manifestEnv: Record<string, string> = {};

    if (manifestPromise) {
      const manifest = await manifestPromise;
      manifestEnv = manifest.env ?? manifest.environment?.env ?? {};

      if (manifest.baseline && baselinePromise) {
        broadcastStatus('downloading_baseline');
        try {
          const baselineData = await baselinePromise;
          broadcastStatus('extracting_baseline');
          emulator?.create_file('baseline.tar.gz', baselineData);
          const tarOut = await execWait('zcat /mnt/baseline.tar.gz | tar -xf - -C /home/swacn');
          console.log('[VMWorker] tar output:', tarOut);
          await execWait('rm /mnt/baseline.tar.gz');
        } catch (err) {
          console.error('[VMWorker] Failed to apply baseline', err);
        }
      }

      const binariesList = manifest.binaries?.x86_32 ?? manifest.environment?.binaries?.x86_32 ??
                           manifest.binaries?.i386 ?? manifest.environment?.binaries?.i386 ??
                           manifest.binaries?.x86_64 ?? manifest.environment?.binaries?.x86_64 ?? [];

      if (binariesList.length > 0) {
        broadcastStatus('downloading_tools');
        try {
          const downloadPromises = binariesList.map(async (tool: any) => {
            const data = await fetchAsset(tool.url, true);
            return { tool, data };
          });
          const results = await Promise.all(downloadPromises);

          broadcastStatus('installing_tools');
          for (const { tool, data } of results) {
            const filename = tool.url.split('/').pop() || 'tool';
            let installPath = tool.install_path || '/usr/bin';
            if (!installPath.endsWith(tool.name)) {
              installPath = installPath.endsWith('/')
                ? `${installPath}${tool.name}`
                : `${installPath}/${tool.name}`;
            }
            emulator?.create_file(filename, data);
            await execWait(`mkdir -p ${installPath.substring(0, installPath.lastIndexOf('/'))}`);
            await execWait(`cp /mnt/${filename} ${installPath}`);
            await execWait(`chmod +x ${installPath}`);
            await execWait(`rm /mnt/${filename}`);
          }
        } catch (err) {
          console.error('[VMWorker] Failed to install tools', err);
        }
      }
    }

    // ─── Handover ─────────────────────────────────────────────────────────────
    const welcomeContent = manifestUrl
      ? await execWait('cat welcome.txt 2>/dev/null')
      : null;

    if (Object.keys(manifestEnv).length > 0) {
      await execWait('mkdir -p /etc/profile.d && rm -f /etc/profile.d/swacn.sh');
      for (const [key, value] of Object.entries(manifestEnv)) {
        await execWait(`echo 'export ${key}="${value}"' >> /etc/profile.d/swacn.sh`);
      }
      await execWait('. /etc/profile.d/swacn.sh');
    }

    await execWait("export PS1='swacn@sandbox:~$ '");
    await execWait('stty cols 80 rows 24');
    await execWait('stty echo');

    // Drain in-flight bytes
    await new Promise(r => setTimeout(r, 300));

    const PROMPT = 'swacn@sandbox:~$ ';
    const initialOutput = (welcomeContent && welcomeContent.trim().length > 0)
      ? welcomeContent.trim() + '\r\n\r\n' + PROMPT
      : PROMPT;

    // Tell all clients: clear terminal, write initial output, switch to interactive
    broadcast({ type: 'CLEAR' });
    broadcast({ type: 'OUTPUT', data: initialOutput });

    isInteractiveMode = true;
    broadcastStatus('ready');
    broadcast({ type: 'READY' });

  } catch (err: any) {
    console.error('[VMWorker] Boot failed:', err);
    broadcastStatus('error');
  }
}

// ─── SharedWorker Connect Handler ─────────────────────────────────────────────
self.addEventListener('connect', (e: MessageEvent) => {
  const port = e.ports[0];
  connectedPorts.add(port);

  // Immediately send current state to newly connected port
  port.postMessage({ type: 'STATUS', status: currentStatus });
  if (isInteractiveMode) {
    // Late joiner: send a fresh prompt so their terminal isn't blank
    port.postMessage({ type: 'OUTPUT', data: 'swacn@sandbox:~$ ' });
    port.postMessage({ type: 'READY' });
  }

  port.addEventListener('message', (event: MessageEvent) => {
    const { type } = event.data;

    if (type === 'BOOT') {
      if (!bootStarted) {
        bootStarted = true;
        boot(event.data.manifestUrl, event.data.baselineUrl);
      }
      // If already booting/booted, the port already received the current STATUS above.
    } else if (type === 'INPUT') {
      if (emulator && isInteractiveMode) {
        const data: string = event.data.data;
        for (let i = 0; i < data.length; i++) {
          emulator.serial0_send(data[i]);
        }
      }
    } else if (type === 'DISCONNECT') {
      connectedPorts.delete(port);
      port.close();
    }
  });

  port.start();
});
