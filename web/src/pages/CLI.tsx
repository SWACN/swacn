import React, { useState, useEffect } from 'react';
import { Terminal, Download, Copy, Check, ChevronRight, Command, Package, Zap } from 'lucide-react';

export function CLI() {
  const [copied, setCopied] = useState(false);
  const [installPlatform, setInstallPlatform] = useState<'unix' | 'windows'>('unix');

  useEffect(() => {
    // Basic OS detection
    const ua = window.navigator.userAgent.toLowerCase();
    if (ua.includes('win')) {
      setInstallPlatform('windows');
    }
  }, []);

  const installCmdUnix = "curl -fsSL https://raw.githubusercontent.com/karthikeyjoshi/swacn/main/scripts/install.sh | bash";
  const installCmdWindows = "irm https://raw.githubusercontent.com/karthikeyjoshi/swacn/main/scripts/install.ps1 | iex";

  const currentCmd = installPlatform === 'unix' ? installCmdUnix : installCmdWindows;

  const handleCopy = () => {
    navigator.clipboard.writeText(currentCmd);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-12 md:py-24">
      {/* Hero Header */}
      <section className="mb-32 flex flex-col md:flex-row items-center gap-16">
        <div className="md:w-1/2">
          <div className="inline-flex items-center gap-2 bg-surface-container-high border-2 border-on-surface px-3 py-1 mb-6 font-mono text-xs font-bold uppercase tracking-widest text-primary">
            <Zap size={14} />
            v1.0.4 Release
          </div>
          <h1 className="font-headline text-6xl md:text-8xl font-black tracking-tighter leading-none mb-8 uppercase">
            The Command<br/>Line Interface.
          </h1>
          <p className="text-xl leading-relaxed mb-12 text-on-surface/80 max-w-xl">
            A high-performance binary written in C++ for real-time filesystem event sourcing. Zero dependencies, statically linked, and ready for your production pipeline.
          </p>
          <div className="flex flex-wrap gap-4">
            <a href="https://github.com/karthikeyjoshi/swacn/releases/latest" target="_blank" rel="noopener noreferrer" className="bg-primary text-on-primary border-4 border-on-surface px-8 py-4 text-xl font-bold hover:translate-x-[4px] hover:translate-y-[4px] transition-none hard-shadow flex items-center gap-4">
              <Download size={24} />
              Releases
            </a>
            <a href="https://github.com/karthikeyjoshi/swacn" target="_blank" rel="noopener noreferrer" className="bg-white text-on-surface border-4 border-on-surface px-8 py-4 text-xl font-bold hover:translate-x-[4px] hover:translate-y-[4px] transition-none flex items-center gap-4">
              <Package size={24} />
              View on GitHub
            </a>
          </div>
        </div>
        <div className="md:w-1/2 w-full">
          <div className="border-4 border-on-surface hard-shadow bg-on-surface overflow-hidden">
            <div className="bg-surface-container-high px-4 py-2 border-b-4 border-on-surface flex items-center justify-between">
              <div className="flex gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500"></div>
                <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                <div className="w-3 h-3 rounded-full bg-green-500"></div>
              </div>
              <div className="flex">
                <button 
                  onClick={() => setInstallPlatform('unix')}
                  className={`font-mono text-[10px] font-bold uppercase tracking-widest px-3 py-1 transition-colors ${installPlatform === 'unix' ? 'text-primary' : 'text-on-surface/50 hover:text-on-surface'}`}
                >
                  Mac / Linux
                </button>
                <button 
                  onClick={() => setInstallPlatform('windows')}
                  className={`font-mono text-[10px] font-bold uppercase tracking-widest px-3 py-1 transition-colors ${installPlatform === 'windows' ? 'text-primary' : 'text-on-surface/50 hover:text-on-surface'}`}
                >
                  Windows
                </button>
              </div>
            </div>
            <div className="p-8 font-mono text-background min-h-[220px]">
              <p className="text-primary mb-4 text-sm"># One-liner installation script</p>
              <div className="flex items-center justify-between bg-white/5 p-4 border-2 border-white/10 group">
                <code className="text-sm md:text-base text-white overflow-x-auto whitespace-nowrap scrollbar-hide">
                  {currentCmd}
                </code>
                <button 
                  onClick={handleCopy}
                  className="ml-4 p-2 hover:bg-white/10 transition-colors text-primary flex-shrink-0"
                >
                  {copied ? <Check size={20} /> : <Copy size={20} />}
                </button>
              </div>
              <div className="mt-8 text-xs opacity-40 space-y-1">
                {installPlatform === 'unix' ? (
                  <>
                    <p>&gt; Verifying OS architecture...</p>
                    <p>&gt; Fetching swacn release from GitHub...</p>
                    <p>&gt; Installing to ~/.local/bin/swacn</p>
                  </>
                ) : (
                  <>
                    <p>&gt; Fetching swacn.exe release from GitHub...</p>
                    <p>&gt; Installing to AppData\Local\swacn\swacn.exe</p>
                    <p>&gt; Adding to user PATH...</p>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="mb-32">
        <div className="grid md:grid-cols-3 gap-8">
          <div className="border-4 border-on-surface p-8 bg-white">
            <div className="w-12 h-12 bg-primary text-on-primary flex items-center justify-center mb-6">
              <Command size={24} />
            </div>
            <h3 className="font-headline text-2xl font-black uppercase mb-4 tracking-tighter">Native Binary</h3>
            <p className="text-sm leading-relaxed opacity-70">Compiled with Clang 15 for maximum performance. No Node.js or Python runtime required. Just download and run.</p>
          </div>
          <div className="border-4 border-on-surface p-8 bg-surface-container-high">
            <div className="w-12 h-12 bg-on-surface text-background flex items-center justify-center mb-6">
              <Zap size={24} />
            </div>
            <h3 className="font-headline text-2xl font-black uppercase mb-4 tracking-tighter">Real-time Sync</h3>
            <p className="text-sm leading-relaxed opacity-70">Sub-millisecond latency for filesystem event detection. Your changes are indexed and ready before you can switch tabs.</p>
          </div>
          <div className="border-4 border-on-surface p-8 bg-white">
            <div className="w-12 h-12 bg-primary text-on-primary flex items-center justify-center mb-6">
              <Terminal size={24} />
            </div>
            <h3 className="font-headline text-2xl font-black uppercase mb-4 tracking-tighter">Rich Output</h3>
            <p className="text-sm leading-relaxed opacity-70">Beautifully formatted terminal UI with progress indicators, detailed error reporting, and JSON output for automation.</p>
          </div>
        </div>
      </section>

      {/* Command Reference */}
      <section className="mb-32">
        <div className="flex items-center gap-4 mb-12">
          <h2 className="font-headline text-4xl font-black uppercase tracking-tighter">Command Reference</h2>
          <div className="h-1 flex-grow bg-on-surface"></div>
        </div>
        <div className="space-y-4 font-mono">
          {[
            { cmd: "swacn init", desc: "Initialize a new SWACN workspace in the current directory." },
            { cmd: "swacn sync", desc: "Start the real-time filesystem watcher and sync to the cloud." },
            { cmd: "swacn status", desc: "Check the health of the local daemon and remote connection." },
            { cmd: "swacn log", desc: "View the global transaction log for the current workspace." },
            { cmd: "swacn rollback [id]", desc: "Revert the workspace state to a specific transaction ID." },
            { cmd: "swacn manifest", desc: "Generate a JSON manifest of the current system state." },
          ].map((item, idx) => (
            <div key={idx} className="border-2 border-on-surface p-6 flex flex-col md:flex-row md:items-center justify-between hover:bg-surface-container-high transition-colors group">
              <div className="flex items-center gap-4 mb-2 md:mb-0">
                <ChevronRight size={18} className="text-primary group-hover:translate-x-1 transition-transform" />
                <span className="font-bold text-lg">{item.cmd}</span>
              </div>
              <span className="text-sm opacity-60">{item.desc}</span>
            </div>
          ))}
        </div>
      </section>

      {/* OS Support */}
      <section className="border-4 border-on-surface p-12 bg-surface-container-low text-center">
        <h2 className="font-headline text-3xl font-black uppercase mb-8 tracking-tighter">Supported Architectures</h2>
        <div className="flex flex-wrap justify-center gap-12">
          <div className="flex flex-col items-center">
            <span className="font-bold text-4xl mb-2"></span>
            <span className="font-mono text-xs uppercase tracking-widest opacity-50">macOS (Apple Silicon)</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="font-bold text-4xl mb-2">🐧</span>
            <span className="font-mono text-xs uppercase tracking-widest opacity-50">Linux (x86_64/ARM64)</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="font-bold text-4xl mb-2">🪟</span>
            <span className="font-mono text-xs uppercase tracking-widest opacity-50">Windows (Native x86_64)</span>
          </div>
        </div>
      </section>
    </div>
  );
}
