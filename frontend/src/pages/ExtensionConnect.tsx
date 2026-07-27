import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Link2, Loader2, ShieldCheck } from 'lucide-react';

/**
 * Page OAuth pour l'extension Connect AI (PKCE).
 * Ouverte via chrome.identity.launchWebAuthFlow depuis l'extension.
 */
export function ExtensionConnect() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { user, accessToken } = useAuth();
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  const codeChallenge = params.get('code_challenge');
  const state = params.get('state');
  const redirectUri = params.get('redirect_uri');

  useEffect(() => {
    if (!user && !accessToken) {
      const returnTo = `/extension/connect?${params.toString()}`;
      navigate(`/login?redirect=${encodeURIComponent(returnTo)}`, { replace: true });
    }
  }, [user, accessToken, navigate, params]);

  const authorize = async () => {
    if (!codeChallenge || !redirectUri) {
      setError('Paramètres OAuth manquants.');
      return;
    }
    setStatus('loading');
    setError(null);
    try {
      const { data } = await api.post<{ code: string }>('/connect-ai/auth/authorize', {
        code_challenge: codeChallenge,
        redirect_uri: redirectUri,
      });
      const url = new URL(redirectUri);
      url.searchParams.set('code', data.code);
      if (state) url.searchParams.set('state', state);
      setStatus('done');
      window.location.href = url.toString();
    } catch (e) {
      setStatus('error');
      setError(e instanceof Error ? e.message : 'Autorisation refusée');
    }
  };

  if (!codeChallenge || !redirectUri) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <p className="text-sm text-muted-foreground">Lien d'autorisation invalide.</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-slate-50 to-white p-6 dark:from-slate-950 dark:to-slate-900">
      <div className="w-full max-w-md rounded-2xl border bg-card p-8 shadow-lg">
        <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-[#016AEB] to-sky-400 text-white">
          <Link2 className="h-6 w-6" />
        </div>
        <h1 className="text-xl font-semibold">Autoriser le Copilote Commercial</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          L'extension Ciblix Copilote Commercial demande l'accès à votre compte
          {user ? ` (${user.email})` : ''} pour analyser des profils et préparer des messages.
        </p>
        <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
          <li className="flex items-start gap-2">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
            Aucun envoi automatique — vous cliquez toujours sur Envoyer.
          </li>
          <li className="flex items-start gap-2">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
            Aucun cookie LinkedIn n'est stocké.
          </li>
        </ul>
        {error && <p className="mt-4 text-sm text-destructive">{error}</p>}
        {status === 'done' ? (
          <p className="mt-6 text-sm text-emerald-600">Redirection vers l'extension…</p>
        ) : (
          <Button className="mt-6 w-full" onClick={authorize} disabled={status === 'loading' || !user}>
            {status === 'loading' ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Autorisation…
              </>
            ) : (
              'Autoriser l\'extension'
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
