import React from 'react';
import { Terminal, Key, PlayCircle, Share2, ServerCog, ArrowRight, Laptop, Box, FileTerminal, Download, FileJson, UploadCloud, Settings, Link as LinkIcon } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';

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
            Learn how to record deterministic terminal sessions, replay them in the browser, and share interactive sandboxes anywhere.
          </p>
        </div>
      </header>

      <div className="flex items-center gap-4 mb-16">
        <h2 className="font-headline text-3xl font-black uppercase tracking-tighter">Core Workflow</h2>
        <div className="h-[4px] flex-grow bg-on-surface"></div>
      </div>

      <div className="space-y-8 md:space-y-12">
        
        {/* Step 1: Download */}
        <section className="bg-surface-container-high border-4 border-on-surface p-6 md:p-10 hard-shadow relative overflow-hidden group hover:-translate-y-1 transition-transform">
          <div className="absolute -top-10 -right-10 text-on-surface opacity-5 transform group-hover:scale-110 group-hover:rotate-12 transition-transform duration-700 pointer-events-none">
            <Download size={300} />
          </div>
          <div className="relative z-10 flex flex-col md:flex-row gap-8 items-start">
            <div className="flex-shrink-0 w-16 h-16 bg-primary text-white flex items-center justify-center text-2xl font-black font-headline border-4 border-on-surface hard-shadow-sm">
              01
            </div>
            <div className="flex-grow">
              <h3 className="text-3xl font-black font-headline uppercase tracking-tighter mb-4">Get the CLI</h3>
              <p className="text-lg mb-6 leading-relaxed max-w-2xl">
                Everything starts with the SWACN Command Line Interface. It's the engine that records your sessions and packages your filesystem.
              </p>
              <Link to="/cli" className="inline-flex items-center gap-2 bg-on-surface text-background px-6 py-3 font-mono font-bold uppercase text-sm border-2 border-transparent hover:bg-background hover:text-on-surface hover:border-on-surface transition-colors hard-shadow">
                Download CLI <ArrowRight size={16} />
              </Link>
            </div>
          </div>
        </section>

        {/* Step 2: Auth */}
        <section className="bg-white border-4 border-on-surface p-6 md:p-10 hard-shadow relative overflow-hidden group hover:-translate-y-1 transition-transform">
          <div className="absolute -top-10 -right-10 text-on-surface opacity-5 transform group-hover:scale-110 group-hover:-rotate-12 transition-transform duration-700 pointer-events-none">
            <Key size={300} />
          </div>
          <div className="relative z-10 flex flex-col md:flex-row gap-8 items-start">
            <div className="flex-shrink-0 w-16 h-16 bg-white text-on-surface flex items-center justify-center text-2xl font-black font-headline border-4 border-on-surface hard-shadow-sm">
              02
            </div>
            <div className="flex-grow">
              <h3 className="text-3xl font-black font-headline uppercase tracking-tighter mb-4">Authenticate</h3>
              <p className="text-lg mb-6 leading-relaxed max-w-2xl">
                Link your local terminal to your SWACN account. Grab your API token from the dashboard and run the auth command.
              </p>
              <div className="bg-background border-2 border-on-surface p-4 font-mono text-sm md:text-base flex items-center gap-4 overflow-x-auto w-max max-w-full">
                <span className="text-primary font-bold">$</span>
                <span>swacn auth login &lt;your_api_token&gt;</span>
              </div>
            </div>
          </div>
        </section>

        {/* Step 3: Config */}
        <section className="bg-surface-container-low border-4 border-on-surface p-6 md:p-10 hard-shadow relative overflow-hidden group hover:-translate-y-1 transition-transform">
          <div className="absolute -top-10 -right-10 text-on-surface opacity-5 transform group-hover:scale-110 group-hover:rotate-12 transition-transform duration-700 pointer-events-none">
            <FileJson size={300} />
          </div>
          <div className="relative z-10 flex flex-col md:flex-row gap-8 items-start">
            <div className="flex-shrink-0 w-16 h-16 bg-primary text-white flex items-center justify-center text-2xl font-black font-headline border-4 border-on-surface hard-shadow-sm">
              03
            </div>
            <div className="flex-grow">
              <h3 className="text-3xl font-black font-headline uppercase tracking-tighter mb-4">Configuration</h3>
              <p className="text-lg mb-4 leading-relaxed max-w-2xl">
                Create a <code className="bg-on-surface/10 px-2 py-1 rounded text-sm font-bold">swacn.config</code> in your project root. This tells SWACN what your project is about and, crucially, how to fetch the required <strong>Linux i386 compiled binaries</strong> for the v86 environment.
              </p>
              <div className="bg-background border-2 border-on-surface p-4 font-mono text-sm overflow-x-auto mb-6 max-w-2xl">
<pre className="text-on-surface/90">{`{
  "project": "my-awesome-cli",
  "env": {
    "PATH": "/usr/local/bin:/bin:/usr/bin"
  },
  "binaries": {
    "i386": [
      {
        "name": "yq",
        "url": "https://github.com/mikefarah/yq/releases/download/v4.40.5/yq_linux_386",
        "install_path": "/usr/bin/yq"
      }
    ]
  }
}`}</pre>
              </div>
              
              <div className="bg-error/10 border-l-4 border-error p-5 mt-6 relative overflow-hidden">
                <h4 className="font-bold text-error uppercase text-sm mb-2 flex items-center gap-2">
                  <Terminal size={16} /> Security Warning
                </h4>
                <p className="text-on-surface/90 text-sm leading-relaxed">
                  When the <code className="font-bold text-error">--fs</code> flag is used, the directory where you run SWACN will be captured in its entirety. <strong>Make absolutely sure there is no sensitive information (like .env files, private keys, or passwords)</strong> in this directory. Everything in this folder will be publicly accessible in the resulting sandbox!
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Step 4: Record & Upload */}
        <section className="bg-white border-4 border-on-surface p-6 md:p-10 hard-shadow relative overflow-hidden group hover:-translate-y-1 transition-transform">
          <div className="absolute -top-10 -right-10 text-on-surface opacity-5 transform group-hover:scale-110 group-hover:-rotate-12 transition-transform duration-700 pointer-events-none">
            <UploadCloud size={300} />
          </div>
          <div className="relative z-10 flex flex-col md:flex-row gap-8 items-start">
            <div className="flex-shrink-0 w-16 h-16 bg-white text-on-surface flex items-center justify-center text-2xl font-black font-headline border-4 border-on-surface hard-shadow-sm">
              04
            </div>
            <div className="flex-grow w-full">
              <h3 className="text-3xl font-black font-headline uppercase tracking-tighter mb-4">Record & Upload</h3>
              <p className="text-lg mb-6 leading-relaxed max-w-2xl">
                Start the engine. SWACN will launch a sub-shell and immediately begin logging your actions. When you're done, upload the recording.
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-4xl">
                <div className="bg-surface-container-low border-2 border-on-surface p-4">
                  <div className="font-mono text-xs text-primary font-bold mb-3 uppercase">1. Record</div>
                  <div className="font-mono text-sm opacity-90 leading-relaxed">
                    $ swacn record --fs --keys<br/>
                    <span className="opacity-50 mt-2 block italic">
                      # (Do your cool terminal stuff here)<br/>
                      $ npm run build<br/>
                      $ vim src/index.js
                    </span>
                  </div>
                </div>
                <div className="bg-surface-container-low border-2 border-on-surface p-4">
                  <div className="font-mono text-xs text-primary font-bold mb-3 uppercase">2. Finish & Upload</div>
                  <div className="font-mono text-sm leading-relaxed">
                    $ exit<br/>
                    $ swacn upload<br/>
                    <span className="text-primary opacity-90 mt-2 block font-bold">✓ Session synced to cloud</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Step 5: Web Access & Customization */}
        <section className="bg-primary text-white border-4 border-on-surface p-6 md:p-10 hard-shadow relative overflow-hidden group hover:-translate-y-1 transition-transform">
          <div className="absolute -top-10 -right-10 text-white opacity-10 transform group-hover:scale-110 group-hover:rotate-12 transition-transform duration-700 pointer-events-none">
            <Settings size={300} />
          </div>
          <div className="relative z-10 flex flex-col md:flex-row gap-8 items-start">
            <div className="flex-shrink-0 w-16 h-16 bg-white text-primary flex items-center justify-center text-2xl font-black font-headline border-4 border-on-surface hard-shadow-sm">
              05
            </div>
            <div className="flex-grow">
              <h3 className="text-3xl font-black font-headline uppercase tracking-tighter mb-4">Web Access & Settings</h3>
              <p className="text-lg mb-8 leading-relaxed max-w-2xl text-white/90">
                Head over to the Dashboard to see your project. You can tweak the appearance, terminal theme, and adjust access controls.
              </p>
              
              <div className="flex flex-col gap-6 max-w-3xl">
                <div className="flex items-start gap-4">
                  <div className="mt-1 bg-white p-2 border-2 border-on-surface hard-shadow-sm"><Laptop size={20} className="text-primary" /></div>
                  <div>
                    <h4 className="font-bold text-xl font-headline tracking-tight">Customization</h4>
                    <p className="text-white/80 mt-1 leading-relaxed">Personalize the sandbox. Change visual themes (we support Catppuccin and more!) and tailor the lab environment to match your branding.</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="mt-1 bg-white p-2 border-2 border-on-surface hard-shadow-sm"><Download size={20} className="text-primary" /></div>
                  <div>
                    <h4 className="font-bold text-xl font-headline tracking-tight">Filesystem Downloads</h4>
                    <p className="text-white/80 mt-1 leading-relaxed">
                      You can toggle off the explicit "Download Filesystem" button in the UI. 
                    </p>
                    <div className="mt-3 bg-on-surface/10 border-l-2 border-white/40 pl-3 py-1">
                      <span className="italic text-white/90 text-sm">
                        * Psst... if someone really, really wants your filesystem, they can still extract it from the WASM state if they know what they're doing. It's the web, nothing is truly hidden! So again, <strong>no passwords</strong>!
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              
            </div>
          </div>
        </section>

        {/* Step 6: Share & Embed */}
        <section className="bg-surface-container-low border-4 border-on-surface p-6 md:p-10 hard-shadow relative overflow-hidden group hover:-translate-y-1 transition-transform">
          <div className="absolute -bottom-10 -right-10 text-on-surface opacity-5 transform group-hover:scale-110 group-hover:-rotate-12 transition-transform duration-700 pointer-events-none">
            <LinkIcon size={300} />
          </div>
          <div className="relative z-10 flex flex-col md:flex-row gap-8 items-start">
            <div className="flex-shrink-0 w-16 h-16 bg-on-surface text-white flex items-center justify-center text-2xl font-black font-headline border-4 border-on-surface hard-shadow-sm">
              06
            </div>
            <div className="flex-grow">
              <h3 className="text-3xl font-black font-headline uppercase tracking-tighter mb-4">Share & Embed</h3>
              <p className="text-lg mb-6 leading-relaxed max-w-2xl">
                Show off your creation. Share the URL directly or embed your SWACN terminal sessions into your blog, documentation, or portfolio.
              </p>
              
              <div className="bg-primary/5 border-l-4 border-primary p-6 mt-6 max-w-2xl">
                <div className="flex items-center gap-3 mb-3">
                  <div className="bg-primary p-2 text-white hard-shadow-sm">
                    <LinkIcon size={20} />
                  </div>
                  <h4 className="font-headline font-black text-xl uppercase tracking-tight text-on-surface">Pro Tip: Quick Embed</h4>
                </div>
                <p className="font-mono text-sm leading-relaxed text-on-surface/80">
                  Instead of writing code manually, you can directly right-click anywhere inside the terminal while viewing your workspace to instantly copy the iframe embed code to your clipboard.
                </p>
              </div>
            </div>
          </div>
        </section>

      </div>

      {/* Architecture Deep Dive Footer */}
      <div className="mt-32 border-t-4 border-on-surface pt-12 flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
        <div>
          <h2 className="font-headline text-2xl font-black uppercase tracking-tighter">Under the Hood</h2>
          <p className="font-mono text-sm mt-2 max-w-lg text-on-surface/80">
            SWACN is powered by a high-performance C++ backend for session multiplexing, dynamic chunking for deduplication, and v86 for x86 browser emulation.
          </p>
        </div>
        <div className="flex gap-4 opacity-50 grayscale hover:grayscale-0 hover:opacity-100 transition-all cursor-pointer">
          <Box size={32} />
          <FileTerminal size={32} />
          <ServerCog size={32} />
        </div>
      </div>

    </div>
  );
}

