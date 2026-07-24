import { prisma } from '../../db/prisma.js';
import { searchCompaniesWithCache } from './index.js';
import { emptyWebEnrichment } from './websiteEnrichment.js';
import type { CompanySearchCriteria, CompanySearchHit, WebEnrichmentResult } from './types.js';
import { recordHuntProspectFound } from '../agent-memory/agentIntegrations.js';
import { scheduleOrgRescan } from '../agent-memory/contactResolution.js';

function enrichmentPersistFields(e: WebEnrichmentResult) {
  return {
    websiteTitle: e.websiteTitle,
    websiteDescription: e.websiteDescription,
    detectedEmails: e.detectedEmails.length ? e.detectedEmails : undefined,
    facebookUrl: e.facebookUrl,
    instagramUrl: e.instagramUrl,
    faviconUrl: e.faviconUrl,
    hasResponsiveWebsite: e.hasResponsiveWebsite,
    hasSsl: e.hasSsl,
    seoScore: e.seoScore,
    digitalPresenceLevel: e.digitalPresenceLevel,
    technologiesDetected: e.technologiesDetected.length ? e.technologiesDetected : undefined,
  };
}

function dedupeProviderKey(providerUsed: string, hit: CompanySearchHit): string {
  const tail = (hit.externalId || hit.companyName || 'unknown').toString().trim();
  return `${providerUsed}:${tail}`.slice(0, 450);
}

/** Persistance brute — aligné avec la route `/prospecting/search`. */
function hitToFoundProspectData(
  hit: CompanySearchHit,
  criteria: CompanySearchCriteria,
  rawProviderDedupe: string,
  enrichment: WebEnrichmentResult
) {
  return {
    companyName: hit.companyName,
    website: hit.website || null,
    linkedin: hit.linkedin || null,
    phone: hit.phone || null,
    email: hit.email || null,
    city: hit.city || null,
    country: hit.country || null,
    industry: hit.industry || criteria.sector || null,
    companySize: hit.companySize || criteria.companySize || null,
    score: 0,
    status: 'FOUND' as const,
    lastSearchQuery: JSON.stringify(criteria),
    rawProvider: rawProviderDedupe,
    googleMapsUrl: hit.googleMapsUrl || null,
    ...enrichmentPersistFields(enrichment),
  };
}

export type ImportProspectsResult = {
  providerUsed: string;
  fromCache: boolean;
  count: number;
  rawHits: number;
  prospects: unknown[];
};

/**
 * Lance une recherche comme l’endpoint HTTP, puis crée des `FOUND` jusqu’à `importMax`.
 * Utilisable par les jobs automatiques sans `AuthRequest`.
 */
export async function importProspectsFromSearch(
  organizationId: string,
  criteria: CompanySearchCriteria,
  options?: { refresh?: boolean; importMax?: number; userId?: string }
): Promise<ImportProspectsResult> {
  const refresh = Boolean(options?.refresh);
  const { hits, providerUsed, fromCache } = await searchCompaniesWithCache(organizationId, criteria, { refresh });

  const importMax = Math.min(
    120,
    Math.max(10, Number(options?.importMax) || Number(process.env.PROSPECTING_IMPORT_MAX) || 80)
  );
  const tagBase = fromCache ? `${providerUsed}|search_cache` : providerUsed;
  const empty = emptyWebEnrichment();

  const created: unknown[] = [];
  const dedupeKeys = new Set<string>();

  for (const hitBase of hits.slice(0, importMax)) {
    const dedupeKey = dedupeProviderKey(tagBase, hitBase);
    if (dedupeKeys.has(dedupeKey)) continue;
    dedupeKeys.add(dedupeKey);

    const existing = await prisma.aiProspect.findFirst({
      where: {
        organizationId,
        deletedAt: null,
        rawProvider: dedupeKey,
      },
    });
    if (existing) {
      created.push(existing);
      continue;
    }

    const row = await prisma.aiProspect.create({
      data: {
        organizationId,
        ...hitToFoundProspectData(hitBase, criteria, dedupeKey, empty),
      },
    });
    created.push(row);

    if (options?.userId) {
      void recordHuntProspectFound({
        organizationId,
        userId: options.userId,
        prospect: {
          id: row.id,
          companyName: row.companyName,
          phone: row.phone,
          email: row.email,
          score: row.score,
          lastSearchQuery: row.lastSearchQuery,
        },
        skipRescan: true,
      }).catch((err) => console.warn('[hunt] agent-memory prospect found', row.id, err));
    }
  }

  if (options?.userId && created.length > 0) {
    scheduleOrgRescan(organizationId);
  }

  return {
    providerUsed,
    fromCache,
    count: created.length,
    rawHits: hits.length,
    prospects: created,
  };
}
