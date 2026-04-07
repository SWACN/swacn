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
  
  // Harness State for Background Execution
  private outputBuffer = "";
  private resolveCommand: (() => void) | null = null;
  private isInteractiveMode = false;

  constructor(xterm: Terminal) {
    this.xterm = xterm;
  }

  private consoleOut = (buf: Uint8Array) => {
    if (this.isInteractiveMode) {
      this.xterm.write(buf);
    } else {
      const str = new TextDecoder().decode(buf);
      this.outputBuffer += str;
      if (this.outputBuffer.includes("__SWACN_CMD_DONE__")) {
        this.outputBuffer = this.outputBuffer.replace("__SWACN_CMD_DONE__", "");
        if (this.resolveCommand) {
          this.resolveCommand();
          this.resolveCommand = null;
        }
      }
    }
  };

  private async execWait(cmd: string) {
    if (!this.writeToCheerpX) return;
    this.outputBuffer = "";
    return new Promise<void>((resolve) => {
      this.resolveCommand = resolve;
      const fullCmd = `${cmd}\necho "__SWACN_CMD_DONE__"\n`;
      const bytes = new TextEncoder().encode(fullCmd);
      for (let i = 0; i < bytes.length; i++) {
        this.writeToCheerpX!(bytes[i]);
      }
    });
  }

  private async blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result.split(',')[1]); 
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  private async injectBase64ToVM(filename: string, b64: string, executable: boolean = false) {
    if (!this.writeToCheerpX) return;
    const chunkSize = 64000; 
    
    await this.execWait(`> ${filename}.b64`); 
    for (let i = 0; i < b64.length; i += chunkSize) {
      const chunk = b64.substring(i, i + chunkSize);
      await this.execWait(`echo -n "${chunk}" >> ${filename}.b64`);
    }
    
    await this.execWait(`base64 -d ${filename}.b64 > ${filename} && rm ${filename}.b64`);
    if (executable) {
      await this.execWait(`chmod +x ${filename}`);
    }
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
          "TERM=xterm-256color", 
          "USER=swacn", 
          "HOME=/home/user", 
          "PATH=/usr/local/bin:/bin:/usr/bin"
        ] 
      });

      await new Promise(r => setTimeout(r, 1000));
      await this.execWait("cd /home/user");

      if (manifestUrl && baselineUrl) {
        onStatus('downloading_baseline');
        const baselineRes = await fetch(baselineUrl);
        if (!baselineRes.ok) throw new Error(`Baseline not found: ${baselineRes.status}`);
        
        const baselineBlob = await baselineRes.blob();
        const baselineB64 = await this.blobToBase64(baselineBlob);
        
        onStatus('extracting_baseline');
        await this.injectBase64ToVM('/tmp/baseline.tar.gz', baselineB64);
        await this.execWait(`tar -xzf /tmp/baseline.tar.gz -C /home/user && rm /tmp/baseline.tar.gz`);

        const manifestRes = await fetch(manifestUrl);
        if (!manifestRes.ok) throw new Error(`Manifest not found: ${manifestRes.status}`);
        
        const manifest = await manifestRes.json();
        
        if (manifest.environment?.binaries?.x86_64) {
          const tools = manifest.environment.binaries.x86_64;
          for (const tool of tools) {
            onStatus('downloading_tools');
            const toolRes = await fetch(tool.url);
            if (!toolRes.ok) continue;

            const toolBlob = await toolRes.blob();
            const toolB64 = await this.blobToBase64(toolBlob);
            
            onStatus('installing_tools');
            const dir = tool.install_path.substring(0, tool.install_path.lastIndexOf('/'));
            await this.execWait(`mkdir -p ${dir}`);
            await this.injectBase64ToVM(tool.install_path, toolB64, true);
          }
        }
      }

      await this.execWait("clear");
      
      // GUARANTEE A CLEAN PROMPT: Wipe the xterm canvas before handing over control
      this.xterm.clear();
      this.isInteractiveMode = true;

      // Send a silent Enter key to generate a fresh bash prompt in the view
      const enterKey = new TextEncoder().encode("\r");
      this.writeToCheerpX!(enterKey[0]);

      // Connect user input
      this.dataListener = this.xterm.onData((data: string) => {
        const bytes = new TextEncoder().encode(data);
        for (let i = 0; i < bytes.length; i++) {
          this.writeToCheerpX!(bytes[i]);
        }
      });

      onStatus('ready');

    } catch (error: any) {
      console.error("CheerpX Boot Error:", error);
      onStatus('error');
    }
  }

  public dispose() {
    if (this.dataListener) {
      this.dataListener.dispose();
      this.dataListener = null;
    }
    this.cx = null;
  }
}