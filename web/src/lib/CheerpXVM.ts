import { Terminal } from '@xterm/xterm';

// Access the globally loaded CheerpX from the CDN
declare const CheerpX: any;

export type VMStatus = 
  | 'initializing' 
  | 'booting_kernel' 
  | 'downloading_baseline' 
  | 'extracting_baseline' 
  | 'downloading_tools' 
  | 'installing_tools' 
  | 'ready' 
  | 'error';

export class CheerpXVM {
  private xterm: Terminal;
  private cx: any = null;
  private dataListener: { dispose: () => void } | null = null;
  private writeToCheerpX: ((buf: number) => void) | null = null;
  
  private outputBuffer = "";
  private resolveCommand: (() => void) | null = null;
  private currentMarker: string | null = null;
  private isInteractiveMode = false;

  constructor(xterm: Terminal) {
    this.xterm = xterm;
  }

  private consoleOut = (buf: Uint8Array) => {
    const str = new TextDecoder().decode(buf);
    
    if (this.isInteractiveMode) {
      this.xterm.write(buf);
    } else {
      this.outputBuffer += str;

      if (this.currentMarker && this.outputBuffer.includes(this.currentMarker)) {
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
    if (!this.writeToCheerpX) return "";
    this.outputBuffer = "";
    
    const nonce = Math.random().toString(36).substring(2, 10);
    this.currentMarker = `__SWACN_${nonce}__`;
    
    return new Promise<string>(async (resolve) => {
      this.resolveCommand = () => {
        const cleanOutput = this.outputBuffer
          .split(this.currentMarker || "")[0] // Only take text BEFORE the marker
          .replace(cmd, "")
          .trim();
        resolve(cleanOutput);
      };
      
      const fullCmd = `${cmd}\nprintf "${this.currentMarker}"\n`;
      const bytes = new TextEncoder().encode(fullCmd);
      
      for (let i = 0; i < bytes.length; i++) {
        this.writeToCheerpX!(bytes[i]);
        if (i > 0 && i % 128 === 0) await new Promise(r => setTimeout(r, 1));
      }
    });
  }

  private async blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result.substring(result.indexOf(',') + 1)); 
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  private async injectBase64ToVM(filename: string, b64: string, executable: boolean = false) {
    if (!this.writeToCheerpX) return;

    await this.execWait("stty -echo");
    await this.execWait(`> ${filename}.b64`);

    const chunkSize = 2000; 
    const lineSize = 76;
    let currentLinePos = 0;

    for (let i = 0; i < b64.length; i += chunkSize) {
      let chunk = b64.substring(i, i + chunkSize);
      let processedChunk = "";
      for (let j = 0; j < chunk.length; j++) {
        processedChunk += chunk[j];
        currentLinePos++;
        if (currentLinePos >= lineSize) {
          processedChunk += "\\n";
          currentLinePos = 0;
        }
      }
      await this.execWait(`printf "${processedChunk}" >> ${filename}.b64`);
    }

    await this.execWait(`base64 -d ${filename}.b64 > ${filename}`);
    await this.execWait(`rm ${filename}.b64`);
    if (executable) await this.execWait(`chmod +x ${filename}`);
  }

  public async boot(
    manifestUrl: string | null, 
    baselineUrl: string | null, 
    onStatus: (status: VMStatus) => void
  ) {
    onStatus('initializing');

    try {
      const cloudDevice = await CheerpX.CloudDevice.create("wss://disks.webvm.io/debian_large_20230522_5044875331.ext2");
      const idbDevice = await CheerpX.IDBDevice.create("swacn_block_storage");
      const overlayDevice = await CheerpX.OverlayDevice.create(cloudDevice, idbDevice);

      onStatus('booting_kernel');
      this.cx = await CheerpX.Linux.create({
        mounts: [
          { type: "ext2", path: "/", dev: overlayDevice },
          { type: "devs", path: "/dev" },
        ],
      });

      this.writeToCheerpX = this.cx.setCustomConsole(
        this.consoleOut,
        this.xterm.cols,
        this.xterm.rows
      );

      this.cx.run("/bin/bash", ["--login"], { 
        env: [
          "TERM=xterm-256color", "USER=swacn", "HOME=/home/swacn", "PATH=/usr/local/bin:/bin:/usr/bin"
        ] 
      });

      await new Promise(r => setTimeout(r, 1000));
      
      // 1. Silent Mode Initialization
      await this.execWait("export PS1=''"); 
      await this.execWait("stty -echo");
      await this.execWait("mkdir -p /home/swacn && cd /home/swacn");
      await this.execWait("shopt -s dotglob && rm -rf /home/swacn/* && shopt -u dotglob");

      if (manifestUrl) {
        const manifestRes = await fetch(manifestUrl);
        if (!manifestRes.ok) throw new Error(`Manifest error: ${manifestRes.status}`);
        const manifest = await manifestRes.json();
        
        if (manifest.baseline && baselineUrl) {
          onStatus('downloading_baseline');
          const baselineRes = await fetch(baselineUrl);
          if (baselineRes.ok) {
            const baselineB64 = await this.blobToBase64(await baselineRes.blob());
            onStatus('extracting_baseline');
            await this.injectBase64ToVM('/tmp/baseline.tar.gz', baselineB64);
            await this.execWait(`tar -xzf /tmp/baseline.tar.gz -C /home/swacn -m --no-same-owner --no-same-permissions --warning=no-unknown-keyword --exclude="._*" > /dev/null 2>&1`);
            await this.execWait(`rm /tmp/baseline.tar.gz`);
          }
        }

        if (manifest.environment?.binaries?.x86_64) {
          const tools = manifest.environment.binaries.x86_64;
          for (const tool of tools) {
            onStatus('downloading_tools');
            const tRes = await fetch(tool.url);
            if (!tRes.ok) continue;
            const tB64 = await this.blobToBase64(await tRes.blob());
            onStatus('installing_tools');
            await this.execWait(`mkdir -p ${tool.install_path.substring(0, tool.install_path.lastIndexOf('/'))}`);
            await this.injectBase64ToVM(tool.install_path, tB64, true);
          }
        }
      }

      // --- THE CLEAN HANDOVER ---

      // 1. Capture README content
      const readmeContent = await this.execWait("cat README.md 2>/dev/null || cat README 2>/dev/null");

      // 2. Configure the shell environment
      const setupCmd = "stty echo && export PS1='swacn@sandbox:~$ '\n";
      const setupBytes = new TextEncoder().encode(setupCmd);
      for (let b of setupBytes) this.writeToCheerpX!(b);

      // 3. Wait for shell to process
      await new Promise(r => setTimeout(r, 150));

      // 4. Wipe the visual terminal
      this.xterm.clear();

      // 5. Conditional Handover
      if (readmeContent && readmeContent.trim().length > 0) {
        // SCENARIO A: README exists
        this.xterm.write(readmeContent.trim());
        this.isInteractiveMode = true;
        
        // Send Enter (13) to put the prompt on the line immediately following the text
        this.writeToCheerpX!(13); 
      } else {
        // SCENARIO B: No README
        this.isInteractiveMode = true;
        
        // Instead of Enter, send CTRL+L (ASCII 12 / Form Feed)
        // This tells the shell: "Redraw your prompt at the top of the current screen"
        this.writeToCheerpX!(12); 
      }

      // 6. Hook up the listener
      this.dataListener = this.xterm.onData((data) => {
        const bytes = new TextEncoder().encode(data);
        for (let b of bytes) this.writeToCheerpX!(b);
      });


      onStatus('ready');
    } catch (e) {
      console.error(e);
      onStatus('error');
    }
  }

  public dispose() {
    if (this.dataListener) this.dataListener.dispose();
    this.cx = null;
  }
}