// src/core/WebVMBridge.ts
import type { FsEvent } from './CastParser';

export class WebVMBridge {
  private vmReady = false;

  async initialize(baselineTarballUrl: string) {
    console.log("[Mock VM] Booting...");
    console.log(`[Mock VM] Would fetch and unpack: ${baselineTarballUrl}`);
    
    // Simulate a short boot delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    this.vmReady = true;
    console.log("[Mock VM] Ready. T=0 State Hydrated.");
  }

  async applyFsEvent(event: FsEvent[2]) {
    if (!this.vmReady) return;

    try {
      if (event.action === 'create' || event.action === 'modify') {
        // Decode your Base64 payload!
        const binaryString = atob(event.content!);
        
        console.log(`[Mock VM FS] 📝 ${event.action.toUpperCase()}: ${event.path}`);
        console.log(`[Mock VM FS] Content preview:`, binaryString.substring(0, 50) + "...");
      } else if (event.action === 'delete') {
        console.log(`[Mock VM FS] 🗑️ DELETE: ${event.path}`);
      }
    } catch (err) {
      console.error(`Failed to apply FS state for ${event.path}:`, err);
    }
  }

  async spawnInteractiveShell(terminal: any) {
     if (terminal) {
         console.log("[Mock VM] Xterm instance bound.");
         terminal.write('\r\n\x1b[33m[Mock Mode] You are in control! (No actual shell attached yet)\x1b[0m\r\n$ ');
     }
  }
}