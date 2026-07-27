import { useEffect, useState } from 'react';
import { loginWithCiblix, clearSession, getSession } from '../shared/auth.js';

export function AuthGate({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authed, setAuthed] = useState<boolean | null>(null);

  useEffect(() => {
    getSession().then((s) => setAuthed(!!s));
  }, []);

  if (authed === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#fafafa] dark:bg-[#0a0a0b]">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#016AEB] border-t-transparent" />
      </div>
    );
  }

  if (!authed) {
    return (
      <div className="panel-width flex min-h-screen flex-col items-center justify-center bg-[#fafafa] px-6 dark:bg-[#0a0a0b]">
        <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#016AEB] to-[#38bdf8] shadow-lg shadow-blue-500/20">
          <span className="text-xl font-bold text-white">C</span>
        </div>
        <h1 className="text-center text-lg font-semibold text-slate-900 dark:text-white">Copilote Commercial</h1>
        <p className="mt-2 text-center text-sm text-slate-500">
          Bienvenue dans le Copilote Commercial.
          <br />
          Connectez votre compte Ciblix.
        </p>
        {error && (
          <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600 dark:bg-red-950 dark:text-red-300">
            {error}
          </p>
        )}
        <button
          type="button"
          disabled={loading}
          onClick={async () => {
            setLoading(true);
            setError(null);
            try {
              await loginWithCiblix();
              setAuthed(true);
            } catch (e) {
              setError(e instanceof Error ? e.message : 'Connexion impossible');
            } finally {
              setLoading(false);
            }
          }}
          className="mt-8 w-full rounded-xl bg-gradient-to-r from-[#016AEB] to-[#38bdf8] py-3 text-sm font-medium text-white shadow-md hover:opacity-95 disabled:opacity-50"
        >
          {loading ? 'Connexion…' : 'Se connecter avec Ciblix'}
        </button>
        <p className="mt-4 text-center text-[10px] text-slate-400">
          Aucun cookie LinkedIn n'est stocké.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}

export async function logout() {
  await clearSession();
  window.location.reload();
}
