import React, { useState, useEffect } from 'react';
import { NavLink, Link, useSearchParams, useLocation } from 'react-router-dom';
import { cn } from '../lib/utils';
import { getAuthToken, logout } from '../lib/api';
import { Copy, Check, Terminal, X, LogOut } from 'lucide-react';
import { ProjectCreatorModal } from './ProjectCreatorModal';
import { LoginModal } from './LoginModal';

export function Layout({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editCastId, setEditCastId] = useState<string | null>(null);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const isEmbed = searchParams.get('embed') === 'true';

  // Scroll to top on navigation
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  // Sync token state on mount
  React.useLayoutEffect(() => {
    setToken(getAuthToken());

    const handleOpenModal = (e: Event) => {
      const customEvent = e as CustomEvent;
      setEditCastId(customEvent.detail?.id || null);
      setIsCreateModalOpen(true);
    };
    window.addEventListener('open-project-creator', handleOpenModal);
    const handleOpenLoginModal = () => setIsLoginModalOpen(true);
    window.addEventListener('open-login-modal', handleOpenLoginModal);

    // Auth Bridge: Listen for requests from embedded iframes
    const handleAuthRequest = (event: MessageEvent) => {
      // Security: Only respond if the event type is correct
      if (event.data?.type === 'SWACN_GET_AUTH') {
        console.log("[Layout] Auth request received from:", event.origin);
        const currentToken = getAuthToken();
        if (currentToken) {
          console.log("[Layout] Sending auth token to iframe...");
          // Handle 'null' origin (common in file://) by using '*' as target
          const targetOrigin = event.origin === 'null' ? '*' : event.origin;
          (event.source as WindowProxy)?.postMessage({ 
            type: 'SWACN_AUTH', 
            token: currentToken 
          }, targetOrigin);
        } else {
          console.log("[Layout] No auth token found to share.");
        }
      }
    };

    window.addEventListener('message', handleAuthRequest);
    
    // Listen for auth updates from other windows/tabs (like login popup)
    const authChannel = new BroadcastChannel('swacn_auth');
    authChannel.onmessage = (event) => {
      if (event.data?.type === 'SWACN_AUTH' && event.data?.token) {
        console.log("[Layout] Auth update received via BroadcastChannel");
        setToken(event.data.token);
      }
    };

    return () => {
      window.removeEventListener('open-project-creator', handleOpenModal);
      window.removeEventListener('open-login-modal', handleOpenLoginModal);
      window.removeEventListener('message', handleAuthRequest);
      authChannel.close();
    };
  }, []);

  // Broadcast token to iframes whenever it changes (e.g. after login)
  useEffect(() => {
    if (isEmbed || !token) return;

    const broadcastToIframes = () => {
      const iframes = document.querySelectorAll('iframe');
      if (iframes.length === 0) return;

      console.log(`[Layout] Broadcasting auth token to ${iframes.length} iframes...`);
      iframes.forEach(iframe => {
        try {
          // Send to any iframe that might be a SWACN lab
          // We use '*' because origin checks can fail in partitioned/file contexts
          iframe.contentWindow?.postMessage({ 
            type: 'SWACN_AUTH', 
            token 
          }, '*');
        } catch (e) {
          // Ignore cross-origin errors
        }
      });
    };

    // Initial broadcast
    broadcastToIframes();

    // Also broadcast after a short delay to catch iframes that are still loading
    const timer = setTimeout(broadcastToIframes, 2000);
    return () => clearTimeout(timer);
  }, [token, isEmbed]);

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
              <button 
                onClick={() => {
                  if (token) {
                    setEditCastId(null);
                    setIsCreateModalOpen(true);
                  } else {
                    setIsLoginModalOpen(true);
                  }
                }}
                className={cn(
                  "border-2 border-on-surface px-4 md:px-6 py-2 font-mono text-sm uppercase font-bold transition-all hard-shadow whitespace-nowrap",
                  "bg-primary text-white hover:-translate-y-1 hover:-translate-x-1"
                )}
              >
                {token ? "Make Project" : "Sign In"}
              </button>
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

          <Link to="/terms" className="text-on-surface hover:text-primary">Terms</Link>
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

      <ProjectCreatorModal isOpen={isCreateModalOpen} editCastId={editCastId} onClose={() => setIsCreateModalOpen(false)} />
      <LoginModal isOpen={isLoginModalOpen} onClose={() => setIsLoginModalOpen(false)} />
    </div>
  );
}