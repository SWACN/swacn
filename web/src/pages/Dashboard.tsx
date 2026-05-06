import React, { useEffect, useState } from 'react';
import { Terminal, Clock, Share2, Check, ArrowRight, Activity, Grid, Trash2, AlertTriangle, ListVideo, Zap, Star, Lock, Loader2, X } from 'lucide-react';
import { fetchCasts, fetchMe, getAuthToken, deleteCast, createCheckoutSession, fetchCastDetails } from '../lib/api';
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
  const [sharingProject, setSharingProject] = useState<any | null>(null);
  const [sharingCasts, setSharingCasts] = useState<any[]>([]);
  const [loadingSharingDetails, setLoadingSharingDetails] = useState(false);
  const [copiedCastId, setCopiedCastId] = useState<number | null>(null);
  const [searchParams] = useSearchParams();
  const paymentStatus = searchParams.get('payment');
  const isPro = user?.is_pro;

  useEffect(() => {
    if (!getAuthToken()) {
      window.dispatchEvent(new CustomEvent('open-login-modal'));
      return;
    }

    Promise.all([fetchCasts(), fetchMe()])
      .then(([castsData, userData]) => {
        setCasts(castsData);
        setUser(userData);
        
        // Clear query params if payment was successful to avoid banner sticking
        if (searchParams.get('payment') === 'success') {
          setTimeout(() => {
            const url = new URL(window.location.href);
            url.searchParams.delete('payment');
            window.history.replaceState({}, '', url.toString());
          }, 3000);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const [verificationTimeout, setVerificationTimeout] = useState(false);

  useEffect(() => {
    let interval: any;
    let timeout: any;
    
    if (paymentStatus === 'success' && !isPro && !verificationTimeout) {
      interval = setInterval(() => {
        fetchMe().then(setUser).catch(console.error);
      }, 3000);

      // Stop trying after 15 seconds
      timeout = setTimeout(() => {
        setVerificationTimeout(true);
        clearInterval(interval);
      }, 15000);
    }
    
    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [paymentStatus, isPro, verificationTimeout]);

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

  const handleShare = async (e: React.MouseEvent, cast: any) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (cast.cast_count > 1) {
      setSharingProject(cast);
      setLoadingSharingDetails(true);
      try {
        const details = await fetchCastDetails(cast.id);
        setSharingCasts(details.casts || []);
      } catch (err) {
        console.error("Failed to fetch sharing details:", err);
      } finally {
        setLoadingSharingDetails(false);
      }
      return;
    }

    const url = `${window.location.origin}/lab/${cast.id}?embed=true`;
    navigator.clipboard.writeText(url);
    setCopiedId(cast.id);
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



  return (
    <div className="w-full px-4 md:px-8 lg:px-16 xl:px-24 py-4 lg:py-8">
      
      {/* Payment Status Banners */}
      {paymentStatus === 'success' && (
        <div className={`mb-8 border-4 border-on-surface p-5 hard-shadow flex items-center gap-4 animate-in fade-in slide-in-from-top-2 duration-500 ${isPro ? 'bg-primary text-white' : 'bg-white text-on-surface'}`}>
          <div className={`w-10 h-10 flex items-center justify-center border-2 flex-shrink-0 ${isPro ? 'bg-white text-primary border-white' : 'bg-surface-container-high border-on-surface'}`}>
            {isPro ? <Star size={20} fill="currentColor" /> : (verificationTimeout ? <AlertTriangle size={20} className="text-red-500" /> : <Loader2 size={20} className="animate-spin" />)}
          </div>
          <div>
            <p className="font-mono font-black uppercase text-sm tracking-widest">
              {isPro ? 'Pro Activated!' : (verificationTimeout ? 'Verification Delayed' : 'Verifying Payment...')}
            </p>
            <p className="font-mono text-xs opacity-80 mt-0.5">
              {isPro 
                ? 'Your subscription is confirmed. All Pro features are now unlocked.' 
                : (verificationTimeout 
                    ? 'Confirmation is taking longer than expected. Please refresh in a moment or contact support if the issue persists.' 
                    : 'We are waiting for the payment confirmation. This will update automatically in a few seconds.')}
            </p>
          </div>
        </div>
      )}

      {paymentStatus === 'cancelled' && (
        <div className="mb-8 border-4 border-on-surface bg-white p-5 hard-shadow flex items-center gap-4 animate-in fade-in slide-in-from-top-2 duration-500">
          <div className="w-10 h-10 bg-surface-container-high text-on-surface/50 flex items-center justify-center border-2 border-on-surface flex-shrink-0">
            <X size={20} />
          </div>
          <div>
            <p className="font-mono font-black uppercase text-sm tracking-widest text-on-surface/60">Payment Cancelled</p>
            <p className="font-mono text-xs opacity-60 mt-0.5">Your payment process was cancelled. No charges were made.</p>
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
            <div className="flex flex-col items-end gap-2">
              <div className="flex items-center gap-2 font-mono text-xs uppercase font-bold text-white bg-on-surface px-4 py-2 border-2 border-on-surface">
                <Star size={12} fill="currentColor" />
                Pro Member
              </div>
              <a 
                href="https://customer.dodopayments.com" 
                target="_blank" 
                rel="noopener noreferrer"
                className="font-mono text-[10px] uppercase font-bold text-on-surface/60 hover:text-primary transition-colors flex items-center gap-1"
              >
                Manage Subscription <ArrowRight size={10} />
              </a>
            </div>
          )}
        </div>
      </div>

      {/* Pro Upgrade Banner (only for free users and if not just finished paying) */}
      {!isPro && paymentStatus !== 'success' && (
        <div className="mb-10 border-4 border-on-surface bg-surface-container-high p-8 hard-shadow relative overflow-hidden">
          {/* Subtle background icon */}
          <div className="absolute right-0 top-0 w-32 h-32 opacity-[0.03] pointer-events-none translate-x-8 -translate-y-8">
             <Zap size={128} fill="currentColor" />
          </div>
          
          <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-8">
            <div className="max-w-2xl">
              <div className="flex items-center gap-2 mb-4">
                <div className="bg-on-surface text-white px-3 py-1 font-mono text-[10px] font-black uppercase tracking-tighter">
                  Status: Standard
                </div>
                <div className="border-2 border-on-surface/20 px-3 py-1 font-mono text-[10px] font-bold uppercase text-on-surface/40">
                  Upgrade Available
                </div>
              </div>
              
              <h2 className="font-headline font-black text-3xl md:text-4xl text-on-surface uppercase tracking-tight leading-none mb-4">
                Need more? Go Pro.
              </h2>
              
              <p className="font-mono text-sm text-on-surface/70 leading-relaxed">
                Upgrade for higher project quotas, Super Project support, private projects, and prioritized feature access. 
                It helps me pay for the servers and keep this project alive. 
                No marketing fluff, just better tools.
              </p>
            </div>

            <div className="flex flex-col items-start lg:items-end gap-3">
              {upgradeError && (
                <p className="font-mono text-xs text-red-600 max-w-xs lg:text-right font-bold uppercase">{upgradeError}</p>
              )}
              <button
                id="upgrade-to-pro-btn"
                onClick={handleUpgrade}
                disabled={isUpgrading}
                className="group flex items-center gap-4 bg-on-surface text-white px-8 py-5 font-mono text-sm font-black uppercase tracking-widest hover:-translate-y-1 hover:-translate-x-1 transition-all hard-shadow active:translate-x-0 active:translate-y-0 disabled:opacity-50 disabled:transform-none"
              >
                {isUpgrading ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    Initializing...
                  </>
                ) : (
                  <>
                    Upgrade to Pro
                    <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </button>
            </div>
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
                onClick={(e) => handleShare(e, cast)}
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

      {/* Share Super Project Modal */}
      {sharingProject && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="bg-white border-4 border-on-surface p-6 md:p-8 max-w-2xl w-full hard-shadow animate-in fade-in zoom-in duration-200 flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className="font-headline font-black text-2xl md:text-3xl uppercase tracking-tighter text-on-surface mb-1">Share Super Project</h3>
                <p className="font-mono text-xs text-on-surface/60 font-bold uppercase">{sharingProject.name}</p>
              </div>
              <button 
                onClick={() => setSharingProject(null)}
                className="p-2 border-2 border-on-surface hover:bg-surface-container-high transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex-grow overflow-y-auto pr-2 space-y-6">
              {/* Option 1: Master Link */}
              <div className="border-4 border-on-surface p-6 bg-surface-container-high">
                <div className="flex justify-between items-center mb-4">
                  <h4 className="font-mono text-sm font-black uppercase tracking-widest text-primary">Master Project Link</h4>
                  <div className="px-2 py-0.5 bg-primary text-white font-mono text-[10px] font-bold">Recommended</div>
                </div>
                <p className="font-mono text-xs text-on-surface/70 mb-4">Share the entire interactive environment. Viewers can switch between all chapters.</p>
                <button 
                  onClick={() => {
                    const url = `${window.location.origin}/lab/${sharingProject.id}?embed=true`;
                    navigator.clipboard.writeText(url);
                    setCopiedId(sharingProject.id);
                    setTimeout(() => setCopiedId(null), 2000);
                  }}
                  className="w-full bg-white border-2 border-on-surface p-3 font-mono text-xs font-bold uppercase flex items-center justify-center gap-3 transition-all hover:-translate-y-0.5 hover:-translate-x-0.5 hard-shadow-sm active:translate-x-0 active:translate-y-0"
                >
                  {copiedId === sharingProject.id ? <><Check size={16} className="text-primary" /> Copied Link</> : <><Share2 size={16} /> Copy Full Project Link</>}
                </button>
              </div>

              {/* Option 2: Individual Casts */}
              <div>
                <h4 className="font-mono text-sm font-black uppercase tracking-widest mb-4 flex items-center gap-2">
                  <ListVideo size={18} /> Direct Chapter Access
                </h4>
                
                {loadingSharingDetails ? (
                  <div className="flex flex-col items-center py-8 opacity-40">
                    <Activity className="animate-pulse mb-2" size={24} />
                    <span className="font-mono text-[10px] font-bold uppercase">Indexing Chapters...</span>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-3">
                    {sharingCasts.map((cast, idx) => (
                      <div key={cast.id} className="border-2 border-on-surface p-4 flex items-center justify-between bg-white hover:bg-surface-container-low transition-colors group">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-8 h-8 bg-surface-container-high flex items-center justify-center border-2 border-on-surface text-[10px] font-black shrink-0">
                            {idx + 1}
                          </div>
                          <span className="font-mono text-xs font-bold truncate pr-4">{cast.title || `Chapter ${idx + 1}`}</span>
                        </div>
                        <button 
                          onClick={() => {
                            const url = `${window.location.origin}/lab/${sharingProject.id}?embed=true&castIndex=${idx}`;
                            navigator.clipboard.writeText(url);
                            setCopiedCastId(cast.id);
                            setTimeout(() => setCopiedCastId(null), 2000);
                          }}
                          className={`shrink-0 p-2 border-2 border-on-surface transition-all ${copiedCastId === cast.id ? 'bg-primary text-white border-primary' : 'bg-white hover:bg-on-surface hover:text-white'}`}
                        >
                          {copiedCastId === cast.id ? <Check size={14} /> : <Share2 size={14} />}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="mt-8 pt-4 border-t-2 border-on-surface/10">
              <p className="font-mono text-[10px] text-on-surface/40 uppercase font-bold text-center">
                Pro Tip: You can also right-click inside the Lab terminal to get Notion-compatible direct links.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}