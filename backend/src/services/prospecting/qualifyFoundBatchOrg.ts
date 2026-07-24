import { prisma } from '../../db/prisma.js';
import { runProspectEnrichmentPipeline } from './index.js';
import type { CompanySearchCriteria, CompanySearchHit, LeadQualification, WebEnrichmentResult } from './types.js';

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

type LeadQualificationLike = LeadQualification;

function prismaRowToSearchHit(row: {
  companyName: string;
  website: string | null;
  linkedin: string | null;
  phone: string | null;
  email: string | null;
  city: string | null;
  country: string | null;
  industry: string | null;
  companySize: string | null;
  rawProvider?: string | null;
  googleMapsUrl?: string | null;
}): CompanySearchHit {
  const rawProvider = row.rawProvider || '';
  const colon = rawProvider.indexOf(':');
  const externalId = colon >= 0 ? rawProvider.slice(colon + 1) : null;
  return {
    companyName: row.companyName,
    website: row.website,
    linkedin: row.linkedin,
    phone: row.phone,
    email: row.email,
    city: row.city,
    country: row.country,
    industry: row.industry,
    companySize: row.companySize,
    externalId: externalId || null,
    googleMapsUrl: row.googleMapsUrl || null,
  };
}

function hitToProspectData(
  hit: CompanySearchHit,
  q: LeadQualificationLike,
  criteria: CompanySearchCriteria,
  rawProvider: string,
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
    score: q.score,
    scoreReason: q.scoreReason,
    suggestedPitch: q.suggestedPitch,
    aiTags: q.aiTags as object,
    potentialLevel: q.potentialLevel,
    commercialAngle: q.commercialAngle,
    aiSummary: q.aiSummary,
    interestProbability: q.interestProbability,
    followUpPlan: q.followUpPlan as object,
    probableBusinessProblem: q.probableBusinessProblem,
    suggestedOffer: q.suggestedOffer,
    commercialProfile: q.commercialProfile as object,
    googleMapsUrl: hit.googleMapsUrl || null,
    status: 'QUALIFIED' as const,
    lastSearchQuery: JSON.stringify(criteria),
    rawProvider,
    ...enrichmentPersistFields(enrichment),
  };
}

/** Qualifie jusqu’à `capTotal` lignes FOUND pour une org (parcours multiples petits batches). */
export async function qualifyFoundBatchForOrganization(
  organizationId: string,
  capTotal: number
): Promise<{ qualifiedCount: number }> {
  const batchLimit = Math.min(25, Math.max(1, capTotal));
  let qualifiedCount = 0;
  let noProgressStreak = 0;

  for (let round = 0; round < 20 && qualifiedCount < capTotal; round++) {
    const pending = await prisma.aiProspect.findMany({
      where: { organizationId, deletedAt: null, status: 'FOUND' },
      orderBy: { createdAt: 'asc' },
      take: batchLimit,
    });
    if (pending.length === 0) break;

    let progressed = 0;
    for (const row of pending) {
      try {
        const criteria = (row.lastSearchQuery ? JSON.parse(row.lastSearchQuery) : {}) as CompanySearchCriteria;
        const hit = prismaRowToSearchHit(row);
        const { hit: merged, enrichment, qualification: q } = await runProspectEnrichmentPipeline(
          hit,
          criteria
        );
        await prisma.aiProspect.update({
          where: { id: row.id },
          data: {
            ...hitToProspectData(merged, q, criteria, row.rawProvider || 'google_places', enrichment),
            phone: merged.phone,
            email: merged.email,
            linkedin: merged.linkedin,
            website: merged.website,
          },
        });
        qualifiedCount++;
        progressed++;
      } catch (err) {
        console.error('[prospecting] qualify-automation', row.id, err);
      }
    }

    if (progressed === 0) {
      noProgressStreak++;
      if (noProgressStreak >= 2) break;
    } else {
      noProgressStreak = 0;
    }
  }

  return { qualifiedCount };
}
