/** Routes marketing accessibles sans session (pas de redirection /login). */
export function isPublicMarketingPath(pathname: string): boolean {
  const path = pathname.replace(/\/$/, '') || '/';
  if (path === '/' || path === '/sales') return true;
  const publicPrefixes = [
    '/login',
    '/register',
    '/pricing',
    '/tarifs',
    '/fonctionnalites',
    '/features',
    '/solutions',
    '/ressources',
    '/resources',
    '/a-propos',
    '/about',
    '/contact',
    '/securite',
    '/security',
    '/faq',
    '/documentation',
    '/docs',
    '/blog',
    '/onboarding',
    '/forgot-password',
    '/reset-password',
    '/legal',
    '/agent',
  ];
  return publicPrefixes.some((p) => path === p || path.startsWith(`${p}/`));
}

/** API appelable sans JWT (chatbot home, etc.). */
export function isPublicAnonymousApi(url?: string): boolean {
  return !!url && url.startsWith('/onboarding-chatbot');
}
