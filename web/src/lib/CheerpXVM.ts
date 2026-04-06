import { Terminal } from '@xterm/xterm';
import * as CheerpX from '@leaningtech/cheerpx';

export class CheerpXVM {
  private xterm: Terminal;
  private cx: CheerpX.Linux | null = null;
  private dataListener: { dispose: () => void } | null = null;

  constructor(xterm: Terminal) {
    this.xterm = xterm;
  }

  public async boot() {
    this.xterm.writeln('\x1b[33m[SWACN Kernel] Booting CheerpX x86 engine...\x1b[0m');

    try {
      // 1. Setup Filesystem Devices
      const cloudDevice = await CheerpX.CloudDevice.create("wss://disks.webvm.io/debian_large_20230522_5044875331.ext2");
      const idbDevice = await CheerpX.IDBDevice.create("swacn_block_storage");
      const overlayDevice = await CheerpX.OverlayDevice.create(cloudDevice, idbDevice);

      this.xterm.writeln('\x1b[33m[SWACN Kernel] Mounting Debian ext2 filesystem...\x1b[0m');

      // 2. Boot Linux Kernel
      this.cx = await CheerpX.Linux.create({
        mounts: [
          { type: "ext2", path: "/", dev: overlayDevice },
          { type: "devs", path: "/dev" } as any, // Bypasses the strict TS interface
        ],
      });

      this.xterm.writeln('\x1b[32m[SUCCESS] Kernel ready. Handing over standard I/O...\x1b[0m\r\n');

      // 3. The I/O Pipeline
      // FIX 1: Provide terminal columns and rows so Linux knows the screen size
      const writeToCheerpX = this.cx.setCustomConsole(
        (buf: Uint8Array) => this.xterm.write(buf),
        this.xterm.cols,
        this.xterm.rows
      );

      const encoder = new TextEncoder();
      this.dataListener = this.xterm.onData((data: string) => {
        const bytes = encoder.encode(data);
        // FIX 2: Stream the data into CheerpX one byte (number) at a time
        for (let i = 0; i < bytes.length; i++) {
          writeToCheerpX(bytes[i]);
        }
      });

      // 4. Run bash
      await this.cx.run("/bin/bash", ["--login"], { 
        env: [
          "TERM=xterm-256color", 
          "USER=swacn", 
          "HOME=/home/user", 
          "PATH=/bin:/usr/bin:/usr/local/bin"
        ] 
      });

    } catch (error: any) {
      console.error("CheerpX Boot Error:", error);
      this.xterm.writeln(`\r\n\x1b[31m[KERNEL PANIC] ${error.message || "Failed to boot x86 engine."}\x1b[0m`);
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