import React from 'react';
import { Terminal, Key, PlayCircle, Share2, ServerCog, ArrowRight, Laptop, Box, FileTerminal, Download, FileJson, UploadCloud, Settings, Link as LinkIcon, MousePointer2, FolderUp, Sparkles, ShieldAlert, Cpu } from 'lucide-react';
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
            Learn to build, record, and share deterministic terminal sandboxes. Follow the steps below to get your first project online.
          </p>
        </div>
      </header>

      {/* 01. Preparation: The Project Directory */}
      <section className="mb-32">
        <div className="flex items-center gap-4 mb-12">
          <h2 className="font-headline text-4xl font-black uppercase tracking-tighter">01. Setup the Project</h2>
          <div className="h-[4px] flex-grow bg-on-surface"></div>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          <div>
            <p className="text-xl leading-relaxed text-on-surface/80 mb-8">
              If you want to include a filesystem in your sandbox (via the <code className="font-bold">--fs</code> flag or Web Upload), you need to organize your files locally first.
            </p>
            <div className="space-y-6">
              <div className="flex gap-4">
                <div className="shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary">1</div>
                <div>
                  <h4 className="font-bold mb-1">Create a Root Directory</h4>
                  <p className="text-sm opacity-70 leading-relaxed">Place all files you want accessible in the VM here. Keep the total size under 2MB.</p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary">2</div>
                <div>
                  <h4 className="font-bold mb-1 text-error">Security Check: No Secrets</h4>
                  <p className="text-sm opacity-70 leading-relaxed font-bold">Remove .env files, private keys, or credentials. Everything in this folder will be public.</p>
                </div>
              </div>
            </div>
          </div>
          <div className="bg-surface-container-high border-4 border-on-surface p-6 hard-shadow">
            <div className="flex items-center justify-between mb-4">
              <div className="flex gap-2">
                <div className="w-3 h-3 rounded-full bg-red-400"></div>
                <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
                <div className="w-3 h-3 rounded-full bg-green-400"></div>
              </div>
              <div className="font-mono text-[10px] uppercase font-bold opacity-50">Project Structure</div>
            </div>
            <pre className="font-mono text-sm leading-relaxed text-on-surface/80">
{`my-project/
├── swacn.json       # Required for CLI
├── welcome.txt      # Optional greeting
├── src/             # Your code
│   └── main.sh
└── data/            # Local data
    └── sample.json`}
            </pre>
          </div>
        </div>
      </section>

      {/* 02. Technical Requirements */}
      <section className="mb-32">
        <div className="flex items-center gap-4 mb-12">
          <h2 className="font-headline text-4xl font-black uppercase tracking-tighter">02. Technical Requirements</h2>
          <div className="h-[4px] flex-grow bg-primary/20"></div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="bg-white border-4 border-on-surface p-8 hard-shadow flex flex-col gap-6">
            <div className="bg-surface-container-high p-3 border-2 border-on-surface w-max">
              <Cpu size={24} className="text-primary" />
            </div>
            <h3 className="text-2xl font-black font-headline uppercase tracking-tighter">Binary Compatibility</h3>
            <p className="text-on-surface/70 leading-relaxed">
              The WebVM environment uses <strong>v86</strong>, which emulates an x86 processor. 
            </p>
            <div className="bg-error/5 border-l-4 border-error p-4 text-sm font-mono italic">
              All external tool links MUST be <strong>statically linked x86 32bit binary links</strong> for them to run in the sandbox.
            </div>
          </div>

          <div className="bg-white border-4 border-on-surface p-8 hard-shadow flex flex-col gap-6">
            <div className="bg-surface-container-high p-3 border-2 border-on-surface w-max">
              <Box size={24} className="text-on-surface" />
            </div>
            <h3 className="text-2xl font-black font-headline uppercase tracking-tighter">Payload Constraints</h3>
            <ul className="space-y-4 font-mono text-sm">
              <li className="flex items-center gap-3">
                <div className="w-2 h-2 bg-primary"></div>
                <span>Max 15 Projects per account</span>
              </li>
              <li className="flex items-center gap-3">
                <div className="w-2 h-2 bg-primary"></div>
                <span className="font-bold text-error">Max 2MB per upload</span>
              </li>
              <li className="flex items-center gap-3">
                <div className="w-2 h-2 bg-primary"></div>
                <span>Public access by default</span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* 03. Execution Path A: Web */}
      <section id="web-flow" className="mb-32 scroll-mt-32">
        <div className="flex items-center gap-4 mb-12">
          <h2 className="font-headline text-4xl font-black uppercase tracking-tighter">03. Web Upload Flow</h2>
          <div className="h-[4px] flex-grow bg-on-surface/20"></div>
        </div>

        <div className="bg-primary/5 border-4 border-primary p-8 hard-shadow relative overflow-hidden group">
          <div className="relative z-10 flex flex-col md:flex-row gap-12 items-start">
            <div className="flex-shrink-0 w-16 h-16 bg-primary text-white flex items-center justify-center text-3xl font-black font-headline border-4 border-on-surface hard-shadow-sm">A</div>
            <div className="flex-grow">
              <h3 className="text-2xl font-black font-headline uppercase tracking-tighter mb-4">Drag, Drop, Deploy</h3>
              <p className="text-lg mb-8 leading-relaxed max-w-2xl text-on-surface/80">
                The fastest way to get your project online. No CLI needed.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white border-2 border-on-surface p-4 flex flex-col gap-3">
                  <div className="font-black text-xs opacity-40">STEP 1</div>
                  <h4 className="font-bold text-sm uppercase">Make Project</h4>
                  <p className="text-xs opacity-70 leading-relaxed">Click the "Make Project" button in the global header.</p>
                </div>
                <div className="bg-white border-2 border-on-surface p-4 flex flex-col gap-3">
                  <div className="font-black text-xs opacity-40">STEP 2</div>
                  <h4 className="font-bold text-sm uppercase">Select Folder</h4>
                  <p className="text-xs opacity-70 leading-relaxed">Choose your root directory. We'll bundle everything automatically.</p>
                </div>
                <div className="bg-white border-2 border-on-surface p-4 flex flex-col gap-3">
                  <div className="font-black text-xs opacity-40">STEP 3</div>
                  <h4 className="font-bold text-sm uppercase">Upload .cast</h4>
                  <p className="text-xs opacity-70 leading-relaxed">(Optional) Add a recording to guide your users through the tool.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 04. Execution Path B: CLI */}
      <section id="cli-flow" className="mb-32 scroll-mt-32">
        <div className="flex items-center gap-4 mb-12">
          <h2 className="font-headline text-4xl font-black uppercase tracking-tighter">04. CLI Native Flow</h2>
          <div className="h-[4px] flex-grow bg-on-surface/20"></div>
        </div>

        <div className="bg-surface-container-low border-4 border-on-surface p-8 hard-shadow relative overflow-hidden group">
          <div className="relative z-10 flex flex-col md:flex-row gap-12 items-start">
            <div className="flex-shrink-0 w-16 h-16 bg-on-surface text-white flex items-center justify-center text-3xl font-black font-headline border-4 border-on-surface hard-shadow-sm">B</div>
            <div className="flex-grow">
              <h3 className="text-2xl font-black font-headline uppercase tracking-tighter mb-4">The Power User Workflow</h3>
              <p className="text-lg mb-8 leading-relaxed max-w-2xl text-on-surface/80">
                Best for complex recordings and automated project management.
              </p>
              
              <div className="space-y-6 max-w-3xl">
                <div className="flex gap-4 items-center">
                  <div className="bg-background border-2 border-on-surface px-4 py-2 font-mono text-sm flex items-center gap-4 flex-grow">
                    <span className="text-primary font-bold">$</span>
                    <span>swacn auth login &lt;token&gt;</span>
                  </div>
                  <Link to="/cli" className="bg-on-surface text-white p-2 border-2 border-on-surface hard-shadow-sm hover:scale-105 transition-transform">
                    <Download size={20} />
                  </Link>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-white border-2 border-on-surface p-4">
                    <div className="font-bold text-[10px] uppercase text-primary mb-2">1. Local Record</div>
                    <code className="text-sm font-bold">$ swacn record --fs --keys</code>
                    <p className="text-[10px] mt-2 opacity-50 italic">The --fs flag captures your current folder snapshot.</p>
                  </div>
                  <div className="bg-white border-2 border-on-surface p-4">
                    <div className="font-bold text-[10px] uppercase text-primary mb-2">2. Remote Sync</div>
                    <code className="text-sm font-bold">$ swacn upload</code>
                    <p className="text-[10px] mt-2 opacity-50 italic">Uploads the manifest, filesystem, and cast.</p>
                  </div>
                </div>
                
                <div className="bg-error/10 border-l-4 border-error p-4">
                  <h4 className="text-error font-black uppercase text-xs flex items-center gap-2 mb-2">
                    <ShieldAlert size={14} /> Critical Security Note
                  </h4>
                  <p className="text-xs leading-relaxed font-medium">
                    Running <code className="font-bold">--fs</code> will capture EVERYTHING in the current directory. <strong>Check for hidden files (.git, .env, .ssh)</strong> before running the record command.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 05. Advanced: swacn.json */}
      <section className="mb-32">
        <div className="flex items-center gap-4 mb-12">
          <h2 className="font-headline text-4xl font-black uppercase tracking-tighter">05. Advanced: swacn.json</h2>
          <div className="h-[4px] flex-grow bg-on-surface"></div>
        </div>

        <div className="bg-white border-4 border-on-surface p-8 hard-shadow relative overflow-hidden group">
          <div className="absolute -top-10 -right-10 text-on-surface opacity-5 transform group-hover:scale-110 transition-transform duration-700 pointer-events-none">
            <FileJson size={300} />
          </div>
          <div className="relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-12">
            <div>
              <p className="text-lg leading-relaxed text-on-surface/80 mb-6">
                The <code className="bg-on-surface/10 px-2 py-0.5 rounded font-bold">swacn.json</code> file is the blueprint for your sandbox. 
              </p>
              <div className="bg-primary/10 border-l-4 border-primary p-4 mb-6">
                 <p className="text-sm font-bold text-primary uppercase mb-1">💡 Important Note</p>
                 <p className="text-sm opacity-80">This file is <strong>only required if you use the CLI</strong>. If you use the Web Upload flow, we build this manifest for you based on the form data.</p>
              </div>
              <div className="space-y-4">
                <div className="border-l-4 border-primary pl-4 py-1">
                  <span className="font-bold block text-sm mb-1 uppercase">project</span>
                  <p className="text-sm opacity-70">The human-readable name of your workspace.</p>
                </div>
                <div className="border-l-4 border-primary pl-4 py-1">
                  <span className="font-bold block text-sm mb-1 uppercase">env</span>
                  <p className="text-sm opacity-70">Key-value pairs to set in the shell environment.</p>
                </div>
                <div className="border-l-4 border-primary pl-4 py-1">
                  <span className="font-bold block text-sm mb-1 uppercase">binaries</span>
                  <p className="text-sm opacity-70">Define the external tools to be installed in the environment.</p>
                </div>
              </div>
            </div>
            <div className="bg-background border-2 border-on-surface p-6 font-mono text-sm overflow-x-auto shadow-inner">
<pre className="text-on-surface/90">{`{
  "project": "my-awesome-cli",
  "env": {
    "PATH": "/usr/local/bin:/bin:/usr/bin",
    "DEBUG": "true"
  },
  "binaries": {
    "x86_32": [
      {
        "name": "yq",
        "url": "https://.../yq_linux_386",
        "install_path": "/usr/bin"
      }
    ]
  }
}`}</pre>
            </div>
          </div>
        </div>
      </section>

      {/* 06. Polish & Customization */}
      <section className="mb-32">
        <div className="flex items-center gap-4 mb-12">
          <h2 className="font-headline text-4xl font-black uppercase tracking-tighter">06. Polish & Customization</h2>
          <div className="h-[4px] flex-grow bg-on-surface"></div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Themes */}
          <div className="bg-white border-4 border-on-surface p-8 hard-shadow flex flex-col gap-6">
            <div className="bg-surface-container-high p-3 border-2 border-on-surface w-max">
              <Settings size={24} className="text-primary" />
            </div>
            <h3 className="text-2xl font-black font-headline uppercase tracking-tighter">Terminal Aesthetics</h3>
            <p className="text-on-surface/70 leading-relaxed">
              Personalize your sandbox from the Dashboard. We support the full <strong>Catppuccin</strong> palette (Mocha, Latte, Frappe, Macchiato) for the terminal UI.
            </p>
            <div className="mt-auto flex gap-2">
              <div className="w-6 h-6 bg-[#1e1e2e] border border-on-surface"></div>
              <div className="w-6 h-6 bg-[#eff1f5] border border-on-surface"></div>
              <div className="w-6 h-6 bg-[#303446] border border-on-surface"></div>
              <div className="w-6 h-6 bg-[#24273a] border border-on-surface"></div>
            </div>
          </div>

          {/* welcome.txt */}
          <div className="bg-white border-4 border-on-surface p-8 hard-shadow flex flex-col gap-6 relative overflow-hidden">
             <div className="absolute top-4 right-4 text-primary animate-pulse">
                <Sparkles size={24} />
             </div>
            <h3 className="text-2xl font-black font-headline uppercase tracking-tighter">Custom Greeting</h3>
            <p className="text-on-surface/70 leading-relaxed">
              Add a <code className="font-bold">welcome.txt</code> to your root folder. It will be automatically printed to the terminal screen the moment a user launches the sandbox.
            </p>
            <div className="bg-background/10 border-2 border-on-surface/20 p-3 font-mono text-[10px] italic">
              $ cat welcome.txt<br/>
              "Welcome to the sandbox! Run 'ls' to see my code."
            </div>
          </div>
        </div>
      </section>

      {/* 07. Privacy & Limits */}
      <section className="mb-32">
        <div className="flex items-center gap-4 mb-12">
          <h2 className="font-headline text-4xl font-black uppercase tracking-tighter">07. Privacy & Limits</h2>
          <div className="h-[4px] flex-grow bg-error/20"></div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="bg-error text-white p-8 border-4 border-on-surface hard-shadow flex flex-col gap-6">
            <div className="bg-white text-error p-3 border-2 border-on-surface w-max">
              <ShieldAlert size={32} />
            </div>
            <h3 className="text-3xl font-black font-headline uppercase tracking-tighter">Nothing is Hidden</h3>
            <p className="text-lg leading-relaxed opacity-90">
              The "Disable Download" toggle in settings is a UI visual only. Determined users can always extract files from the browser VM state.
            </p>
            <p className="font-black uppercase text-sm underline decoration-white/50 underline-offset-4">
              Never upload sensitive credentials.
            </p>
          </div>

          <div className="bg-white border-4 border-on-surface p-8 hard-shadow flex flex-col gap-6">
             <div className="bg-surface-container-high p-3 border-2 border-on-surface w-max">
              <Box size={32} />
            </div>
            <h3 className="text-3xl font-black font-headline uppercase tracking-tighter">Platform Constraints</h3>
            <ul className="space-y-4 font-mono text-base">
              <li className="flex items-center gap-4">
                <div className="w-3 h-3 bg-primary"></div>
                <span className="font-bold">Max 15 Active Projects</span>
              </li>
              <li className="flex items-center gap-4">
                <div className="w-3 h-3 bg-primary"></div>
                <span className="font-bold text-error">2MB Max Payload Size</span>
              </li>
              <li className="flex items-center gap-4">
                <div className="w-3 h-3 bg-primary"></div>
                <span className="font-bold">Public URLs by Default</span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* Deep Dive Footer */}
      <div className="mt-32 border-t-4 border-on-surface pt-12 flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
        <div>
          <h2 className="font-headline text-2xl font-black uppercase tracking-tighter text-on-surface">Infrastructure</h2>
          <p className="font-mono text-sm mt-2 max-w-lg text-on-surface/60">
            Powered by a high-performance C++ backend, deduplicated storage engine, and v86 hardware emulation.
          </p>
        </div>
        <div className="flex gap-4 opacity-50 grayscale">
          <Box size={32} />
          <FileTerminal size={32} />
          <ServerCog size={32} />
        </div>
      </div>

    </div>
  );
}
