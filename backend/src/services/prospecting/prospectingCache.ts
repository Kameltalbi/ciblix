import { createHash } from 'node:crypto';
import type { CompanySearchCriteria, CompanySearchHit } from './types.js';
import { prisma } from '../../db/prisma.js';

const TTL_MS_DEFAULT = Number(process.env.PROSPECTING_CACHE_TTL_MS) || 7 * 24 * 60 * 60 * 1000;

function stableCriteriaJson(c: CompanySearchCriteria): string {
  return JSON.stringify({
    sector: (c.sector || '').trim().toLowerCase(),
    country: (c.country || '').trim().toLowerCase(),
    city: (c.city || '').trim().toLowerCase(),
    companySize: (c.companySize || '').trim().toLowerCase(),
    keywords: (c.keywords || '').trim().toLowerCase(),
  });
}

export function buildSearchCacheKey(organizationId: string, criteria: CompanySearchCriteria): string {
  return createHash('sha256').update(`${organizationId}|${stableCriteriaJson(criteria)}`).digest('hex');
}

function normalizeWebsiteCacheKey(raw: string): string | null {
  try {
    const u = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    const host = u.hostname.toLowerCase();
    const path = u.pathname.replace(/\/$/, '') || '';
    return `${host}${path}`.slice(0, 500);
  } catch {
    return null;
  }
}

export async function pruneProspectingCaches(): Promise<void> {
  const now = new Date();
  await Promise.all([
    prisma.prospectingSearchCache.deleteMany({ where: { expiresAt: { lt: now } } }),
    prisma.prospectingWebsiteCache.deleteMany({ where: { expiresAt: { lt: now } } }),
  ]);
}

export async function getCachedSearchHits(
  organizationId: string,
  criteria: CompanySearchCriteria
): Promise<{ hits: CompanySearchHit[]; providerUsed: string } | null> {
  const cacheKey = buildSearchCacheKey(organizationId, criteria);
  const row = await prisma.prospectingSearchCache.findUnique({ where: { cacheKey } });
  if (!row || row.expiresAt <= new Date()) return null;
  const payload = row.payload as unknown;
  if (!Array.isArray(payload)) return null;
  return { hits: payload as CompanySearchHit[], providerUsed: row.providerUsed };
}

export async function setCachedSearchHits(
  organizationId: string,
  criteria: CompanySearchCriteria,
  providerUsed: string,
  hits: CompanySearchHit[]
): Promise<void> {
  const cacheKey = buildSearchCacheKey(organizationId, criteria);
  const expiresAt = new Date(Date.now() + TTL_MS_DEFAULT);
  await prisma.prospectingSearchCache.upsert({
    where: { cacheKey },
    create: { cacheKey, providerUsed, payload: hits as object, expiresAt },
    update: { providerUsed, payload: hits as object, expiresAt },
  });
}

function stripPiiFromWebsiteCache(payload: Record<string, unknown>): Record<string, unknown> {
  const next = { ...payload };
  delete next.detectedEmails;
  delete next.phoneFromPage;
  // Ne jamais partager des emails/téléphones via cache URL global
  return next;
}

export async function getCachedWebsiteEnrichment(urlKey: string): Promise<Record<string, unknown> | null> {
  const row = await prisma.prospectingWebsiteCache.findUnique({ where: { urlKey } });
  if (!row || row.expiresAt <= new Date()) return null;
  return stripPiiFromWebsiteCache(row.payload as Record<string, unknown>);
}

export async function setCachedWebsiteEnrichment(urlKey: string, payload: Record<string, unknown>): Promise<void> {
  const expiresAt = new Date(Date.now() + TTL_MS_DEFAULT);
  const safe = stripPiiFromWebsiteCache(payload);
  await prisma.prospectingWebsiteCache.upsert({
    where: { urlKey },
    create: { urlKey, payload: safe as object, expiresAt },
    update: { payload: safe as object, expiresAt },
  });
}

export function websiteCacheKeyFromRawWebsite(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;
  return normalizeWebsiteCacheKey(raw.trim());
}
