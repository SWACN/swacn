import React from 'react';
import { XCircle, Github, Fingerprint } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export function LoginModal({ isOpen, onClose }: Props) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-on-surface/40 backdrop-blur-sm">
      <div className="bg-background border-4 border-on-surface w-full max-w-md hard-shadow overflow-hidden flex flex-col">
        <div className="bg-on-surface p-4 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-2 text-background font-mono text-sm font-bold">
            <Fingerprint size={18} />
            <span>AUTHENTICATION</span>
          </div>
          <button onClick={onClose} className="text-background hover:text-primary transition-colors">
            <XCircle size={24} />
          </button>
        </div>

        <div className="p-8 flex flex-col gap-6">
          <h2 className="font-headline text-3xl font-black uppercase tracking-tighter text-center">Sign In</h2>
          
          <button 
            onClick={() => window.location.href = '/api/auth/github/login'}
            className="w-full border-4 border-on-surface px-4 sm:px-6 py-4 font-mono text-base sm:text-lg font-bold transition-transform hard-shadow bg-surface-container-high text-on-surface flex items-center gap-4 hover:-translate-y-1 hover:-translate-x-1"
          >
            <Github size={24} className="shrink-0" />
            <span className="flex-1 text-center pr-6 whitespace-nowrap">Continue with GitHub</span>
          </button>
          
          <button 
            onClick={() => window.location.href = '/api/auth/google/login'}
            className="w-full border-4 border-on-surface px-4 sm:px-6 py-4 font-mono text-base sm:text-lg font-bold transition-transform hard-shadow bg-surface-container-high text-on-surface flex items-center gap-4 hover:-translate-y-1 hover:-translate-x-1"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" className="shrink-0" xmlns="http://www.w3.org/2000/svg">
              <path d="M12.24 10.285V14.4h6.806c-.275 1.765-2.056 5.174-6.806 5.174-4.095 0-7.439-3.389-7.439-7.574s3.345-7.574 7.439-7.574c2.33 0 3.891.989 4.785 1.849l3.254-3.138C18.189 1.186 15.479 0 12.24 0c-6.635 0-12 5.365-12 12s5.365 12 12 12c6.926 0 11.52-4.869 11.52-11.726 0-.788-.085-1.39-.189-1.989H12.24z"/>
            </svg>
            <span className="flex-1 text-center pr-6 whitespace-nowrap">Continue with Google</span>
          </button>
          
        </div>
      </div>
    </div>
  );
}
