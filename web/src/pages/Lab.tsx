import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FolderOpen, Folder, FileText, Settings, Play, Pause, SquareTerminal, Palette, ListVideo, Keyboard } from 'lucide-react';
import { Terminal as XTerm } from '@xterm/xterm';
import { fetchCasts } from '../lib/api';
import '@xterm/xterm/css/xterm.css';
import { CheerpXVM } from '../lib/CheerpXVM';

type Tab = 'projects' | 'fs' | 'settings';
type Theme = 'swacn-dark' | 'swacn-light' | 'dracula';

const THEMES = {
  'swacn-dark': { background: '#1c1c17', foreground: '#fcf9f0', cursor: '#fcf9f0', selectionBackground: '#847469' },
  'swacn-light': { background: '#ffffff', foreground: '#1c1c17', cursor: '#703e0e', selectionBackground: '#ebe8df' },
  'dracula': { background: '#282a36', foreground: '#f8f8f2', cursor: '#ff79c6', selectionBackground: '#44475a' },
};

export function Lab() {
  const { id } = useParams();
  const navigate = useNavigate();
  
  // State
  const [activeTab, setActiveTab] = useState<Tab>('projects');
  const [isPlaying, setIsPlaying] = useState(false);
  const [theme, setTheme] = useState<Theme>('swacn-light');
  const [showKeystrokes, setShowKeystrokes] = useState(true);
  const [projects, setProjects] = useState<any[]>([]);
  
  // Refs
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermInstance = useRef<XTerm | null>(null);

  // Fetch available projects for the sidebar
  useEffect(() => {
    fetchCasts().then(setProjects).catch(console.error);
  }, []);

  useEffect(() => {
    if (!terminalRef.current) return;

    xtermInstance.current = new XTerm({
      fontFamily: '"IBM Plex Mono", monospace',
      fontSize: 15,
      theme: THEMES[theme],
      cursorBlink: true,
      convertEol: true,
    });

    xtermInstance.current.open(terminalRef.current);
    const xterm = xtermInstance.current;
    
    // Initialize the real x86 emulator
    const vm = new CheerpXVM(xterm);
    vm.boot();

    return () => {
      vm.dispose();
      xtermInstance.current?.dispose();
    };
  }, [id]); // Re-init when ID changes

  // Handle Theme Changes dynamically
  useEffect(() => {
    if (xtermInstance.current) {
      xtermInstance.current.options.theme = THEMES[theme];
    }
  }, [theme]);

  return (
    <div className="flex-grow flex flex-col md:flex-row border-b-4 border-on-surface min-h-[calc(100vh-160px)]">
      
      {/* LEFT SIDEBAR: Controls & Context (3 columns equivalent) */}
      <aside className="w-full md:w-80 border-r-4 border-on-surface bg-background flex flex-col flex-shrink-0">
        
        {/* Sidebar Tabs */}
        <div className="flex border-b-4 border-on-surface">
          <button 
            onClick={() => setActiveTab('projects')}
            className={`flex-1 py-3 flex justify-center items-center border-r-2 border-on-surface transition-colors ${activeTab === 'projects' ? 'bg-primary text-white' : 'hover:bg-surface-container-high'}`}
          >
            <ListVideo size={20} />
          </button>
          <button 
            onClick={() => setActiveTab('fs')}
            className={`flex-1 py-3 flex justify-center items-center border-r-2 border-on-surface transition-colors ${activeTab === 'fs' ? 'bg-primary text-white' : 'hover:bg-surface-container-high'}`}
          >
            <FolderOpen size={20} />
          </button>
          <button 
            onClick={() => setActiveTab('settings')}
            className={`flex-1 py-3 flex justify-center items-center transition-colors ${activeTab === 'settings' ? 'bg-primary text-white' : 'hover:bg-surface-container-high'}`}
          >
            <Settings size={20} />
          </button>
        </div>

        {/* Sidebar Content Area */}
        <div className="flex-grow overflow-y-auto p-4">
          
          {/* PROJECTS TAB */}
          {activeTab === 'projects' && (
            <div className="space-y-4">
              <h2 className="font-headline font-bold text-xs uppercase tracking-widest text-primary mb-4">Select Workspace</h2>
              
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

          {/* FILESYSTEM TAB */}
          {activeTab === 'fs' && (
            <div className="space-y-2 font-mono text-sm">
              <h2 className="font-headline font-bold text-xs uppercase tracking-widest text-primary mb-4">Virtual FS Mount</h2>
              <div className="flex items-center gap-2 py-1 px-2"><FolderOpen size={16} /> root</div>
              <div className="flex items-center gap-2 py-1 px-2 pl-6"><Folder size={16} className="text-primary" /> <span className="text-primary">src</span></div>
              <div className="flex items-center gap-2 py-1 px-2 pl-10 bg-surface-container-high"><FileText size={16} className="text-primary" /> main.cpp</div>
              <div className="flex items-center gap-2 py-1 px-2 pl-6"><Folder size={16} /> build</div>
            </div>
          )}

          {/* SETTINGS / EMBED STUDIO TAB */}
          {activeTab === 'settings' && (
            <div className="space-y-8">
              <div>
                <h2 className="font-headline font-bold text-xs uppercase tracking-widest text-primary mb-4 flex items-center gap-2"><Palette size={16}/> Embed Theme</h2>
                <div className="space-y-2 font-mono text-sm">
                  {(Object.keys(THEMES) as Theme[]).map(t => (
                    <label key={t} className="flex items-center gap-3 p-2 border-2 border-transparent hover:border-on-surface cursor-pointer">
                      <input 
                        type="radio" 
                        name="theme" 
                        checked={theme === t} 
                        onChange={() => setTheme(t)}
                        className="accent-primary"
                      />
                      {t}
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <h2 className="font-headline font-bold text-xs uppercase tracking-widest text-primary mb-4 flex items-center gap-2"><Keyboard size={16}/> Overlays</h2>
                <label className="flex items-center gap-3 p-2 cursor-pointer font-mono text-sm">
                  <input 
                    type="checkbox" 
                    checked={showKeystrokes} 
                    onChange={(e) => setShowKeystrokes(e.target.checked)}
                    className="accent-primary w-4 h-4"
                  />
                  Show Keystroke Overlay
                </label>
                <p className="text-[10px] opacity-60 font-mono pl-9 mt-1">Only available if `swacn record --keys` was used.</p>
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* RIGHT AREA: Massive Terminal (9 columns equivalent) */}
      <section className="flex-grow flex flex-col relative bg-surface-container-low">
        
        {/* Terminal Header & Playback Controls */}
        <div className="p-3 border-b-4 border-on-surface bg-background flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <div className={`w-3 h-3 ${isPlaying ? 'bg-green-500 animate-pulse' : 'bg-primary'}`}></div>
            <span className="font-mono text-sm font-bold uppercase">
              {id ? `PLAYBACK: ${id.split('-')[0]}` : 'INTERACTIVE SANDBOX'}
            </span>
          </div>

          {/* Timeline / Playback UI (Only show if a project is selected) */}
          {id && (
            <div className="flex items-center gap-4 flex-grow max-w-xl mx-4">
              <button 
                onClick={() => setIsPlaying(!isPlaying)}
                className="w-8 h-8 flex items-center justify-center bg-on-surface text-background hover:bg-primary transition-colors"
              >
                {isPlaying ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" className="ml-1" />}
              </button>
              <div className="flex-grow h-2 bg-surface-container-high border-2 border-on-surface relative cursor-pointer">
                <div className="absolute top-0 left-0 h-full bg-primary" style={{ width: '35%' }}></div>
              </div>
              <span className="font-mono text-xs font-bold">01:24 / 04:12</span>
            </div>
          )}
          
          <div className="font-mono text-[10px] bg-surface-container-high px-2 py-1 border-2 border-on-surface hidden md:block">
            {isPlaying ? 'READ-ONLY' : 'INTERACTIVE'}
          </div>
        </div>
        
        {/* The Actual Terminal Canvas */}
        <div 
          className="flex-grow w-full relative" 
          style={{ backgroundColor: THEMES[theme].background }}
        >
          {/* xterm.js container */}
          <div ref={terminalRef} className="absolute inset-0 pl-4 pt-4 overflow-hidden" />

          {/* Keystroke Overlay Mockup */}
          {id && showKeystrokes && isPlaying && (
            <div className="absolute bottom-12 left-1/2 -translate-x-1/2 bg-on-surface text-background font-mono px-4 py-2 text-xl font-bold rounded-sm opacity-80 pointer-events-none">
              npm install
            </div>
          )}
        </div>
      </section>

    </div>
  );
}