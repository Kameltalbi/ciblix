import type { CompanySearchCriteria, CompanySearchHit, WebEnrichmentResult } from './types.js';
import { resolveProspectingSearchProvider } from './getSearchProvider.js';
import { qualifyCompanyHit } from './qualifyWithAi.js';
import { MockCompanySearchProvider } from './providers/MockCompanySearchProvider.js';
import { enrichWebsiteFromUrl, emptyWebEnrichment } from './websiteEnrichment.js';
import {
  getCachedSearchHits,
  getCachedWebsiteEnrichment,
  pruneProspectingCaches,
  setCachedSearchHits,
  setCachedWebsiteEnrichment,
  websiteCacheKeyFromRawWebsite,
} from './prospectingCache.js';

/** Recherche entreprises — délègue au fournisseur (Google Places par défaut si clé, sinon mock). */
export async function searchCompanies(criteria: CompanySearchCriteria): Promise<CompanySearchHit[]> {
  const provider = resolveProspectingSearchProvider();
  return provider.searchCompanies(criteria);
}

/** Si le fournisseur externe ne renvoie rien (non configuré), repli démo mock. */
export async function searchCompaniesWithFallback(criteria: CompanySearchCriteria): Promise<{
  hits: CompanySearchHit[];
  providerUsed: string;
}> {
  const provider = resolveProspectingSearchProvider();
  let hits = await provider.searchCompanies(criteria);
  let providerUsed: string = provider.id;
  if (hits.length === 0 && provider.id !== 'mock') {
    hits = await new MockCompanySearchProvider().searchCompanies(criteria);
    providerUsed = 'mock_fallback';
  }
  return { hits, providerUsed };
}

/** Recherche avec cache Prisma (TTL 7 j. par défaut) — clé par organisation + critères. */
export async function searchCompaniesWithCache(
  organizationId: string,
  criteria: CompanySearchCriteria
): Promise<{ hits: CompanySearchHit[]; providerUsed: string; fromCache: boolean }> {
  await pruneProspectingCaches().catch(() => {});
  const cached = await getCachedSearchHits(organizationId, criteria);
  if (cached) return { ...cached, fromCache: true };
  const fresh = await searchCompaniesWithFallback(criteria);
  await setCachedSearchHits(organizationId, criteria, fresh.providerUsed, fresh.hits).catch(() => {});
  return { ...fresh, fromCache: false };
}

function mergeEnrichmentIntoHit(hit: CompanySearchHit, e: WebEnrichmentResult): CompanySearchHit {
  const out: CompanySearchHit = { ...hit };
  if (!out.email && e.detectedEmails[0]) out.email = e.detectedEmails[0];
  if (!out.phone && e.phoneFromPage) out.phone = e.phoneFromPage;
  if (!out.linkedin && e.linkedinUrlsFound[0]) out.linkedin = e.linkedinUrlsFound[0];
  return out;
}

/** Crawl site + cache URL — fusionne emails / tél / LinkedIn dans le hit. */
export async function enrichHitWebsiteCached(
  hit: CompanySearchHit
): Promise<{ hit: CompanySearchHit; enrichment: WebEnrichmentResult }> {
  if (!hit.website?.trim()) {
    return { hit, enrichment: emptyWebEnrichment() };
  }
  const ukey = websiteCacheKeyFromRawWebsite(hit.website);
  if (!ukey) {
    return { hit, enrichment: emptyWebEnrichment() };
  }
  const cached = await getCachedWebsiteEnrichment(ukey);
  if (cached && typeof cached === 'object' && typeof (cached as { seoScore?: unknown }).seoScore === 'number') {
    const e = cached as unknown as WebEnrichmentResult;
    return { hit: mergeEnrichmentIntoHit(hit, e), enrichment: e };
  }
  const e = await enrichWebsiteFromUrl(hit.website);
  await setCachedWebsiteEnrichment(ukey, { ...(e as object) } as Record<string, unknown>).catch(() => {});
  return { hit: mergeEnrichmentIntoHit(hit, e), enrichment: e };
}

/** Point d’extension Apollo / Hunter — aujourd’hui : enrichissement web crawl. */
export async function enrichCompany(hit: CompanySearchHit): Promise<CompanySearchHit> {
  const { hit: h } = await enrichHitWebsiteCached(hit);
  return h;
}

/** Recherche d’emails (Hunter, etc.) — no-op pour l’instant. */
export async function findEmails(hit: CompanySearchHit): Promise<CompanySearchHit> {
  return hit;
}

/** Qualification / score IA d’un prospect. */
export const scoreLead = qualifyCompanyHit;
