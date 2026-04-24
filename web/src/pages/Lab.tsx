import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Settings, SquareTerminal, Palette, ListVideo, Play, Pause, XCircle, Menu, Share2, Check, ExternalLink, Download } from 'lucide-react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import * as AsciinemaPlayer from 'asciinema-player';
import 'asciinema-player/dist/bundle/asciinema-player.css';
import '@xterm/xterm/css/xterm.css';

import { fetchCasts, fetchCastDetails, updateCastSettings, getAuthToken } from '../lib/api';
import { TarBuilder } from '../lib/TarBuilder';
import { V86VM, VMStatus } from '../lib/V86VM';

type Tab = 'projects' | 'settings';
type Theme = 'latte' | 'frappe' | 'macchiato' | 'mocha' | 'swacn' | 'swacn-dark';

const TERMINAL_THEMES = {
  swacn: { fg: "#1c1c17", bg: "#fcf9f0", palette: "#1c1c17:#a33030:#4a7023:#b3821a:#355c82:#804d7c:#338580:#ebe8df:#5a5a52:#a33030:#4a7023:#b3821a:#355c82:#804d7c:#338580:#ffffff" },
  'swacn-dark': { fg: "#fcf9f0", bg: "#1c1c17", palette: "#40403a:#e05c5c:#7ca84d:#d6a63c:#5380a6:#a66b9e:#4da6a0:#ebe8df:#5a5a52:#e05c5c:#7ca84d:#d6a63c:#5380a6:#a66b9e:#4da6a0:#ffffff" },
  latte: { fg: "#4c4f69", bg: "#eff1f5", palette: "#5c5f77:#d20f39:#40a02b:#df8e1d:#1e66f5:#ea76cb:#179299:#acb0be:#6c6f85:#d20f39:#40a02b:#df8e1d:#1e66f5:#ea76cb:#179299:#bcc0cc" },
  frappe: { fg: "#c6d0f5", bg: "#303446", palette: "#51576d:#e78284:#a6d189:#e5c890:#8caaee:#f4b8e4:#81c8be:#b5bfe2:#626880:#e78284:#a6d189:#e5c890:#8caaee:#f4b8e4:#81c8be:#a5adce" },
  macchiato: { fg: "#cad3f5", bg: "#24273a", palette: "#494d64:#ed8796:#a6da95:#eed49f:#8aadf4:#f5bde6:#8bd5ca:#b8c0e0:#5b6078:#ed8796:#a6da95:#eed49f:#8aadf4:#f5bde6:#8bd5ca:#a5adcb" },
  mocha: { fg: "#cdd6f4", bg: "#1e1e2e", palette: "#45475a:#f38ba8:#a6e3a1:#f9e2af:#89b4fa:#f5c2e7:#94e2d5:#bac2de:#585b70:#f38ba8:#a6e3a1:#f9e2af:#89b4fa:#f5c2e7:#94e2d5:#a6adc8" }
};

const getXtermTheme = (themeName: Theme) => {
  // Fallback protection against corrupted localStorage state
  const t = TERMINAL_THEMES[themeName] || TERMINAL_THEMES['swacn-dark'];
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
  const [theme, setTheme] = useState<Theme>('swacn-dark');
  const [projects, setProjects] = useState<any[]>([]);
  const [projectName, setProjectName] = useState<string>('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showKeystrokes, setShowKeystrokes] = useState<boolean>(true);
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number } | null>(null);
  const [copiedEmbed, setCopiedEmbed] = useState(false);
  const [allowFsDownload, setAllowFsDownload] = useState<boolean>(true);
  const [hasBaseline, setHasBaseline] = useState<boolean>(false);



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

    const handleProjectCreated = () => {
      fetchCasts().then(setProjects).catch(console.error);
      setIsSidebarOpen(false);
    };
    window.addEventListener('project-created', handleProjectCreated);
    return () => window.removeEventListener('project-created', handleProjectCreated);
  }, []);

  useEffect(() => {
    // Reset project-specific states immediately on ID change
    setVmStatus('initializing');
    setIsPlaying(true);
    setIsSidebarOpen(false);

    if (id) {
      fetchCastDetails(id).then(details => {
        if (TERMINAL_THEMES[details.theme as Theme]) {
          setTheme(details.theme as Theme);
        } else {
          setTheme('swacn-dark');
        }
        setShowKeystrokes(details.show_keystrokes);
        setAllowFsDownload(details.allow_fs_download ?? true);
        setHasBaseline(details.has_baseline ?? false);
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
      setTheme('swacn-dark');
      setShowKeystrokes(false);
      setAllowFsDownload(false);
      setHasBaseline(false);
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
      updateCastSettings(id, { theme: newTheme, show_keystrokes: showKeystrokes, allow_fs_download: allowFsDownload }).catch(console.error);
    }
  };

  const handleKeystrokesChange = (show: boolean) => {
    setShowKeystrokes(show);
    if (id && isOwner) {
      updateCastSettings(id, { theme, show_keystrokes: show, allow_fs_download: allowFsDownload }).catch(console.error);
    }
  };

  const handleFsDownloadChange = (allow: boolean) => {
    setAllowFsDownload(allow);
    if (id && isOwner) {
      updateCastSettings(id, { theme, show_keystrokes: showKeystrokes, allow_fs_download: allow }).catch(console.error);
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
      fit: 'both', 
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

    let resizeTimeout: ReturnType<typeof setTimeout>;
    const resizeObserver = new ResizeObserver(() => {
      try {
        fitAddon.fit();
        
        // Debounce the VM stty commands to prevent serial port flooding
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
          vm.setTerminalSize(term.cols, term.rows);
        }, 300);
      } catch (err) {
        // Ignore fit errors if container is 0x0
      }
    });

    resizeObserver.observe(terminalRef.current);

    return () => {
      resizeObserver.disconnect();
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

  // Safe fallback for terminal themes
  const currentThemeConfig = TERMINAL_THEMES[theme] || TERMINAL_THEMES['swacn-dark'];
  const currentPalette = currentThemeConfig.palette.split(':');
  const isDarkTheme = theme !== 'latte' && theme !== 'swacn';

  const handleDownloadFs = () => {
    if (baselineUrl && hasBaseline) {
      window.open(baselineUrl, '_blank');
    }
  };

  const renderDownloadButton = (isEmbedSizing: boolean) => {
    if (!id || isDefaultSandbox) return null;
    if (!hasBaseline) return null;
    if (!isOwner && !allowFsDownload) return null;
    
    return (
      <button 
        onClick={handleDownloadFs}
        className={`bg-transparent border-2 ${isEmbedSizing ? 'px-2 py-1 text-[10px]' : 'px-4 py-2 text-xs'} font-mono font-bold uppercase transition-all hard-shadow flex items-center gap-1.5 text-black border-black/30 hover:bg-black hover:text-white hover:-translate-y-0.5 hover:-translate-x-0.5 cursor-pointer`}
        title="Download filesystem"
      >
        <Download size={isEmbedSizing ? 12 : 16} /> FS
      </button>
    );
  };

  const renderActionButton = (isEmbedSizing: boolean) => {
    if (isSandboxMode && hasRecording && !isDefaultSandbox) {
      return (
        <button 
          onClick={handleReturnToPlayback} 
          className={`bg-transparent border-2 ${isEmbedSizing ? 'px-4 py-1.5 text-[10px]' : 'px-4 py-2 text-xs'} font-mono font-bold uppercase transition-all hard-shadow flex items-center gap-1.5 text-black border-black/30 hover:bg-black hover:text-white hover:-translate-y-0.5 hover:-translate-x-0.5`}
        >
          <XCircle size={isEmbedSizing ? 12 : 16} /> Exit Sandbox
        </button>
      );
    }
    
    if (vmStatus !== 'ready' || (!isSandboxMode && hasRecording && !isDefaultSandbox)) {
      return (
        <div className={`group relative flex ${vmStatus !== 'ready' ? (isEmbedSizing ? 'min-w-[100px]' : 'min-w-[160px]') : ''}`}>
          <button 
            onClick={vmStatus === 'ready' ? handleTryNow : undefined}
            disabled={vmStatus !== 'ready' && !isEmbed}
            className={`relative overflow-hidden border-on-surface font-mono font-bold uppercase transition-all flex items-center justify-center gap-2 hard-shadow
              ${isEmbedSizing ? 'border-2 px-4 py-1.5 text-[10px]' : 'border-2 px-6 py-2.5 text-xs'}
              ${vmStatus === 'ready' 
                ? 'bg-primary text-white hover:-translate-y-0.5 hover:-translate-x-0.5 cursor-pointer' 
                : (isEmbed ? 'w-full bg-surface-container-high text-on-surface/60 cursor-default group-hover:opacity-0' : 'w-full bg-surface-container-high text-on-surface/60 cursor-not-allowed')}`}
          >
            {/* Progress Fill Layer */}
            <div 
              className="absolute inset-y-0 left-0 bg-primary transition-all duration-700 ease-out z-0"
              style={{ width: `${getVMProgress(vmStatus)}%`, opacity: vmStatus === 'ready' ? 1 : 0.2 }}
            />

            <span className="relative z-10 flex items-center justify-center gap-1.5 whitespace-nowrap">
              {vmStatus === 'ready' ? (
                <><SquareTerminal size={isEmbedSizing ? 12 : 16} /> Try Now</>
              ) : vmStatus === 'error' ? (
                <><div className="w-1.5 h-1.5 bg-red-500 rounded-full"></div> Failed</>
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
              className={`absolute inset-0 opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto bg-primary text-white border-on-surface flex items-center justify-center gap-1.5 font-mono font-bold uppercase transition-all duration-300 hard-shadow z-20 whitespace-nowrap hover:-translate-y-0.5 hover:-translate-x-0.5 ${isEmbedSizing ? 'border-2 text-[10px]' : 'border-2 text-xs'}`}
            >
              Open in SWACN <ExternalLink size={isEmbedSizing ? 12 : 16} />
            </a>
          )}
        </div>
      );
    }
    
    return null;
  };

  return (
    <div className={`flex-grow flex flex-col md:flex-row relative ${isEmbed ? 'h-full border-b-0 bg-background overflow-hidden' : 'w-full px-4 md:px-8 lg:px-16 xl:px-24 pb-4 md:pb-8 h-[calc(100vh-6rem)] md:h-[calc(100vh-8rem)]'}`}>
      
      <style>{`
        /* 1. AGGRESSIVE ASCIINEMA STRUCTURAL NUKE */
        asciinema-player, .ap-wrapper, .ap-player {
          width: 100% !important;
          height: 100% !important;
          background: transparent !important;
          background-color: transparent !important;
          border: none !important;
          margin: 0 !important;
          padding: 0 !important;
        }

        .ap-terminal {
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
          justify-content: center !important;
          align-items: center !important;
        }

        /* 2. DYNAMIC THEME INJECTION
           These map directly into Asciinema's internal rendering engine natively. 
        */
        .ap-wrapper, .ap-player, .ap-terminal {
          --term-color-background: transparent !important;
          --term-color-foreground: ${currentThemeConfig.fg} !important;
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

      {/* Main Tactile Panel for Lab */}
      <div className={`flex flex-col relative w-full h-full ${!isEmbed ? 'border-4 border-on-surface bg-transparent hard-shadow overflow-hidden' : 'overflow-hidden'}`}>

        {/* Mobile Backdrop */}
        {!isEmbed && (
          <div 
            className={`absolute inset-0 bg-on-surface/40 backdrop-blur-sm z-30 transition-opacity duration-300 ${isSidebarOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
            onClick={() => setIsSidebarOpen(false)}
          />
        )}

        {/* Overlapping Drawer Sidebar */}
        {!isEmbed && (
        <aside className={`absolute top-14 left-0 bottom-0 z-40 bg-surface-container-high border-r-4 border-on-surface flex flex-col transition-transform duration-300 ease-in-out w-4/5 md:w-80 hard-shadow ${isSidebarOpen ? 'translate-x-0' : '-translate-x-[110%]'}`}>
          <div className="w-full h-full flex flex-col flex-shrink-0">

          <div className="flex-grow relative overflow-hidden">
            {/* Projects Tab */}
            <div className={`absolute inset-0 p-6 overflow-y-auto transition-all duration-300 ease-in-out ${activeTab === 'projects' ? 'opacity-100 translate-x-0 z-10' : 'opacity-0 -translate-x-2 pointer-events-none -z-10'}`}>
              <div className="space-y-4">
                <h2 className="font-headline font-black text-lg uppercase tracking-tight text-on-surface mb-6 border-b-4 border-on-surface pb-2">Workspaces</h2>
                
                <div 
                  onClick={() => window.dispatchEvent(new CustomEvent('open-project-creator'))}
                  className="p-4 border-2 border-dashed border-on-surface cursor-pointer font-mono text-sm flex items-center justify-center gap-3 transition-colors bg-surface-container-high hover:bg-white text-on-surface/60 hover:text-on-surface mb-4 group"
                >
                  <span className="font-bold uppercase tracking-widest group-hover:scale-105 transition-transform">+ Make New Project</span>
                </div>

                <div 
                  onClick={() => navigate('/lab')}
                  className={`p-4 border-2 border-on-surface cursor-pointer font-mono text-sm flex items-center gap-3 transition-colors ${!id ? 'bg-primary text-white hard-shadow' : 'bg-white hover:bg-surface-container-low'}`}
                >
                  <SquareTerminal size={18} className={!id ? 'text-white' : 'text-primary'} /> 
                  <span className="font-bold">Base Sandbox</span>
                </div>

                  {projects.map(p => (
                    <div 
                      key={p.id}
                      onClick={() => navigate(`/lab/${p.id}`)}
                      className={`p-4 border-2 border-on-surface cursor-pointer font-mono text-sm flex items-center gap-3 transition-colors ${id === p.id ? 'bg-primary text-white hard-shadow' : 'bg-white hover:bg-surface-container-low'}`}
                    >
                      <ListVideo size={18} className={id === p.id ? 'text-white' : 'text-primary'} /> 
                      <span className="truncate font-bold">{p.name || p.id.split('-')[0]}</span>
                    </div>
                  ))}
              </div>
            </div>

            {/* Settings Tab */}
            <div className={`absolute inset-0 p-6 overflow-y-auto transition-all duration-300 ease-in-out ${activeTab === 'settings' ? 'opacity-100 translate-x-0 z-10' : 'opacity-0 translate-x-2 pointer-events-none -z-10'}`}>
              <div className="space-y-10">
                <div>
                  <h2 className="font-headline font-black text-lg uppercase tracking-tight text-on-surface mb-6 border-b-4 border-on-surface pb-2 flex items-center gap-2"><Palette size={20}/> Embed Theme</h2>
                  <div className="space-y-3 font-mono text-sm capitalize">
                    {(Object.keys(TERMINAL_THEMES) as Theme[]).map(t => (
                      <label key={t} className="flex items-center gap-4 p-3 border-2 bg-white hover:border-on-surface cursor-pointer border-transparent transition-colors">
                        <input 
                          type="radio" 
                          name="theme" 
                          checked={theme === t} 
                          onChange={() => handleThemeChange(t)}
                          className="accent-primary w-4 h-4"
                        />
                        <span className="font-bold">{t}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className={(!hasRecording || recordedKeys.length === 0) ? 'opacity-50 grayscale pointer-events-none' : ''}>
                  <h2 className="font-headline font-black text-lg uppercase tracking-tight text-on-surface mb-6 border-b-4 border-on-surface pb-2 flex items-center gap-2"><SquareTerminal size={20}/> Keystroke HUD</h2>
                  <label className="flex items-center gap-4 p-3 border-2 bg-white hover:border-on-surface cursor-pointer border-transparent transition-colors font-mono text-sm">
                    <input 
                      type="checkbox" 
                      checked={showKeystrokes} 
                      onChange={(e) => handleKeystrokesChange(e.target.checked)}
                      disabled={!hasRecording || recordedKeys.length === 0}
                      className="accent-primary w-4 h-4"
                    />
                    <span className="font-bold">Show Overlay</span>
                  </label>
                </div>

                <div className={!hasBaseline ? 'opacity-50 grayscale pointer-events-none' : ''}>
                  <h2 className="font-headline font-black text-lg uppercase tracking-tight text-on-surface mb-6 border-b-4 border-on-surface pb-2 flex items-center gap-2"><Download size={20}/> Filesystem Download</h2>
                  <label className="flex items-center gap-4 p-3 border-2 bg-white hover:border-on-surface cursor-pointer border-transparent transition-colors font-mono text-sm">
                    <input 
                      type="checkbox" 
                      checked={allowFsDownload} 
                      onChange={(e) => handleFsDownloadChange(e.target.checked)}
                      disabled={!hasBaseline}
                      className="accent-primary w-4 h-4"
                    />
                    <span className="font-bold">Allow Viewers to Download</span>
                  </label>
                </div>
   
               </div>
             </div>
           </div>
          </div>
        </aside>
        )}

        <section className="flex-grow flex flex-col relative overflow-hidden bg-transparent">
          
          {!isEmbed && (
          <div className="px-4 py-3 border-b-4 border-on-surface bg-surface-container-high flex justify-between items-center z-10 h-16 shrink-0 relative">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => {
                    if (activeTab === 'projects' && isSidebarOpen) setIsSidebarOpen(false);
                    else { setActiveTab('projects'); setIsSidebarOpen(true); }
                  }}
                  className={`p-2 border-2 border-transparent transition-all ${activeTab === 'projects' && isSidebarOpen ? 'bg-primary text-white border-on-surface hard-shadow' : 'hover:bg-white text-on-surface'}`}
                  title="Workspaces"
                >
                  <ListVideo size={20} />
                </button>
                <button 
                  onClick={() => {
                    if (activeTab === 'settings' && isSidebarOpen) setIsSidebarOpen(false);
                    else { setActiveTab('settings'); setIsSidebarOpen(true); }
                  }}
                  className={`p-2 border-2 border-transparent transition-all ${activeTab === 'settings' && isSidebarOpen ? 'bg-primary text-white border-on-surface hard-shadow' : 'hover:bg-white text-on-surface'}`}
                  title="Settings"
                >
                  <Settings size={20} />
                </button>
              </div>
              <div className="w-px h-8 bg-on-surface opacity-30"></div>
              <span className="font-mono text-sm md:text-base font-bold uppercase tracking-tighter truncate max-w-[200px] sm:max-w-none">
              {id 
                ? (projectName || projects.find(p => p.id === id)?.name || id.split('-')[0])
                : 'BASE SANDBOX'}
              </span>
            </div>
            
            {/* Main Header Action Button */}
            <div className="flex items-center gap-3 z-20">
              {renderDownloadButton(false)}
              {renderActionButton(false)}
            </div>
          </div>
          )}
          
          {/* Embed macOS-style Title Bar */}
          {isEmbed && (
            <div className="h-14 bg-surface-container-high border-b-4 border-on-surface flex items-center justify-between px-4 shrink-0 relative z-10">
              <div className="flex gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500 border-2 border-on-surface"></div>
                <div className="w-3 h-3 rounded-full bg-yellow-500 border-2 border-on-surface"></div>
                <div className="w-3 h-3 rounded-full bg-green-500 border-2 border-on-surface"></div>
              </div>
              <div className="absolute left-1/2 -translate-x-1/2 font-mono text-xs font-bold tracking-widest uppercase text-on-surface">
                {projectName || id?.split('-')[0]}
              </div>
              
              {/* Embed Header Action Button */}
              <div className="flex items-center gap-3 z-20">
                {renderDownloadButton(true)}
                {renderActionButton(true)}
              </div>
            </div>
          )}

          {/* Core Viewport Background */}
          <div 
            key={id || 'base'}
            className="flex-grow w-full relative" 
            onContextMenu={handleContextMenu}
            style={{ 
              backgroundColor: currentThemeConfig.bg,
              color: currentThemeConfig.fg,
            } as React.CSSProperties}
          >

            {/* Unified Containers with maintained dimensions for silent terminal fitting */}
            <div className={`absolute inset-0 p-4 z-20 transition-opacity duration-300 ${isSandboxMode ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
              <div ref={playerContainerRef} className="w-full h-full overflow-hidden flex items-center justify-center" />
            </div>

            <div className={`absolute inset-0 p-4 z-10 transition-opacity duration-300 ${isSandboxMode ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
              <div ref={terminalRef} className="w-full h-full" />
            </div>

            {/* Keystroke HUD (Stacked Toast Overlay) */}
            {!isSandboxMode && showKeystrokes && recordedKeys.length > 0 && (
              <div className="absolute bottom-12 left-1/2 -translate-x-1/2 w-full max-w-lg pointer-events-none z-50 flex flex-col justify-end items-center gap-4">
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
                          {k.count > 1 && <span className={`bg-white text-primary border-on-surface font-bold uppercase ${isEmbed ? 'text-xs px-1.5 py-0 border-2' : 'text-sm px-2 py-0.5 border-2'}`}>x{k.count}</span>}
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}

            {/* Context Menu */}
            {contextMenu && (
              <div 
                className="fixed z-[1000] bg-background border-4 border-on-surface p-2 hard-shadow font-mono text-sm"
                style={{ left: contextMenu.x, top: contextMenu.y }}
              >
                <button 
                  onClick={copyEmbedCode}
                  className={`w-full text-left px-6 py-3 transition-colors flex items-center gap-3 font-bold border-2 border-transparent ${copiedEmbed ? 'bg-primary text-white' : 'text-on-surface hover:border-on-surface hover:bg-surface-container-high'}`}
                >
                  {copiedEmbed ? <Check size={16} /> : <Share2 size={16} />} 
                  {copiedEmbed ? 'Copied!' : 'Copy embed code'}
                </button>
              </div>
            )}
          </div>

          {/* Elegant Embed Footer */}
          {isEmbed && (
            <div className="h-12 bg-background border-t-4 border-on-surface flex justify-between items-center px-4 shrink-0 font-mono text-[10px] uppercase font-bold tracking-widest text-on-surface/70 relative z-10">
              <div className="flex items-center gap-4">
                 {isSandboxMode 
                   ? <span className="flex items-center gap-2 text-primary"><SquareTerminal size={14}/> Live Interactive Sandbox</span> 
                   : (isPlaying 
                      ? <span className="flex items-center gap-2"><Play size={14}/> Playing Cast</span> 
                      : <span className="flex items-center gap-2"><Pause size={14}/> Paused</span>
                     )
                 }
              </div>
              
              <a 
                href={`/lab/${id}`} 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center gap-2 hover:text-primary transition-colors group"
              >
                Open in SWACN 
                <span className="group-hover:-translate-y-0.5 group-hover:translate-x-0.5 transition-transform">
                  <ExternalLink size={14} />
                </span>
              </a>
            </div>
          )}

        </section>
      </div>


    </div>
  );
}