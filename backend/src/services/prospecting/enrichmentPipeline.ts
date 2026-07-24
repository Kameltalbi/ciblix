import type {
  CompanySearchCriteria,
  CompanySearchHit,
  LeadQualification,
  WebEnrichmentResult,
} from './types.js';
import { enrichHitWithPlaceDetails } from './providers/googlePlaceDetails.js';
import { resolveWebsiteEnrichmentPort } from './providers/FirecrawlWebsiteProvider.js';
import { resolveEmailFinderPort } from './providers/HunterEmailProvider.js';
import { qualifyCompanyHit } from './qualifyWithAi.js';
import {
  getCachedWebsiteEnrichment,
  setCachedWebsiteEnrichment,
  websiteCacheKeyFromRawWebsite,
} from './prospectingCache.js';
import { emptyWebEnrichment } from './websiteEnrichment.js';

/**
 * Pipeline Prospecteur modulaire :
 * Place Details → site (Firecrawl|native) → emails (Hunter) → qualification OpenAI/heuristique
 *
 * Ajouter une source = brancher un nouveau port dans ce fichier, sans toucher aux routes.
 */
export async function runProspectEnrichmentPipeline(
  hit: CompanySearchHit,
  criteria: CompanySearchCriteria
): Promise<{
  hit: CompanySearchHit;
  enrichment: WebEnrichmentResult;
  qualification: LeadQualification;
  hunterEmails: string[];
}> {
  let current = await enrichHitWithPlaceDetails(hit);

  let enrichment: WebEnrichmentResult = emptyWebEnrichment();
  if (current.website?.trim()) {
    const ukey = websiteCacheKeyFromRawWebsite(current.website);
    const cached = ukey ? await getCachedWebsiteEnrichment(ukey) : null;
    if (cached && typeof cached === 'object' && typeof (cached as { seoScore?: unknown }).seoScore === 'number') {
      enrichment = cached as unknown as WebEnrichmentResult;
      current = mergeEmailsPhone(current, enrichment);
    } else {
      const websitePort = resolveWebsiteEnrichmentPort();
      const web = await websitePort.enrichCompany(current);
      current = web.hit;
      enrichment = web.enrichment;
      if (ukey) {
        await setCachedWebsiteEnrichment(ukey, { ...(enrichment as object) } as Record<string, unknown>).catch(
          () => {}
        );
      }
    }
  }

  const emailPort = resolveEmailFinderPort();
  const { emails: hunterEmails, hit: withHunter } = await emailPort.findEmails(current);
  current = withHunter;

  if (hunterEmails.length) {
    const merged = new Set([...(enrichment.detectedEmails || []), ...hunterEmails]);
    enrichment = { ...enrichment, detectedEmails: [...merged].slice(0, 16) };
  }

  const qualification = await qualifyCompanyHit(current, criteria, enrichment);

  return { hit: current, enrichment, qualification, hunterEmails };
}

function mergeEmailsPhone(hit: CompanySearchHit, e: WebEnrichmentResult): CompanySearchHit {
  return {
    ...hit,
    email: hit.email || e.detectedEmails[0] || null,
    phone: hit.phone || e.phoneFromPage || null,
    linkedin: hit.linkedin || e.linkedinUrlsFound[0] || null,
  };
}
