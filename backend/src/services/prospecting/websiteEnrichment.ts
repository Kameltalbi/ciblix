import type { WebEnrichmentResult } from './types.js';

const FETCH_TIMEOUT_MS = Number(process.env.PROSPECTING_FETCH_TIMEOUT_MS) || 10_000;
const MAX_HTML_CHARS = 400_000;

function decodeBasicEntities(s: string): string {
  return s
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/gi, "'");
}

function stripScripts(html: string): string {
  return html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ');
}

function extractTagContent(html: string, re: RegExp): string | null {
  const m = html.match(re);
  return m?.[1] ? decodeBasicEntities(m[1].replace(/\s+/g, ' ').trim()).slice(0, 2000) || null : null;
}

function absolutizeUrl(base: string, href: string): string | null {
  try {
    return new URL(href, base).href;
  } catch {
    return null;
  }
}

function isPrivateOrLocalHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (h === 'localhost' || h.endsWith('.local')) return true;
  if (/^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.)/.test(h)) return true;
  if (h === '0.0.0.0') return true;
  return false;
}

function normalizeSeedUrl(raw: string): URL | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const withProto = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const u = new URL(withProto);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    if (isPrivateOrLocalHost(u.hostname)) return null;
    return u;
  } catch {
    return null;
  }
}

function extractEmails(html: string, baseUrl: string): string[] {
  const text = stripScripts(html).replace(/<[^>]+>/g, ' ');
  const re = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const found = new Set<string>();
  let m: RegExpExecArray | null;
  const bad = /^(example\.|sentry\.|wixpress\.|domain\.|email\.|yourname\.)/i;
  while ((m = re.exec(text)) !== null) {
    const e = m[0].toLowerCase();
    if (e.length > 120) continue;
    if (bad.test(e)) continue;
    found.add(e);
  }
  const mailto = html.matchAll(/mailto:([^"'>\s]+)/gi);
  for (const x of mailto) {
    try {
      const addr = decodeURIComponent(x[1].split('?')[0]).toLowerCase();
      if (addr.includes('@')) found.add(addr);
    } catch {
      /* ignore */
    }
  }
  void baseUrl;
  return [...found].slice(0, 12);
}

function extractSocial(html: string, base: string): {
  linkedin: string[];
  facebook: string | null;
  instagram: string | null;
} {
  const linkedin = new Set<string>();
  let facebook: string | null = null;
  let instagram: string | null = null;
  const hrefRe = /href=["']([^"']+)["']/gi;
  let m: RegExpExecArray | null;
  while ((m = hrefRe.exec(html)) !== null) {
    const abs = absolutizeUrl(base, m[1]);
    if (!abs) continue;
    const u = abs.toLowerCase();
    if (u.includes('linkedin.com/')) linkedin.add(abs.split('?')[0]);
    if (!facebook && u.includes('facebook.com/')) facebook = abs.split('?')[0];
    if (!instagram && u.includes('instagram.com/')) instagram = abs.split('?')[0];
  }
  return { linkedin: [...linkedin].slice(0, 3), facebook, instagram };
}

function extractFavicon(html: string, base: string): string | null {
  const icon =
    html.match(/<link[^>]+rel=["'](?:shortcut )?icon["'][^>]*href=["']([^"']+)["']/i) ||
    html.match(/<link[^>]+href=["']([^"']+)["'][^>]*rel=["'](?:shortcut )?icon["']/i);
  if (icon?.[1]) return absolutizeUrl(base, icon[1]);
  try {
    const u = new URL(base);
    return new URL('/favicon.ico', u.origin).href;
  } catch {
    return null;
  }
}

function extractTel(html: string): string | null {
  const m = html.match(/href=["']tel:([^"']+)["']/i);
  if (!m?.[1]) return null;
  const raw = decodeURIComponent(m[1]).replace(/[^\d+]/g, '');
  return raw.length >= 8 ? raw : null;
}

function detectTechnologies(html: string): string[] {
  const h = html.toLowerCase();
  const tags = new Set<string>();
  if (h.includes('wp-content') || h.includes('wordpress')) tags.add('WordPress');
  if (h.includes('shopify')) tags.add('Shopify');
  if (h.includes('woocommerce')) tags.add('WooCommerce');
  if (h.includes('next.js') || h.includes('__next')) tags.add('Next.js');
  if (h.includes('react') && h.includes('chunk')) tags.add('React');
  if (h.includes('gtag(') || h.includes('google-analytics') || h.includes('googletagmanager')) tags.add('Google Analytics');
  if (h.includes('facebook.net') || h.includes('connect.facebook')) tags.add('Meta Pixel');
  if (h.includes('hotjar')) tags.add('Hotjar');
  if (h.includes('hubspot')) tags.add('HubSpot');
  return [...tags].slice(0, 12);
}

function computeSeoScore(html: string, hasSsl: boolean, hasViewport: boolean): number {
  let s = 0;
  const title = extractTagContent(html, /<title[^>]*>([\s\S]*?)<\/title>/i);
  if (title && title.length >= 10) s += 18;
  if (extractTagContent(html, /<meta[^>]+name=["']description["'][^>]*content=["']([^"']*)["']/i)) s += 18;
  if (/<meta[^>]+property=["']og:title["']/i.test(html)) s += 10;
  if (/<link[^>]+rel=["']canonical["']/i.test(html)) s += 10;
  if (/<h1[\s>]/i.test(html)) s += 8;
  if (hasViewport) s += 12;
  if (hasSsl) s += 14;
  return Math.max(0, Math.min(100, s));
}

function digitalLevel(seo: number, socialCount: number, hasSite: boolean): 'FORT' | 'MOYEN' | 'FAIBLE' {
  if (!hasSite) return 'FAIBLE';
  const score = seo + socialCount * 8;
  if (score >= 62) return 'FORT';
  if (score >= 38) return 'MOYEN';
  return 'FAIBLE';
}

const emptyResult = (err?: string): WebEnrichmentResult => ({
  websiteTitle: null,
  websiteDescription: null,
  detectedEmails: [],
  phoneFromPage: null,
  facebookUrl: null,
  instagramUrl: null,
  linkedinUrlsFound: [],
  faviconUrl: null,
  hasResponsiveWebsite: false,
  hasSsl: false,
  seoScore: 0,
  digitalPresenceLevel: 'FAIBLE',
  technologiesDetected: [],
  fetchedUrl: null,
  fetchError: err ?? null,
  importantPages: [],
  productsServices: [],
  sectorsFromSite: [],
  enrichmentSource: 'none',
});

/** Enrichissement vide (pas de site ou crawl désactivé). */
export function emptyWebEnrichment(): WebEnrichmentResult {
  return emptyResult();
}

/** Crawl léger du site (HTML) — pas de headless ; signaux heuristiques uniquement. */
export async function enrichWebsiteFromUrl(rawWebsite: string | null | undefined): Promise<WebEnrichmentResult> {
  const seed = normalizeSeedUrl(rawWebsite || '');
  if (!seed) return emptyResult('url_invalide');

  const hasSsl = seed.protocol === 'https:';
  const entryUrl = seed.href;

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(entryUrl, {
      redirect: 'follow',
      signal: ac.signal,
      headers: {
        'User-Agent': 'KTOptima-ProspectionBot/1.0 (+https://ktoptima.com)',
        Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
      },
    });
    clearTimeout(timer);
    if (!res.ok) return emptyResult(`http_${res.status}`);
    const ct = (res.headers.get('content-type') || '').toLowerCase();
    if (!ct.includes('text/html') && !ct.includes('application/xhtml')) {
      return emptyResult('non_html');
    }
    const buf = await res.text();
    const html = buf.slice(0, MAX_HTML_CHARS);
    const finalUrl = res.url || entryUrl;

    const stripped = stripScripts(html);
    const title = extractTagContent(stripped, /<title[^>]*>([\s\S]*?)<\/title>/i);
    const desc =
      extractTagContent(
        stripped,
        /<meta[^>]+name=["']description["'][^>]*content=["']([^"']*)["']/i
      ) ||
      extractTagContent(
        stripped,
        /<meta[^>]+content=["']([^"']*)["'][^>]*name=["']description["']/i
      );
    const hasViewport = /<meta[^>]+name=["']viewport["']/i.test(stripped);
    const social = extractSocial(stripped, finalUrl);
    const emails = extractEmails(stripped, finalUrl);
    const fav = extractFavicon(stripped, finalUrl);
    const phone = extractTel(stripped);
    const tech = detectTechnologies(stripped);
    const finalHttps = finalUrl.startsWith('https://');
    const seo = computeSeoScore(stripped, finalHttps, hasViewport);
    const socialCount = social.linkedin.length + (social.facebook ? 1 : 0) + (social.instagram ? 1 : 0);
    const dig = digitalLevel(seo, socialCount, true);

    return {
      websiteTitle: title,
      websiteDescription: desc,
      detectedEmails: emails,
      phoneFromPage: phone,
      facebookUrl: social.facebook,
      instagramUrl: social.instagram,
      linkedinUrlsFound: social.linkedin,
      faviconUrl: fav,
      hasResponsiveWebsite: hasViewport,
      hasSsl: finalHttps,
      seoScore: seo,
      digitalPresenceLevel: dig,
      technologiesDetected: tech,
      fetchedUrl: finalUrl,
      fetchError: null,
      importantPages: [],
      productsServices: [],
      sectorsFromSite: [],
      enrichmentSource: 'native',
    };
  } catch (e) {
    clearTimeout(timer);
    const msg = e instanceof Error ? e.message : 'fetch_error';
    return emptyResult(msg.slice(0, 200));
  }
}
