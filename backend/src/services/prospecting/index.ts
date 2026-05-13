import type { CompanySearchCriteria, CompanySearchHit } from './types.js';
import { resolveProspectingSearchProvider } from './getSearchProvider.js';
import { qualifyCompanyHit } from './qualifyWithAi.js';
import { MockCompanySearchProvider } from './providers/MockCompanySearchProvider.js';

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

/** Enrichissement futur (Apollo / Clearbit) — no-op pour l’instant. */
export async function enrichCompany(hit: CompanySearchHit): Promise<CompanySearchHit> {
  return hit;
}

/** Recherche d’emails (Hunter, etc.) — no-op pour l’instant. */
export async function findEmails(hit: CompanySearchHit): Promise<CompanySearchHit> {
  return hit;
}

/** Qualification / score IA d’un prospect. */
export const scoreLead = qualifyCompanyHit;
