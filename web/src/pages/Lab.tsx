import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Settings, SquareTerminal, Palette, ListVideo, Play, Pause, XCircle, Menu, Share2, Check, ExternalLink } from 'lucide-react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import * as AsciinemaPlayer from 'asciinema-player';
import 'asciinema-player/dist/bundle/asciinema-player.css';
import '@xterm/xterm/css/xterm.css';

import { fetchCasts, fetchCastDetails, updateCastSettings } from '../lib/api';
import { V86VM, VMStatus } from '../lib/V86VM';

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
  const [searchParams] = useSearchParams();
  const isEmbed = searchParams.get('embed') === 'true';
  
  const [activeTab, setActiveTab] = useState<Tab>('projects');
  const [theme, setTheme] = useState<Theme>('mocha');
  const [projects, setProjects] = useState<any[]>([]);
  const [projectName, setProjectName] = useState<string>('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showKeystrokes, setShowKeystrokes] = useState<boolean>(true);
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number } | null>(null);
  const [copiedEmbed, setCopiedEmbed] = useState(false);

  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, []);
  
  const [isPlaying, setIsPlaying] = useState(true);
  const [isSandboxMode, setIsSandboxMode] = useState(false);
  const [vmStatus, setVmStatus] = useState<VMStatus>('initializing');
  const [hasRecording, setHasRecording] = useState(true);
  const [recordedKeys, setRecordedKeys] = useState<{t: number, k: string}[]>([]);
  const [playerTime, setPlayerTime] = useState(0);
  
  const playerContainerRef = useRef<HTMLDivElement>(null);
  const playerInstance = useRef<any>(null);
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermInstance = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const lastKeyTimeRef = useRef<number>(-1);

  const isDefaultSandbox = !id;
  const manifestUrl = id ? `/uploads/${id}/manifest.json` : null;
  const baselineUrl = id ? `/uploads/${id}/baseline.tar.gz` : null;
  const recordingUrl = id ? `/uploads/${id}/recording.cast` : null;

  useEffect(() => {
    fetchCasts().then(setProjects).catch(console.error);
  }, []);

  useEffect(() => {
    // Reset project-specific states immediately on ID change
    setVmStatus('initializing');
    setIsPlaying(true);

    if (id) {
      fetchCastDetails(id).then(details => {
        if (CATPPUCCIN[details.theme as Theme]) {
          setTheme(details.theme as Theme);
        } else {
          setTheme('mocha');
        }
        setShowKeystrokes(details.show_keystrokes);
        setHasRecording(details.has_recording);
        setIsSandboxMode(!details.has_recording);
        if (details.name) setProjectName(details.name);
      }).catch(err => {
        console.error("Failed to fetch cast details", err);
        setHasRecording(true);
        setIsSandboxMode(false);
      });
    } else {
      // Base Sandbox: always interactive, no recording
      setTheme('mocha');
      setShowKeystrokes(false);
      setHasRecording(false);
      setIsSandboxMode(true);
    }
  }, [id]);

  const isOwner = !id || projects.some(p => p.id === id);

  // Auto-switch to sandbox mode when VM is ready (for default sandbox with no recording)
  useEffect(() => {
    if (isDefaultSandbox && vmStatus === 'ready') {
      setIsSandboxMode(true);
    }
  }, [vmStatus, isDefaultSandbox]);

  const handleThemeChange = (newTheme: Theme) => {
    setTheme(newTheme);
    if (id && isOwner) {
      updateCastSettings(id, { theme: newTheme, show_keystrokes: showKeystrokes }).catch(console.error);
    }
  };

  const handleKeystrokesChange = (show: boolean) => {
    setShowKeystrokes(show);
    if (id && isOwner) {
      updateCastSettings(id, { theme, show_keystrokes: show }).catch(console.error);
    }
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    if (!id) return;
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY });
    setCopiedEmbed(false);
  };

  const copyEmbedCode = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!id) return;
    const url = `${window.location.origin}/lab/${id}?embed=true`;
    const embedCode = `<iframe src="${url}" width="800" height="600" style="border: none; display: block;" frameborder="0" allowfullscreen></iframe>`;
    navigator.clipboard.writeText(embedCode);
    setCopiedEmbed(true);
    setTimeout(() => setContextMenu(null), 1000);
  };

  // --- ASCIINEMA INITIALIZATION (Crash-Proof) ---
  useEffect(() => {
    if (!playerContainerRef.current || !recordingUrl || !hasRecording) return;

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

    // Keystroke Synchronization Loop (High Precision)
    let rafId: number;
    const syncKeys = async () => {
      if (recordedKeys.length === 0 || !playerInstance.current) {
        rafId = requestAnimationFrame(syncKeys);
        return;
      }
      
      try {
        const currentTime = await playerInstance.current?.getCurrentTime();
        if (typeof currentTime === 'number') {
          setPlayerTime(currentTime);
        }
      } catch (e) {
        // Player might be disposed or not ready
      }

      rafId = requestAnimationFrame(syncKeys);
    };

    rafId = requestAnimationFrame(syncKeys);

    // Debugging: verify if player time is moving
    const debugTimer = setInterval(async () => {
      try {
        const t = await playerInstance.current?.getCurrentTime();
        console.log("Player Time:", t, "Keys:", recordedKeys.length);
      } catch(e) {}
    }, 2000);

    return () => {
      clearInterval(debugTimer);
      cancelAnimationFrame(rafId);
      if (playerInstance.current) {
        playerInstance.current.dispose();
        playerInstance.current = null;
      }
    };
  }, [recordingUrl, hasRecording, recordedKeys]);

  useEffect(() => {
    if (!id || !hasRecording || !recordingUrl) return;
    
        fetch(recordingUrl)
          .then(res => res.text())
          .then(text => {
            const lines = text.split('\n');
            const rawKeys: {t: number, k: string, special: boolean}[] = [];
            let absoluteTime = 0;
            let isV3 = false;

            lines.forEach((line, index) => {
              if (!line.trim()) return;
              try {
                const data = JSON.parse(line);
                
                if (index === 0 && data.version === 3) {
                  isV3 = true;
                  return;
                }

                if (Array.isArray(data)) {
                  if (isV3) {
                    absoluteTime += data[0];
                  } else {
                    absoluteTime = data[0];
                  }

                  if (data[1] === 'i') {
                    const input = data[2];
                    const mapping: Record<string, string> = {
                      '\x7f': 'BACK', '\b': 'BACK', '\t': 'TAB', '\x1b': 'ESC',
                      '\x1b[A': 'UP', '\x1b[B': 'DOWN', '\x1b[C': 'RIGHT', '\x1b[D': 'LEFT',
                      '\x1b[H': 'HOME', '\x1b[F': 'END', '\x1b[3~': 'DEL',
                      '\x1b[5~': 'PGUP', '\x1b[6~': 'PGDN',
                      '\x01': 'CTRL+A', '\x02': 'CTRL+B', '\x03': 'CTRL+C', '\x04': 'CTRL+D',
                      '\x05': 'CTRL+E', '\x06': 'CTRL+F', '\x0c': 'CTRL+L', '\x0e': 'CTRL+N',
                      '\x10': 'CTRL+P', '\x12': 'CTRL+R', '\x13': 'CTRL+S', '\x15': 'CTRL+U', 
                      '\x17': 'CTRL+W', '\x18': 'CTRL+X', '\x19': 'CTRL+Y', '\x1a': 'CTRL+Z'
                    };
                    
                    if (mapping[input]) {
                      rawKeys.push({ t: absoluteTime, k: mapping[input], special: true });
                    } else if (input.startsWith('\x1b') && input.length > 1) {
                      // Escape sequences
                      if (input[1] !== '[') {
                         // Likely ALT/OPTION + key
                         const key = input.substring(1);
                         if (key.length === 1 && key >= ' ') {
                            rawKeys.push({ t: absoluteTime, k: `ALT+${key.toUpperCase()}`, special: true });
                         }
                      }
                      // Unknown CSI sequences (e.g. \x1b[1;5C) are safely ignored to avoid printing garbage
                    } else if (input.length === 1 && input >= ' ') {
                      rawKeys.push({ t: absoluteTime, k: input.toUpperCase(), special: false });
                    } else if (input.length > 1) {
                      // Handle batched or multi-byte sequences properly
                      for (const char of input) {
                        if (mapping[char]) {
                          rawKeys.push({ t: absoluteTime, k: mapping[char], special: true });
                        } else if (char >= ' ') {
                          rawKeys.push({ t: absoluteTime, k: char.toUpperCase(), special: false });
                        }
                      }
                    }
                  }
                }
              } catch(e) {}
            });

            // Group keys into semantic "blocks"
            const blocks: {t: number, k: string, count: number, special: boolean}[] = [];
            rawKeys.sort((a, b) => a.t - b.t).forEach(curr => {
              const last = blocks[blocks.length - 1];
              const isSpecial = curr.special;
              const lastIsSpecial = last ? last.special : false;
              
              if (last && curr.k === last.k && isSpecial) {
                // Repeat of special key (e.g. BACK, BACK)
                last.count++;
                last.t = curr.t;
              } else if (last && !isSpecial && !lastIsSpecial && curr.t - last.t < 0.6) {
                // Consecutive regular typing
                last.k += curr.k;
                last.t = curr.t;
              } else {
                blocks.push({ t: curr.t, k: curr.k, count: 1, special: curr.special });
              }
            });
            setRecordedKeys(blocks as any);
          });
  }, [id, hasRecording, recordingUrl]);

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

    const fitAddon = new FitAddon();
    fitAddonRef.current = fitAddon;
    term.loadAddon(fitAddon);

    xtermInstance.current = term;
    term.open(terminalRef.current);
    
    // Initial fit attempt
    setTimeout(() => {
      if (isSandboxMode) fitAddon.fit();
    }, 100);
    
    const vm = new V86VM(term);
    vm.boot(manifestUrl, baselineUrl, (status) => setVmStatus(status), (manifest) => {
      // Manifest boot callback - we keep it for potential future metadata but 
      // rely on the top-level project state for isSandboxMode/hasRecording.
    });

    const handleResize = () => {
      if (isSandboxMode) {
        fitAddon.fit();
        vm.setTerminalSize(term.cols, term.rows);
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      vm.dispose();
      term.dispose();
      xtermInstance.current = null;
      fitAddonRef.current = null;
    };
  }, [id]); 

  // Re-fit when switching to sandbox mode (terminal becomes visible)
  useEffect(() => {
    if (isSandboxMode && xtermInstance.current && fitAddonRef.current) {
      fitAddonRef.current.fit();
    }
  }, [isSandboxMode]);
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

  const getVMProgress = (status: VMStatus) => {
    const steps: Record<VMStatus, number> = {
      initializing: 15,
      booting_kernel: 30,
      downloading_baseline: 50,
      extracting_baseline: 70,
      downloading_tools: 85,
      installing_tools: 95,
      ready: 100,
      error: 0
    };
    return steps[status] || 0;
  };

  // Safe fallback for Catppuccin themes
  const currentCatTheme = CATPPUCCIN[theme] || CATPPUCCIN['mocha'];
  const currentPalette = currentCatTheme.palette.split(':');
  const isDarkTheme = theme !== 'latte';

  return (
    <div className={`flex-grow flex flex-col md:flex-row border-on-surface relative overflow-hidden ${isEmbed ? 'h-full border-b-0 bg-background' : 'h-[calc(100vh-160px)] border-b-4'}`}>
      
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
        .ap-wrapper, .ap-player, .ap-terminal {
          --term-color-background: transparent !important;
          --term-color-foreground: ${currentCatTheme.fg} !important;
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

        /* 4. KEY HUD ANIMATIONS */
        .key-capsule {
          animation: key-fade-in 0.1s ease-out;
        }

        @keyframes key-fade-in {
          from { opacity: 0; transform: scale(0.8); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>

      {/* Mobile Backdrop */}
      {!isEmbed && (
        <div 
          className={`md:hidden absolute inset-0 bg-black/50 z-30 transition-opacity duration-300 ${isSidebarOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {!isEmbed && (
      <aside className={`absolute md:relative z-40 h-full bg-background border-on-surface flex flex-col flex-shrink-0 transition-all duration-300 ease-in-out overflow-hidden ${isSidebarOpen ? 'w-4/5 md:w-80 border-r-4 translate-x-0' : 'w-0 border-r-0 -translate-x-full md:translate-x-0'}`}>
        <div className="w-[80vw] md:w-80 h-full flex flex-col flex-shrink-0">


        <div className="flex-grow relative overflow-hidden">
          {/* Projects Tab */}
          <div className={`absolute inset-0 p-4 overflow-y-auto transition-all duration-300 ease-in-out ${activeTab === 'projects' ? 'opacity-100 translate-x-0 z-10' : 'opacity-0 -translate-x-2 pointer-events-none -z-10'}`}>
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
                    <span className="truncate">{p.name || p.id.split('-')[0]}</span>
                  </div>
                ))}
            </div>
          </div>

          {/* Settings Tab */}
          <div className={`absolute inset-0 p-4 overflow-y-auto transition-all duration-300 ease-in-out ${activeTab === 'settings' ? 'opacity-100 translate-x-0 z-10' : 'opacity-0 translate-x-2 pointer-events-none -z-10'}`}>
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

              <div className={(!hasRecording || recordedKeys.length === 0) ? 'opacity-50 grayscale pointer-events-none' : ''}>
                <h2 className="font-headline font-bold text-xs uppercase tracking-widest text-primary mb-4 flex items-center gap-2"><SquareTerminal size={16}/> Keystroke HUD</h2>
                <label className="flex items-center gap-3 p-2 border-2 border-transparent hover:border-on-surface cursor-pointer font-mono text-sm">
                  <input 
                    type="checkbox" 
                    checked={showKeystrokes} 
                    onChange={(e) => handleKeystrokesChange(e.target.checked)}
                    disabled={!hasRecording || recordedKeys.length === 0}
                    className="accent-primary w-4 h-4"
                  />
                  Show Keystroke Overlay
                </label>
              </div>
 
             </div>
           </div>
         </div>
        </div>
      </aside>
      )}

      <section className="flex-grow flex flex-col relative overflow-hidden">
        
        {!isEmbed && (
        <div className="p-3 border-b-4 border-on-surface bg-background flex justify-between items-center z-10 h-14">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              <button 
                onClick={() => {
                  if (activeTab === 'projects' && isSidebarOpen) setIsSidebarOpen(false);
                  else { setActiveTab('projects'); setIsSidebarOpen(true); }
                }}
                className={`p-1.5 rounded transition-colors ${activeTab === 'projects' && isSidebarOpen ? 'bg-primary text-white' : 'hover:bg-surface-container-high text-primary'}`}
                title="Workspaces"
              >
                <ListVideo size={18} />
              </button>
              <button 
                onClick={() => {
                  if (activeTab === 'settings' && isSidebarOpen) setIsSidebarOpen(false);
                  else { setActiveTab('settings'); setIsSidebarOpen(true); }
                }}
                className={`p-1.5 rounded transition-colors ${activeTab === 'settings' && isSidebarOpen ? 'bg-primary text-white' : 'hover:bg-surface-container-high text-primary'}`}
                title="Settings"
              >
                <Settings size={18} />
              </button>
            </div>
            <div className="w-px h-6 bg-on-surface opacity-20"></div>
            <span className="font-mono text-sm font-bold uppercase tracking-tighter truncate max-w-[200px] sm:max-w-none">
            {id 
              ? (projectName || projects.find(p => p.id === id)?.name || id.split('-')[0])
              : 'BASE SANDBOX'}
            </span>
          </div>
        </div>
        )}
        
        {/* Embed macOS-style Title Bar */}
        {isEmbed && (
          <div className="h-8 bg-surface-container-high border-b-2 border-on-surface flex items-center px-4 shrink-0">
            <div className="flex gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-red-500 border border-on-surface"></div>
              <div className="w-2.5 h-2.5 rounded-full bg-yellow-500 border border-on-surface"></div>
              <div className="w-2.5 h-2.5 rounded-full bg-green-500 border border-on-surface"></div>
            </div>
            <div className="absolute left-1/2 -translate-x-1/2 font-mono text-[10px] font-bold tracking-widest uppercase text-on-surface/50">
              {projectName || id?.split('-')[0]}
            </div>
          </div>
        )}

        {/* Core Viewport Background */}
        <div 
          key={id || 'base'}
          className="flex-grow w-full relative" 
          onContextMenu={handleContextMenu}
          style={{ 
            backgroundColor: currentCatTheme.bg,
            color: currentCatTheme.fg,
          } as React.CSSProperties}
        >
          
          <div className="absolute top-4 right-6 z-50">
            {isSandboxMode && hasRecording && !isDefaultSandbox ? (
              <button 
                onClick={handleReturnToPlayback} 
                className={`bg-transparent backdrop-blur-[2px] border-2 px-4 py-2 font-mono text-xs font-bold uppercase transition-colors hard-shadow flex items-center gap-2 ${
                  isDarkTheme 
                    ? 'text-white border-white/30 hover:bg-white hover:text-black' 
                    : 'text-black border-black/30 hover:bg-black hover:text-white'
                }`}
              >
                <XCircle size={14} /> Exit Sandbox
              </button>
            ) : (
              // Show loading button if not ready, or "Try Now" if a project is loaded but not yet interactive
              (vmStatus !== 'ready' || (!isSandboxMode && hasRecording && !isDefaultSandbox)) && (
                <div className={`group relative flex ${vmStatus !== 'ready' ? 'min-w-[160px]' : ''}`}>
                  <button 
                    onClick={vmStatus === 'ready' ? handleTryNow : undefined}
                    disabled={vmStatus !== 'ready' && !isEmbed}
                    className={`relative overflow-hidden border-2 border-on-surface px-4 py-2 font-mono text-xs font-bold uppercase transition-all flex items-center justify-center gap-2 hard-shadow
                      ${vmStatus === 'ready' 
                        ? 'bg-primary text-white hover:translate-y-[2px] hover:translate-x-[2px] cursor-pointer' 
                        : (isEmbed ? 'w-full bg-surface-container-high text-on-surface/60 cursor-default group-hover:opacity-0' : 'w-full bg-surface-container-high text-on-surface/60 cursor-not-allowed')}`}
                  >
                    {/* Progress Fill Layer */}
                    <div 
                      className="absolute inset-y-0 left-0 bg-primary transition-all duration-700 ease-out z-0"
                      style={{ width: `${getVMProgress(vmStatus)}%`, opacity: vmStatus === 'ready' ? 1 : 0.4 }}
                    />

                    <span className="relative z-10 flex items-center justify-center gap-2 whitespace-nowrap">
                      {vmStatus === 'ready' ? (
                        <><SquareTerminal size={14} /> Try Now</>
                      ) : vmStatus === 'error' ? (
                        <><div className="w-2 h-2 bg-red-500 rounded-full"></div> Engine Failed</>
                      ) : (
                        <>{formatStatus(vmStatus)}...</>
                      )}
                    </span>
                  </button>

                  {/* Embed Hover Override */}
                  {isEmbed && vmStatus !== 'ready' && vmStatus !== 'error' && (
                    <a 
                      href={`/lab/${id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="absolute inset-0 opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto bg-primary text-white border-2 border-on-surface flex items-center justify-center gap-2 font-mono text-xs font-bold uppercase transition-opacity duration-300 hard-shadow z-20 whitespace-nowrap"
                    >
                      Open in SWACN <ExternalLink size={14} />
                    </a>
                  )}
                </div>
              )
            )}
          </div>

          {/* Unified Containers with maintained dimensions for silent terminal fitting */}
          <div className={`absolute inset-0 p-2 z-20 transition-opacity duration-300 ${isSandboxMode ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
            <div ref={playerContainerRef} className="w-full h-full overflow-hidden flex" />
          </div>

          <div className={`absolute inset-0 p-2 z-10 transition-opacity duration-300 ${isSandboxMode ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
            <div ref={terminalRef} className="w-full h-full" />
          </div>

          {/* Keystroke HUD (Stacked Toast Overlay) */}
          {!isSandboxMode && showKeystrokes && recordedKeys.length > 0 && (
            <div className="absolute bottom-12 left-1/2 -translate-x-1/2 w-full max-w-lg pointer-events-none z-[999] flex flex-col justify-end items-center gap-4">
              {recordedKeys
                .filter(k => playerTime >= k.t && playerTime < k.t + 2.5)
                .slice(-3) // Only show last 3 active blocks to avoid clutter
                .map((k: any, i) => {
                  const age = playerTime - k.t; 
                  const opacity = age > 2.0 ? 1 - (age - 2.0) / 0.5 : 1;
                  
                  return (
                    <div 
                      key={`${k.t}-${k.k}`}
                      className="transition-all duration-300 ease-linear"
                      style={{ 
                        opacity: Math.max(0, opacity),
                        transform: `scale(${1 - (age * 0.05)})`,
                      }}
                    >
                      <div className={`bg-primary text-white border-on-surface font-mono font-black hard-shadow flex items-center gap-4 justify-center ${isEmbed ? 'px-4 py-2 border-2 text-lg min-w-[3rem]' : 'px-8 py-4 border-4 text-2xl min-w-[4rem]'}`}>
                        <span className="tracking-tighter">{k.k}</span>
                        {k.count > 1 && <span className={`bg-white text-primary border-on-surface font-bold uppercase ${isEmbed ? 'text-xs px-1.5 py-0 border' : 'text-sm px-2 py-0.5 border-2'}`}>x{k.count}</span>}
                      </div>
                    </div>
                  );
                })}
            </div>
          )}

          {/* Context Menu */}
          {contextMenu && (
            <div 
              className="fixed z-[1000] bg-background border-2 border-on-surface p-1 hard-shadow font-mono text-sm"
              style={{ left: contextMenu.x, top: contextMenu.y }}
            >
              <button 
                onClick={copyEmbedCode}
                className={`w-full text-left px-4 py-2 transition-colors flex items-center gap-2 font-bold ${copiedEmbed ? 'bg-on-surface text-background' : 'text-primary hover:bg-primary hover:text-white'}`}
              >
                {copiedEmbed ? <Check size={14} /> : <Share2 size={14} />} 
                {copiedEmbed ? 'Copied!' : 'Copy embed code'}
              </button>
            </div>
          )}
        </div>

        {/* Elegant Embed Footer */}
        {isEmbed && (
          <div className="h-10 bg-background border-t-2 border-on-surface flex justify-between items-center px-4 shrink-0 font-mono text-[10px] uppercase font-bold tracking-widest text-on-surface/70">
            <div className="flex items-center gap-4">
               {isSandboxMode 
                 ? <span className="flex items-center gap-1.5 text-primary"><SquareTerminal size={12}/> Live Interactive Sandbox</span> 
                 : (isPlaying 
                    ? <span className="flex items-center gap-1.5"><Play size={12}/> Playing Cast</span> 
                    : <span className="flex items-center gap-1.5"><Pause size={12}/> Paused</span>
                   )
               }
            </div>
            
            <a 
              href={`/lab/${id}`} 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 hover:text-primary transition-colors group"
            >
              Open in SWACN 
              <span className="group-hover:-translate-y-0.5 group-hover:translate-x-0.5 transition-transform">
                <ExternalLink size={12} />
              </span>
            </a>
          </div>
        )}

      </section>
    </div>
  );
}