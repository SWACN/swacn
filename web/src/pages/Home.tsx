import React from 'react';
import { motion } from 'motion/react';
import { PlayCircle, Share2, Terminal, ArrowRight, FolderUp, Sparkles, Globe, Cpu, Layers, ShieldCheck, Zap } from 'lucide-react';
import { Link } from 'react-router-dom';

export function Home() {
  return (
    <div className="w-full min-h-screen px-4 md:px-8 lg:px-16 xl:px-24 py-8 flex flex-col gap-8 bg-background overflow-x-hidden">
      
      {/* 01. HERO GRID: THE CORE UTILITY */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-stretch">
        
        {/* PRIMARY VALUE PROP */}
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="col-span-1 md:col-span-8 border-4 border-on-surface bg-white hard-shadow p-8 md:p-12 relative overflow-hidden flex flex-col justify-center"
        >
          <div className="relative z-10">
            <div className="font-mono text-xs font-black uppercase tracking-[0.4em] text-primary mb-6 flex items-center gap-3">
              <span className="w-3 h-3 bg-primary animate-pulse"></span>
              SWACN_PROTOCOL_v1.0.4
            </div>
            
            <h1 className="font-headline text-5xl md:text-7xl lg:text-8xl font-black tracking-tighter leading-[0.85] mb-8 text-on-surface uppercase">
              Executable<br/>Software<br/>Artifacts.
            </h1>
            
            <p className="font-mono text-base md:text-lg text-on-surface/80 max-w-2xl mb-10 border-l-4 border-primary pl-6 leading-relaxed">
              Ditch static code snippets. SWACN captures terminal sessions and packages them into <strong>browser-native x86 sandboxes</strong>. Replay, pause, and interact with live filesystems at any point in time.
            </p>
            
            <div className="flex flex-wrap gap-4">
              <Link to="/dashboard" className="bg-primary text-white border-4 border-on-surface hard-shadow hover:-translate-y-1 hover:-translate-x-1 px-10 py-5 font-mono text-sm uppercase font-black hover:bg-on-surface transition-all flex items-center gap-3">
                Access Workspace <ArrowRight size={20} />
              </Link>
              <Link to="/guide" className="bg-white text-on-surface border-4 border-on-surface hard-shadow hover:-translate-y-1 hover:-translate-x-1 px-10 py-5 font-mono text-sm uppercase font-black hover:bg-surface-container-high transition-all flex items-center gap-3">
                Read Specs
              </Link>
            </div>
          </div>
        </motion.div>

        {/* TECHNICAL STACK PANEL */}
        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          className="col-span-1 md:col-span-4 border-4 border-on-surface bg-surface-container-high hard-shadow p-8 flex flex-col justify-center"
        >
          <div className="flex items-center justify-between mb-10">
            <Cpu className="text-primary" size={48} />
            <div className="bg-on-surface text-white text-xs font-black px-3 py-1 uppercase tracking-widest">v86_ENGINE</div>
          </div>
          
          <h3 className="font-headline font-black text-4xl lg:text-5xl uppercase tracking-tighter mb-6 leading-[0.9]">Native x86<br/>Emulation</h3>
          <p className="font-mono text-sm text-on-surface/70 leading-relaxed mb-10">
            Zero server-side VM cost. Your browser executes a full i386 environment via high-performance WASM acceleration.
          </p>
          
          <div className="space-y-4">
            <div className="flex items-center gap-4 font-mono text-xs font-black uppercase p-4 border-2 border-on-surface bg-white hard-shadow-sm">
              <ShieldCheck size={20} className="text-primary shrink-0" /> Statically Linked Binaries
            </div>
            <div className="flex items-center gap-4 font-mono text-xs font-black uppercase p-4 border-2 border-on-surface bg-white hard-shadow-sm">
              <Zap size={20} className="text-primary shrink-0" /> WASM-Accelerated Boot
            </div>
            <div className="flex items-center gap-4 font-mono text-xs font-black uppercase p-4 border-2 border-on-surface bg-white hard-shadow-sm">
              <Layers size={20} className="text-primary shrink-0" /> Persistent FS Layering
            </div>
          </div>
        </motion.div>
      </div>

      {/* 02. WORKFLOW SECTION: HOW IT ACTUALLY WORKS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* STEP 1 */}
        <div className="border-4 border-on-surface bg-white hard-shadow p-8 group hover:-translate-y-2 transition-transform">
          <div className="w-12 h-12 bg-on-surface text-white flex items-center justify-center font-black text-2xl mb-6">01</div>
          <h4 className="font-headline font-black text-xl uppercase mb-3">Record Session</h4>
          <p className="font-mono text-xs text-on-surface/70 leading-relaxed mb-6">
            Use the web portal to select a local folder. Record your CLI interactions into a standard <code className="bg-primary/10 px-1">.cast</code> artifact.
          </p>
        </div>

        {/* STEP 2 */}
        <div className="border-4 border-on-surface bg-white hard-shadow p-8 group hover:-translate-y-2 transition-transform">
          <div className="w-12 h-12 bg-on-surface text-white flex items-center justify-center font-black text-2xl mb-6">02</div>
          <h4 className="font-headline font-black text-xl uppercase mb-3">Bundle Payload</h4>
          <p className="font-mono text-xs text-on-surface/70 leading-relaxed mb-6">
            Our builder compiles your files and scripts into a bootable manifest. No dockerfiles or server-side config required.
          </p>
          <div className="flex gap-2">
            <FolderUp size={20} className="text-primary" />
            <div className="h-2 flex-grow bg-on-surface/10 mt-2">
              <div className="h-full bg-primary w-[70%]"></div>
            </div>
          </div>
        </div>

        {/* STEP 3 */}
        <div className="border-4 border-on-surface bg-primary text-white hard-shadow p-8 group hover:-translate-y-2 transition-transform">
          <div className="w-12 h-12 bg-white text-primary flex items-center justify-center font-black text-2xl mb-6">03</div>
          <h4 className="font-headline font-black text-xl uppercase mb-3">Execute & Embed</h4>
          <p className="font-mono text-xs text-white/70 leading-relaxed mb-6">
            Share a link or embed the lab into your documentation. Users can pause the playback and take control of the shell instantly.
          </p>
          <div className="flex gap-2 justify-center">
            <Globe size={24} className="animate-spin-slow" />
            <Share2 size={24} />
          </div>
        </div>

      </div>

      {/* 03. CAPABILITIES GRID */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        
        <div className="col-span-1 md:col-span-2 border-4 border-on-surface bg-white hard-shadow p-8 flex flex-col md:flex-row gap-8 items-center">
           <div className="w-24 h-24 bg-primary/10 border-4 border-on-surface border-dashed flex items-center justify-center shrink-0">
              <Zap size={40} className="text-primary" />
           </div>
           <div>
              <h5 className="font-headline font-black text-lg uppercase mb-2">Live Lab Environments</h5>
              <p className="font-mono text-[11px] text-on-surface/70 leading-relaxed">
                Break the wall between video and reality. Jump into a live, interactive shell at any point during playback to explore the project filesystem.
              </p>
           </div>
        </div>

        <div className="col-span-1 md:col-span-2 border-4 border-on-surface bg-white hard-shadow p-8 flex flex-col md:flex-row gap-8 items-center">
           <div className="w-24 h-24 bg-primary/10 border-4 border-on-surface border-dashed flex items-center justify-center shrink-0">
              <Layers size={40} className="text-primary" />
           </div>
           <div>
              <h5 className="font-headline font-black text-lg uppercase mb-2">Multi-Cast Lab</h5>
              <p className="font-mono text-[11px] text-on-surface/70 leading-relaxed">
                Pro users can attach multiple recordings to a single project. Create branching tutorials where users can explore different paths.
              </p>
           </div>
        </div>

      </div>

    </div>
  );
}
