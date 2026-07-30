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

/** Clé stable (ignore le suffixe |search_cache). */
function dedupeProviderKey(providerUsed: string, hit: CompanySearchHit): string {
  const provider = providerUsed.replace(/\|search_cache$/i, '').trim() || 'provider';
  const tail = (hit.externalId || hit.companyName || 'unknown').toString().trim();
  return `${provider}:${tail}`.slice(0, 450);
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

async function findExistingProspect(organizationId: string, hit: CompanySearchHit, dedupeKey: string) {
  const externalId = hit.externalId?.trim();
  const name = hit.companyName?.trim();

  const or: Array<Record<string, unknown>> = [{ rawProvider: dedupeKey }];
  if (externalId) {
    or.push({ rawProvider: { endsWith: `:${externalId}` } });
  }
  if (name) {
    or.push({ companyName: { equals: name, mode: 'insensitive' } });
  }

  return prisma.aiProspect.findFirst({
    where: {
      organizationId,
      deletedAt: null,
      OR: or,
    },
  });
}

export type ImportProspectsResult = {
  providerUsed: string;
  fromCache: boolean;
  /** Nouvelles fiches créées. */
  count: number;
  /** Hits API bruts avant dédup. */
  rawHits: number;
  /** Déjà en base (incluses dans prospects, pas masquées). */
  skippedExisting: number;
  prospects: unknown[];
};

/**
 * Lance une recherche, upsert les hits, et renvoie TOUTES les entreprises trouvées
 * (nouvelles + déjà connues) — plus de masquage silencieux.
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
  const empty = emptyWebEnrichment();

  const prospects: unknown[] = [];
  const dedupeKeys = new Set<string>();
  let createdCount = 0;
  let alreadyKnown = 0;

  for (const hitBase of hits.slice(0, importMax)) {
    const dedupeKey = dedupeProviderKey(providerUsed, hitBase);
    if (dedupeKeys.has(dedupeKey)) continue;
    dedupeKeys.add(dedupeKey);

    const existing = await findExistingProspect(organizationId, hitBase, dedupeKey);
    if (existing) {
      alreadyKnown += 1;
      prospects.push(existing);
      continue;
    }

    const row = await prisma.aiProspect.create({
      data: {
        organizationId,
        ...hitToFoundProspectData(hitBase, criteria, dedupeKey, empty),
      },
    });
    createdCount += 1;
    prospects.push(row);

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

  if (options?.userId && createdCount > 0) {
    scheduleOrgRescan(organizationId);
  }

  if (createdCount > 0) {
    void import('../tenant-onboarding/index.js').then(({ markTtfrlFirstLead }) =>
      markTtfrlFirstLead(organizationId)
    );
  }

  return {
    providerUsed,
    fromCache,
    count: createdCount,
    rawHits: hits.length,
    skippedExisting: alreadyKnown,
    prospects,
  };
}
