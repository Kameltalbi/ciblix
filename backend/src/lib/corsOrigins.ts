/**
 * Origines front autorisées pour CORS (credentials: true → jamais `*`).
 *
 * Sources :
 * - FRONTEND_URL (canonique, ex. https://ciblix.com)
 * - CORS_ORIGINS (liste séparée par des virgules, optionnelle)
 * - Variante www / apex du FRONTEND_URL (évite le blocage www ↔ non-www)
 */
export function getAllowedCorsOrigins(): string[] {
  const set = new Set<string>();

  const add = (raw?: string | null) => {
    const v = (raw || '').trim().replace(/\/$/, '');
    if (!v) return;
    try {
      const u = new URL(v);
      if (u.protocol !== 'http:' && u.protocol !== 'https:') return;
      set.add(u.origin);
    } catch {
      // ignore invalid
    }
  };

  add(process.env.FRONTEND_URL);

  for (const part of (process.env.CORS_ORIGINS || '').split(',')) {
    add(part);
  }

  // Variante www ↔ apex pour le domaine canonique
  for (const origin of [...set]) {
    try {
      const u = new URL(origin);
      if (u.hostname.startsWith('www.')) {
        u.hostname = u.hostname.slice(4);
        set.add(u.origin);
      } else if (u.hostname.includes('.') && !u.hostname.startsWith('localhost')) {
        u.hostname = `www.${u.hostname}`;
        set.add(u.origin);
      }
    } catch {
      // ignore
    }
  }

  // Dev local
  if (process.env.NODE_ENV !== 'production') {
    add('http://localhost:3000');
    add('http://localhost:5173');
    add('http://127.0.0.1:3000');
    add('http://127.0.0.1:5173');
  }

  return [...set];
}

/** URL canonique (FRONTEND_URL) sans trailing slash — liens emails, OAuth, etc. */
export function getCanonicalFrontendUrl(): string {
  return (process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/$/, '');
}
