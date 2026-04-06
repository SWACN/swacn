import React from 'react';
import { NavLink, Link } from 'react-router-dom';
import { cn } from '../lib/utils';

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col selection:bg-primary selection:text-white">
      {/* TopNavBar */}
      <nav className="bg-background border-b-4 border-on-surface sticky top-0 z-50 flex justify-between items-center w-full px-6 py-4">
        <div className="flex items-center gap-8">
          <Link to="/" className="text-2xl font-black text-on-surface tracking-tighter font-headline">
            SWACN
          </Link>
          <div className="hidden md:flex gap-6">
            <NavLink 
              to="/docs" 
              className={({ isActive }) => cn(
                "text-on-surface font-medium hover:bg-surface-container-high transition-none px-2 py-1",
                isActive && "text-primary font-bold border-b-2 border-primary"
              )}
            >
              Docs
            </NavLink>
            <NavLink 
              to="/blueprint" 
              className={({ isActive }) => cn(
                "text-on-surface font-medium hover:bg-surface-container-high transition-none px-2 py-1",
                isActive && "text-primary font-bold border-b-2 border-primary"
              )}
            >
              Blueprint
            </NavLink>
            <NavLink 
              to="/lab" 
              className={({ isActive }) => cn(
                "text-on-surface font-medium hover:bg-surface-container-high transition-none px-2 py-1",
                isActive && "text-primary font-bold border-b-2 border-primary"
              )}
            >
              Lab
            </NavLink>
            <NavLink 
              to="/cli" 
              className={({ isActive }) => cn(
                "text-on-surface font-medium hover:bg-surface-container-high transition-none px-2 py-1",
                isActive && "text-primary font-bold border-b-2 border-primary"
              )}
            >
              CLI
            </NavLink>
          </div>
        </div>
        <button className="bg-primary text-white border-2 border-on-surface px-4 py-2 font-bold hover:translate-x-[2px] hover:translate-y-[2px] transition-none active:translate-x-[4px] active:translate-y-[4px]">
          Get CLI
        </button>
      </nav>

      <main className="flex-grow">
        {children}
      </main>

      {/* Footer */}
      <footer className="bg-background border-t-4 border-on-surface flex flex-col md:flex-row justify-between items-center px-6 py-8 w-full font-mono text-xs uppercase tracking-widest">
        <div className="mb-4 md:mb-0 text-on-surface">
          (c) 2024 SWACN
        </div>
        <div className="flex gap-8">
          <a className="text-on-surface hover:text-primary transition-none" href="#">GitHub</a>
          <a className="text-on-surface hover:text-primary transition-none" href="#">Discord</a>
          <a className="text-on-surface hover:text-primary transition-none" href="#">CLI Roadmap</a>
        </div>
      </footer>
    </div>
  );
}
