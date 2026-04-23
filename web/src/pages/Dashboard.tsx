import React, { useEffect, useState } from 'react';
import { Terminal, Clock, Share2, Check } from 'lucide-react';
import { fetchCasts, getAuthToken } from '../lib/api';
import { Link } from 'react-router-dom';

export function Dashboard() {
  const [casts, setCasts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    if (!getAuthToken()) {
      window.location.href = '/api/auth/github/login';
      return;
    }

    fetchCasts()
      .then(setCasts)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="p-12 font-mono text-primary text-center">Syncing ledger...</div>;
  }

  const handleShare = (e: React.MouseEvent, castId: string) => {
    e.preventDefault();
    e.stopPropagation();
    const url = `${window.location.origin}/lab/${castId}`;
    navigator.clipboard.writeText(url);
    setCopiedId(castId);
    setTimeout(() => setCopiedId(null), 1000);
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-12">
      <header className="mb-12 border-l-8 border-on-surface pl-8">
        <h1 className="text-5xl font-black font-headline tracking-tighter uppercase">Your Workspaces</h1>
        <p className="font-mono mt-4 opacity-70">Authenticated. Rendering synchronized environments.</p>
      </header>

      <div className="grid md:grid-cols-3 gap-8">
        {casts.map((cast) => (
          <div key={cast.id} className="border-4 border-on-surface p-6 bg-white hover:bg-surface-container-high transition-colors group relative hard-shadow">
            <div className="flex justify-between items-start mb-6">
              <div className="w-10 h-10 bg-primary text-on-primary flex items-center justify-center">
                <Terminal size={20} />
              </div>
              <div className="flex items-center gap-2 h-8">
                {copiedId === cast.id ? (
                  <div className="font-mono text-[10px] font-bold bg-primary text-white px-3 py-1.5 border-2 border-on-surface uppercase tracking-widest z-20">
                    Copied!
                  </div>
                ) : (
                  <>
                    <button onClick={(e) => handleShare(e, cast.id)} className="z-20 relative p-1.5 border-2 border-on-surface text-primary hover:bg-primary hover:text-white transition-colors" title="Copy Link">
                      <Share2 size={14} />
                    </button>
                    <span className="font-mono text-[10px] bg-surface-container-low px-2 py-1.5 border-2 border-on-surface">
                      {new Date(cast.created_at).toLocaleDateString()}
                    </span>
                  </>
                )}
              </div>
            </div>
            
            <h3 className="font-mono font-bold text-lg mb-2 truncate">{cast.name || cast.id.split('-')[0]}</h3>
            
            <div className="flex items-center gap-2 mt-4 pt-4 border-t-2 border-on-surface opacity-60 font-mono text-xs">
              <Clock size={14} />
              <span>{new Date(cast.created_at).toLocaleTimeString()}</span>
            </div>

            <Link to={`/lab/${cast.id}`} className="absolute inset-0 z-10">
              <span className="sr-only">View Environment</span>
            </Link>
          </div>
        ))}

        {casts.length === 0 && (
          <div className="col-span-3 border-4 border-dashed border-on-surface p-12 text-center bg-surface-container-low">
            <p className="font-mono">No interactive environments found.</p>
            <p className="font-mono text-xs mt-2 opacity-50">Run `swacn record` and `swacn upload` from your terminal.</p>
          </div>
        )}
      </div>
    </div>
  );
}