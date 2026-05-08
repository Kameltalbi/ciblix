import { randomBytes } from 'crypto';
import jwt from 'jsonwebtoken';
import { google } from 'googleapis';

const SCOPES = ['openid', 'profile', 'email'];

export function getGoogleLoginRedirectUri(): string {
  const explicit = process.env.GOOGLE_LOGIN_REDIRECT_URI?.trim();
  if (explicit) return explicit;
  if (process.env.FRONTEND_URL) {
    return `${process.env.FRONTEND_URL.replace(/\/$/, '')}/api/auth/google/callback`;
  }
  return `http://localhost:${process.env.PORT || '4000'}/api/auth/google/callback`;
}

export function createGoogleLoginOAuthClient() {
  const id = process.env.GOOGLE_CLIENT_ID;
  const secret = process.env.GOOGLE_CLIENT_SECRET;
  if (!id || !secret) throw new Error('GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET manquants');
  return new google.auth.OAuth2(id, secret, getGoogleLoginRedirectUri());
}

export function buildGoogleAuthorizeUrl(state: string): string {
  const oauth2 = createGoogleLoginOAuthClient();
  return oauth2.generateAuthUrl({
    access_type: 'online',
    prompt: 'select_account',
    scope: SCOPES,
    state,
  });
}

export function assertValidGoogleOAuthState(state: unknown, jwtSecret: string): void {
  const token = typeof state === 'string' ? state : '';
  if (!token) throw new Error('state_missing');
  const decoded = jwt.verify(token, jwtSecret) as { p?: string };
  if (decoded.p !== 'google_login') throw new Error('state_invalid');
}

/** Échange code OAuth → tokens Google puis profil utilisateur vérifié. */
export async function fetchGoogleOidUserProfile(authCode: string): Promise<{
  googleSub: string;
  email: string;
  name: string;
  emailVerified: boolean;
}> {
  const oauth2 = createGoogleLoginOAuthClient();
  const { tokens } = await oauth2.getToken(authCode);
  if (!tokens.access_token) throw new Error('pas_de_access_token');

  const resp = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  if (!resp.ok) {
    throw new Error(`userinfo ${resp.status}`);
  }
  const raw = (await resp.json()) as Record<string, unknown>;

  const sub = typeof raw.sub === 'string' ? raw.sub : '';
  const email = typeof raw.email === 'string' ? raw.email.trim().toLowerCase() : '';
  const emailVerified =
    typeof raw.email_verified === 'boolean'
      ? raw.email_verified
      : typeof raw.email_verified === 'string'
        ? raw.email_verified === 'true'
        : false;
  let name =
    typeof raw.name === 'string' && raw.name.trim().length > 0
      ? raw.name.trim()
      : email.split('@')[0] ?? 'Utilisateur';

  return { googleSub: sub, email, name, emailVerified: emailVerified };
}

export function mintGoogleOAuthState(jwtSecret: string): string {
  return jwt.sign(
    {
      p: 'google_login',
      rnd: randomBytes(16).toString('hex'),
    },
    jwtSecret,
    { expiresIn: '10m' }
  );
}
