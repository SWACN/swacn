import React from 'react';
import { Terminal, PlayCircle, Share2, ServerCog, ArrowRight, Laptop, Box, FileTerminal, Download, FileJson, UploadCloud, Settings, MousePointer2, FolderUp, Sparkles, ShieldAlert, Cpu, CheckCircle2, Zap, Lock, Globe, Layers, PlusCircle } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';

export function Guide() {
  const navigate = useNavigate();

  return (
    <div className="max-w-7xl mx-auto px-6 py-12 md:py-20 bg-background">
      
      {/* Hero Section */}
      <header className="mb-24 md:mb-32 relative">
        <div className="absolute -top-20 -left-20 w-64 h-64 bg-primary/10 rounded-full blur-3xl -z-10 animate-pulse"></div>
        <div className="border-l-8 border-on-surface pl-6 md:pl-10">
          <p className="font-mono text-primary text-sm md:text-base tracking-[0.3em] uppercase mb-4 font-black">Technical Documentation</p>
          <h1 className="text-5xl md:text-8xl font-black font-headline tracking-tighter uppercase leading-[0.9] mb-8">
            Master the<br/>SWACN Lab
          </h1>
          <p className="text-lg md:text-2xl max-w-3xl font-medium leading-relaxed text-on-surface/80">
            Build interactive, browser-native terminal sandboxes. Record interactions, bundle filesystems, and share executable environments instantly.
          </p>
        </div>
      </header>

      {/* Account Tiers Comparison */}
      <section className="mb-32">
        <div className="flex items-center gap-4 mb-12">
          <h2 className="font-headline text-4xl font-black uppercase tracking-tighter flex items-center gap-4">
            <Layers className="text-primary" /> 01. Choose Your Tier
          </h2>
          <div className="h-[4px] flex-grow bg-on-surface/10"></div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Free Tier */}
          <div className="bg-white border-4 border-on-surface p-8 hard-shadow flex flex-col relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-110 transition-transform duration-500 text-on-surface">
              <Zap size={120} />
            </div>
            <h3 className="text-3xl font-black font-headline uppercase tracking-tighter mb-2">Standard</h3>
            <p className="text-on-surface/60 font-mono text-sm mb-8">Perfect for hobbyists and open source demos.</p>
            
            <ul className="space-y-4 mb-12">
              <li className="flex items-center gap-3">
                <CheckCircle2 size={18} className="text-primary shrink-0" />
                <span className="font-bold">15 Active Projects</span>
              </li>
              <li className="flex items-center gap-3">
                <CheckCircle2 size={18} className="text-primary shrink-0" />
                <span className="font-bold">Standard Payload Limit</span>
              </li>
              <li className="flex items-center gap-3">
                <CheckCircle2 size={18} className="text-primary shrink-0" />
                <span className="font-bold">Public Visibility Only</span>
              </li>
              <li className="flex items-center gap-3">
                <CheckCircle2 size={18} className="text-primary shrink-0" />
                <span className="font-bold">Single Cast Recording</span>
              </li>
            </ul>
            
            <div className="mt-auto pt-8 border-t-2 border-dashed border-on-surface/10">
              <span className="text-2xl font-black font-mono">$0/month</span>
            </div>
          </div>

          {/* Pro Tier */}
          <div className="bg-primary text-background border-4 border-on-surface p-8 hard-shadow flex flex-col relative overflow-hidden group">
             <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-3xl"></div>
            <div className="absolute top-0 right-0 p-4 opacity-20 text-white group-hover:scale-110 transition-transform duration-500">
              <Sparkles size={120} />
            </div>
            <div className="bg-white text-primary px-3 py-1 text-[10px] font-black uppercase tracking-widest w-max mb-4">Most Popular</div>
            <h3 className="text-3xl font-black font-headline uppercase tracking-tighter mb-2">Pro & Creator</h3>
            <p className="text-background/60 font-mono text-sm mb-8 text-white/60">Built for technical writers and enterprise teams.</p>
            
            <ul className="space-y-4 mb-12 text-white">
              <li className="flex items-center gap-3">
                <Sparkles size={18} className="text-background shrink-0" />
                <span className="font-bold">50 Active Projects</span>
              </li>
              <li className="flex items-center gap-3">
                <Sparkles size={18} className="text-background shrink-0" />
                <span className="font-bold">Increased Payload Capacity</span>
              </li>
              <li className="flex items-center gap-3">
                <Sparkles size={18} className="text-background shrink-0" />
                <span className="font-bold">Private & Unlisted Projects</span>
              </li>
              <li className="flex items-center gap-3">
                <Sparkles size={18} className="text-background shrink-0" />
                <span className="font-bold">Multiple Casts per Project</span>
              </li>
            </ul>
            
            <div className="mt-auto pt-8 border-t-2 border-dashed border-background/20">
              <span className="text-2xl font-black font-mono">$10/month</span>
            </div>
          </div>
        </div>
      </section>

      {/* 02. Preparation */}
      <section className="mb-32">
        <div className="flex items-center gap-4 mb-12">
          <h2 className="font-headline text-4xl font-black uppercase tracking-tighter">02. Prepare Your Payload</h2>
          <div className="h-[4px] flex-grow bg-on-surface"></div>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          <div className="space-y-8">
            <p className="text-xl leading-relaxed text-on-surface/80">
              SWACN sandboxes are generated from a local folder. You don't need complex configuration files; our web builder handles the environment manifest for you.
            </p>
            
            <div className="bg-surface-container-high border-l-8 border-primary p-6">
              <h4 className="font-black uppercase text-sm mb-2 flex items-center gap-2">
                <CheckCircle2 size={16} className="text-primary" /> The Root Directory
              </h4>
              <p className="text-sm opacity-70 leading-relaxed mb-4">
                Pick a folder on your machine. Everything inside will be bundled into a compressed <code className="font-bold">baseline.tar.gz</code> and loaded into the VM's <code className="font-bold">/root</code> home.
              </p>
              <div className="bg-error/5 border-2 border-error/20 p-4 flex gap-4 items-start">
                <ShieldAlert size={20} className="text-error shrink-0 mt-1" />
                <p className="text-xs font-bold text-error leading-relaxed uppercase">
                  Security Check: Ensure your folder does not contain <code className="bg-error/10">.env</code>, <code className="bg-error/10">.ssh</code>, or other private credentials.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white border-2 border-on-surface p-4">
                <h5 className="font-bold text-xs uppercase mb-1">welcome.txt</h5>
                <p className="text-[10px] opacity-60">Add this to print a custom greeting on terminal boot.</p>
              </div>
              <div className="bg-white border-2 border-on-surface p-4">
                <h5 className="font-bold text-xs uppercase mb-1">init.sh</h5>
                <p className="text-[10px] opacity-60">Add this to run setup commands (like npm install) automatically.</p>
              </div>
            </div>
          </div>

          <div className="bg-on-surface text-background p-8 hard-shadow font-mono text-sm leading-relaxed relative">
             <div className="absolute top-4 right-4 flex gap-1">
                <div className="w-2 h-2 rounded-full bg-red-500"></div>
                <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
                <div className="w-2 h-2 rounded-full bg-green-500"></div>
             </div>
             <div className="mb-4 text-primary font-bold tracking-widest uppercase text-xs"># Recommended Structure</div>
             <pre className="text-background/80 leading-tight">
{`my-project/
├── welcome.txt      # Optional Greeting
├── init.sh          # Optional Startup Script
├── src/             # Your Source Code
│   └── main.py
└── data/            # Static Assets
    └── config.yaml`}
             </pre>
          </div>
        </div>
      </section>

      {/* 03. Web Flow */}
      <section className="mb-32">
        <div className="flex items-center gap-4 mb-12">
          <h2 className="font-headline text-4xl font-black uppercase tracking-tighter">03. Deployment Flow</h2>
          <div className="h-[4px] flex-grow bg-on-surface/20"></div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="flex flex-col gap-4 group">
            <div className="w-12 h-12 bg-on-surface text-background flex items-center justify-center font-black text-2xl group-hover:bg-primary transition-colors">1</div>
            <h4 className="text-xl font-black uppercase tracking-tight">Initiate</h4>
            <p className="text-sm opacity-70 leading-relaxed">
              Click <strong className="text-primary font-black">"MAKE PROJECT"</strong> in the header. If you're not signed in, we'll prompt you for GitHub/Google auth.
            </p>
          </div>
          <div className="flex flex-col gap-4 group">
            <div className="w-12 h-12 bg-on-surface text-background flex items-center justify-center font-black text-2xl group-hover:bg-primary transition-colors">2</div>
            <h4 className="text-xl font-black uppercase tracking-tight">Configure</h4>
            <p className="text-sm opacity-70 leading-relaxed">
              Set your project name, environment variables, and any external binaries you need from GitHub releases.
            </p>
          </div>
          <div className="flex flex-col gap-4 group">
            <div className="w-12 h-12 bg-on-surface text-background flex items-center justify-center font-black text-2xl group-hover:bg-primary transition-colors">3</div>
            <h4 className="text-xl font-black uppercase tracking-tight">Upload</h4>
            <p className="text-sm opacity-70 leading-relaxed">
              Select your local folder and your <code className="font-bold">.cast</code> recording. Hit upload and your lab will be live in seconds.
            </p>
          </div>
        </div>
      </section>

      {/* 04. Technical Requirements */}
      <section className="mb-32">
        <div className="flex items-center gap-4 mb-12">
          <h2 className="font-headline text-4xl font-black uppercase tracking-tighter flex items-center gap-4">
            <Cpu className="text-primary" /> 04. Binary Compatibility
          </h2>
          <div className="h-[4px] flex-grow bg-primary/20"></div>
        </div>

        <div className="bg-white border-4 border-on-surface p-12 hard-shadow relative overflow-hidden">
          <div className="relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <p className="text-lg leading-relaxed text-on-surface/80 mb-6">
                The SWACN WebVM uses <strong>v86 hardware emulation</strong>. This means you are running a real x86 environment in the browser. 
              </p>
              <div className="bg-primary/5 border-l-4 border-primary p-6 mb-8 font-mono text-sm">
                <h5 className="font-black uppercase mb-2 text-primary">Requirement Checklist:</h5>
                <ul className="space-y-2">
                  <li>• Architecture: <strong>x86 (32-bit/i386)</strong></li>
                  <li>• Linking: <strong>Static</strong> (no dynamic libc dependencies)</li>
                  <li>• OS: <strong>Linux</strong> compatible</li>
                </ul>
              </div>
              <p className="text-sm opacity-60 italic">
                Pro-tip: Search for "linux-386" or "i386" in GitHub Releases. Most Go and Rust tools provide these.
              </p>
            </div>
            <div className="space-y-4">
               <div className="bg-background border-2 border-on-surface p-4 font-mono text-xs">
                  <div className="text-primary font-bold mb-2">// Binary Config in Lab</div>
                  <div className="opacity-50">name=yq</div>
                  <div className="opacity-50 break-all">url=https://github.com/mikefarah/yq/releases/download/v4.40.5/yq_linux_386</div>
               </div>
               <div className="bg-background border-2 border-on-surface p-4 font-mono text-xs">
                  <div className="text-primary font-bold mb-2">// Environment Check</div>
                  <div className="opacity-50">$ file ./my-tool</div>
                  <div className="opacity-50">my-tool: ELF 32-bit LSB executable, Intel 80386, statically linked</div>
               </div>
            </div>
          </div>
        </div>
      </section>

      {/* 05. Advanced Config */}
      <section className="mb-32">
        <div className="flex items-center gap-4 mb-12">
          <h2 className="font-headline text-4xl font-black uppercase tracking-tighter">05. Advanced Controls</h2>
          <div className="h-[4px] flex-grow bg-on-surface"></div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
           <div className="bg-white border-4 border-on-surface p-8 hard-shadow">
              <div className="w-12 h-12 bg-surface-container-high border-2 border-on-surface flex items-center justify-center mb-6">
                <Settings size={24} className="text-primary" />
              </div>
              <h3 className="text-2xl font-black uppercase font-headline tracking-tighter mb-4">Environment Injection</h3>
              <p className="text-on-surface/70 leading-relaxed text-sm mb-6">
                Inject custom variables into the shell session. These are available in both the interactive terminal and your <code className="font-bold">init.sh</code> script.
              </p>
              <div className="bg-background p-4 border-2 border-on-surface font-mono text-[10px]">
                API_KEY=********<br/>
                DEBUG=true<br/>
                THEME=nord
              </div>
           </div>

           <div className="bg-white border-4 border-on-surface p-8 hard-shadow">
              <div className="w-12 h-12 bg-surface-container-high border-2 border-on-surface flex items-center justify-center mb-6">
                <Globe size={24} className="text-primary" />
              </div>
              <h3 className="text-2xl font-black uppercase font-headline tracking-tighter mb-4">Project Visibility</h3>
              <p className="text-on-surface/70 leading-relaxed text-sm mb-6">
                Manage who can see your lab. Pro users can toggle projects between Public and Private from the Dashboard or Project Modal.
              </p>
              <div className="flex gap-4">
                 <div className="flex items-center gap-2 text-xs font-black opacity-40">
                    <Globe size={14} /> PUBLIC
                 </div>
                 <div className="flex items-center gap-2 text-xs font-black text-primary">
                    <Lock size={14} /> PRIVATE (PRO ONLY)
                 </div>
              </div>
           </div>
        </div>
      </section>

      {/* 06. Polish */}
      <section className="mb-32">
        <div className="flex items-center gap-4 mb-12">
          <h2 className="font-headline text-4xl font-black uppercase tracking-tighter flex items-center gap-4">
            <Sparkles className="text-primary" /> 06. Terminal Aesthetics
          </h2>
          <div className="h-[4px] flex-grow bg-on-surface/10"></div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
           <div className="bg-on-surface text-background p-12 hard-shadow">
              <h3 className="text-2xl font-black uppercase font-headline tracking-tighter mb-4 text-white">Color Palettes</h3>
              <p className="text-white/70 leading-relaxed mb-8">
                SWACN supports native brand themes and the full <strong>Catppuccin</strong> color palette. Personalize your terminal experience via the Lab settings.
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                 <div className="flex items-center gap-3 bg-white/10 border-2 border-white/20 px-4 py-2">
                    <div className="w-4 h-4 bg-[#fcf9f0] border border-white/20"></div>
                    <span className="font-mono text-[10px] font-black uppercase text-white">SWACN</span>
                 </div>
                 <div className="flex items-center gap-3 bg-white/10 border-2 border-white/20 px-4 py-2">
                    <div className="w-4 h-4 bg-[#1c1c17]"></div>
                    <span className="font-mono text-[10px] font-black uppercase text-white">Dark</span>
                 </div>
                 <div className="flex items-center gap-3 bg-white/10 border-2 border-white/20 px-4 py-2">
                    <div className="w-4 h-4 bg-[#eff1f5]"></div>
                    <span className="font-mono text-[10px] font-black uppercase text-white">Latte</span>
                 </div>
                 <div className="flex items-center gap-3 bg-white/10 border-2 border-white/20 px-4 py-2">
                    <div className="w-4 h-4 bg-[#303446]"></div>
                    <span className="font-mono text-[10px] font-black uppercase text-white">Frappe</span>
                 </div>
                 <div className="flex items-center gap-3 bg-white/10 border-2 border-white/20 px-4 py-2">
                    <div className="w-4 h-4 bg-[#24273a]"></div>
                    <span className="font-mono text-[10px] font-black uppercase text-white">Macchiato</span>
                 </div>
                 <div className="flex items-center gap-3 bg-white/10 border-2 border-white/20 px-4 py-2">
                    <div className="w-4 h-4 bg-[#1e1e2e]"></div>
                    <span className="font-mono text-[10px] font-black uppercase text-white">Mocha</span>
                 </div>
              </div>
           </div>

           <div className="bg-primary text-white p-12 hard-shadow flex flex-col justify-center">
              <h3 className="text-2xl font-black uppercase font-headline tracking-tighter mb-4">Keyboard HUD</h3>
              <p className="text-white/80 leading-relaxed text-sm mb-6">
                Enhance your screencasts with our built-in <strong>Keystroke Visualizer</strong>. During playback, a tactile HUD overlays real-time inputs. To enable this, record your session with the <code>--stdin</code> flag:
              </p>
              <div className="bg-on-surface p-4 border-2 border-white/20 font-mono text-xs mb-8">
                $ asciinema rec --stdin project.cast
              </div>
              <div className="flex justify-center">
                 <div className="bg-white text-primary border-4 border-on-surface px-8 py-4 font-mono font-black hard-shadow flex items-center gap-4">
                    <span className="tracking-tighter text-2xl uppercase">Ctrl + C</span>
                    <span className="bg-primary text-white border-2 border-on-surface text-xs px-2 py-0.5 uppercase">x1</span>
                 </div>
              </div>
           </div>
        </div>
      </section>

      {/* 07. Security */}
      <section className="mb-32">
        <div className="flex items-center gap-4 mb-12">
          <h2 className="font-headline text-4xl font-black uppercase tracking-tighter text-error">07. Security & Privacy</h2>
          <div className="h-[4px] flex-grow bg-error/20"></div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
           <div className="bg-white border-4 border-error p-8 hard-shadow">
              <div className="flex items-center gap-4 mb-6">
                 <div className="w-12 h-12 bg-error text-white flex items-center justify-center">
                    <Lock size={24} />
                 </div>
                 <h3 className="text-2xl font-black uppercase font-headline tracking-tighter">Private Labs</h3>
              </div>
              <p className="text-on-surface/70 leading-relaxed text-sm">
                Pro projects are secured by role-based access control. Unauthorized users cannot boot the VM or download the filesystem assets. However, once a user is authorized, assets are cached locally for performance.
              </p>
           </div>

           <div className="bg-error text-white p-8 hard-shadow flex flex-col md:flex-row gap-6 items-center">
              <ShieldAlert size={60} className="shrink-0" />
              <div>
                 <h3 className="text-xl font-black uppercase font-headline tracking-tighter mb-2">Memory Forensics</h3>
                 <p className="text-sm opacity-90">
                   Since the VM runs in-browser, any authorized user can extract files directly from memory. <strong>Never upload production credentials or sensitive PII.</strong>
                 </p>
              </div>
           </div>
        </div>
      </section>


    </div>
  );
}
