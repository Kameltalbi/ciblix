import type { CompanySearchCriteria, CompanySearchHit, WebEnrichmentResult } from './types.js';
import { resolveProspectingSearchProvider } from './getSearchProvider.js';
import { qualifyCompanyHit } from './qualifyWithAi.js';
import { MockCompanySearchProvider } from './providers/MockCompanySearchProvider.js';
import { resolveWebsiteEnrichmentPort } from './providers/FirecrawlWebsiteProvider.js';
import { resolveEmailFinderPort } from './providers/HunterEmailProvider.js';
import { emptyWebEnrichment } from './websiteEnrichment.js';
import {
  getCachedSearchHits,
  getCachedWebsiteEnrichment,
  pruneProspectingCaches,
  setCachedSearchHits,
  setCachedWebsiteEnrichment,
  websiteCacheKeyFromRawWebsite,
} from './prospectingCache.js';

import { allowMockProspecting } from './mockPolicy.js';

export { runProspectEnrichmentPipeline } from './enrichmentPipeline.js';
export { allowMockProspecting } from './mockPolicy.js';

/** True si le hit vient du générateur mock / domaines .example.com. */
export function isMockOrFakeHit(hit: CompanySearchHit): boolean {
  const ext = (hit.externalId || '').toLowerCase();
  if (ext.startsWith('mock:')) return true;
  const web = (hit.website || '').toLowerCase();
  const email = (hit.email || '').toLowerCase();
  if (web.includes('.example.com') || email.includes('.example.com')) return true;
  const name = (hit.companyName || '').trim();
  if (/#\d+\s*$/.test(name) && /—/.test(name)) return true;
  return false;
}

/** Recherche entreprises — délègue au fournisseur réel (pas de mock silencieux). */
export async function searchCompanies(criteria: CompanySearchCriteria): Promise<CompanySearchHit[]> {
  const provider = resolveProspectingSearchProvider();
  return provider.searchCompanies(criteria);
}

/**
 * Recherche réelle uniquement.
 * Mock UNIQUEMENT si PROSPECTING_ALLOW_MOCK=1 (dev) — jamais en prod par défaut.
 */
export async function searchCompaniesWithFallback(criteria: CompanySearchCriteria): Promise<{
  hits: CompanySearchHit[];
  providerUsed: string;
}> {
  const provider = resolveProspectingSearchProvider();
  let hits = await provider.searchCompanies(criteria);
  let providerUsed: string = provider.id;

  if (provider.id === 'mock' && !allowMockProspecting()) {
    console.warn(
      '[Prospecting] fournisseur mock refusé (pas de clé API Places/Outscraper). Résultats vides.'
    );
    return { hits: [], providerUsed: 'none' };
  }

  hits = hits.filter((h) => !isMockOrFakeHit(h) || allowMockProspecting());

  if (hits.length === 0 && provider.id !== 'mock' && allowMockProspecting()) {
    hits = await new MockCompanySearchProvider().searchCompanies(criteria);
    providerUsed = 'mock_fallback';
  }

  return { hits, providerUsed };
}

/** Recherche avec cache Prisma — ignore / invalide les caches mock. */
export async function searchCompaniesWithCache(
  organizationId: string,
  criteria: CompanySearchCriteria,
  options?: { refresh?: boolean }
): Promise<{ hits: CompanySearchHit[]; providerUsed: string; fromCache: boolean }> {
  await pruneProspectingCaches().catch(() => {});
  const cached = options?.refresh ? null : await getCachedSearchHits(organizationId, criteria);
  if (cached) {
    const isMockCache =
      cached.providerUsed === 'mock' ||
      cached.providerUsed === 'mock_fallback' ||
      cached.hits.some((h) => isMockOrFakeHit(h));
    if (isMockCache && !allowMockProspecting()) {
      // ne pas resservir de la démo
    } else {
      return { ...cached, fromCache: true };
    }
  }
  const fresh = await searchCompaniesWithFallback(criteria);
  if (fresh.hits.length > 0 && fresh.providerUsed !== 'none') {
    await setCachedSearchHits(organizationId, criteria, fresh.providerUsed, fresh.hits).catch(() => {});
  }
  return { ...fresh, fromCache: false };
}

function mergeEnrichmentIntoHit(hit: CompanySearchHit, e: WebEnrichmentResult): CompanySearchHit {
  const out: CompanySearchHit = { ...hit };
  if (!out.email && e.detectedEmails[0]) out.email = e.detectedEmails[0];
  if (!out.phone && e.phoneFromPage) out.phone = e.phoneFromPage;
  if (!out.linkedin && e.linkedinUrlsFound[0]) out.linkedin = e.linkedinUrlsFound[0];
  return out;
}

/** Crawl site + cache URL — Firecrawl si clé, sinon HTML natif. */
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
  const port = resolveWebsiteEnrichmentPort();
  const { hit: merged, enrichment: e } = await port.enrichCompany(hit);
  await setCachedWebsiteEnrichment(ukey, { ...(e as object) } as Record<string, unknown>).catch(() => {});
  return { hit: merged, enrichment: e };
}

/** Point d’extension Apollo / registres — aujourd’hui : enrichissement web. */
export async function enrichCompany(hit: CompanySearchHit): Promise<CompanySearchHit> {
  const { hit: h } = await enrichHitWebsiteCached(hit);
  return h;
}

/** Recherche d’emails via Hunter (si HUNTER_API_KEY). */
export async function findEmails(hit: CompanySearchHit): Promise<CompanySearchHit> {
  const port = resolveEmailFinderPort();
  const { hit: next } = await port.findEmails(hit);
  return next;
}

/** Qualification / score IA d’un prospect. */
export const scoreLead = qualifyCompanyHit;
