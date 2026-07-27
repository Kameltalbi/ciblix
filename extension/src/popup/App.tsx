import { useEffect, useState } from 'react';
import { loginWithCiblix, getSession, clearSession } from '../shared/auth.js';
import '../styles/index.css';

export function PopupApp() {
  const [user, setUser] = useState<{ name: string; email: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getSession().then((s) => {
      setUser(s?.user ?? null);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return <div className="w-72 p-6 text-center text-sm text-slate-400">Chargement…</div>;
  }

  if (user) {
    return (
      <div className="w-72 p-4">
        <p className="text-sm font-semibold">{user.name}</p>
        <p className="text-xs text-slate-500">{user.email}</p>
        <p className="mt-3 text-xs text-emerald-600">Connecté à Ciblix</p>
        <button
          type="button"
          onClick={() => clearSession().then(() => setUser(null))}
          className="mt-4 w-full rounded-lg border py-2 text-xs"
        >
          Déconnexion
        </button>
      </div>
    );
  }

  return (
    <div className="w-72 p-4">
      <h1 className="text-sm font-semibold">Copilote Commercial</h1>
      <p className="mt-1 text-xs text-slate-500">Connectez votre compte Ciblix pour prospecter.</p>
      <button
        type="button"
        onClick={() => loginWithCiblix().then((s) => setUser(s.user!))}
        className="mt-4 w-full rounded-xl bg-gradient-to-r from-[#016AEB] to-[#38bdf8] py-2.5 text-xs font-medium text-white"
      >
        Se connecter avec Ciblix
      </button>
    </div>
  );
}
