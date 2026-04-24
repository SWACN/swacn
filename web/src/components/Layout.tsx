import React, { useState, useEffect } from 'react';
import { NavLink, Link, useSearchParams } from 'react-router-dom';
import { cn } from '../lib/utils';
import { getAuthToken, logout } from '../lib/api';
import { Copy, Check, Terminal, X, LogOut } from 'lucide-react';

export function Layout({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [searchParams] = useSearchParams();
  const isEmbed = searchParams.get('embed') === 'true';

  // Sync token state on mount
  useEffect(() => {
    setToken(getAuthToken());
  }, []);

  return (
    <div className={`min-h-screen flex flex-col selection:bg-primary selection:text-white ${isEmbed ? 'h-screen overflow-hidden' : ''}`}>
      
      {/* Floating Command Pill */}
      {!isEmbed && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 pointer-events-none w-full max-w-[95%] md:max-w-max flex justify-center">
          <nav className="pointer-events-auto bg-surface-container-high border-4 border-on-surface flex items-center p-2 hard-shadow gap-2 md:gap-6 bg-opacity-95 backdrop-blur-sm">
            <Link to="/" className="text-xl md:text-2xl font-black text-on-surface tracking-tighter font-headline px-2 md:px-4 hover:scale-105 transition-transform">
              SWACN
            </Link>
            <div className="hidden md:flex gap-2">
              <NavLink to="/dashboard" className={({ isActive }) => cn("text-on-surface font-mono text-sm uppercase font-bold hover:bg-white px-4 py-2 border-2 border-transparent transition-all", isActive && "bg-white border-on-surface hard-shadow -translate-y-1 -translate-x-1")}>
                Dashboard
              </NavLink>
              <NavLink to="/guide" className={({ isActive }) => cn("text-on-surface font-mono text-sm uppercase font-bold hover:bg-white px-4 py-2 border-2 border-transparent transition-all", isActive && "bg-white border-on-surface hard-shadow -translate-y-1 -translate-x-1")}>
                Guide
              </NavLink>
              <NavLink to="/lab" className={({ isActive }) => cn("text-on-surface font-mono text-sm uppercase font-bold hover:bg-white px-4 py-2 border-2 border-transparent transition-all", isActive && "bg-white border-on-surface hard-shadow -translate-y-1 -translate-x-1")}>
                Lab
              </NavLink>
            </div>

            {/* Dynamic Action Buttons */}
            <div className="flex gap-2 ml-auto md:ml-0">
              <NavLink 
                to="/cli"
                className={({ isActive }) => cn(
                  "border-2 border-on-surface px-4 md:px-6 py-2 font-mono text-sm uppercase font-bold transition-all hard-shadow whitespace-nowrap",
                  isActive 
                    ? "bg-white text-on-surface hover:-translate-y-1 hover:-translate-x-1" 
                    : "bg-primary text-white hover:-translate-y-1 hover:-translate-x-1"
                )}
              >
                CLI Access
              </NavLink>
            </div>
          </nav>
        </div>
      )}

      <main className={`flex-grow flex flex-col ${!isEmbed ? 'pt-24 md:pt-32' : ''}`}>{children}</main>

      {/* Footer */}
      {!isEmbed && (
      <footer className="bg-background border-t-4 border-on-surface flex flex-col md:flex-row justify-between items-center px-6 py-8 w-full font-mono text-xs uppercase tracking-widest">
        <div className="mb-4 md:mb-0 text-on-surface">(c) 2026 SWACN</div>
        <div className="flex gap-8 items-center">
          <a className="text-on-surface hover:text-primary" href="#">GitHub</a>
          <a className="text-on-surface hover:text-primary" href="#">Discord</a>
          {token && (
            <button 
              onClick={() => {
                logout();
                setToken(null);
                window.location.href = '/';
              }}
              className="text-on-surface hover:text-red-500 flex items-center gap-1 transition-all hover:-translate-y-1 hover:scale-105 duration-200"
              title="Logout"
            >
              <LogOut size={14} /> LOGOUT
            </button>
          )}
        </div>
      </footer>
      )}
    </div>
  );
}