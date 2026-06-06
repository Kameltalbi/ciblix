import { prisma } from '../../db/prisma.js';
import { runSeoAudit } from './seoAudit.js';
import { buildChannelScores } from './scoring.js';
import type { BrandProfile } from '@prisma/client';

/** Phase 6 — benchmark concurrent (SEO réel + estimation autres canaux). */
export async function runCompetitorBenchmark(profile: BrandProfile): Promise<{
  snapshot: { globalScore: number; channels: ReturnType<typeof buildChannelScores> };
  history: Array<{ globalScore: number; computedAt: Date }>;
}> {
  if (!profile.competitorUrl && !profile.competitorName) {
    throw Object.assign(new Error('Concurrent non configuré'), { statusCode: 400 });
  }

  const url = profile.competitorUrl || `https://www.google.com/search?q=${encodeURIComponent(profile.competitorName!)}`;
  let audit = null;
  if (profile.competitorUrl) {
    audit = await runSeoAudit(profile.competitorUrl);
  }

  const channels = buildChannelScores(audit, {});
  const global = channels.find((c) => c.channel === 'GLOBAL')?.score ?? 50;

  await prisma.brandCompetitorSnapshot.create({
    data: {
      organizationId: profile.organizationId,
      brandProfileId: profile.id,
      competitorName: profile.competitorName || 'Concurrent',
      globalScore: global,
      channels: channels as object,
    },
  });

  const history = await prisma.brandCompetitorSnapshot.findMany({
    where: { organizationId: profile.organizationId, brandProfileId: profile.id },
    orderBy: { computedAt: 'desc' },
    take: 12,
    select: { globalScore: true, computedAt: true },
  });

  return {
    snapshot: { globalScore: global, channels },
    history,
  };
}
