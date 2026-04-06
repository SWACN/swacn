import React from 'react';
import { FolderOpen, Folder, FileText, Plus } from 'lucide-react';

export function Lab() {
  return (
    <div className="flex-grow grid grid-cols-12 gap-0 border-b-4 border-on-surface min-h-[calc(100vh-160px)]">
      {/* Left: System State */}
      <aside className="col-span-12 md:col-span-2 border-r-4 border-on-surface flex flex-col bg-background">
        <div className="p-4 border-b-2 border-on-surface bg-surface-container-high">
          <h2 className="font-headline font-bold text-xs uppercase tracking-widest text-primary">System State</h2>
        </div>
        <div className="p-4 space-y-6 font-mono text-xs">
          <div>
            <div className="flex justify-between mb-1">
              <span>CPU LOAD</span>
              <span className="text-primary">14.2%</span>
            </div>
            <div className="w-full bg-surface-container-high border-2 border-on-surface h-4">
              <div className="bg-primary h-full" style={{ width: '14.2%' }}></div>
            </div>
          </div>
          <div>
            <div className="flex justify-between mb-1">
              <span>MEMORY</span>
              <span className="text-primary">1.2GB/4GB</span>
            </div>
            <div className="w-full bg-surface-container-high border-2 border-on-surface h-4">
              <div className="bg-primary h-full" style={{ width: '30%' }}></div>
            </div>
          </div>
          <div className="space-y-2 pt-4">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 bg-green-600"></span>
              <span>NET_STATUS: UP</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 bg-green-600"></span>
              <span>DAEMON: ACTIVE</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 bg-primary"></span>
              <span>LATENCY: 42ms</span>
            </div>
          </div>
        </div>
        <div className="mt-auto p-4 border-t-2 border-on-surface font-mono text-[10px] opacity-60">
          SWACN KERNEL v2.4.1-STABLE<br/>
          BUILD: 0x99FF2A
        </div>
      </aside>

      {/* Center: Terminal */}
      <section className="col-span-12 md:col-span-7 flex flex-col bg-white relative overflow-hidden">
        <div className="p-3 border-b-2 border-on-surface bg-surface-container-high flex justify-between items-center">
          <div className="flex gap-2 items-center">
            <div className="w-3 h-3 bg-on-surface"></div>
            <span className="font-mono text-xs font-bold">TERMINAL (SH) — SESSION_ID: 8821</span>
          </div>
          <div className="flex gap-4 font-mono text-[10px]">
            <span className="text-primary">[REC]</span>
            <span>UTF-8</span>
          </div>
        </div>
        <div className="flex-grow p-6 font-mono text-sm overflow-y-auto leading-relaxed">
          <div className="mb-4">
            <span className="text-primary font-bold">user@swacn-lab</span>:<span className="text-outline">~</span>$ monolith init lab-environment --verbose
          </div>
          <div className="mb-2 text-on-surface opacity-70">
            [00:01] <span className="bg-surface-container-high px-1">INFO</span> Establishing secure bridge to monolith...
          </div>
          <div className="mb-2 text-on-surface opacity-70">
            [00:03] <span className="bg-surface-container-high px-1">INFO</span> Verified integrity of config.yaml
          </div>
          <div className="mb-2 text-on-surface opacity-70">
            [00:05] <span className="bg-surface-container-high px-1">INFO</span> Mounting virtual filesystem: /root/bin, /root/etc
          </div>
          <div className="mb-4 text-on-surface opacity-70">
            [00:08] <span className="bg-primary text-white px-1">SUCCESS</span> Lab initialized. Workspace ready.
          </div>
          <div className="flex items-center gap-1">
            <span className="text-primary font-bold">user@swacn-lab</span>:<span className="text-outline">~</span>$ <span className="animate-pulse bg-on-surface w-2 h-5 inline-block"></span>
          </div>
          {/* Background Image Decorator */}
          <div className="absolute bottom-10 right-10 opacity-5 grayscale pointer-events-none">
            <img 
              alt="Hardware schematic" 
              className="w-64" 
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuBZryydBKOPYfbqu41JouSKRALSLcfa9yh-2cyg35i3qh0VE4AR3Z2eD0ApMFmlmpAhYlIjfjDk4BGCyJecg7BpFjGeaj4xiPBdADLGIIpNj_2uv66QOPVFTdGvYsID0SD8oGRsXvLmewRxW4EtX90Yhlt0QrjjJAFmJbOAV16USbpv_bsNuHyAb4P1Y84Y2laXiHMjBPxbtBubMBOY4HQNHNavAoIpXUavVUiCXcTxzvmp_s3Z3lcqk0ar0oHgUyJxXmo8LhanT_PC"
              referrerPolicy="no-referrer"
            />
          </div>
        </div>
      </section>

      {/* Right: Virtual Filesystem */}
      <aside className="col-span-12 md:col-span-3 border-l-4 border-on-surface bg-background flex flex-col">
        <div className="p-4 border-b-2 border-on-surface bg-surface-container-high flex justify-between items-center">
          <h2 className="font-headline font-bold text-xs uppercase tracking-widest text-primary">Filesystem</h2>
          <Plus size={16} className="text-primary cursor-pointer" />
        </div>
        <div className="p-4 font-mono text-sm space-y-1">
          <div className="flex items-center gap-2 py-1 px-2 hover:bg-surface-container-high cursor-pointer">
            <FolderOpen size={16} className="text-on-surface" />
            <span>root</span>
          </div>
          <div className="flex items-center gap-2 py-1 px-2 pl-6 hover:bg-surface-container-high cursor-pointer">
            <Folder size={16} className="text-primary" />
            <span className="text-primary">bin</span>
          </div>
          <div className="flex items-center gap-2 py-1 px-2 pl-6 hover:bg-surface-container-high cursor-pointer">
            <Folder size={16} className="text-on-surface" />
            <span>etc</span>
          </div>
          <div className="flex items-center gap-2 py-1 px-2 pl-10 hover:bg-surface-container-high cursor-pointer">
            <Folder size={16} className="text-on-surface" />
            <span>swacn</span>
          </div>
          <div className="flex items-center gap-2 py-1 px-2 pl-14 hover:bg-surface-container-high cursor-pointer bg-surface-container-high">
            <FileText size={16} className="text-primary" />
            <span>config.yaml</span>
          </div>
          <div className="flex items-center gap-2 py-1 px-2 pl-6 hover:bg-surface-container-high cursor-pointer">
            <Folder size={16} className="text-on-surface" />
            <span>usr</span>
          </div>
          <div className="flex items-center gap-2 py-1 px-2 pl-6 hover:bg-surface-container-high cursor-pointer">
            <FileText size={16} className="text-on-surface" />
            <span>readme.md</span>
          </div>
        </div>
        {/* Preview/Details Box */}
        <div className="mt-auto p-4 border-t-2 border-on-surface bg-surface-container-low">
          <div className="text-[10px] font-mono text-primary mb-1 uppercase">File Details</div>
          <div className="text-xs font-mono">
            NAME: config.yaml<br/>
            SIZE: 4.2 KB<br/>
            PERM: -rw-r--r--<br/>
            SHA: 0f2b...8a11
          </div>
        </div>
      </aside>
    </div>
  );
}
