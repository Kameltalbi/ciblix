import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';

/**
 * Reçoit les jetons dans le fragment (#) après redirection Google,
 * les enregistre puis charge /auth/me avant d’envoyer vers le dashboard.
 */
export function GoogleAuthCallback() {
  const navigate = useNavigate();
  const [message, setMessage] = useState('Connexion avec Google…');

  useEffect(() => {
    let cancelled = false;
    const raw = window.location.hash.replace(/^#/, '');
    const p = new URLSearchParams(raw);

    const accessToken = p.get('accessToken');
    const refreshToken = p.get('refreshToken');
    const paymentStatus = p.get('paymentStatus') || 'PENDING';

    window.history.replaceState(null, '', window.location.pathname + window.location.search);

    void (async () => {
      if (!accessToken || !refreshToken) {
        navigate('/login?error=google_missing_tokens', { replace: true });
        return;
      }
      if (cancelled) return;

      localStorage.setItem('accessToken', accessToken);
      localStorage.setItem('refreshToken', refreshToken);
      localStorage.setItem('paymentStatus', paymentStatus);

      useAuth.setState({
        accessToken,
        refreshToken,
        paymentStatus,
      });

      try {
        await useAuth.getState().fetchMe();
        if (cancelled) return;
        const u = useAuth.getState().user;
        if (!u) {
          navigate('/login?error=google_profile_failed', { replace: true });
          return;
        }
        navigate(u.role === 'SUPERADMIN' ? '/admin' : '/dashboard', { replace: true });
      } catch {
        if (!cancelled) navigate('/login?error=google_profile_failed', { replace: true });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [navigate]);

  return (
    <div className="min-h-[40vh] flex items-center justify-center text-muted-foreground text-sm">{message}</div>
  );
}
