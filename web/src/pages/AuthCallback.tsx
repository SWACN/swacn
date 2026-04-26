import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { setAuthToken } from '../lib/api';

export function AuthCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    const token = searchParams.get('token');
    if (token) {
      console.log("[AuthCallback] Token received, broadcasting...");
      setAuthToken(token);
      
      const authChannel = new BroadcastChannel('swacn_auth');
      authChannel.postMessage({ type: 'SWACN_AUTH', token });
      authChannel.close();

      if (window.opener) {
        console.log("[AuthCallback] Sending message to opener...");
        window.opener.postMessage({ type: 'SWACN_AUTH', token }, '*');
      }
      
      const isPopup = localStorage.getItem('swacn_is_popup') === 'true' || 
                      window.opener || 
                      window.name === 'swacn_auth' || 
                      window.location.search.includes('popup=true');

      // If we are likely in a popup, close after a brief delay
      if (isPopup) {
        console.log("[AuthCallback] Closing popup window...");
        localStorage.removeItem('swacn_is_popup');
        setTimeout(() => window.close(), 500);
      } else {
        const returnTo = localStorage.getItem('swacn_return_to');
        if (returnTo) {
          localStorage.removeItem('swacn_return_to');
          window.location.href = returnTo;
        } else {
          navigate('/dashboard');
        }
      }
    } else {
      navigate('/');
    }
  }, [searchParams, navigate]);

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center font-mono text-on-surface p-8 text-center">
      <div className="bg-white border-4 border-on-surface p-8 hard-shadow max-w-sm">
        <span className="block animate-pulse text-primary font-black mb-4 tracking-widest uppercase">Syncing Session...</span>
        <p className="text-xs opacity-60 mb-6">Communicating with SWACN Kernel. This window should close automatically.</p>
        <button 
          onClick={() => window.close()}
          className="w-full bg-on-surface text-white py-3 px-6 font-bold uppercase text-xs hover:bg-primary transition-colors"
        >
          Close Window
        </button>
      </div>
    </div>
  );
}