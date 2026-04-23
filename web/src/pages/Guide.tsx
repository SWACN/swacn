import React from 'react';
import { Terminal, Key, PlayCircle, Share2, ServerCog, ArrowRight, Laptop, Box, FileTerminal } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function Guide() {
  const navigate = useNavigate();

  return (
    <div className="max-w-7xl mx-auto px-6 py-12 md:py-20">
      
      {/* Hero Section */}
      <header className="mb-24 md:mb-32">
        <div className="border-l-8 border-on-surface pl-6 md:pl-10">
          <p className="font-mono text-primary text-sm md:text-base tracking-widest uppercase mb-4">Official Documentation</p>
          <h1 className="text-5xl md:text-7xl lg:text-8xl font-black font-headline tracking-tighter uppercase leading-none mb-8">
            The SWACN<br/>User Guide
          </h1>
          <p className="text-lg md:text-2xl max-w-3xl font-medium leading-relaxed text-on-surface/80">
            Learn how to record deterministic terminal sessions, replay them in the browser, and share interactive sandboxes anywhere. Software Without Any Cool Name.
          </p>
        </div>
      </header>

      <div className="flex items-center gap-4 mb-16">
        <h2 className="font-headline text-3xl font-black uppercase tracking-tighter">Core Workflow</h2>
        <div className="h-[4px] flex-grow bg-on-surface"></div>
      </div>

      <div className="space-y-8 md:space-y-12">
        
        {/* Step 1: Install & Auth */}
        <section className="bg-surface-container-high border-4 border-on-surface p-6 md:p-10 hard-shadow relative overflow-hidden group hover:-translate-y-1 transition-transform">
          <div className="absolute -top-10 -right-10 text-on-surface opacity-5 transform group-hover:scale-110 group-hover:rotate-12 transition-transform duration-700 pointer-events-none">
            <Key size={300} />
          </div>
          <div className="relative z-10 flex flex-col md:flex-row gap-8 items-start">
            <div className="flex-shrink-0 w-16 h-16 bg-primary text-white flex items-center justify-center text-2xl font-black font-headline border-4 border-on-surface hard-shadow-sm">
              01
            </div>
            <div className="flex-grow">
              <h3 className="text-3xl font-black font-headline uppercase tracking-tighter mb-4">Connect the CLI</h3>
              <p className="text-lg mb-6 leading-relaxed max-w-2xl">
                Before you can start recording sessions, you need to link your local terminal to your SWACN account using your unique API token.
              </p>
              <div className="bg-background border-2 border-on-surface p-4 font-mono text-sm md:text-base flex items-center gap-4 overflow-x-auto w-max max-w-full">
                <span className="text-primary font-bold">$</span>
                <span>swacn auth login &lt;your_api_token&gt;</span>
              </div>
            </div>
          </div>
        </section>

        {/* Step 2: Recording */}
        <section className="bg-white border-4 border-on-surface p-6 md:p-10 hard-shadow relative overflow-hidden group hover:-translate-y-1 transition-transform">
          <div className="absolute -top-10 -right-10 text-on-surface opacity-5 transform group-hover:scale-110 group-hover:-rotate-12 transition-transform duration-700 pointer-events-none">
            <ServerCog size={300} />
          </div>
          <div className="relative z-10 flex flex-col md:flex-row gap-8 items-start">
            <div className="flex-shrink-0 w-16 h-16 bg-white text-on-surface flex items-center justify-center text-2xl font-black font-headline border-4 border-on-surface hard-shadow-sm">
              02
            </div>
            <div className="flex-grow w-full">
              <h3 className="text-3xl font-black font-headline uppercase tracking-tighter mb-4">Record a Session</h3>
              <p className="text-lg mb-6 leading-relaxed max-w-2xl">
                Navigate to your project directory and start the engine. SWACN will launch a sub-shell and immediately begin logging every keystroke, stdout frame, and filesystem event.
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
                <div className="bg-surface-container-low border-2 border-on-surface p-4 md:col-span-2">
                  <div className="font-mono text-xs text-primary font-bold mb-2 uppercase">CLI Commands & Flags</div>
                  <div className="font-mono text-sm space-y-2">
                    <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4 border-b-2 border-on-surface/10 pb-2">
                      <span className="font-bold min-w-[140px]">$ swacn record</span>
                      <span className="opacity-80">Start recording terminal output only</span>
                    </div>
                    <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4 border-b-2 border-on-surface/10 pb-2">
                      <span className="font-bold min-w-[140px] text-primary">--fs</span>
                      <span className="opacity-80">Capture baseline filesystem state and track all changes via FSEvents</span>
                    </div>
                    <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4 border-b-2 border-on-surface/10 pb-2">
                      <span className="font-bold min-w-[140px] text-primary">--keys</span>
                      <span className="opacity-80">Capture raw keystrokes to power the interactive Keystroke HUD</span>
                    </div>
                    <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4 pb-1">
                      <span className="font-bold min-w-[140px] text-primary">--overwrite</span>
                      <span className="opacity-80">Overwrite any existing SWACN recording in the current directory</span>
                    </div>
                  </div>
                </div>
                <div className="bg-surface-container-low border-2 border-on-surface p-4">
                  <div className="font-mono text-xs text-primary font-bold mb-2 uppercase">1. Start & Work</div>
                  <div className="font-mono text-sm opacity-90">
                    $ swacn record --fs --keys<br/>
                    <span className="opacity-60 mt-2 block">
                      $ npm run build<br/>
                      $ vim src/index.js
                    </span>
                  </div>
                </div>
                <div className="bg-surface-container-low border-2 border-on-surface p-4">
                  <div className="font-mono text-xs text-primary font-bold mb-2 uppercase">2. Exit & Sync</div>
                  <div className="font-mono text-sm">
                    $ exit<br/>
                    $ swacn upload<br/>
                    <span className="text-primary opacity-80 mt-2 block">✓ Session compressed and synced to cloud</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Step 3: Replay & Interactive Sandbox */}
        <section className="bg-primary text-white border-4 border-on-surface p-6 md:p-10 hard-shadow relative overflow-hidden group hover:-translate-y-1 transition-transform">
          <div className="absolute -top-10 -right-10 text-white opacity-10 transform group-hover:scale-110 group-hover:rotate-12 transition-transform duration-700 pointer-events-none">
            <PlayCircle size={300} />
          </div>
          <div className="relative z-10 flex flex-col md:flex-row gap-8 items-start">
            <div className="flex-shrink-0 w-16 h-16 bg-white text-primary flex items-center justify-center text-2xl font-black font-headline border-4 border-on-surface hard-shadow-sm">
              03
            </div>
            <div className="flex-grow">
              <h3 className="text-3xl font-black font-headline uppercase tracking-tighter mb-4">Replay & Interact</h3>
              <p className="text-lg mb-6 leading-relaxed max-w-2xl text-white/90">
                Open the SWACN Dashboard. Your session is now a fully interactive WebVM powered by v86 and WASM. Watch the recording play back with perfectly synchronized keystrokes.
              </p>
              
              <div className="flex flex-col gap-4">
                <div className="flex items-start gap-4">
                  <div className="mt-1 bg-white p-1 rounded-sm"><Laptop size={16} className="text-primary" /></div>
                  <div>
                    <h4 className="font-bold text-xl font-headline tracking-tight">The Keystroke HUD</h4>
                    <p className="text-white/80 mt-1">See exactly what the author was typing in real-time. No more guessing keyboard shortcuts from screencasts.</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="mt-1 bg-white p-1 rounded-sm"><Terminal size={16} className="text-primary" /></div>
                  <div>
                    <h4 className="font-bold text-xl font-headline tracking-tight">Pause & Take Over</h4>
                    <p className="text-white/80 mt-1">Pause the playback at any moment to jump into a live terminal sandbox. Run commands against the exact filesystem state of that timestamp.</p>
                  </div>
                </div>
              </div>
              
              <button onClick={() => navigate('/lab')} className="mt-8 bg-white text-on-surface border-2 border-on-surface px-6 py-3 font-mono font-bold uppercase text-sm flex items-center gap-2 hover:bg-surface-container-low transition-colors hard-shadow">
                Enter The Lab <ArrowRight size={16} />
              </button>
            </div>
          </div>
        </section>

        {/* Step 4: Share & Embed */}
        <section className="bg-surface-container-low border-4 border-on-surface p-6 md:p-10 hard-shadow relative overflow-hidden group hover:-translate-y-1 transition-transform">
          <div className="absolute -bottom-10 -right-10 text-on-surface opacity-5 transform group-hover:scale-110 group-hover:-rotate-12 transition-transform duration-700 pointer-events-none">
            <Share2 size={300} />
          </div>
          <div className="relative z-10 flex flex-col md:flex-row gap-8 items-start">
            <div className="flex-shrink-0 w-16 h-16 bg-on-surface text-white flex items-center justify-center text-2xl font-black font-headline border-4 border-on-surface hard-shadow-sm">
              04
            </div>
            <div className="flex-grow">
              <h3 className="text-3xl font-black font-headline uppercase tracking-tighter mb-4">Share Everywhere</h3>
              <p className="text-lg mb-6 leading-relaxed max-w-2xl">
                Technical documentation shouldn't be static. Embed your SWACN terminal sessions directly into your blog, documentation, or portfolio using our responsive iframe generator.
              </p>
              
              <div className="bg-background border-2 border-on-surface p-4 font-mono text-sm overflow-x-auto">
                <span className="text-primary opacity-80">&lt;iframe</span><br/>
                &nbsp;&nbsp;<span>src="https://swacn.app/lab/proj-123?embed=true"</span><br/>
                &nbsp;&nbsp;<span>style="width: 100%; height: 600px; border: none;"</span><br/>
                &nbsp;&nbsp;<span>allow="clipboard-write"</span><br/>
                <span className="text-primary opacity-80">&gt;&lt;/iframe&gt;</span>
              </div>
            </div>
          </div>
        </section>

      </div>

      {/* Architecture Deep Dive Footer */}
      <div className="mt-32 border-t-4 border-on-surface pt-12 flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
        <div>
          <h2 className="font-headline text-2xl font-black uppercase tracking-tighter">Under the Hood</h2>
          <p className="font-mono text-sm mt-2 max-w-lg">
            SWACN is powered by a high-performance C++ backend utilizing <code>FSEvents</code> for kernel-level file tracking, dynamic chunking for deduplication, and `v86` for x86 browser emulation.
          </p>
        </div>
        <div className="flex gap-4 opacity-50 grayscale hover:grayscale-0 hover:opacity-100 transition-all">
          <Box size={32} />
          <FileTerminal size={32} />
          <ServerCog size={32} />
        </div>
      </div>

    </div>
  );
}
