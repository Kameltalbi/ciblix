import type { SeoAuditResult } from './types.js';

function extractTag(html: string, tag: string, attr?: string): string | null {
  if (attr) {
    const re = new RegExp(`<${tag}[^>]*${attr}=["']([^"']+)["']`, 'i');
    const m = html.match(re);
    return m?.[1]?.trim() || null;
  }
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i');
  const m = html.match(re);
  if (!m?.[1]) return null;
  return m[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() || null;
}

function countTags(html: string, tag: string): number {
  const re = new RegExp(`<${tag}[\\s>]`, 'gi');
  return (html.match(re) || []).length;
}

function approxWordCount(html: string): number {
  const body = html.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '');
  const text = body.replace(/<[^>]+>/g, ' ');
  return text.split(/\s+/).filter((w) => w.length > 2).length;
}

export async function runSeoAudit(websiteUrl: string): Promise<SeoAuditResult> {
  let url = websiteUrl.trim();
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`;

  const start = Date.now();
  const response = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CiblixBrandPulse/1.0)' },
    signal: AbortSignal.timeout(15000),
    redirect: 'follow',
  });
  const responseMs = Date.now() - start;
  const html = await response.text();

  const title = extractTag(html, 'title');
  const metaDescription =
    html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i)?.[1]
    || html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*name=["']description["']/i)?.[1]
    || null;
  const h1Count = countTags(html, 'h1');
  const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  const h1Text = h1Match?.[1]?.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() || null;
  const hasCanonical = /<link[^>]*rel=["']canonical["']/i.test(html);
  const hasOgTitle = /<meta[^>]*property=["']og:title["']/i.test(html);

  const issues: string[] = [];
  const strengths: string[] = [];

  if (!response.ok) issues.push(`Page HTTP ${response.status}`);
  if (!url.startsWith('https://')) issues.push('Site non servi en HTTPS');
  else strengths.push('HTTPS actif');
  if (!title || title.length < 10) issues.push('Titre de page absent ou trop court');
  else if (title.length <= 60) strengths.push('Longueur de titre adaptée');
  else issues.push('Titre de page trop long (> 60 caractères)');
  if (!metaDescription) issues.push('Meta description absente');
  else if (metaDescription.length < 120) issues.push('Meta description courte');
  else strengths.push('Meta description présente');
  if (h1Count === 0) issues.push('Aucun H1 détecté');
  else if (h1Count === 1) strengths.push('Un seul H1 (bonne pratique)');
  else issues.push(`Plusieurs H1 (${h1Count})`);
  if (!hasCanonical) issues.push('Balise canonical absente');
  if (responseMs > 3000) issues.push(`Temps de réponse élevé (${responseMs}ms)`);
  else strengths.push('Temps de chargement acceptable');

  return {
    url,
    fetchedAt: new Date().toISOString(),
    responseMs,
    https: url.startsWith('https://'),
    title,
    metaDescription,
    h1Count,
    h1Text,
    hasCanonical,
    hasOgTitle,
    wordCountApprox: approxWordCount(html),
    issues,
    strengths,
  };
}

export function seoScoreFromAudit(audit: SeoAuditResult): number {
  let score = 100;
  score -= audit.issues.length * 8;
  score += Math.min(audit.strengths.length * 3, 15);
  if (audit.wordCountApprox < 200) score -= 10;
  if (audit.responseMs > 5000) score -= 10;
  return Math.max(0, Math.min(100, Math.round(score)));
}
