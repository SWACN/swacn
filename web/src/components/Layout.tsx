import React, { useState, useEffect } from 'react';
import { NavLink, Link, useSearchParams } from 'react-router-dom';
import { cn } from '../lib/utils';
import { getAuthToken } from '../lib/api'; // Import our token helper
import { Copy, Check, Terminal, X } from 'lucide-react';

export function Layout({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [copied, setCopied] = useState(false);
  const [searchParams] = useSearchParams();
  const isEmbed = searchParams.get('embed') === 'true';

  // Sync token state on mount
  useEffect(() => {
    setToken(getAuthToken());
  }, []);

  const handleGetCLI = () => {
    if (!token) {
      // Not logged in: Redirect to Drogon's GitHub Auth endpoint
      window.location.href = '/api/auth/github/login';
    } else {
      // Logged in: Show the instructions modal
      setShowModal(true);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const loginCmd = `swacn auth login ${token}`;

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

            {/* Dynamic Action Button */}
            <button 
              onClick={handleGetCLI}
              className="bg-primary text-white border-2 border-on-surface px-4 md:px-6 py-2 font-mono text-sm uppercase font-bold hover:-translate-y-1 hover:-translate-x-1 transition-all active:translate-y-0 active:translate-x-0 hard-shadow whitespace-nowrap ml-auto md:ml-0"
            >
              {token ? 'CLI Access' : 'Get CLI'}
            </button>
          </nav>
        </div>
      )}

      <main className={`flex-grow flex flex-col ${!isEmbed ? 'pt-24 md:pt-32' : ''}`}>{children}</main>

      {/* --- CLI ACCESS MODAL --- */}
      {showModal && !isEmbed && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-on-surface/40 backdrop-blur-sm">
          <div className="bg-background border-4 border-on-surface w-full max-w-2xl hard-shadow overflow-hidden">
            <div className="bg-on-surface p-4 flex justify-between items-center">
              <div className="flex items-center gap-2 text-background font-mono text-sm font-bold">
                <Terminal size={18} />
                <span>SWACN_AUTH_PROMPT</span>
              </div>
              <button onClick={() => setShowModal(false)} className="text-background hover:text-primary">
                <X size={24} />
              </button>
            </div>

            <div className="p-8">
              <h2 className="font-headline text-3xl font-black uppercase mb-4">You're Authenticated.</h2>
              <p className="font-mono text-sm mb-8 opacity-70">Use the following key to authorize your local machine with the SWACN kernel.</p>

              <div className="space-y-6">
                {/* API Key Box */}
                <div>
                  <label className="font-mono text-[10px] font-bold uppercase text-primary block mb-2">Your Secret API Key</label>
                  <div className="flex items-center justify-between bg-surface-container-high border-2 border-on-surface p-4 font-mono text-sm">
                    <span className="truncate mr-4">{token}</span>
                    <button onClick={() => copyToClipboard(token || '')} className="text-primary hover:scale-110 transition-transform">
                      {copied ? <Check size={18} /> : <Copy size={18} />}
                    </button>
                  </div>
                </div>

                {/* Command Box */}
                <div>
                  <label className="font-mono text-[10px] font-bold uppercase text-primary block mb-2">Run this in your terminal</label>
                  <div className="bg-on-surface text-background p-4 font-mono text-sm flex justify-between items-center border-2 border-on-surface">
                    <code>{loginCmd}</code>
                    <button onClick={() => copyToClipboard(loginCmd)} className="text-primary">
                      <Copy size={18} />
                    </button>
                  </div>
                </div>

                <div className="pt-4 border-t-2 border-on-surface/10 flex justify-between items-center font-mono text-[10px] opacity-50 uppercase tracking-widest">
                  <span>Target: {window.location.hostname}</span>
                  <span>Protocol: v1.0.4-secure</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      {!isEmbed && (
      <footer className="bg-background border-t-4 border-on-surface flex flex-col md:flex-row justify-between items-center px-6 py-8 w-full font-mono text-xs uppercase tracking-widest">
        <div className="mb-4 md:mb-0 text-on-surface">(c) 2026 SWACN</div>
        <div className="flex gap-8">
          <a className="text-on-surface hover:text-primary" href="#">GitHub</a>
          <a className="text-on-surface hover:text-primary" href="#">Discord</a>
        </div>
      </footer>
      )}
    </div>
  );
}