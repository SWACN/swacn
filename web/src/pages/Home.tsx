import React from 'react';
import { motion } from 'motion/react';
import { PlayCircle, Share2, Terminal, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

export function Home() {
  return (
    <div className="w-full h-[calc(100vh-6rem)] md:h-[calc(100vh-8rem)] px-4 md:px-8 lg:px-16 xl:px-24 py-4 md:py-8 flex flex-col justify-center overflow-hidden">
      {/* Asymmetric Control Board Grid */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 md:gap-6 auto-rows-min h-full md:h-auto overflow-y-auto md:overflow-visible pr-2 md:pr-0">
        
        {/* HERO PANEL (Spans 8 columns) */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="col-span-1 md:col-span-8 border-4 border-on-surface bg-white hard-shadow p-6 md:p-10 relative overflow-hidden group hover:-translate-y-2 hover:-translate-x-2 transition-transform duration-300"
        >
          <div className="absolute -right-24 -bottom-24 opacity-5 pointer-events-none group-hover:scale-110 transition-transform duration-700">
            <img 
              alt="SWACN Logo" 
              className="w-96 h-96 grayscale contrast-125" 
              src="../../assets/logo.png"
              referrerPolicy="no-referrer"
            />
          </div>
          
          <div className="relative z-10 flex flex-col h-full justify-center">
            <div className="font-mono text-xs font-bold uppercase tracking-widest text-primary mb-4 flex items-center gap-2">
              <span className="w-2 h-2 bg-primary"></span>
              SWACN_CORE_v1.0.4
            </div>
            
            <h1 className="font-headline text-4xl md:text-6xl lg:text-7xl font-black tracking-tighter leading-none mb-4 max-w-2xl text-on-surface uppercase">
              Software<br/>Without Any<br/>Cool Name.
            </h1>
            
            <p className="font-mono text-sm md:text-base text-on-surface/70 max-w-xl mb-8 border-l-4 border-primary pl-4">
              A highly tactile, terminal-first reactive model for deterministic state hydration and interactive web virtual machines.
            </p>
            
            <div className="mt-auto flex flex-wrap gap-4">
              <Link to="/dashboard" className="bg-primary text-white border-4 border-on-surface px-6 py-3 font-mono text-xs md:text-sm uppercase font-bold hover:bg-on-surface transition-colors flex items-center gap-2">
                Launch Dashboard <ArrowRight size={18} />
              </Link>
              <button className="bg-surface-container-high text-on-surface border-4 border-on-surface px-6 py-3 font-mono text-xs md:text-sm uppercase font-bold hover:bg-white transition-colors">
                Read Manifest
              </button>
            </div>
          </div>
        </motion.div>

        {/* TERMINAL MOCKUP PANEL (Spans 4 columns) */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="col-span-1 md:col-span-4 border-4 border-on-surface bg-on-surface hard-shadow flex flex-col group hover:-translate-y-2 hover:-translate-x-2 transition-transform duration-300"
        >
          <div className="bg-surface-container-low border-b-4 border-on-surface px-4 py-2 flex items-center justify-between shrink-0">
            <div className="flex gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500 border border-on-surface"></div>
              <div className="w-3 h-3 rounded-full bg-yellow-500 border border-on-surface"></div>
              <div className="w-3 h-3 rounded-full bg-green-500 border border-on-surface"></div>
            </div>
            <span className="font-mono text-[10px] text-on-surface/50 uppercase font-bold">Install_CLI</span>
          </div>
          
          <div className="p-4 md:p-6 font-mono text-sm text-surface-container-low flex-grow flex flex-col justify-center">
            <div className="flex gap-3 mb-2">
              <span className="text-primary font-bold">➜</span>
              <span className="text-white">curl -sL https://swacn.com/install.sh | bash</span>
            </div>
            <div className="text-white/40 mb-6 text-xs leading-relaxed">
              SWACN CLI Installer (Linux/macOS)<br/>
              Platform: macos (arm64)<br/>
              Fetching latest release...<br/>
              ✔ Successfully installed swacn to ~/.local/bin/swacn
            </div>
            <div className="flex gap-3">
              <span className="text-primary font-bold">➜</span>
              <span className="text-white animate-pulse">_</span>
            </div>
          </div>
        </motion.div>

        {/* FEATURE 1 PANEL */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="col-span-1 md:col-span-4 border-4 border-on-surface bg-surface-container-low hard-shadow p-6 hover:-translate-y-2 hover:-translate-x-2 transition-transform duration-300 flex flex-col group"
        >
          <div className="w-10 h-10 bg-primary text-white flex items-center justify-center border-2 border-on-surface mb-4 group-hover:scale-110 transition-transform hard-shadow-sm">
            <Terminal size={20} />
          </div>
          <h3 className="font-headline font-black text-xl uppercase tracking-tight mb-2">Record Everything</h3>
          <p className="font-mono text-xs text-on-surface/70 leading-relaxed">
            Capture stdout, keystrokes, and your project filesystem. SWACN guarantees a deterministic, pixel-perfect replay of your interactive session.
          </p>
        </motion.div>

        {/* FEATURE 2 PANEL */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="col-span-1 md:col-span-4 border-4 border-on-surface bg-white hard-shadow p-6 hover:-translate-y-2 hover:-translate-x-2 transition-transform duration-300 flex flex-col group"
        >
          <div className="w-10 h-10 bg-white text-primary flex items-center justify-center border-2 border-on-surface mb-4 group-hover:scale-110 transition-transform hard-shadow-sm">
            <PlayCircle size={20} />
          </div>
          <h3 className="font-headline font-black text-xl uppercase tracking-tight mb-2">Interactive Playback</h3>
          <p className="font-mono text-xs text-on-surface/70 leading-relaxed">
            Don't just watch—interact. Pause the video at any timestamp to jump into a live v86 sandbox pre-loaded with your project's filesystem.
          </p>
        </motion.div>

        {/* FEATURE 3 PANEL */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="col-span-1 md:col-span-4 border-4 border-on-surface bg-primary text-white hard-shadow p-6 hover:-translate-y-2 hover:-translate-x-2 transition-transform duration-300 flex flex-col group"
        >
          <div className="w-10 h-10 bg-on-surface text-white flex items-center justify-center border-2 border-white/20 mb-4 group-hover:scale-110 transition-transform hard-shadow-sm">
            <Share2 size={20} />
          </div>
          <h3 className="font-headline font-black text-xl uppercase tracking-tight mb-2">Embed Anywhere</h3>
          <p className="font-mono text-xs text-white/70 leading-relaxed">
            Ditch static code blocks. Turn your docs and tutorials into live, shareable lab environments with a simple iframe embed.
          </p>
        </motion.div>

      </div>
    </div>
  );
}
