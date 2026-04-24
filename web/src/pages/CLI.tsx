import React, { useState, useEffect } from 'react';
import { Terminal, Download, Copy, Check, ChevronRight, Command, Package, Zap, X } from 'lucide-react';
import { getAuthToken } from '../lib/api';

export function CLI() {
  const [copied, setCopied] = useState(false);
  const [modalCopied, setModalCopied] = useState(false);
  const [installPlatform, setInstallPlatform] = useState<'unix' | 'windows'>('unix');
  const [token, setToken] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    // Basic OS detection
    const ua = window.navigator.userAgent.toLowerCase();
    if (ua.includes('win')) {
      setInstallPlatform('windows');
    }
    
    // Sync token state
    setToken(getAuthToken());
  }, []);

  const installCmdUnix = "curl -fsSL https://raw.githubusercontent.com/karthikeyjoshi/swacn/main/scripts/install.sh | bash";
  const installCmdWindows = "irm https://raw.githubusercontent.com/karthikeyjoshi/swacn/main/scripts/install.ps1 | iex";

  const currentCmd = installPlatform === 'unix' ? installCmdUnix : installCmdWindows;

  const handleCopy = () => {
    navigator.clipboard.writeText(currentCmd);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleModalCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setModalCopied(true);
    setTimeout(() => setModalCopied(false), 2000);
  };

  const handleGetCLI = () => {
    if (!token) {
      window.location.href = '/api/auth/github/login';
    } else {
      setShowModal(true);
    }
  };

  const loginCmd = `swacn auth login ${token}`;

  return (
    <div className="max-w-7xl mx-auto px-6 pt-8 md:pt-16 pb-12 md:pb-24">
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
            A lightweight, cross-platform C++ CLI for capturing your terminal sessions and workspace filesystem. Built for developers to seamlessly share interactive coding environments.
          </p>
          <div className="flex flex-wrap gap-4">
            <button 
              onClick={handleGetCLI}
              className="bg-black text-white border-4 border-on-surface px-8 py-4 text-xl font-bold hover:translate-x-[4px] hover:translate-y-[4px] transition-none hard-shadow flex items-center gap-4 w-full md:w-auto justify-center"
            >
              <Terminal size={24} />
              {token ? 'View API Key' : 'Authenticate CLI'}
            </button>
            <a href="https://github.com/karthikeyjoshi/swacn/releases/latest" target="_blank" rel="noopener noreferrer" className="bg-primary text-on-primary border-4 border-on-surface px-8 py-4 text-xl font-bold hover:translate-x-[4px] hover:translate-y-[4px] transition-none hard-shadow flex items-center gap-4 flex-1 md:flex-none justify-center">
              <Download size={24} />
              Releases
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
            <h3 className="font-headline text-2xl font-black uppercase mb-4 tracking-tighter">Cross-Platform</h3>
            <p className="text-sm leading-relaxed opacity-70">Available natively for Windows, macOS (Apple Silicon), and Linux. A fast C++ executable that integrates seamlessly into your terminal.</p>
          </div>
          <div className="border-4 border-on-surface p-8 bg-surface-container-high">
            <div className="w-12 h-12 bg-on-surface text-background flex items-center justify-center mb-6">
              <Package size={24} />
            </div>
            <h3 className="font-headline text-2xl font-black uppercase mb-4 tracking-tighter">Filesystem Snapshots</h3>
            <p className="text-sm leading-relaxed opacity-70">Capture the complete state of your workspace. SWACN automatically bundles your codebase so viewers can interact with your actual files.</p>
          </div>
          <div className="border-4 border-on-surface p-8 bg-white">
            <div className="w-12 h-12 bg-primary text-on-primary flex items-center justify-center mb-6">
              <Terminal size={24} />
            </div>
            <h3 className="font-headline text-2xl font-black uppercase mb-4 tracking-tighter">Asciinema Powered</h3>
            <p className="text-sm leading-relaxed opacity-70">SWACN acts as a powerful wrapper around the standard Asciinema CLI, enabling high-fidelity keystroke and output recording.</p>
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
            { cmd: "swacn auth login <K>", desc: "Verify and securely save your API key." },
            { cmd: "swacn record", desc: "Start an interactive terminal recording." },
            { cmd: "swacn record --fs", desc: "Start recording AND capture the local filesystem state." },
            { cmd: "swacn record --keys", desc: "Start recording AND capture raw keystrokes." },
            { cmd: "swacn record --norec", desc: "Setup the recording environment without launching a terminal recording." },
            { cmd: "swacn record --overwrite", desc: "Overwrite any existing recording in the .swacn directory." },
            { cmd: "swacn upload", desc: "Upload the finished recording to the SWACN cloud." },
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



      {/* --- CLI ACCESS MODAL --- */}
      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-on-surface/40 backdrop-blur-sm">
          <div className="bg-background border-4 border-on-surface w-full max-w-2xl hard-shadow overflow-hidden">
            <div className="bg-on-surface p-4 flex justify-between items-center">
              <div className="flex items-center gap-2 text-background font-mono text-sm font-bold">
                <Terminal size={18} />
                <span>SWACN_AUTH_PROMPT</span>
              </div>
              <button onClick={() => setShowModal(false)} className="text-background hover:text-primary">
                <X size={24} />
              </button>
            </div>

            <div className="p-8">
              <h2 className="font-headline text-3xl font-black uppercase mb-4">You're Authenticated.</h2>
              <p className="font-mono text-sm mb-8 opacity-70">Use the following key to authorize your local machine with the SWACN kernel.</p>

              <div className="space-y-6">
                {/* API Key Box */}
                <div>
                  <label className="font-mono text-[10px] font-bold uppercase text-primary block mb-2">Your Secret API Key</label>
                  <div className="flex items-center justify-between bg-surface-container-high border-2 border-on-surface p-4 font-mono text-sm">
                    <span className="truncate mr-4">{token}</span>
                    <button onClick={() => handleModalCopy(token || '')} className="text-primary hover:scale-110 transition-transform">
                      {modalCopied ? <Check size={18} /> : <Copy size={18} />}
                    </button>
                  </div>
                </div>

                {/* Command Box */}
                <div>
                  <label className="font-mono text-[10px] font-bold uppercase text-primary block mb-2">Run this in your terminal</label>
                  <div className="bg-on-surface text-background p-4 font-mono text-sm flex justify-between items-center border-2 border-on-surface">
                    <code>{loginCmd}</code>
                    <button onClick={() => handleModalCopy(loginCmd)} className="text-primary">
                      <Copy size={18} />
                    </button>
                  </div>
                </div>

                <div className="pt-4 border-t-2 border-on-surface/10 flex justify-between items-center font-mono text-[10px] opacity-50 uppercase tracking-widest">
                  <span>Target: {window.location.hostname}</span>
                  <span>Protocol: v1.0.4-secure</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
