import React from 'react';
import { motion } from 'motion/react';
import { Rss, Settings2, Cpu } from 'lucide-react';

export function Home() {
  return (
    <div className="max-w-7xl mx-auto px-6 py-12 md:py-24">
      {/* Hero Section */}
      <section className="flex flex-col items-center text-center mb-32">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 border-4 border-on-surface p-4 bg-white hard-shadow"
        >
          <img 
            alt="SWACN Logo" 
            className="w-32 h-32 md:w-48 md:h-48 grayscale contrast-125" 
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuANMmxkivF9nkF-19t-8MKYyCvzV14SxMApgyuz2usFg31rDTUVutxRPpxTACQ-i-PhSKc3IiV42ab61lkdTBMNtkl4Q8m47dnd5QMx6OqeFQeKjbaT9DJz8bWPHLv9yLerYNmuV3gQWqGhmxHjK6l5WFjxc8zyc9Tle8-cu-HaKpQwobeWgA2tpbCZ4Mg7LFHgDJGH-S3akCvxXkxtL5kEoY04pHvaZH9GdryOp1v9oYlD6NrklO0rDYxidlwkOqs8XpWdEGJr_Y2l"
            referrerPolicy="no-referrer"
          />
        </motion.div>
        <motion.h1 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
          className="font-headline text-5xl md:text-8xl font-black tracking-tight leading-none mb-6 max-w-4xl text-on-surface"
        >
          Software Without Any Cool Name.
        </motion.h1>
        <motion.p 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="font-mono text-lg md:text-xl text-primary max-w-2xl mb-12 bg-surface-container-high px-4 py-2 border-2 border-on-surface inline-block"
        >
          A terminal-first reactive model for state hydration.
        </motion.p>
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="flex flex-wrap justify-center gap-4"
        >
          <button className="bg-primary text-on-primary border-4 border-on-surface px-8 py-4 text-xl font-bold hover:translate-x-[4px] hover:translate-y-[4px] transition-none hard-shadow">
            Initialize CLI
          </button>
          <button className="bg-surface-container-high text-on-surface border-4 border-on-surface px-8 py-4 text-xl font-bold hover:translate-x-[4px] hover:translate-y-[4px] transition-none">
            Read Manifest
          </button>
        </motion.div>
      </section>

      {/* Technical Logic Section */}
      <section className="mb-32">
        <div className="border-4 border-on-surface bg-surface-container-low p-1 md:p-2 hard-shadow">
          <div className="bg-on-surface text-background px-4 py-2 font-mono flex justify-between items-center">
            <span>SYSTEM_LOGIC_CORE_V1.0.4</span>
            <div className="flex gap-2">
              <div className="w-3 h-3 bg-background"></div>
              <div className="w-3 h-3 bg-primary"></div>
            </div>
          </div>
          <div className="grid md:grid-cols-2 divide-y-4 md:divide-y-0 md:divide-x-4 divide-on-surface border-t-4 border-on-surface">
            <div className="p-8 space-y-6">
              <h3 className="font-mono font-bold text-2xl text-primary uppercase tracking-tighter">01. The Recording Phase</h3>
              <div className="font-mono text-sm leading-relaxed space-y-4">
                <p className="bg-white p-4 border-2 border-outline">
                  [HOOK] intercepting syscalls via native C++ hooks. Every filesystem event is indexed as a discrete transaction.
                </p>
                <p>
                  Unlike standard snapshots, SWACN serializes the *intent* of the change. This creates a high-fidelity audit trail that is immune to race conditions during the bootstrap sequence.
                </p>
                <div className="text-[10px] text-outline-variant">
                  REF: TEXT_11 // KERNEL_MODULE_AUTH
                </div>
              </div>
            </div>
            <div className="p-8 space-y-6 bg-surface-container-high">
              <h3 className="font-mono font-bold text-2xl text-primary uppercase tracking-tighter">02. The Playback Phase</h3>
              <div className="font-mono text-sm leading-relaxed space-y-4">
                <p className="bg-white p-4 border-2 border-outline">
                  [WASM] executing isolated sandbox hydration. Replaying indexed transactions into a virtual memory space.
                </p>
                <p>
                  The WASM environment ensures deterministic results regardless of host OS. State is hydrated in parallel chunks, reducing startup latency by up to 84% compared to linear JSON parsing.
                </p>
                <div className="text-[10px] text-outline-variant">
                  REF: TEXT_11 // HYDRATION_ENGINE
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="mb-32">
        <div className="flex items-baseline gap-4 mb-12">
          <h2 className="font-headline text-4xl font-black uppercase">Core Modules</h2>
          <div className="h-1 flex-grow bg-on-surface"></div>
        </div>
        <div className="grid md:grid-cols-3 gap-0 border-4 border-on-surface">
          <div className="p-8 border-b-4 md:border-b-0 md:border-r-4 border-on-surface bg-white hover:bg-surface-container-high transition-colors group">
            <div className="text-primary mb-4">
              <Rss size={40} />
            </div>
            <h4 className="font-headline text-2xl font-bold mb-4">Filesystem Event Sourcing</h4>
            <p className="text-sm leading-relaxed">Continuous tracking of all I/O operations. Roll back to any microsecond of your development history without git commits.</p>
          </div>
          <div className="p-8 border-b-4 md:border-b-0 md:border-r-4 border-on-surface bg-surface-container-low hover:bg-surface-container-high transition-colors group">
            <div className="text-primary mb-4">
              <Settings2 size={40} />
            </div>
            <h4 className="font-headline text-2xl font-bold mb-4">Side-Effect Injection</h4>
            <p className="text-sm leading-relaxed">Decouple external dependencies by injecting mock side-effects directly at the runtime layer. Perfect for CI/CD isolation.</p>
          </div>
          <div className="p-8 bg-white hover:bg-surface-container-high transition-colors group">
            <div className="text-primary mb-4">
              <Cpu size={40} />
            </div>
            <h4 className="font-headline text-2xl font-bold mb-4">WebVM Hydration</h4>
            <p className="text-sm leading-relaxed">Run full environment states in the browser with zero overhead. Your terminal workspace, now accessible via a single URL.</p>
          </div>
        </div>
      </section>

      {/* Terminal Mockup */}
      <section>
        <div className="max-w-3xl mx-auto">
          <div className="border-4 border-on-surface hard-shadow">
            <div className="bg-on-surface px-4 py-2 flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500"></div>
              <div className="w-3 h-3 rounded-full bg-surface-container-high"></div>
              <div className="w-3 h-3 rounded-full bg-primary"></div>
              <span className="ml-4 font-mono text-xs text-background opacity-50">zsh — 80x24</span>
            </div>
            <div className="bg-on-surface p-8 font-mono text-background">
              <div className="flex gap-4 mb-2">
                <span className="text-primary font-bold">➜</span>
                <span className="text-outline-variant">~</span>
                <span className="text-white">brew install swacn</span>
              </div>
              <div className="text-outline-variant mb-4">
                ==&gt; Downloading https://ghcr.io/v2/swacn/core/manifests/v1.0.4<br/>
                ==&gt; Extracting swacn-binary-macos-arm64.tar.gz<br/>
                ==&gt; Linking binary to /usr/local/bin/swacn
              </div>
              <div className="flex gap-4">
                <span className="text-primary font-bold">➜</span>
                <span className="text-outline-variant">~</span>
                <span className="text-white animate-pulse">_</span>
              </div>
            </div>
          </div>
          <p className="mt-8 text-center font-mono text-xs uppercase tracking-widest text-outline">
            Requirement: macOS 12+ / Linux Kernel 5.15+ / WASM Runtime
          </p>
        </div>
      </section>
    </div>
  );
}
