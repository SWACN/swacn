if (typeof globalThis.setImmediate === 'undefined') {
  const mc = new MessageChannel();
  const queue: any[] = [];
  mc.port2.onmessage = () => {
    const cb = queue.shift();
    if (cb) cb();
  };
  (globalThis as any).setImmediate = (cb: any, ...args: any[]) => {
    queue.push(() => cb(...args));
    mc.port1.postMessage(null);
  };
}

let emulator: any = null;
let pendingOutput = '';
let outputFlushTimer: any = null;

function scheduleFlush() {
  if (!outputFlushTimer) {
    outputFlushTimer = setTimeout(() => {
      if (pendingOutput) {
        self.postMessage({ type: 'OUTPUT_STR', data: pendingOutput });
        pendingOutput = '';
      }
      outputFlushTimer = null;
    }, 4);
  }
}

self.onmessage = async (e: MessageEvent) => {
  const { type, payload } = e.data;
  console.log('[v86-worker] Received message:', type);

  if (type === 'INIT') {
    console.log('[v86-worker] Initializing V86...');
    const { bios, vgabios, bzimage, wasmModule, projectId, tabId } = payload;
    try {
      const { V86 } = await import('v86');

      emulator = new V86({
        wasm_fn: async (imports: any) => {
          const instance = await WebAssembly.instantiate(wasmModule as WebAssembly.Module, imports);
          return instance.exports;
        },
        memory_size: 256 * 1024 * 1024,
        vga_memory_size: 8 * 1024 * 1024,
        bios: { buffer: bios.buffer },
        vga_bios: { buffer: vgabios.buffer },
        bzimage: { buffer: bzimage.buffer },
        filesystem: {},
        cmdline: 'tsc=reliable mitigations=off random.trust_cpu=on rw init=/bin/sh root=/dev/root rootfstype=ext2 console=ttyS0',
        autostart: true,
        disable_keyboard: true,
        disable_mouse: true,
        disable_speaker: true,
      });

      emulator.add_listener('serial0-output-byte', (byte: number) => {
        pendingOutput += String.fromCharCode(byte);
        scheduleFlush();
      });
      
      console.log('[v86-worker] V86 initialized successfully');
    } catch (err: any) {
      console.error('[v86-worker] Critical initialization error:', err);
      self.postMessage({ type: 'ERROR', data: err.message || 'Unknown V86 error' });
    }
  } else if (type === 'SERIAL_SEND') {
    const { data } = payload;
    if (emulator) {
      for (let i = 0; i < data.length; i++) {
        emulator.serial0_send(data[i]);
      }
    }
  } else if (type === 'CREATE_FILE') {
    const { name, data } = payload;
    if (emulator) {
      emulator.create_file(name, data);
    }
  } else if (type === 'STOP') {
    if (emulator) {
      emulator.stop();
      emulator = null;
    }
  }
};
