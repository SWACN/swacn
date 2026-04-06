import React from 'react';
import { Terminal, Bell, Database, CloudCheck, Cpu, CloudUpload, AlertTriangle, Expand, Plus } from 'lucide-react';

export function Blueprint() {
  return (
    <div className="max-w-7xl mx-auto px-6 py-12">
      {/* Header Section */}
      <header className="mb-20 border-l-8 border-on-surface pl-8">
        <p className="font-mono text-primary text-sm tracking-widest uppercase mb-2">Technical Specification v.0.42</p>
        <h1 className="text-6xl md:text-8xl font-black font-headline tracking-tighter uppercase leading-none">
          01. Event Sourcing<br/>Filesystem
        </h1>
        <div className="mt-8 grid grid-cols-1 md:grid-cols-12 gap-6">
          <div className="md:col-span-8">
            <p className="text-xl max-w-2xl font-medium leading-relaxed">
              Architecture overview of the SWACN immutable ledger. Unlike traditional file systems, SWACN treats every disk write as a discrete event, serializing the global state into a verifiable stream of NDJSON fragments.
            </p>
          </div>
          <div className="md:col-span-4 flex flex-col justify-end">
            <div className="bg-surface-container-high p-4 border-2 border-on-surface">
              <span className="font-mono text-xs block mb-1">ENGINE_STATUS</span>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-primary"></div>
                <span className="font-mono text-sm font-bold uppercase tracking-tighter">Operational: 0xFD99</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Technical Diagrams Section */}
      <section className="mb-32">
        <div className="flex items-center gap-4 mb-12">
          <h2 className="font-headline text-3xl font-extrabold uppercase tracking-tighter">System Data Flow</h2>
          <div className="h-[4px] flex-grow bg-on-surface"></div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 relative">
          {/* CLI Node */}
          <div className="border-4 border-on-surface p-8 bg-white flex flex-col items-center justify-center text-center z-10">
            <Terminal size={40} className="mb-4 text-primary" />
            <h3 className="font-headline font-black text-xl mb-2">CLI</h3>
            <p className="font-mono text-xs opacity-70">User Interaction Layer</p>
          </div>
          {/* FSEvents Node */}
          <div className="border-4 border-on-surface p-8 bg-white flex flex-col items-center justify-center text-center z-10">
            <Bell size={40} className="mb-4 text-primary" />
            <h3 className="font-headline font-black text-xl mb-2">FSEvents</h3>
            <p className="font-mono text-xs opacity-70">Kernel Watcher Proxy</p>
          </div>
          {/* NDJSON Node */}
          <div className="border-4 border-on-surface p-8 bg-white flex flex-col items-center justify-center text-center z-10">
            <Database size={40} className="mb-4 text-primary" />
            <h3 className="font-headline font-black text-xl mb-2">NDJSON</h3>
            <p className="font-mono text-xs opacity-70">Serialized Event Log</p>
          </div>
          {/* WebVM Node */}
          <div className="border-4 border-on-surface p-8 bg-white flex flex-col items-center justify-center text-center z-10">
            <CloudCheck size={40} className="mb-4 text-primary" />
            <h3 className="font-headline font-black text-xl mb-2">WebVM</h3>
            <p className="font-mono text-xs opacity-70">Edge Execution Target</p>
          </div>
          {/* Connecting Arrows (Desktop only) */}
          <div className="hidden md:block absolute top-1/2 left-0 w-full h-1 bg-on-surface -translate-y-1/2 z-0"></div>
        </div>
      </section>

      {/* Bento Grid: Core Execution & Data Persistence */}
      <section className="grid grid-cols-1 md:grid-cols-12 gap-8 mb-32">
        {/* Execution Layer (6 cols) */}
        <div className="md:col-span-7 border-4 border-on-surface p-8 bg-surface-container-high relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <Cpu size={120} />
          </div>
          <h2 className="font-headline text-4xl font-black uppercase tracking-tighter mb-8">Core Execution Layer</h2>
          <div className="space-y-8">
            <div className="flex gap-6">
              <div className="flex-shrink-0 w-12 h-12 bg-on-surface text-background flex items-center justify-center font-mono font-bold">01</div>
              <div>
                <h4 className="font-headline font-bold text-xl uppercase">Native C++ Engine</h4>
                <p className="mt-2 leading-relaxed">Low-latency event processing kernel. Handles direct I/O multiplexing and cryptographic signing of every transaction before they hit the buffer.</p>
              </div>
            </div>
            <div className="flex gap-6">
              <div className="flex-shrink-0 w-12 h-12 bg-primary text-on-primary flex items-center justify-center font-mono font-bold">02</div>
              <div>
                <h4 className="font-headline font-bold text-xl uppercase">WASM Sandbox</h4>
                <p className="mt-2 leading-relaxed">Secure isolation for third-party plugins and data transformations. Executes with near-native speed while ensuring zero-trust memory access.</p>
              </div>
            </div>
          </div>
          <div className="mt-12 pt-8 border-t-2 border-on-surface/20">
            <img 
              alt="Technical schematic" 
              className="w-full h-48 object-cover border-2 border-on-surface grayscale contrast-125" 
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuCGX2NRy1YfoCYCRjBxS0PqBylrD242UbFU_eLXluVPlMqL8Byash5gQmkwyAQ1l4FalTrTE3RbEk2SlWXnxrL5VmVFLQEkxpDSlpvxNwMecT13E-4w8NzipjmgqNEdg04znz13PIl4p2zxW2m751ZcNuyQ6QI-Wd11DfrkXPZertGG3bGb08xPy4p-ndcgGBfGI6002Cj3yHGGWwSOBhQUrGGIG20lOMsgsVaBuifVxtDUn5_054oPnWaq6ow6i2CDHIgvyP4IWTqN"
              referrerPolicy="no-referrer"
            />
          </div>
        </div>
        {/* Data Persistence (5 cols) */}
        <div className="md:col-span-5 flex flex-col gap-8">
          <div className="border-4 border-on-surface p-8 bg-white flex-grow">
            <h2 className="font-headline text-3xl font-black uppercase tracking-tighter mb-6">Data Persistence</h2>
            <div className="space-y-6">
              <div className="p-4 bg-surface-container-low border-2 border-on-surface border-dashed">
                <span className="font-mono text-xs font-bold text-primary block mb-2 uppercase">Chunking Logic</span>
                <p className="text-sm font-mono">Dynamic content-defined chunking (CDC) splits files into 4MB immutable segments to maximize deduplication across versions.</p>
              </div>
              <div className="p-4 bg-surface-container-low border-2 border-on-surface border-dashed">
                <span className="font-mono text-xs font-bold text-primary block mb-2 uppercase">S3 Serialization</span>
                <p className="text-sm font-mono">Parallel stream upload of compressed segments. Manifests are signed with Ed25519 and cached locally in LevelDB.</p>
              </div>
            </div>
          </div>
          <div className="border-4 border-on-surface bg-primary p-8 text-on-primary">
            <h3 className="font-headline font-bold text-2xl uppercase mb-2">Network Redundancy</h3>
            <p className="font-mono text-sm opacity-80">3x Replication Factor (Standard)</p>
            <div className="mt-4 flex gap-1">
              <div className="h-4 w-full bg-white/20"></div>
              <div className="h-4 w-full bg-white/20"></div>
              <div className="h-4 w-full bg-white"></div>
              <div className="h-4 w-full bg-white/20"></div>
            </div>
          </div>
        </div>
      </section>

      {/* Timeline of State Section */}
      <section className="mb-32">
        <div className="flex justify-between items-end mb-8">
          <div>
            <h2 className="font-headline text-4xl font-black uppercase tracking-tighter">Timeline of State</h2>
            <p className="font-mono text-xs text-primary mt-2">GLOBAL_TRANSACTION_LOG_STDOUT</p>
          </div>
          <div className="font-mono text-xs border-2 border-on-surface px-4 py-2 uppercase font-bold">
            Filter: 0x4F00 - 0x4FFF
          </div>
        </div>
        <div className="border-t-4 border-on-surface font-mono">
          {/* Log Entry 1 */}
          <div className="grid grid-cols-1 md:grid-cols-12 py-6 border-b-2 border-on-surface group hover:bg-surface-container-high transition-colors">
            <div className="md:col-span-2 text-primary font-bold">0x4F88A</div>
            <div className="md:col-span-2 text-on-surface opacity-50 text-xs self-center">14:02:11.002</div>
            <div className="md:col-span-6 flex items-center gap-4">
              <Plus size={14} />
              <span className="font-bold">FILE_CREATED</span>
              <span className="opacity-60">/src/engine/kernel.cpp</span>
            </div>
            <div className="md:col-span-2 text-right text-xs opacity-50">SHA_256: 9e3f...</div>
          </div>
          {/* Log Entry 2 */}
          <div className="grid grid-cols-1 md:grid-cols-12 py-6 border-b-2 border-on-surface group hover:bg-surface-container-high transition-colors bg-surface-container-low">
            <div className="md:col-span-2 text-primary font-bold">0x4F88B</div>
            <div className="md:col-span-2 text-on-surface opacity-50 text-xs self-center">14:02:12.450</div>
            <div className="md:col-span-6 flex items-center gap-4">
              <Expand size={14} />
              <span className="font-bold">METADATA_UPDATE</span>
              <span className="opacity-60">Permissions set to 0755</span>
            </div>
            <div className="md:col-span-2 text-right text-xs opacity-50">SIG: Verified</div>
          </div>
          {/* Log Entry 3 */}
          <div className="grid grid-cols-1 md:grid-cols-12 py-6 border-b-2 border-on-surface group hover:bg-surface-container-high transition-colors">
            <div className="md:col-span-2 text-primary font-bold">0x4F88C</div>
            <div className="md:col-span-2 text-on-surface opacity-50 text-xs self-center">14:03:00.001</div>
            <div className="md:col-span-6 flex items-center gap-4">
              <CloudUpload size={14} />
              <span className="font-bold">S3_SYNC_START</span>
              <span className="opacity-60">Bucket: swacn-us-west-2</span>
            </div>
            <div className="md:col-span-2 text-right text-xs opacity-50">CHUNKS: 12</div>
          </div>
          {/* Log Entry 4 */}
          <div className="grid grid-cols-1 md:grid-cols-12 py-6 border-b-2 border-on-surface group hover:bg-surface-container-high transition-colors">
            <div className="md:col-span-2 text-primary font-bold">0x4F88D</div>
            <div className="md:col-span-2 text-on-surface opacity-50 text-xs self-center">14:03:02.890</div>
            <div className="md:col-span-6 flex items-center gap-4 text-red-600">
              <AlertTriangle size={14} />
              <span className="font-bold">RETRY_TRIGGERED</span>
              <span className="opacity-60 text-on-surface">Network timeout on chunk 0xA1</span>
            </div>
            <div className="md:col-span-2 text-right text-xs opacity-50">ATTEMPT: 1/3</div>
          </div>
        </div>
        <div className="mt-8 flex justify-center">
          <button className="border-2 border-on-surface px-8 py-3 font-mono text-sm hover:bg-on-surface hover:text-background transition-none uppercase tracking-widest flex items-center gap-4">
            Load Older Transactions
            <Expand size={16} className="rotate-90" />
          </button>
        </div>
      </section>
    </div>
  );
}
