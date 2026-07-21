import React, { useEffect, useRef, useState, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Settings, SquareTerminal, Palette, ListVideo, Play, Pause, XCircle, Menu, Share2, Check, ExternalLink, Download, LogOut, ChevronLeft, ChevronRight, Lock as LockIcon, LogIn } from 'lucide-react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import * as AsciinemaPlayer from 'asciinema-player';
import 'asciinema-player/dist/bundle/asciinema-player.css';
import '@xterm/xterm/css/xterm.css';

import { fetchCasts, fetchCastDetails, updateCastSettings, getAuthToken, setAuthToken, logout } from '../lib/api';
import { TarBuilder } from '../lib/TarBuilder';
import { V86VM, fetchAssetWithCache, VMStatus } from '../lib/V86VM';

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
  const hudParam = searchParams.get('hud') ?? searchParams.get('show_keystrokes');
  const hudOverride = hudParam !== null ? hudParam === 'true' : null;

  const [activeTab, setActiveTab] = useState<Tab>('projects');
  const [token, setToken] = useState<string | null>(getAuthToken());
  const [theme, setTheme] = useState<Theme>(() => {
    if (!id) return 'swacn-dark';
    const cached = localStorage.getItem(`swacn_theme_${id}`);
    return (cached as Theme) || 'swacn-dark';
  });
  const [projects, setProjects] = useState<any[]>([]);
  const [projectName, setProjectName] = useState<string>(() => {
    if (!id) return '';
    return localStorage.getItem(`swacn_name_${id}`) || '';
  });
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showKeystrokes, setShowKeystrokes] = useState<boolean>(() => {
    if (hudOverride !== null) return hudOverride;
    return true;
  });
  const [loadError, setLoadError] = useState<number | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number } | null>(null);
  const [copiedEmbed, setCopiedEmbed] = useState(false);
  const [copiedEmbedCast, setCopiedEmbedCast] = useState(false);
  const [copiedDirect, setCopiedDirect] = useState(false);
  const [copiedDirectCast, setCopiedDirectCast] = useState(false);
  const [allowFsDownload, setAllowFsDownload] = useState<boolean>(true);
  const [hasBaseline, setHasBaseline] = useState<boolean>(false);
  const [casts, setCasts] = useState<{id: number, title: string, recording_url: string}[]>([]);
  const castIndexParam = parseInt(searchParams.get('castIndex') || '0', 10);
  const isSingleCastEmbed = searchParams.has('castIndex');
  const [activeCastIndex, setActiveCastIndex] = useState(isNaN(castIndexParam) ? 0 : castIndexParam);
  const [embedTheme, setEmbedTheme] = useState<'light' | 'dark'>(() => {
    if (!id) return 'dark';
    const cached = localStorage.getItem(`swacn_embed_theme_${id}`);
    return (cached as 'light' | 'dark') || 'dark';
  });
  const [bootCounter, setBootCounter] = useState(0);
  const tabId = useMemo(() => Math.random().toString(36).substring(2, 15), []);



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
  const vmInstance = useRef<V86VM | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const lastKeyTimeRef = useRef<number>(-1);

  const isDefaultSandbox = !id;
  const manifestUrl = useMemo(() => id ? `/uploads/${id}/manifest.json?${token ? `token=${token}&` : ''}t=${Date.now()}` : null, [id, token, bootCounter]);
  const baselineUrl = useMemo(() => id ? `/uploads/${id}/baseline.tar.gz?${token ? `token=${token}&` : ''}t=${Date.now()}` : null, [id, token, bootCounter]);
  const currentCast = casts[activeCastIndex];
  const recordingUrl = useMemo(() => {
    if (currentCast) return `/uploads/${currentCast.recording_url}?${token ? `token=${token}&` : ''}t=${currentCast.id}`;
    if (id && hasRecording) {
      if (casts.length === 0) return null;
      return `/uploads/${id}/recording.cast?${token ? `token=${token}&` : ''}t=${id}`;
    }
    return null;
  }, [id, token, hasRecording, currentCast, casts.length]);
  const authChannelRef = useRef<BroadcastChannel | null>(null);

  const refreshProjects = () => {
    fetchCasts().then(setProjects).catch(err => {
      if (!isEmbed) console.error("Failed to fetch casts", err);
    });
  };

  useEffect(() => {
    refreshProjects();

    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'SWACN_AUTH' && event.data.token) {
        console.log("[Lab] Auth token received via Bridge");
        setAuthToken(event.data.token);
        setToken(event.data.token);
        refreshProjects();
      }
    };

    // BroadcastChannel: used only for popup-based login handshake
    const authChannel = new BroadcastChannel('swacn_auth');
    authChannelRef.current = authChannel;
    authChannel.onmessage = (event) => {
      if (event.data?.type === 'SWACN_AUTH' && event.data.token) {
        console.log("[Lab] Auth token received via BroadcastChannel");
        setAuthToken(event.data.token);
        setToken(event.data.token);
        refreshProjects();
      }
    };

    // storage event fires in every OTHER context (iframes, tabs) on the same origin
    // when localStorage changes — most reliable cross-iframe sync primitive.
    const handleStorage = (event: StorageEvent) => {
      if (event.key === 'swacn_token') {
        if (event.newValue) {
          console.log("[Lab] Token set via storage event");
          setToken(event.newValue);
          fetchCasts().then(setProjects).catch(() => {});
        } else {
          console.log("[Lab] Token cleared via storage event");
          setToken(null);
          setProjects([]);
        }
      }
    };

    const handleProjectCreated = () => {
      refreshProjects();
      setIsSidebarOpen(false);
      setBootCounter(prev => prev + 1);
    };

    window.addEventListener('message', handleMessage);
    window.addEventListener('storage', handleStorage);
    window.addEventListener('project-created', handleProjectCreated);

    // If we are in an embed and don't have a token, ask the parent for the auth token
    if (isEmbed && !getAuthToken()) {
      window.parent.postMessage({ type: 'SWACN_GET_AUTH' }, '*');
    }

    return () => {
      window.removeEventListener('message', handleMessage);
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('project-created', handleProjectCreated);
      authChannel.close();
      authChannelRef.current = null;
    };
  }, [isEmbed]);

  // Reset VM status ONLY when the project id changes — not on every projects reload.
  // Clients receive vmStatus via BroadcastChannel; resetting on projects reload
  // would clobber those updates before the next broadcast arrives.
  useEffect(() => {
    setVmStatus('initializing');
    setIsPlaying(true);
    setIsSidebarOpen(false);
  }, [id, bootCounter]);

  useEffect(() => {
    if (id) {
      // 1. OPTIMISTIC SYNC FROM CACHED PROJECTS LIST (Removes UI Flash)
      const cached = projects.find(p => p.id === id || p.uuid === id);
      if (cached) {
        if (TERMINAL_THEMES[cached.theme as Theme]) setTheme(cached.theme as Theme);
        setEmbedTheme((cached.embed_theme as 'light' | 'dark') || 'dark');
        if (hudOverride !== null) {
          setShowKeystrokes(hudOverride);
        } else if (cached.show_keystrokes !== undefined) {
          setShowKeystrokes(cached.show_keystrokes);
        }
        setAllowFsDownload(cached.allow_fs_download ?? true);
        // setHasBaseline is intentionally removed from optimistic sync to ensure fresh database state is used
        if (cached.casts) setCasts(cached.casts);
        setIsSandboxMode(!cached.has_recording);
        setProjectName(cached.name || '');
      }

      // 2. FETCH SOURCE OF TRUTH (with cache busting)
      fetchCastDetails(`${id}?t=${Date.now()}`).then(details => {
        const freshTheme = (details.theme as Theme) || 'swacn-dark';
        const freshEmbedTheme = (details.embed_theme as 'light' | 'dark') || 'dark';
        const freshName = details.name || '';

        if (TERMINAL_THEMES[freshTheme]) setTheme(freshTheme);
        setEmbedTheme(freshEmbedTheme);
        setProjectName(freshName);
        
        console.log("[Lab] Project details fetched:", details);
        setProjectName(details.name || id);
        setHasRecording(details.has_recording ?? false);
        setHasBaseline(details.has_baseline ?? false);
        setAllowFsDownload(details.allow_fs_download ?? true);
        setShowKeystrokes(hudOverride !== null ? hudOverride : (details.show_keystrokes ?? true));
        if (details.casts) setCasts(details.casts);
        setIsSandboxMode(!details.has_recording);
        setLoadError(null);
      }).catch(err => {
        console.error("Failed to fetch cast details", err);
        if (err.status) setLoadError(err.status);
        setHasRecording(true);
        setIsSandboxMode(false);
      });
    } else {
      // Base Sandbox: always interactive, no recording
      setTheme('swacn-dark');
      setShowKeystrokes(false);
      setAllowFsDownload(false);
      setHasBaseline(false);
      setEmbedTheme('dark');
      setHasRecording(false);
      setIsSandboxMode(true);
      setProjectName('');
    }
  }, [id, projects, hudOverride]);

  const isOwner = !id || projects.some(p => String(p.id) === String(id) || p.uuid === id);

  // Auto-switch to sandbox mode when VM is ready (for default sandbox with no recording)
  useEffect(() => {
    if (isDefaultSandbox && vmStatus === 'ready') {
      setIsSandboxMode(true);
    }
  }, [vmStatus, isDefaultSandbox]);

  const updateLocalProjectState = (key: string, value: any) => {
    setProjects(prev => prev.map(p => (String(p.id) === String(id) || p.uuid === id) ? { ...p, [key]: value } : p));
  };

  const handleThemeChange = (newTheme: Theme) => {
    setTheme(newTheme);
    updateLocalProjectState('theme', newTheme);
    if (id && isOwner) {
      updateCastSettings(id, { theme: newTheme, show_keystrokes: showKeystrokes, allow_fs_download: allowFsDownload, embed_theme: embedTheme }).catch(console.error);
    }
  };

  const handleKeystrokesChange = (show: boolean) => {
    setShowKeystrokes(show);
    updateLocalProjectState('show_keystrokes', show);
    if (id && isOwner) {
      updateCastSettings(id, { theme, show_keystrokes: show, allow_fs_download: allowFsDownload, embed_theme: embedTheme }).catch(console.error);
    }
  };

  const handleFsDownloadChange = (allow: boolean) => {
    setAllowFsDownload(allow);
    updateLocalProjectState('allow_fs_download', allow);
    if (id && isOwner) {
      updateCastSettings(id, { theme, show_keystrokes: showKeystrokes, allow_fs_download: allow, embed_theme: embedTheme }).catch(console.error);
    }
  };

  const handleEmbedThemeChange = (newEmbedTheme: 'light' | 'dark') => {
    setEmbedTheme(newEmbedTheme);
    updateLocalProjectState('embed_theme', newEmbedTheme);
    if (id && isOwner) {
      updateCastSettings(id, { theme, show_keystrokes: showKeystrokes, allow_fs_download: allowFsDownload, embed_theme: newEmbedTheme }).catch(console.error);
    }
  };



  const handleContextMenu = (e: React.MouseEvent) => {
    if (!id) return;
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY });
    setCopiedEmbed(false);
    setCopiedEmbedCast(false);
  };

  const copyEmbedCode = (e: React.MouseEvent, specificCast: boolean = false) => {
    e.stopPropagation();
    if (!id) return;
    let url = `${window.location.origin}/lab/${id}?embed=true`;
    if (specificCast) url += `&castIndex=${activeCastIndex}`;
    
    // We use width: 100% and aspect-ratio for better responsiveness out of the box
    const embedCode = `<iframe src="${url}" width="100%" height="500" style="border: none; display: block; max-width: 100%; aspect-ratio: 16/9; border-radius: 8px; overflow: hidden;" frameborder="0" allowfullscreen></iframe>`;
    navigator.clipboard.writeText(embedCode);
    if (specificCast) {
      setCopiedEmbedCast(true);
    } else {
      setCopiedEmbed(true);
    }
    setTimeout(() => {
      setContextMenu(null);
      setCopiedEmbed(false);
      setCopiedEmbedCast(false);
    }, 1000);
  };

  const copyDirectLink = (e: React.MouseEvent, specificCast: boolean = false) => {
    e.stopPropagation();
    if (!id) return;
    let url = `${window.location.origin}/lab/${id}?embed=true`;
    if (specificCast) url += `&castIndex=${activeCastIndex}`;
    
    navigator.clipboard.writeText(url);
    if (specificCast) {
      setCopiedDirectCast(true);
    } else {
      setCopiedDirect(true);
    }
    setTimeout(() => {
      setContextMenu(null);
      setCopiedDirect(false);
      setCopiedDirectCast(false);
    }, 1000);
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
    
        fetchAssetWithCache(recordingUrl, false)
          .then(data => new TextDecoder().decode(data))
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
    if (terminalRef.current) terminalRef.current.innerHTML = '';
    term.open(terminalRef.current);
    
    // Initial fit attempt
    setTimeout(() => {
      if (isSandboxMode) fitAddon.fit();
    }, 100);
    
    const bootTimer = setTimeout(() => {
      const vm = new V86VM(term, id ?? 'sandbox');
      vmInstance.current = vm;
      vm.boot(manifestUrl, baselineUrl, (status) => setVmStatus(status), undefined);
    }, 200);

    let resizeTimeout: ReturnType<typeof setTimeout>;
    const resizeObserver = new ResizeObserver(() => {
      try {
        if (fitAddonRef.current) {
          fitAddonRef.current.fit();
        }
        
        // Debounce the VM stty commands to prevent serial port flooding
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
          if (xtermInstance.current && vmInstance.current) {
            vmInstance.current.setTerminalSize(xtermInstance.current.cols, xtermInstance.current.rows);
          }
        }, 300);
      } catch (err) {
        // Ignore fit errors if container is 0x0
      }
    });

    // Observe the parent container instead of just the terminal to ensure fit happens even when hidden
    if (terminalRef.current?.parentElement) {
      resizeObserver.observe(terminalRef.current.parentElement);
    }

    return () => {
      resizeObserver.disconnect();
      vmInstance.current?.dispose();
      vmInstance.current = null;
      term.dispose();
      xtermInstance.current = null;
      fitAddonRef.current = null;
      clearTimeout(bootTimer);
    };
  }, [id, bootCounter]); 

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
      // Create a hidden anchor and trigger click for better iframe compatibility
      const link = document.createElement('a');
      link.href = baselineUrl;
      link.setAttribute('download', 'baseline.tar.gz');
      link.setAttribute('target', '_blank');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const renderDownloadButton = (isEmbedSizing: boolean) => {
    if (!id || isDefaultSandbox) return null;
    if (!hasBaseline) return null;
    if (!isOwner && !allowFsDownload) return null;
    
    return (
      <button 
        onClick={handleDownloadFs}
        className={`${isEmbedSizing ? 'border' : 'border-2'} ${isEmbedSizing ? 'px-2 py-1 text-[10px]' : 'px-4 py-2 text-xs'} font-headline font-bold uppercase transition-all flex items-center gap-1.5 
          ${embedTheme === 'dark' 
            ? `bg-transparent text-[#fcf9f0] ${embedTheme === 'dark' ? 'border-[#fcf9f0]/30' : 'border-[#fcf9f0]'} hover:bg-[#fcf9f0] hover:text-[#1c1c17] ${isEmbedSizing ? 'hard-shadow-sm-light' : 'hard-shadow-light'}` 
            : `bg-transparent text-black border-black/30 hover:bg-black hover:text-white ${isEmbedSizing ? 'hard-shadow-sm' : 'hard-shadow'}`}
          hover:-translate-y-0.5 hover:-translate-x-0.5 cursor-pointer`}
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
          className={`${isEmbedSizing ? 'border' : 'border-2'} ${isEmbedSizing ? 'px-4 py-1.5 text-[10px]' : 'px-4 py-2 text-xs'} font-mono font-bold uppercase transition-all flex items-center gap-1.5 
            ${embedTheme === 'dark' 
              ? `bg-transparent text-[#fcf9f0] border-[#fcf9f0]/30 hover:bg-[#fcf9f0] hover:text-[#1c1c17] ${isEmbedSizing ? 'hard-shadow-sm-light' : 'hard-shadow-light'}` 
              : `bg-transparent text-black border-black/30 hover:bg-black hover:text-white ${isEmbedSizing ? 'hard-shadow-sm' : 'hard-shadow'}`}
            hover:-translate-y-0.5 hover:-translate-x-0.5`}
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
            className={`relative overflow-hidden font-mono font-bold uppercase transition-all flex items-center justify-center gap-2 
              ${vmStatus === 'ready' ? (embedTheme === 'dark' ? 'border-[#402208]' : 'border-on-surface') : (embedTheme === 'dark' ? 'border-[#fcf9f0]/10' : 'border-on-surface')}
              ${embedTheme === 'dark' ? (isEmbedSizing ? 'hard-shadow-sm-light' : 'hard-shadow-light') : (isEmbedSizing ? 'hard-shadow-sm' : 'hard-shadow')}
              ${isEmbedSizing ? 'border px-3 py-1.5 text-[9px]' : 'border-2 px-6 py-2.5 text-xs'}
              ${vmStatus === 'ready' 
                ? 'bg-primary text-white hover:-translate-y-0.5 hover:-translate-x-0.5 cursor-pointer' 
                : (isEmbed 
                    ? `w-full ${embedTheme === 'dark' ? 'bg-[#2a2a24] text-[#fcf9f0]/40' : 'bg-surface-container-high text-on-surface/60'} cursor-default group-hover:opacity-0` 
                    : `w-full ${embedTheme === 'dark' ? 'bg-[#2a2a24] text-[#fcf9f0]/40' : 'bg-surface-container-high text-on-surface/60'} cursor-not-allowed`)}`}
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
              className={`absolute inset-0 opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto bg-primary text-white flex items-center justify-center gap-1.5 font-mono font-bold uppercase transition-all duration-300 z-20 whitespace-nowrap hover:-translate-y-0.5 hover:-translate-x-0.5 
                ${embedTheme === 'dark' ? `border-[#402208] ${isEmbedSizing ? 'hard-shadow-sm-light' : 'hard-shadow-light'}` : `border-on-surface ${isEmbedSizing ? 'hard-shadow-sm' : 'hard-shadow'}`}
                ${isEmbedSizing ? 'border text-[10px]' : 'border-2 text-xs'}`}
            >
              Open in SWACN <ExternalLink size={isEmbedSizing ? 12 : 16} />
            </a>
          )}
        </div>
      );
    }
    
    return null;
  };

  if (loadError === 401 || loadError === 403) {
    return (
      <div className="flex flex-col items-center justify-center w-full h-screen font-sans transition-colors duration-300 p-4 md:p-8 bg-background text-on-surface">
        <div className="border-4 p-6 md:p-10 flex flex-col items-center text-center w-full max-w-xl bg-white border-on-surface hard-shadow">
          <LockIcon size={64} className="text-error mb-6" />
          <h1 className="text-4xl md:text-5xl font-black font-headline uppercase tracking-tighter mb-4 leading-none">Access Denied</h1>
          <p className="text-base md:text-lg leading-relaxed opacity-80 font-medium mb-8">
            This project is private. You must be authenticated and authorized by the owner to access this sandbox.
          </p>
          <button 
            onClick={() => {
              const width = 600, height = 700;
              const left = (window.screen.width / 2) - (width / 2);
              const top = (window.screen.height / 2) - (height / 2);
              const handshakeId = Math.random().toString(36).substring(2, 15);
              
              const pollInterval = setInterval(async () => {
                try {
                  const res = await fetch(`/api/auth/poll?handshake_id=${handshakeId}`);
                  if (res.ok) {
                    const data = await res.json();
                    if (data.token) {
                      clearInterval(pollInterval);
                      setAuthToken(data.token);
                      setToken(data.token);
                      if (authChannelRef.current) {
                        authChannelRef.current.postMessage({ type: 'SWACN_AUTH', token: data.token });
                      }
                      setLoadError(null);
                      refreshProjects();
                    }
                  }
                } catch (e) {}
              }, 1000);
              setTimeout(() => clearInterval(pollInterval), 5 * 60 * 1000);
              window.open(`/api/auth/github/login?popup=true&handshake_id=${handshakeId}`, 'swacn_auth', `width=${width},height=${height},left=${left},top=${top}`);
            }}
            className="w-full sm:w-auto px-8 py-4 font-black uppercase tracking-widest transition-transform hover:-translate-y-1 hover:translate-x-1 active:translate-y-0 active:translate-x-0 flex justify-center items-center gap-3 border-4 bg-primary text-white border-on-surface hard-shadow"
          >
            <LogIn size={24} /> Verify Access
          </button>
          {!isEmbed && (
            <a href="/" className="mt-8 text-sm font-bold uppercase tracking-widest underline decoration-2 underline-offset-4 opacity-50 hover:opacity-100 transition-opacity font-mono">Return Home</a>
          )}
        </div>
      </div>
    );
  }

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

        /* 4. HIDE ASCIINEMA TOOLTIP BLOB */
        .ap-tooltip, [class*="ap-tooltip"], .ap-control-bar .ap-btn::after, .ap-control-bar .ap-btn::before {
          display: none !important;
          visibility: hidden !important;
          opacity: 0 !important;
          pointer-events: none !important;
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
                  onClick={() => {
                    if (getAuthToken()) {
                      window.dispatchEvent(new CustomEvent('open-project-creator'));
                    } else {
                      window.dispatchEvent(new CustomEvent('open-login-modal'));
                    }
                  }}
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
                  <h2 className="font-headline font-black text-lg uppercase tracking-tight text-on-surface mb-6 border-b-4 border-on-surface pb-2 flex items-center gap-2"><Palette size={20}/> Terminal Theme</h2>
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

                <div>
                  <h2 className="font-headline font-black text-lg uppercase tracking-tight text-on-surface mb-6 border-b-4 border-on-surface pb-2 flex items-center gap-2"><Palette size={20}/> UI Theme</h2>
                  <div className="space-y-3 font-mono text-sm capitalize">
                    {(['light', 'dark'] as const).map(t => (
                      <label key={t} className="flex items-center gap-4 p-3 border-2 bg-white hover:border-on-surface cursor-pointer border-transparent transition-colors">
                        <input 
                          type="radio" 
                          name="embedTheme" 
                          checked={embedTheme === t} 
                          onChange={() => handleEmbedThemeChange(t)}
                          className="accent-primary w-4 h-4"
                        />
                        <span className="font-bold">{t} Mode</span>
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

                {isOwner && id && (
                  <div>
                    <h2 className="font-headline font-black text-lg uppercase tracking-tight text-on-surface mb-6 border-b-4 border-on-surface pb-2 flex items-center gap-2"><Settings size={20}/> Project Configuration</h2>
                    <div className="space-y-3">
                      <label className={`flex items-center gap-4 p-3 border-2 bg-white hover:border-on-surface cursor-pointer border-transparent transition-colors font-mono text-sm ${!hasBaseline ? 'opacity-50 grayscale pointer-events-none' : ''}`}>
                        <input 
                          type="checkbox" 
                          checked={allowFsDownload} 
                          onChange={(e) => handleFsDownloadChange(e.target.checked)}
                          disabled={!hasBaseline}
                          className="accent-primary w-4 h-4"
                        />
                        <span className="font-bold">Allow FS Download</span>
                      </label>
                      <button 
                        onClick={() => window.dispatchEvent(new CustomEvent('open-project-creator', { detail: { id } }))}
                        className="w-full flex items-center gap-4 p-3 border-2 bg-white hover:border-on-surface cursor-pointer border-transparent transition-colors font-mono text-sm text-left group"
                      >
                        <div className="w-4 h-4 flex items-center justify-center">
                          <SquareTerminal size={16} className="text-on-surface opacity-70 group-hover:opacity-100 transition-opacity" />
                        </div>
                        <span className="font-bold">Edit Project Details</span>
                      </button>
                    </div>
                  </div>
                )}
   
               </div>
             </div>
           </div>
          </div>
        </aside>
        )}

        <section className="flex-grow flex flex-col relative overflow-hidden bg-transparent">
          
          {!isEmbed && (
          <div className={`px-4 py-3 border-b-4 flex justify-between items-center z-10 h-16 shrink-0 relative transition-colors duration-300 ${embedTheme === 'dark' ? 'bg-[#1c1c17] border-[#fcf9f0]/20 text-[#fcf9f0]' : 'bg-surface-container-high border-on-surface text-on-surface'}`}>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => {
                    if (activeTab === 'projects' && isSidebarOpen) setIsSidebarOpen(false);
                    else { setActiveTab('projects'); setIsSidebarOpen(true); }
                  }}
                  className={`p-2 border-2 border-transparent transition-all ${activeTab === 'projects' && isSidebarOpen ? (embedTheme === 'dark' ? 'bg-primary text-white border-[#fcf9f0]/40 hard-shadow-light' : 'bg-primary text-white border-on-surface hard-shadow') : (embedTheme === 'dark' ? 'hover:bg-[#fcf9f0]/10 text-[#fcf9f0] hover:hard-shadow-light' : 'hover:bg-white text-on-surface hover:hard-shadow')}`}
                  title="Workspaces"
                >
                  <ListVideo size={20} />
                </button>
                <button 
                  onClick={() => {
                    if (activeTab === 'settings' && isSidebarOpen) setIsSidebarOpen(false);
                    else { setActiveTab('settings'); setIsSidebarOpen(true); }
                  }}
                  className={`p-2 border-2 border-transparent transition-all ${activeTab === 'settings' && isSidebarOpen ? (embedTheme === 'dark' ? 'bg-primary text-white border-[#fcf9f0]/40 hard-shadow-light' : 'bg-primary text-white border-on-surface hard-shadow') : (embedTheme === 'dark' ? 'hover:bg-[#fcf9f0]/10 text-[#fcf9f0] hover:hard-shadow-light' : 'hover:bg-white text-on-surface hover:hard-shadow')}`}
                  title="Settings"
                >
                  <Settings size={20} />
                </button>
              </div>
              <div className={`w-px h-8 opacity-30 ${embedTheme === 'dark' ? 'bg-[#fcf9f0]' : 'bg-on-surface'}`}></div>
              <span className="font-mono text-sm md:text-base font-bold uppercase tracking-tighter truncate max-w-[200px] sm:max-w-none">
              {id 
                ? (currentCast?.title || projectName || projects.find(p => p.id === id)?.name || id.split('-')[0])
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
            <div className={`h-14 border-b-4 grid grid-cols-[1fr_auto_1fr] items-center px-4 shrink-0 relative z-10 transition-colors duration-300 ${embedTheme === 'dark' ? 'bg-[#1c1c17] border-[#fcf9f0]/20' : 'bg-surface-container-high border-on-surface'}`}>
              <div className="flex gap-2 items-center">
                <div className={`w-3 h-3 rounded-full bg-red-500 border-2 ${embedTheme === 'dark' ? 'border-[#fcf9f0]/20' : 'border-on-surface'}`}></div>
                <div className={`w-3 h-3 rounded-full bg-yellow-500 border-2 ${embedTheme === 'dark' ? 'border-[#fcf9f0]/20' : 'border-on-surface'}`}></div>
                <div className={`w-3 h-3 rounded-full bg-green-500 border-2 ${embedTheme === 'dark' ? 'border-[#fcf9f0]/20' : 'border-on-surface'}`}></div>
              </div>
              
              <div className="min-w-0 flex-grow px-2">
                <div className={`font-mono text-[10px] sm:text-xs font-bold tracking-widest uppercase truncate max-w-[120px] sm:max-w-[300px] mx-auto text-center ${embedTheme === 'dark' ? 'text-[#fcf9f0]' : 'text-on-surface'}`}>
                  {currentCast?.title || projectName || id?.split('-')[0]}
                </div>
              </div>
              
              <div className="flex items-center justify-end gap-3 z-20">
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
            <div className={`absolute inset-0 p-2 sm:p-4 z-20 transition-opacity duration-300 ${isSandboxMode ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
              <div ref={playerContainerRef} className="w-full h-full overflow-hidden flex items-center justify-center" />
            </div>

            <div className={`absolute inset-0 p-2 sm:p-4 z-10 transition-opacity duration-300 ${isSandboxMode ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
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
                        <div className={`bg-primary text-white font-mono font-black flex items-center gap-4 justify-center 
                          ${isDarkTheme ? (isEmbed ? 'hard-shadow-sm-light border-[#402208]' : 'hard-shadow-light border-[#402208]') : (isEmbed ? 'hard-shadow-sm border-on-surface' : 'hard-shadow border-on-surface')}
                          ${isEmbed ? 'px-4 py-2 border-2 text-lg min-w-[3rem]' : 'px-8 py-4 border-4 text-2xl min-w-[4rem]'}`}>
                          <span className="tracking-tighter">{k.k}</span>
                          {k.count > 1 && <span className={`bg-white text-primary font-bold uppercase ${isDarkTheme ? 'border-[#402208]' : 'border-on-surface'} ${isEmbed ? 'text-xs px-1.5 py-0 border-2' : 'text-sm px-2 py-0.5 border-2'}`}>x{k.count}</span>}
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}

            {/* Slider UI for Multiple Casts */}
            {casts.length > 1 && !isSandboxMode && !isSingleCastEmbed && (
              <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex justify-between px-4 z-40 pointer-events-none">
                <button 
                  onClick={() => setActiveCastIndex(prev => Math.max(0, prev - 1))}
                  disabled={activeCastIndex === 0}
                  className={`p-3 border-2 transition-all pointer-events-auto group disabled:opacity-0 disabled:pointer-events-none
                    ${embedTheme === 'dark' 
                      ? 'bg-[#1c1c17]/80 backdrop-blur-md border-[#fcf9f0]/20 text-[#fcf9f0] hover:bg-primary hover:text-white hover:border-primary hard-shadow-sm-light' 
                      : 'bg-white/80 backdrop-blur-md border-on-surface text-on-surface hover:bg-primary hover:text-white hover:border-primary hard-shadow-sm'}`}
                  title="Previous Cast"
                >
                  <ChevronLeft size={24} className="group-hover:-translate-x-0.5 transition-transform" />
                </button>

                <button 
                  onClick={() => setActiveCastIndex(prev => Math.min(casts.length - 1, prev + 1))}
                  disabled={activeCastIndex === casts.length - 1}
                  className={`p-3 border-2 transition-all pointer-events-auto group disabled:opacity-0 disabled:pointer-events-none
                    ${embedTheme === 'dark' 
                      ? 'bg-[#1c1c17]/80 backdrop-blur-md border-[#fcf9f0]/20 text-[#fcf9f0] hover:bg-primary hover:text-white hover:border-primary hard-shadow-sm-light' 
                      : 'bg-white/80 backdrop-blur-md border-on-surface text-on-surface hover:bg-primary hover:text-white hover:border-primary hard-shadow-sm'}`}
                  title="Next Cast"
                >
                  <ChevronRight size={24} className="group-hover:translate-x-0.5 transition-transform" />
                </button>
              </div>
            )}

            {/* Context Menu */}
            {contextMenu && (
              <div 
                className={`fixed z-[1000] border-4 p-2 font-mono text-sm ${embedTheme === 'dark' ? 'bg-[#1c1c17] border-[#fcf9f0]/40 text-[#fcf9f0] hard-shadow-light' : 'bg-background border-on-surface text-on-surface hard-shadow'}`}
                style={{ left: contextMenu.x, top: contextMenu.y }}
              >
                {casts.length > 1 && !isSandboxMode && (
                  <>
                    <button 
                      onClick={(e) => copyEmbedCode(e, true)}
                      className={`w-full text-left px-6 py-3 transition-colors flex items-center gap-3 font-bold border-2 border-transparent ${copiedEmbedCast ? 'bg-primary text-white' : (embedTheme === 'dark' ? 'text-[#fcf9f0] hover:border-[#fcf9f0]/40 hover:bg-[#fcf9f0]/10' : 'text-on-surface hover:border-on-surface hover:bg-surface-container-high')}`}
                    >
                      {copiedEmbedCast ? <Check size={16} /> : <Share2 size={16} />} 
                      {copiedEmbedCast ? 'Copied!' : 'Copy Embed Code (Chapter)'}
                    </button>
                    <button 
                      onClick={(e) => copyDirectLink(e, true)}
                      className={`w-full text-left px-6 py-3 transition-colors flex items-center gap-3 font-bold border-2 border-transparent ${copiedDirectCast ? 'bg-primary text-white' : (embedTheme === 'dark' ? 'text-[#fcf9f0] hover:border-[#fcf9f0]/40 hover:bg-[#fcf9f0]/10' : 'text-on-surface hover:border-on-surface hover:bg-surface-container-high')}`}
                    >
                      {copiedDirectCast ? <Check size={16} /> : <Share2 size={16} />} 
                      {copiedDirectCast ? 'Copied!' : 'Copy Direct Link (Chapter)'}
                    </button>
                    <div className={`h-px mx-2 my-1 ${embedTheme === 'dark' ? 'bg-[#fcf9f0]/20' : 'bg-on-surface/10'}`} />
                  </>
                )}
                <button 
                  onClick={(e) => copyEmbedCode(e, false)}
                  className={`w-full text-left px-6 py-3 transition-colors flex items-center gap-3 font-bold border-2 border-transparent ${copiedEmbed ? 'bg-primary text-white' : (embedTheme === 'dark' ? 'text-[#fcf9f0] hover:border-[#fcf9f0]/40 hover:bg-[#fcf9f0]/10' : 'text-on-surface hover:border-on-surface hover:bg-surface-container-high')}`}
                >
                  {copiedEmbed ? <Check size={16} /> : <Share2 size={16} />} 
                  {copiedEmbed ? 'Copied!' : (casts.length > 1 ? 'Copy Embed Code (Full Project)' : 'Copy Embed Code')}
                </button>
                <button 
                  onClick={(e) => copyDirectLink(e, false)}
                  className={`w-full text-left px-6 py-3 transition-colors flex items-center gap-3 font-bold border-2 border-transparent ${copiedDirect ? 'bg-primary text-white' : (embedTheme === 'dark' ? 'text-[#fcf9f0] hover:border-[#fcf9f0]/40 hover:bg-[#fcf9f0]/10' : 'text-on-surface hover:border-on-surface hover:bg-surface-container-high')}`}
                >
                  {copiedDirect ? <Check size={16} /> : <Share2 size={16} />} 
                  {copiedDirect ? 'Copied!' : (casts.length > 1 ? 'Copy Direct Link (Full Project)' : 'Copy Direct Link')}
                </button>
              </div>
            )}
          </div>

          {/* Elegant Embed Footer */}
          {isEmbed && (
            <div className={`h-12 border-t-4 flex justify-between items-center px-4 shrink-0 font-mono text-[10px] uppercase font-bold tracking-widest relative z-10 transition-colors duration-300 ${embedTheme === 'dark' ? 'bg-[#1c1c17] border-[#fcf9f0]/20 text-[#fcf9f0]/70' : 'bg-background border-on-surface text-on-surface/70'}`}>
               <div className="flex items-center gap-4">
                  {isSandboxMode 
                    ? <span className="flex items-center gap-2 text-primary"><SquareTerminal size={14}/> Live Interactive Sandbox</span> 
                    : (isPlaying 
                       ? <span className="flex items-center gap-2"><Play size={14}/> Playing Cast</span> 
                       : <span className="flex items-center gap-2"><Pause size={14}/> Paused</span>
                      )
                  }
               </div>
              
              <div className="flex items-center gap-4">
                {!token ? (
                  <button 
                    onClick={() => {
                      const width = 600;
                      const height = 700;
                      const left = window.screen.width / 2 - width / 2;
                      const top = window.screen.height / 2 - height / 2;
                      
                      // Generate a unique handshake ID for this session
                      const handshakeId = Math.random().toString(36).substring(2, 15);
                      
                      // Start polling for the token
                      const pollInterval = setInterval(async () => {
                        try {
                          const res = await fetch(`/api/auth/poll?handshake_id=${handshakeId}`);
                          const data = await res.json();
                          if (data.token) {
                            clearInterval(pollInterval);
                            console.log("[Lab] Auth token received via Polling Handshake");
                            setAuthToken(data.token);
                            setToken(data.token);
                            authChannelRef.current?.postMessage({ type: 'SWACN_AUTH', token: data.token });
                            refreshProjects();
                          }
                        } catch (e) {
                          console.error("[Lab] Handshake polling failed", e);
                        }
                      }, 1000);

                      // Stop polling after 5 minutes to avoid leaks
                      setTimeout(() => clearInterval(pollInterval), 5 * 60 * 1000);

                      window.open(`/api/auth/github/login?popup=true&handshake_id=${handshakeId}`, 'swacn_auth', `width=${width},height=${height},left=${left},top=${top}`);
                    }}
                    className={`flex items-center gap-1.5 transition-all hover:text-primary ${embedTheme === 'dark' ? 'text-[#fcf9f0]/70' : 'text-on-surface/70'}`}
                  >
                    <LogOut size={12} className="rotate-180" /> Sign In
                  </button>
                ) : (
                  <button 
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      logout();        // removes from localStorage → fires storage event in all other iframes
                      setToken(null);  // update this iframe immediately (storage event doesn't fire for sender)
                      setProjects([]);
                    }}
                    className={`flex items-center gap-1.5 transition-all hover:text-primary ${embedTheme === 'dark' ? 'text-[#fcf9f0]/70' : 'text-on-surface/70'}`}
                    title="Log Out"
                  >
                    <LogOut size={12} /> Log Out
                  </button>
                )}
                
                <div className="w-px h-3 bg-on-surface/10"></div>
                
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
            </div>
          )}

        </section>
      </div>


    </div>
  );
}