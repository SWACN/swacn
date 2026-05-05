import React, { useEffect, useState } from 'react';
import { Terminal, Clock, Share2, Check, ArrowRight, Activity, Grid, Trash2, AlertTriangle, ListVideo, Zap, Star, Lock, Loader2 } from 'lucide-react';
import { fetchCasts, fetchMe, getAuthToken, deleteCast, createCheckoutSession } from '../lib/api';
import { Link, useSearchParams } from 'react-router-dom';

export function Dashboard() {
  const [casts, setCasts] = useState<any[]>([]);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [deletingCastId, setDeletingCastId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUpgrading, setIsUpgrading] = useState(false);
  const [upgradeError, setUpgradeError] = useState<string | null>(null);
  const [searchParams] = useSearchParams();
  const paymentStatus = searchParams.get('payment');

  useEffect(() => {
    if (!getAuthToken()) {
      window.dispatchEvent(new CustomEvent('open-login-modal'));
      return;
    }

    Promise.all([fetchCasts(), fetchMe()])
      .then(([castsData, userData]) => {
        setCasts(castsData);
        setUser(userData);
      })
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

  const handleUpgrade = async () => {
    setIsUpgrading(true);
    setUpgradeError(null);
    try {
      const { checkout_url } = await createCheckoutSession();
      window.location.href = checkout_url;
    } catch (err: any) {
      setUpgradeError(err.message || 'Failed to start checkout. Please try again.');
      setIsUpgrading(false);
    }
  };

  const isPro = user?.is_pro;

  return (
    <div className="w-full px-4 md:px-8 lg:px-16 xl:px-24 py-4 lg:py-8">
      
      {/* Payment Success Banner */}
      {paymentStatus === 'success' && (
        <div className="mb-8 border-4 border-on-surface bg-primary text-white p-5 hard-shadow flex items-center gap-4 animate-in fade-in slide-in-from-top-2 duration-500">
          <div className="w-10 h-10 bg-white text-primary flex items-center justify-center border-2 border-white flex-shrink-0">
            <Star size={20} fill="currentColor" />
          </div>
          <div>
            <p className="font-mono font-black uppercase text-sm tracking-widest">Pro Activated!</p>
            <p className="font-mono text-xs opacity-80 mt-0.5">Your subscription is confirmed. All Pro features are now unlocked.</p>
          </div>
        </div>
      )}

      {paymentStatus === 'cancelled' && (
        <div className="mb-8 border-4 border-on-surface bg-surface-container-high p-5 hard-shadow flex items-center gap-4 animate-in fade-in slide-in-from-top-2 duration-500">
          <AlertTriangle size={20} className="flex-shrink-0 text-on-surface/60" />
          <p className="font-mono text-sm text-on-surface/70">Checkout was cancelled. No charges were made.</p>
        </div>
      )}

      {/* Header Panel */}
      <div className="mb-10 border-4 border-on-surface bg-white p-8 md:p-12 hard-shadow relative overflow-hidden flex flex-col md:flex-row justify-between items-start md:items-center">
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
        
        <div className="relative z-10 mt-8 md:mt-0 flex flex-col items-start md:items-end gap-3">
          <div className="font-mono text-xs uppercase font-bold text-on-surface/50 border-2 border-on-surface/20 px-4 py-2 bg-surface-container-high">
            {casts.length} Modules Online
          </div>
          {isPro && (
            <div className="flex items-center gap-2 font-mono text-xs uppercase font-bold text-white bg-on-surface px-4 py-2 border-2 border-on-surface">
              <Star size={12} fill="currentColor" />
              Pro Member
            </div>
          )}
        </div>
      </div>

      {/* Pro Upgrade Banner (only for free users) */}
      {!isPro && (
        <div className="mb-10 relative border-4 border-on-surface hard-shadow overflow-hidden">
          {/* Background gradient strip */}
          <div className="absolute inset-0 bg-gradient-to-r from-on-surface via-on-surface/90 to-primary pointer-events-none" />
          
          <div className="relative z-10 p-6 md:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="flex items-start gap-5">
              <div className="w-12 h-12 bg-white/10 border-2 border-white/20 flex items-center justify-center flex-shrink-0 backdrop-blur-sm">
                <Zap size={24} className="text-yellow-400" fill="currentColor" />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-mono text-xs font-bold uppercase text-white/50 tracking-widest">Upgrade</span>
                  <span className="font-mono text-xs font-bold uppercase text-yellow-400 bg-yellow-400/10 border border-yellow-400/30 px-2 py-0.5">Pro</span>
                </div>
                <h2 className="font-headline font-black text-2xl md:text-3xl text-white uppercase tracking-tight leading-tight mb-2">
                  Unlock Pro Features
                </h2>
                <p className="font-mono text-sm text-white/60 max-w-lg">
                  Import projects, create Super Projects with persistent VMs, and get priority access to new features.
                </p>
              </div>
            </div>

            <div className="flex flex-col items-start md:items-end gap-3 flex-shrink-0">
              {upgradeError && (
                <p className="font-mono text-xs text-red-400 max-w-xs text-right">{upgradeError}</p>
              )}
              <button
                id="upgrade-to-pro-btn"
                onClick={handleUpgrade}
                disabled={isUpgrading}
                className="group flex items-center gap-3 bg-white text-on-surface border-2 border-white/20 px-6 py-3.5 font-mono text-sm font-black uppercase tracking-widest hover:-translate-y-0.5 hover:-translate-x-0.5 transition-all hard-shadow-sm disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none"
              >
                {isUpgrading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Redirecting...
                  </>
                ) : (
                  <>
                    <Star size={16} fill="currentColor" className="text-yellow-500" />
                    Upgrade to Pro
                    <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </button>
              <p className="font-mono text-xs text-white/30">Powered by Dodo Payments · Secure Checkout</p>
            </div>
          </div>

          {/* Pro feature pills */}
          <div className="relative z-10 border-t-2 border-white/10 px-6 md:px-8 py-3 flex flex-wrap gap-x-6 gap-y-2">
            {['Import Projects', 'Super Projects', 'Persistent VM State', 'Priority Support'].map(feature => (
              <div key={feature} className="flex items-center gap-1.5 font-mono text-xs text-white/50">
                <Check size={11} className="text-yellow-400" />
                {feature}
              </div>
            ))}
          </div>
        </div>
      )}

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
            Your workspace panel is empty. Upload your project files directly via the browser to get started.
          </p>
          <div className="flex flex-col md:flex-row gap-6 items-center mb-8">
            <button 
              onClick={() => window.dispatchEvent(new CustomEvent('open-project-creator'))}
              className="bg-primary text-white border-4 border-on-surface px-12 py-4 font-mono text-sm font-bold uppercase hard-shadow hover:-translate-y-1 hover:-translate-x-1 transition-all"
            >
              Upload via Website
            </button>
          </div>

          <Link to="/guide" className="font-mono text-xs font-bold uppercase text-on-surface/50 hover:text-primary flex items-center gap-2 group transition-colors">
            New here? Read the Guide <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
          </Link>
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