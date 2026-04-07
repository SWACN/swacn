import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Settings, SquareTerminal, Palette, ListVideo, Play, Pause, XCircle } from 'lucide-react';
import { Terminal as XTerm } from '@xterm/xterm';
import * as AsciinemaPlayer from 'asciinema-player';
import 'asciinema-player/dist/bundle/asciinema-player.css';
import '@xterm/xterm/css/xterm.css';

import { fetchCasts } from '../lib/api';
import { CheerpXVM, VMStatus } from '../lib/CheerpXVM';

type Tab = 'projects' | 'settings';
type Theme = 'latte' | 'frappe' | 'macchiato' | 'mocha';

const CATPPUCCIN = {
  latte: { fg: "#4c4f69", bg: "#eff1f5", palette: "#5c5f77:#d20f39:#40a02b:#df8e1d:#1e66f5:#ea76cb:#179299:#acb0be:#6c6f85:#d20f39:#40a02b:#df8e1d:#1e66f5:#ea76cb:#179299:#bcc0cc" },
  frappe: { fg: "#c6d0f5", bg: "#303446", palette: "#51576d:#e78284:#a6d189:#e5c890:#8caaee:#f4b8e4:#81c8be:#b5bfe2:#626880:#e78284:#a6d189:#e5c890:#8caaee:#f4b8e4:#81c8be:#a5adce" },
  macchiato: { fg: "#cad3f5", bg: "#24273a", palette: "#494d64:#ed8796:#a6da95:#eed49f:#8aadf4:#f5bde6:#8bd5ca:#b8c0e0:#5b6078:#ed8796:#a6da95:#eed49f:#8aadf4:#f5bde6:#8bd5ca:#a5adcb" },
  mocha: { fg: "#cdd6f4", bg: "#1e1e2e", palette: "#45475a:#f38ba8:#a6e3a1:#f9e2af:#89b4fa:#f5c2e7:#94e2d5:#bac2de:#585b70:#f38ba8:#a6e3a1:#f9e2af:#89b4fa:#f5c2e7:#94e2d5:#a6adc8" }
};

const getXtermTheme = (themeName: Theme) => {
  // Fallback protection against corrupted localStorage state
  const t = CATPPUCCIN[themeName] || CATPPUCCIN['mocha'];
  const p = t.palette.split(':');
  return {
    background: '#00000000', // 8-digit hex for WebGL true transparency
    foreground: t.fg,
    cursor: t.fg,
    black: p[0], red: p[1], green: p[2], yellow: p[3], blue: p[4], magenta: p[5], cyan: p[6], white: p[7],
    brightBlack: p[8], brightRed: p[9], brightGreen: p[10], brightYellow: p[11], brightBlue: p[12], brightMagenta: p[13], brightCyan: p[14], brightWhite: p[15]
  };
};

export function Lab() {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [activeTab, setActiveTab] = useState<Tab>('projects');
  const [theme, setTheme] = useState<Theme>('mocha');
  const [projects, setProjects] = useState<any[]>([]);
  
  const [isPlaying, setIsPlaying] = useState(true);
  const [isSandboxMode, setIsSandboxMode] = useState(false);
  const [vmStatus, setVmStatus] = useState<VMStatus>('initializing');
  
  const playerContainerRef = useRef<HTMLDivElement>(null);
  const playerInstance = useRef<any>(null);
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermInstance = useRef<XTerm | null>(null);

  const manifestUrl = id ? `/uploads/${id}/manifest.json` : null;
  const baselineUrl = id ? `/uploads/${id}/baseline.tar.gz` : null;
  const recordingUrl = id ? `/uploads/${id}/recording.cast` : null;

  useEffect(() => {
    fetchCasts().then(setProjects).catch(console.error);
  }, []);

  useEffect(() => {
    const projectKey = `swacn-theme-${id || 'base'}`;
    const savedTheme = localStorage.getItem(projectKey) as Theme;
    if (savedTheme && CATPPUCCIN[savedTheme]) {
      setTheme(savedTheme);
    } else {
      setTheme('mocha');
    }
    setIsSandboxMode(!id);
  }, [id]);

  const handleThemeChange = (newTheme: Theme) => {
    setTheme(newTheme);
    localStorage.setItem(`swacn-theme-${id || 'base'}`, newTheme);
  };

  // --- ASCIINEMA INITIALIZATION (Crash-Proof) ---
  useEffect(() => {
    if (!playerContainerRef.current || !recordingUrl) return;

    if (playerInstance.current) {
      playerInstance.current.dispose();
    }

    const player = AsciinemaPlayer.create(recordingUrl, playerContainerRef.current, {
      loop: true,
      fit: 'none', 
      terminalFontSize: '15px', 
      terminalFontFamily: '"IBM Plex Mono", monospace'
      // NO THEME OPTION PASSED. We rely 100% on the CSS variables injected below.
    });

    playerInstance.current = player;

    player.addEventListener('pause', () => setIsPlaying(false));
    player.addEventListener('play', () => setIsPlaying(true));

    return () => {
      if (playerInstance.current) {
        playerInstance.current.dispose();
        playerInstance.current = null;
      }
    };
  }, [recordingUrl]); // Dependency array no longer includes 'theme'. No more unmounting!

  // --- XTERM INITIALIZATION ---
  useEffect(() => {
    if (!terminalRef.current) return;

    const term = new XTerm({
      fontFamily: '"IBM Plex Mono", monospace',
      fontSize: 15,
      fontWeight: '500', 
      allowTransparency: true, 
      theme: getXtermTheme(theme), 
      cursorBlink: true,
      convertEol: true,
    });

    xtermInstance.current = term;
    term.open(terminalRef.current);
    
    const vm = new CheerpXVM(term);
    vm.boot(manifestUrl, baselineUrl, (status) => setVmStatus(status));

    return () => {
      vm.dispose();
      term.dispose();
      xtermInstance.current = null;
    };
  }, [id]); 

  // Sync XTerm Theme dynamically
  useEffect(() => {
    if (xtermInstance.current) {
      xtermInstance.current.options.theme = getXtermTheme(theme);
    }
  }, [theme]);

  const handleTryNow = () => {
    if (vmStatus !== 'ready') return;
    setIsSandboxMode(true);
    playerInstance.current?.pause();
  };

  const handleReturnToPlayback = () => {
    setIsSandboxMode(false);
  };

  const formatStatus = (status: VMStatus) => {
    if (status === 'initializing') return 'Fetching Assets';
    if (status.includes('tools')) return 'Installing Config Binaries';
    return status.replace(/_/g, ' ');
  };

  // Safe fallback for Catppuccin themes
  const currentCatTheme = CATPPUCCIN[theme] || CATPPUCCIN['mocha'];
  const currentPalette = currentCatTheme.palette.split(':');

  return (
    <div className="flex-grow flex flex-col md:flex-row border-b-4 border-on-surface min-h-[calc(100vh-160px)]">
      
      <style>{`
        /* 1. AGGRESSIVE ASCIINEMA STRUCTURAL NUKE */
        asciinema-player, .ap-wrapper, .ap-player, .ap-terminal {
          width: 100% !important;
          height: 100% !important;
          background: transparent !important;
          background-color: transparent !important;
          border: none !important;
          margin: 0 !important;
          padding: 0 !important;
          box-shadow: none !important;
          --term-padding: 0px !important;
        }

        .ap-term {
        border: none !important;
        }

        .ap-wrapper {
          display: flex !important;
          justify-content: flex-start !important;
          align-items: flex-start !important;
        }

        /* 2. DYNAMIC CATPPUCCIN INJECTION
           These map directly into Asciinema's internal rendering engine natively. 
        */
        asciinema-player {
          --term-color-bg: transparent !important;
          --term-color-fg: ${currentCatTheme.fg} !important;
          --term-color-0: ${currentPalette[0]} !important;
          --term-color-1: ${currentPalette[1]} !important;
          --term-color-2: ${currentPalette[2]} !important;
          --term-color-3: ${currentPalette[3]} !important;
          --term-color-4: ${currentPalette[4]} !important;
          --term-color-5: ${currentPalette[5]} !important;
          --term-color-6: ${currentPalette[6]} !important;
          --term-color-7: ${currentPalette[7]} !important;
          --term-color-8: ${currentPalette[8]} !important;
          --term-color-9: ${currentPalette[9]} !important;
          --term-color-10: ${currentPalette[10]} !important;
          --term-color-11: ${currentPalette[11]} !important;
          --term-color-12: ${currentPalette[12]} !important;
          --term-color-13: ${currentPalette[13]} !important;
          --term-color-14: ${currentPalette[14]} !important;
          --term-color-15: ${currentPalette[15]} !important;
        }

        /* 3. XTERM TRANSPARENCY ENFORCEMENT */
        .xterm, .xterm-viewport, .xterm-screen {
          background-color: transparent !important;
        }
      `}</style>

      <aside className="w-full md:w-80 border-r-4 border-on-surface bg-background flex flex-col flex-shrink-0 z-10">
        <div className="flex border-b-4 border-on-surface">
          <button 
            onClick={() => setActiveTab('projects')}
            className={`flex-1 py-3 flex justify-center items-center border-r-2 border-on-surface transition-colors ${activeTab === 'projects' ? 'bg-primary text-white' : 'hover:bg-surface-container-high'}`}
          >
            <ListVideo size={20} />
          </button>
          <button 
            onClick={() => setActiveTab('settings')}
            className={`flex-1 py-3 flex justify-center items-center transition-colors ${activeTab === 'settings' ? 'bg-primary text-white' : 'hover:bg-surface-container-high'}`}
          >
            <Settings size={20} />
          </button>
        </div>

        <div className="flex-grow overflow-y-auto p-4">
          {activeTab === 'projects' && (
            <div className="space-y-4">
              <h2 className="font-headline font-bold text-xs uppercase tracking-widest text-primary mb-4">Workspaces</h2>
              
              <div 
                onClick={() => navigate('/lab')}
                className={`p-3 border-2 border-on-surface cursor-pointer font-mono text-sm flex items-center gap-3 ${!id ? 'bg-surface-container-high hard-shadow' : 'hover:bg-surface-container-low'}`}
              >
                <SquareTerminal size={16} /> Base Sandbox
              </div>

              {projects.map(p => (
                <div 
                  key={p.id}
                  onClick={() => navigate(`/lab/${p.id}`)}
                  className={`p-3 border-2 border-on-surface cursor-pointer font-mono text-sm flex items-center gap-3 ${id === p.id ? 'bg-surface-container-high hard-shadow' : 'hover:bg-surface-container-low'}`}
                >
                  <ListVideo size={16} className="text-primary" /> 
                  <span className="truncate">{p.id.split('-')[0]}-env</span>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="space-y-8">
              <div>
                <h2 className="font-headline font-bold text-xs uppercase tracking-widest text-primary mb-4 flex items-center gap-2"><Palette size={16}/> Embed Theme</h2>
                <div className="space-y-2 font-mono text-sm capitalize">
                  {(Object.keys(CATPPUCCIN) as Theme[]).map(t => (
                    <label key={t} className="flex items-center gap-3 p-2 border-2 border-transparent hover:border-on-surface cursor-pointer">
                      <input 
                        type="radio" 
                        name="theme" 
                        checked={theme === t} 
                        onChange={() => handleThemeChange(t)}
                        className="accent-primary"
                      />
                      {t}
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </aside>

      <section className="flex-grow flex flex-col relative overflow-hidden">
        
        <div className="p-3 border-b-4 border-on-surface bg-background flex justify-between items-center z-10 h-14">
          <div className="flex items-center gap-3">
            <div className={`w-3 h-3 ${isSandboxMode ? 'bg-green-500 animate-pulse' : 'bg-primary'}`}></div>
            <span className="font-mono text-sm font-bold uppercase tracking-tighter">
              {id ? (isSandboxMode ? `INTERACTIVE: ${id.split('-')[0]}` : `PLAYBACK: ${id.split('-')[0]}`) : 'ISOLATED SANDBOX'}
            </span>
          </div>
          
          {id && (
            <div className="font-mono text-[10px] font-bold uppercase tracking-widest text-on-surface opacity-50 flex items-center gap-2">
              {isSandboxMode ? <><SquareTerminal size={12}/> Live Engine</> : (isPlaying ? <><Play size={12}/> Playing</> : <><Pause size={12}/> Paused</>)}
            </div>
          )}
        </div>
        
        {/* Core Viewport Background */}
        <div 
          key={id || 'base'}
          className="flex-grow w-full relative" 
          style={{ 
            backgroundColor: currentCatTheme.bg,
            color: currentCatTheme.fg,
          } as React.CSSProperties}
        >
          
          {id && (
            <div className="absolute top-4 right-6 z-50">
              {isSandboxMode ? (
                <button 
                  onClick={handleReturnToPlayback} 
                  className="bg-surface-container-high text-on-surface border-2 border-on-surface px-4 py-2 font-mono text-xs font-bold uppercase hover:bg-on-surface hover:text-background transition-colors hard-shadow flex items-center gap-2"
                >
                  <XCircle size={14} /> Exit Sandbox
                </button>
              ) : (
                <button 
                  onClick={handleTryNow}
                  disabled={vmStatus !== 'ready'}
                  className={`border-2 border-on-surface px-4 py-2 font-mono text-xs font-bold uppercase transition-colors flex items-center gap-2
                    ${vmStatus === 'ready' ? 'bg-primary text-white hover:translate-y-[2px] hover:translate-x-[2px] hard-shadow cursor-pointer' : 'bg-surface-container-high text-on-surface opacity-60 cursor-not-allowed'}`}
                >
                  {vmStatus === 'ready' ? (
                    <><SquareTerminal size={14} /> Try Now</>
                  ) : vmStatus === 'error' ? (
                    <><div className="w-2 h-2 bg-red-500 rounded-full"></div> Engine Failed</>
                  ) : (
                    <><div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></div> {formatStatus(vmStatus)}...</>
                  )}
                </button>
              )}
            </div>
          )}

          {/* Unified Padded Container for edge-to-edge alignment */}
          <div className={`absolute inset-0 p-4 z-20 ${isSandboxMode ? 'hidden' : 'block'}`}>
            <div ref={playerContainerRef} className="w-full h-full overflow-hidden flex" />
          </div>

          <div className={`absolute inset-0 p-4 z-10 ${isSandboxMode ? 'block' : 'hidden'}`}>
            <div ref={terminalRef} className="w-full h-full overflow-hidden flex" />
          </div>
          
        </div>
      </section>
    </div>
  );
}