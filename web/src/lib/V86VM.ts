import { Terminal } from '@xterm/xterm';
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

export class V86VM {
  private xterm: Terminal;
  private emulator: any = null;
  private dataListener: { dispose: () => void } | null = null;
  
  private outputBuffer = "";
  private resolveCommand: (() => void) | null = null;
  private currentMarker: string | null = null;
  private isInteractiveMode = false;
  private abortController: AbortController | null = null;
  private hasPrompt = false;
  private hasBooted = false;

  constructor(xterm: Terminal) {
    this.xterm = xterm;
  }

  private consoleOut = (byte: number) => {
    const char = String.fromCharCode(byte);
    
    if (this.isInteractiveMode) {
      this.xterm.write(char);
    } else {
      this.outputBuffer += char;

      // When checking for the marker, also wait for the root prompt (# or % or $) to ensure command finished
      if (this.currentMarker && this.outputBuffer.includes(this.currentMarker) && (this.outputBuffer.endsWith('# ') || this.outputBuffer.endsWith('% ') || this.outputBuffer.endsWith('$ '))) {
        if (this.resolveCommand) {
          this.resolveCommand();
          this.resolveCommand = null;
        }
      }

      if (this.outputBuffer.length > 1024 * 1024) {
        this.outputBuffer = this.outputBuffer.substring(this.outputBuffer.length - 1000);
      }
    }
  };

  private async execWait(cmd: string): Promise<string> {
    if (!this.emulator) return "";
    this.outputBuffer = "";
    
    const nonce = Math.random().toString(36).substring(2, 10);
    this.currentMarker = `__SWACN_${nonce}__`;
    
    return new Promise<string>(async (resolve) => {
      this.resolveCommand = () => {
        const cleanOutput = this.outputBuffer
          .split(this.currentMarker || "")[0]
          .replace(cmd, "")
          .trim();
        resolve(cleanOutput);
      };
      
      const fullCmd = `${cmd} ; printf "${this.currentMarker}"\n`;
      for (let i = 0; i < fullCmd.length; i++) {
        this.emulator?.serial0_send(fullCmd[i]);
        // Small delay to prevent buffer overflow in v86 serial port
        if (i > 0 && i % 64 === 0) await new Promise(r => setTimeout(r, 1)); 
      }
    });
  }

  // Uses the browser Cache API and backend proxy to fetch assets efficiently
  private async fetchWithCache(url: string, useProxy: boolean = true): Promise<Uint8Array> {
    const cacheName = 'swacn-assets-v1';
    
    // 1. Try to get from Cache API first
    try {
      if ('caches' in window) {
        const cache = await caches.open(cacheName);
        const cachedResponse = await cache.match(url);
        if (cachedResponse) {
          console.log(`[V86VM] Cache hit: ${url}`);
          const buffer = await cachedResponse.arrayBuffer();
          return new Uint8Array(buffer);
        }
      }
    } catch (e) {
      console.warn("[V86VM] Cache lookup failed:", e);
    }

    console.log(`[V86VM] Cache miss: ${url}`);
    
    // 2. Fetch from network
    const fetchUrl = useProxy ? `/dev-proxy?url=${encodeURIComponent(url)}` : url;
    const res = await fetch(fetchUrl);
    if (!res.ok) {
      throw new Error(`Fetch failed: ${res.status} for ${url}`);
    }
    
    const buffer = await res.arrayBuffer();
    const data = new Uint8Array(buffer);

    // 3. Store in cache for next time
    try {
      if ('caches' in window) {
        const cache = await caches.open(cacheName);
        // We create a fresh response to store in cache
        await cache.put(url, new Response(buffer, {
          headers: {
            'Content-Type': res.headers.get('Content-Type') || 'application/octet-stream',
            'Content-Length': buffer.byteLength.toString()
          }
        }));
      }
    } catch (e) {
      console.warn("[V86VM] Failed to store in cache:", e);
    }

    return data;
  }

  public async boot(
    manifestUrl: string | null, 
    baselineUrl: string | null, 
    onStatus: (status: VMStatus) => void,
    onManifest?: (manifest: any) => void
  ) {
    // Guard against React Strict Mode double-invocation
    if (this.hasBooted) {
      console.warn("[V86VM] Already booted. Dispose first.");
      return;
    }
    this.hasBooted = true;
    this.abortController = new AbortController();
    const signal = this.abortController.signal;
    onStatus('initializing');
    
    console.log("[V86VM] Booting with manifest:", manifestUrl);
    console.log("[V86VM] Cache API available:", ('caches' in window));

    try {
      onStatus('booting_kernel');

      // Boot a lightweight Buildroot Linux via v86
      this.emulator = new V86({
        wasm_path: wasmURL,
        memory_size: 256 * 1024 * 1024,
        vga_memory_size: 8 * 1024 * 1024,
        bios: { url: "/v86-assets/v86/bios/seabios.bin" },
        vga_bios: { url: "/v86-assets/v86/bios/vgabios.bin" },
        bzimage: { url: "/i-copy-sh/buildroot-bzimage.bin" },
        filesystem: {}, // Enable 9p filesystem
        cmdline: "tsc=reliable mitigations=off random.trust_cpu=on rw init=/bin/sh root=/dev/root rootfstype=ext2 console=ttyS0",
        autostart: true,
        disable_keyboard: true,
        disable_mouse: true,
        disable_speaker: true
      });
      (window as any).vm = this;

      this.emulator.add_listener("serial0-output-byte", this.consoleOut);

      // Wait for the boot to finish and prompt to appear
      await new Promise<void>((resolve) => {
        const interval = setInterval(() => {
          if (this.outputBuffer.includes("Welcome to Buildroot") || this.outputBuffer.endsWith("# ") || this.outputBuffer.endsWith("% ")) {
            clearInterval(interval);
            resolve();
          }
        }, 500);
      });

      await new Promise(r => setTimeout(r, 1000));
      
      // 1. Silent Mode Initialization
      await this.execWait("stty -echo");
      await this.execWait("mkdir -p /home/swacn && cd /home/swacn");
      // Mount the 9p share if not already auto-mounted by the kernel
      // (buildroot auto-mounts when filesystem:{} is set in v86 config)
      const mountOut = await this.execWait("mountpoint -q /mnt || mount -t 9p -o trans=virtio host9p /mnt/");
      if (mountOut) console.log("[V86VM] mount output:", mountOut);

      let manifestEnv: Record<string, string> = {};

      if (manifestUrl) {
        const manifestRes = await fetch(manifestUrl, { signal });
        if (!manifestRes.ok) throw new Error(`Manifest error: ${manifestRes.status}`);
        const manifest = await manifestRes.json();
        
        manifestEnv = manifest.env ?? manifest.environment?.env ?? {};
        if (onManifest) onManifest(manifest);

        if (manifest.baseline && baselineUrl) {
          onStatus('downloading_baseline');
          try {
            // Baseline is cached using our new helper
            const baselineData = await this.fetchWithCache(baselineUrl, false);
            
            onStatus('extracting_baseline');
            // Inject directly into the v86 9p share (mounted at /mnt/ inside the VM)
            this.emulator?.create_file('baseline.tar.gz', baselineData);
            
            // Remove -m flag as busybox tar doesn't support it
            const tarOut = await this.execWait(`zcat /mnt/baseline.tar.gz | tar -xf - -C /home/swacn`);
            console.log("[V86VM] tar output:", tarOut);
            await this.execWait(`rm /mnt/baseline.tar.gz`);
          } catch (err) {
            console.error("Failed to download baseline", err);
          }
        }

        // Read from manifest.binaries using x86_32 target convention (with legacy i386/x86_64 fallback)
        const binariesList = manifest.binaries?.x86_32 ?? manifest.environment?.binaries?.x86_32 ??
                             manifest.binaries?.i386 ?? manifest.environment?.binaries?.i386 ?? 
                             manifest.binaries?.x86_64 ?? manifest.environment?.binaries?.x86_64 ?? [];
        
        if (binariesList.length > 0) {
          onStatus('downloading_tools');
          try {
            // OPTIMIZATION: Download all tools in parallel
            const downloadPromises = binariesList.map(async (tool: any) => {
              const data = await this.fetchWithCache(tool.url);
              return { tool, data };
            });
            
            const results = await Promise.all(downloadPromises);
            
            onStatus('installing_tools');
            // Installation must be sequential because it interacts with the VM serial port
            for (const { tool, data } of results) {
              const filename = tool.url.split('/').pop() || 'tool';
              
              // Smart path resolution:
              // 1. If no path, use /usr/bin/name
              // 2. If path is a directory (doesn't end with name), append name
              // 3. If path is a full file path (ends with name), use as is
              let installPath = tool.install_path || '/usr/bin';
              if (!installPath.endsWith(tool.name)) {
                installPath = installPath.endsWith('/') ? `${installPath}${tool.name}` : `${installPath}/${tool.name}`;
              }

              console.log(`[V86VM] Installing ${tool.name} to ${installPath}`);
              this.emulator?.create_file(filename, data);
              
              await this.execWait(`mkdir -p ${installPath.substring(0, installPath.lastIndexOf('/'))}`);
              const cpOut = await this.execWait(`cp /mnt/${filename} ${installPath}`);
              if (cpOut) console.log(`[V86VM] cp ${filename} output:`, cpOut);
              await this.execWait(`chmod +x ${installPath}`);
              await this.execWait(`rm /mnt/${filename}`);
            }
          } catch (err) {
            console.error("Failed to download or install tools", err);
          }
        }
      }

      // --- THE CLEAN HANDOVER ---

      console.log("[V86VM] Capturing welcome message");
      // 1. Capture welcome message (only meaningful if manifest was loaded)
      const welcomeContent = manifestUrl 
        ? await this.execWait("cat welcome.txt 2>/dev/null")
        : null;
      console.log("[V86VM] Welcome message captured:", welcomeContent);

      if (!this.emulator) return;

      console.log("[V86VM] Configuring shell environment");
      // 2. Write env vars to /etc/profile.d so they persist in all shells
      if (Object.keys(manifestEnv).length > 0) {
        await this.execWait(`mkdir -p /etc/profile.d && rm -f /etc/profile.d/swacn.sh`);
        for (const [key, value] of Object.entries(manifestEnv)) {
          await this.execWait(`echo 'export ${key}="${value}"' >> /etc/profile.d/swacn.sh`);
        }
        await this.execWait(`. /etc/profile.d/swacn.sh`);
      }

      // Set PS1 and terminal size before enabling echo — fully silent
      await this.execWait("export PS1='swacn@sandbox:~$ '");
      await this.execWait(`stty cols ${this.xterm.cols} rows ${this.xterm.rows}`);
      await this.execWait("stty echo");

      // Drain any remaining in-flight v86 serial bytes into outputBuffer
      await new Promise(r => setTimeout(r, 300));

      console.log("[V86VM] Wiping visual terminal");
      // Clear BEFORE switching to interactive mode — stty -echo is still on
      // so no shell output can leak to xterm here
      this.xterm.clear();

      console.log("[V86VM] Handover");
      const PROMPT = "swacn@sandbox:~$ ";

      if (welcomeContent && welcomeContent.trim().length > 0) {
        this.xterm.write(welcomeContent.trim() + "\r\n\r\n" + PROMPT);
      } else if (!manifestUrl) {
        this.xterm.write(PROMPT);
      } else {
        this.xterm.write(PROMPT);
      }

      // Switch to interactive mode — NO serial send.
      // Shell is idle and waiting. User's first keypress drives it from here.
      this.isInteractiveMode = true;


      // 6. Hook up the listener
      this.dataListener = this.xterm.onData((data) => {
        if (!this.isInteractiveMode || !this.emulator) return;
        this.emulator?.serial0_send(data);
      });

      console.log("[V86VM] Boot sequence complete!");
      onStatus('ready');
    } catch (e: any) {
      if (e.name === 'AbortError') return;
      console.error("[V86VM] Boot failed!", e);
      onStatus('error');
    }
  }

  public setTerminalSize(cols?: number, rows?: number) {
    if (!this.emulator || !this.isInteractiveMode) return;
    const c = cols ?? this.xterm.cols;
    const r = rows ?? this.xterm.rows;
    // Update the VM's shell about the new terminal size
    // Note: Sending stty commands over the raw serial port while the user is interacting
    // will pollute their prompt and break any command they are currently typing.
    // Since raw serial doesn't support out-of-band SIGWINCH signals like a true PTY,
    // we must rely on xterm.js for visual wrapping during dynamic resizes.
    
    /*
    const cmd = ` stty -echo; stty cols ${c} rows ${r}; stty echo\n`;
    for (let i = 0; i < cmd.length; i++) {
      this.emulator.serial0_send(cmd[i]);
    }
    */
  }

  public dispose() {
    if (this.abortController) this.abortController.abort();
    if (this.dataListener) this.dataListener.dispose();
    if (this.emulator) this.emulator.stop();
    this.emulator = null;
  }
}
