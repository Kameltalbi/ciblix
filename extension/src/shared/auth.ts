const DEFAULT_API = import.meta.env.VITE_CIBLIX_API || 'http://localhost:4000/api';
const DEFAULT_FRONTEND = import.meta.env.VITE_CIBLIX_FRONTEND || 'http://localhost:3000';

export interface AuthSession {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  apiBase: string;
  user?: { id: string; name: string; email: string };
}

function storageGet<T>(keys: string[]): Promise<Record<string, T>> {
  return new Promise((resolve) => chrome.storage.local.get(keys, resolve));
}

function storageSet(data: Record<string, unknown>): Promise<void> {
  return new Promise((resolve) => chrome.storage.local.set(data, resolve));
}

export async function getSession(): Promise<AuthSession | null> {
  const data = await storageGet<string | number>([
    'accessToken',
    'refreshToken',
    'tokenExpiresAt',
    'apiBase',
    'user',
  ]);
  if (!data.accessToken || !data.refreshToken) return null;
  return {
    accessToken: data.accessToken as string,
    refreshToken: data.refreshToken as string,
    expiresAt: Number(data.tokenExpiresAt || 0),
    apiBase: (data.apiBase as string) || DEFAULT_API,
    user: data.user ? JSON.parse(data.user as string) : undefined,
  };
}

export async function saveSession(session: AuthSession): Promise<void> {
  await storageSet({
    accessToken: session.accessToken,
    refreshToken: session.refreshToken,
    tokenExpiresAt: session.expiresAt,
    apiBase: session.apiBase,
    user: session.user ? JSON.stringify(session.user) : undefined,
  });
  chrome.runtime.sendMessage({ type: 'AUTH_CHANGED' }).catch(() => {});
}

export async function clearSession(): Promise<void> {
  await storageSet({
    accessToken: null,
    refreshToken: null,
    tokenExpiresAt: null,
    user: null,
  });
}

function randomVerifier(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return btoa(String.fromCharCode(...array))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

async function sha256Base64Url(verifier: string): Promise<string> {
  const data = new TextEncoder().encode(verifier);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return btoa(String.fromCharCode(...new Uint8Array(hash)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export async function loginWithCiblix(): Promise<AuthSession> {
  const verifier = randomVerifier();
  const challenge = await sha256Base64Url(verifier);
  const state = randomVerifier();
  const redirectUri = chrome.identity.getRedirectURL();
  const apiBase = DEFAULT_API;
  const frontend = DEFAULT_FRONTEND;

  const authUrl =
    `${frontend}/extension/connect?` +
    new URLSearchParams({
      code_challenge: challenge,
      state,
      redirect_uri: redirectUri,
    }).toString();

  const callbackUrl = await new Promise<string>((resolve, reject) => {
    chrome.identity.launchWebAuthFlow({ url: authUrl, interactive: true }, (url) => {
      if (chrome.runtime.lastError || !url) {
        reject(new Error(chrome.runtime.lastError?.message || 'Connexion annulée'));
        return;
      }
      resolve(url);
    });
  });

  const parsed = new URL(callbackUrl);
  const code = parsed.searchParams.get('code');
  if (!code) throw new Error('Code d\'autorisation manquant');

  const res = await fetch(`${apiBase}/connect-ai/auth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, code_verifier: verifier, redirect_uri: redirectUri }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || 'Échec de connexion');
  }

  const data = (await res.json()) as {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
    user: { id: string; name: string; email: string };
  };

  const session: AuthSession = {
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
    expiresAt: Date.now() + data.expiresIn * 1000,
    apiBase,
    user: data.user,
  };
  await saveSession(session);
  return session;
}

export async function refreshAccessToken(session: AuthSession): Promise<AuthSession> {
  const res = await fetch(`${session.apiBase}/connect-ai/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken: session.refreshToken }),
  });
  if (!res.ok) {
    await clearSession();
    throw new Error('Session expirée');
  }
  const data = (await res.json()) as { accessToken: string; expiresIn: number };
  const updated = {
    ...session,
    accessToken: data.accessToken,
    expiresAt: Date.now() + data.expiresIn * 1000,
  };
  await saveSession(updated);
  return updated;
}

export async function getValidSession(): Promise<AuthSession | null> {
  let session = await getSession();
  if (!session) return null;
  if (Date.now() > session.expiresAt - 60_000) {
    try {
      session = await refreshAccessToken(session);
    } catch {
      return null;
    }
  }
  return session;
}
