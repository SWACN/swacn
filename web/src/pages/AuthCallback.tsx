import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { setAuthToken } from '../lib/api';

export function AuthCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    const token = searchParams.get('token');
    if (token) {
      setAuthToken(token);
      navigate('/dashboard'); // We will build this next
    } else {
      navigate('/');
    }
  }, [searchParams, navigate]);

  return (
    <div className="min-h-[50vh] flex items-center justify-center font-mono text-primary">
      <span className="animate-pulse">Authenticating with SWACN Kernel...</span>
    </div>
  );
}