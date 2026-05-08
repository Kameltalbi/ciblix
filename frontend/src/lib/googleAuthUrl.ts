/** URL absolue ou relative pour lancer le flux OAuth Google côté backend. */
export function getGoogleAuthHref(): string {
  const raw = import.meta.env.VITE_API_URL as string | undefined;
  if (raw && /^https?:\/\//i.test(raw)) {
    const origin = raw.replace(/\/api\/?$/i, '');
    return `${origin}/api/auth/google`;
  }
  return '/api/auth/google';
}
