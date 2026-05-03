// V86SharedWorker — runs V86 in a dedicated SharedWorker thread.
// SharedWorker threads are NOT subject to cross-origin iframe CPU throttling
// (Chrome's Site Isolation / FrameScheduler policies).
// All embeds of the same project connect to ONE worker instance.
// @ts-nocheck

import { V86 } from 'v86';

// ── Storage keys (mirrored from V86VM.ts) ──────────────────────────────────
const K = {
  status:  (id) => `swacn_vm_status_${id}`,
  output:  (id) => `swacn_vm_output_${id}`,
};

// ── Per-project VM state ────────────────────────────────────────────────────
const vms = new Map(); // projectId → VMState

function getVM(projectId) {
  if (!vms.has(projectId)) {
    vms.set(projectId, {
      emulator: null,
      ports: [],           // connected MessagePorts
      booted: false,
      bootPromise: null,
      outputSeq: 0,
      pendingOutput: '',
      outputTimer: null,
    });
  }
  return vms.get(projectId);
}

// ── Worker entry point ──────────────────────────────────────────────────────
self.addEventListener('connect', (e) => {
  const port = e.ports[0];
  port.start();
  port.addEventListener('message', (msg) => handlePortMessage(port, msg.data));
});

function broadcast(vm, msg) {
  for (const p of vm.ports) { try { p.postMessage(msg); } catch (_) {} }
}

function setStatus(projectId, status) {
  // Post to all ports AND write localStorage (for cross-iframe client sync)
  const vm = getVM(projectId);
  broadcast(vm, { type: 'STATUS', status });
  try { localStorage.setItem(K.status(projectId), JSON.stringify({ status })); } catch (_) {}
}

function flushOutput(projectId) {
  const vm = getVM(projectId);
  if (!vm.pendingOutput) return;
  const msg = { type: 'OUTPUT', seq: vm.outputSeq++, data: vm.pendingOutput };
  vm.pendingOutput = '';
  broadcast(vm, msg);
  try { localStorage.setItem(K.output(projectId), JSON.stringify(msg)); } catch (_) {}
}

// ── Main message handler ────────────────────────────────────────────────────
function handlePortMessage(port, data) {
  const { type, projectId } = data;
  const vm = getVM(projectId);

  if (type === 'CONNECT') {
    vm.ports.push(port);
    // Send current status if already booting/booted
    const stored = (() => { try { return JSON.parse(localStorage.getItem(K.status(projectId)) || '{}'); } catch(_) { return {}; } })();
    if (stored.status) port.postMessage({ type: 'STATUS', status: stored.status });
    return;
  }

  if (type === 'DISCONNECT') {
    vm.ports = vm.ports.filter(p => p !== port);
    return;
  }

  if (type === 'BOOT') {
    if (vm.bootPromise) return; // already booting
    vm.bootPromise = runBoot(projectId, data).catch(err => {
      console.error('[V86Worker] boot error', err);
      setStatus(projectId, 'error');
    });
    return;
  }

  if (type === 'INPUT' && vm.emulator && vm.booted) {
    const { inputData } = data;
    for (let i = 0; i < inputData.length; i++) vm.emulator.serial0_send(inputData[i]);
    return;
  }

  if (type === 'RESIZE' && vm.emulator && vm.booted) {
    const cmd = ` stty -echo; stty cols ${data.cols} rows ${data.rows}; stty echo\n`;
    for (let i = 0; i < cmd.length; i++) vm.emulator.serial0_send(cmd[i]);
    return;
  }
}

// ── Boot sequence ───────────────────────────────────────────────────────────
async function runBoot(projectId, bootData) {
  const { wasmURL, biosURL, vgabiosURL, bzimageURL, manifestUrl, baselineUrl, manifestData, baselineData } = bootData;
  const vm = getVM(projectId);

  setStatus(projectId, 'initializing');

  // Compile WASM (no COEP restrictions in Worker)
  const biosBytes    = new Uint8Array(biosData);
  const vgabiosBytes = new Uint8Array(vgabiosData);
  const bzimageBytes = new Uint8Array(bzimageData);

  const module = await WebAssembly.compile(new Uint8Array(bootData.wasmBytes));

  setStatus(projectId, 'booting_kernel');

  let outputBuffer = '';
  let resolveCommand = null;
  let currentMarker = null;
  let isInteractive = false;

  vm.emulator = new V86({
    wasm_fn: async (imports) => (await WebAssembly.instantiate(module, imports)).exports,
    memory_size: 256 * 1024 * 1024,
    vga_memory_size: 8 * 1024 * 1024,
    bios: { buffer: biosBytes.buffer },
    vga_bios: { buffer: vgabiosBytes.buffer },
    bzimage: { buffer: bzimageBytes.buffer },
    filesystem: {},
    cmdline: 'tsc=reliable mitigations=off random.trust_cpu=on rw init=/bin/sh root=/dev/root rootfstype=ext2 console=ttyS0',
    autostart: true,
    disable_keyboard: true, disable_mouse: true, disable_speaker: true,
  });

  vm.emulator.add_listener('serial0-output-byte', (byte) => {
    const char = String.fromCharCode(byte);
    if (isInteractive) {
      vm.pendingOutput += char;
      if (!vm.outputTimer) {
        vm.outputTimer = setTimeout(() => {
          flushOutput(projectId);
          vm.outputTimer = null;
        }, 16);
      }
    } else {
      outputBuffer += char;
      if (resolveCommand && currentMarker &&
          outputBuffer.includes(currentMarker) &&
          (outputBuffer.endsWith('# ') || outputBuffer.endsWith('% ') || outputBuffer.endsWith('$ '))) {
        const r = resolveCommand; resolveCommand = null; r();
      }
      if (outputBuffer.length > 1024 * 1024)
        outputBuffer = outputBuffer.substring(outputBuffer.length - 1000);
    }
  });

  // Wait for boot prompt
  await new Promise(resolve => {
    const mc = new MessageChannel();
    const tick = () => {
      if (outputBuffer.includes('Welcome to Buildroot') ||
          outputBuffer.endsWith('# ') || outputBuffer.endsWith('% '))
        { resolve(); return; }
      setTimeout(() => mc.port1.postMessage(null), 50);
    };
    mc.port2.onmessage = tick;
    mc.port1.postMessage(null);
  });

  const execWait = (cmd) => new Promise(resolve => {
    const nonce = Math.random().toString(36).substring(2, 10);
    currentMarker = `__SWACN_${nonce}__`;
    outputBuffer = '';
    resolveCommand = () => {
      const out = outputBuffer.split(currentMarker)[0].replace(cmd, '').trim();
      currentMarker = null; resolve(out);
    };
    const full = `${cmd} ; printf "${currentMarker}"\n`;
    for (let i = 0; i < full.length; i++) vm.emulator.serial0_send(full[i]);
  });

  await new Promise(r => setTimeout(r, 300));
  await execWait('stty -echo; mkdir -p /home/swacn; cd /home/swacn; mountpoint -q /mnt || mount -t 9p -o trans=virtio host9p /mnt/');

  // Baseline
  if (bootData.baselineBytes && bootData.baselineBytes.byteLength > 0) {
    setStatus(projectId, 'downloading_baseline');
    vm.emulator.create_file('baseline.tar.gz', new Uint8Array(bootData.baselineBytes));
    setStatus(projectId, 'extracting_baseline');
    await execWait('zcat /mnt/baseline.tar.gz | tar -xf - -C /home/swacn; rm /mnt/baseline.tar.gz');
  }

  // Tools
  if (bootData.tools && bootData.tools.length > 0) {
    setStatus(projectId, 'downloading_tools');
    // Tools are pre-fetched by V86VM.ts and sent as ArrayBuffers
    setStatus(projectId, 'installing_tools');
    for (const { name, installPath, bytes } of bootData.tools) {
      vm.emulator.create_file(name, new Uint8Array(bytes));
      const dir = installPath.substring(0, installPath.lastIndexOf('/'));
      await execWait(`mkdir -p ${dir}; cp /mnt/${name} ${installPath}; chmod +x ${installPath}; rm /mnt/${name}`);
    }
  }

  // Env + final setup
  const envSetup = bootData.envVars && Object.keys(bootData.envVars).length > 0
    ? `mkdir -p /etc/profile.d; printf '${Object.entries(bootData.envVars).map(([k,v]) => `export ${k}="${v}"`).join('\\n')}\\n' > /etc/profile.d/swacn.sh; . /etc/profile.d/swacn.sh; `
    : '';
  await execWait(`${envSetup}export PS1='swacn@sandbox:~$ '; stty cols 80 rows 24; stty echo`);

  const PROMPT = 'swacn@sandbox:~$ ';
  isInteractive = true;
  vm.booted = true;

  // Tell all connected ports the VM is ready
  broadcast(vm, { type: 'CLEAR' });
  broadcast(vm, { type: 'READY', data: PROMPT });
  setStatus(projectId, 'ready');
}
