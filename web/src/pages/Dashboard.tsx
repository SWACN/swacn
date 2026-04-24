import React, { useEffect, useState } from 'react';
import { Terminal, Clock, Share2, Check, ArrowRight, Activity, Grid, Trash2, AlertTriangle, ListVideo } from 'lucide-react';
import { fetchCasts, getAuthToken, deleteCast } from '../lib/api';
import { Link } from 'react-router-dom';

export function Dashboard() {
  const [casts, setCasts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [deletingCastId, setDeletingCastId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

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
    return (
      <div className="min-h-[50vh] flex items-center justify-center p-12">
        <div className="border-4 border-on-surface p-12 bg-white hard-shadow flex flex-col items-center">
          <Activity className="animate-pulse mb-6 text-primary" size={48} />
          <div className="font-mono font-bold tracking-widest uppercase text-sm">Fetching Workspaces...</div>
        </div>
      </div>
    );
  }

  const handleShare = (e: React.MouseEvent, castId: string) => {
    e.preventDefault();
    e.stopPropagation();
    const url = `${window.location.origin}/lab/${castId}`;
    navigator.clipboard.writeText(url);
    setCopiedId(castId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDeleteClick = (e: React.MouseEvent, castId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDeletingCastId(castId);
  };

  const confirmDelete = async () => {
    if (!deletingCastId) return;
    setIsDeleting(true);
    try {
      await deleteCast(deletingCastId);
      setCasts(casts.filter(c => c.id !== deletingCastId));
      setDeletingCastId(null);
    } catch (err) {
      console.error("Failed to delete project:", err);
      alert("Failed to delete project");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="w-full px-4 md:px-8 lg:px-16 xl:px-24 py-4 lg:py-8">
      
      {/* Header Panel */}
      <div className="mb-16 border-4 border-on-surface bg-white p-8 md:p-12 hard-shadow relative overflow-hidden flex flex-col md:flex-row justify-between items-start md:items-center">
        <div className="absolute -right-16 -bottom-16 opacity-5 pointer-events-none text-on-surface">
           <Grid size={300} strokeWidth={1} />
        </div>
        
        <div className="relative z-10">
          <h1 className="text-5xl md:text-7xl font-black font-headline uppercase tracking-tighter leading-none mb-4 text-on-surface">
            Workspaces
          </h1>
          <p className="font-mono text-sm md:text-base opacity-70 max-w-xl">
            Your active environments. Select a panel to initialize the runtime.
          </p>
        </div>
        
        <div className="relative z-10 mt-8 md:mt-0 font-mono text-xs uppercase font-bold text-on-surface/50 border-2 border-on-surface/20 px-4 py-2 bg-surface-container-high">
          {casts.length} Modules Online
        </div>
      </div>

      {/* Tactile Panel Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {casts.map((cast) => (
          <div 
            key={cast.id} 
            className="group relative flex flex-col border-4 border-on-surface bg-white hard-shadow hover:-translate-y-2 hover:-translate-x-2 transition-transform duration-300 h-full"
          >
            {/* Top Bar */}
            <div className="border-b-4 border-on-surface p-4 flex justify-between items-center bg-surface-container-low">
              <div className="w-10 h-10 bg-primary text-white flex items-center justify-center border-2 border-on-surface hard-shadow-sm">
                <ListVideo size={20} />
              </div>
              <div className="font-mono text-xs font-bold uppercase px-3 py-1.5 border-2 border-on-surface bg-white opacity-70 group-hover:opacity-100 transition-opacity">
                ID: {cast.id.substring(0, 8)}
              </div>
            </div>
            
            {/* Content Body */}
            <div className="p-6 flex-grow flex flex-col justify-center">
              <h3 className="font-headline font-black text-2xl md:text-3xl mb-4 text-on-surface line-clamp-2 leading-tight">
                {cast.name || cast.id.split('-')[0]}
              </h3>
              
              <div className="flex items-center gap-2 font-mono text-xs text-on-surface/60 bg-surface-container-high px-3 py-2 border-2 border-transparent group-hover:border-on-surface/10 w-max">
                <Clock size={14} />
                <span>{new Date(cast.created_at).toLocaleDateString()} at {new Date(cast.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
              </div>
            </div>
            
            <div className="flex border-t-4 border-on-surface mt-auto">
              <button 
                onClick={(e) => handleDeleteClick(e, cast.id)}
                className="flex-1 flex items-center justify-center p-4 border-r-4 border-on-surface hover:bg-surface-container-high transition-colors font-mono text-xs font-bold uppercase z-20 relative gap-2 text-on-surface"
                title="Delete Workspace"
              >
                DELETE
              </button>

              <button 
                onClick={(e) => handleShare(e, cast.id)}
                className="flex-[2] flex items-center justify-center p-4 border-r-4 border-on-surface hover:bg-surface-container-high transition-colors font-mono text-xs font-bold uppercase z-20 relative gap-2"
                title="Copy Link"
              >
                {copiedId === cast.id ? (
                  <>
                    <Check size={16} className="text-primary" /> <span className="hidden sm:inline">Copied</span>
                  </>
                ) : (
                  <>
                    <Share2 size={16} /> <span className="hidden sm:inline">Share</span>
                  </>
                )}
              </button>
              
              <Link 
                to={`/lab/${cast.id}`}
                className="flex-[2] flex items-center justify-center p-4 bg-primary text-white hover:bg-on-surface transition-colors font-mono text-xs font-bold uppercase gap-2 z-20 relative overflow-hidden"
              >
                <span className="relative z-10">Launch Engine</span>
                <ArrowRight size={16} className="relative z-10 group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>

            {/* Clickable Overlay */}
            <Link to={`/lab/${cast.id}`} className="absolute inset-0 z-10">
              <span className="sr-only">View Environment {cast.name || cast.id}</span>
            </Link>
          </div>
        ))}
      </div>

      {/* Empty State Panel */}
      {casts.length === 0 && (
        <div className="border-4 border-on-surface p-12 md:p-24 flex flex-col items-center justify-center text-center bg-white hard-shadow">
          <div className="w-20 h-20 bg-primary text-white flex items-center justify-center mb-8 border-4 border-on-surface">
            <Terminal size={32} />
          </div>
          <h3 className="font-headline font-black text-3xl md:text-4xl mb-4 uppercase tracking-tight text-on-surface">No Environments</h3>
          <p className="font-mono text-sm md:text-base opacity-70 max-w-lg mb-8">
            Your workspace panel is empty. You need to record and upload a runtime session from your local machine.
          </p>
          <div className="font-mono text-xs font-bold uppercase px-4 py-3 bg-surface-container-low border-2 border-on-surface flex items-center gap-4">
            <span>Run:</span>
            <code className="bg-white px-2 py-1 border border-on-surface">swacn record</code>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingCastId && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="bg-white border-4 border-on-surface p-6 md:p-8 max-w-md w-full hard-shadow animate-in fade-in zoom-in duration-200">
            <div className="flex items-center gap-4 mb-4 text-on-surface">
              <h3 className="font-headline font-black text-2xl uppercase tracking-tighter text-on-surface">Delete Project?</h3>
            </div>
            
            <p className="font-mono text-sm text-on-surface/80 leading-relaxed mb-8">
              Are you absolutely sure you want to permanently delete this environment? This will wipe the workspace files from the server. This action cannot be undone.
            </p>
            
            <div className="flex gap-4">
              <button 
                onClick={() => setDeletingCastId(null)}
                disabled={isDeleting}
                className="flex-1 bg-surface-container-high border-2 border-on-surface py-3 font-mono text-sm font-bold uppercase transition-all hover:bg-surface-container-low disabled:opacity-50"
              >
                Cancel
              </button>
              <button 
                onClick={confirmDelete}
                disabled={isDeleting}
                className="flex-1 bg-on-surface text-white border-2 border-on-surface py-3 font-mono text-sm font-bold uppercase transition-all hover:bg-on-surface/90 hard-shadow-sm hover:-translate-y-1 hover:-translate-x-1 disabled:opacity-50 disabled:transform-none"
              >
                {isDeleting ? 'Deleting...' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}