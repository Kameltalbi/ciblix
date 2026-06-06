import { prisma } from '../../db/prisma.js';
import { runSeoAudit } from './seoAudit.js';
import { buildChannelScores } from './scoring.js';
import { generateTopics } from './topicPrioritizer.js';
import { parseBrandKeywords } from './parseKeywords.js';
import type { BrandProfile } from '@prisma/client';

export async function loadChannelsForProfile(
  organizationId: string,
  profile: BrandProfile,
): Promise<ReturnType<typeof buildChannelScores>> {
  const snapshots = await prisma.brandScoreSnapshot.findMany({
    where: { organizationId, brandProfileId: profile.id },
    orderBy: { computedAt: 'desc' },
    take: 20,
  });
  const channelMap = new Map<string, (typeof snapshots)[0]>();
  for (const s of snapshots) {
    if (!channelMap.has(s.channel)) channelMap.set(s.channel, s);
  }

  if (channelMap.has('SEO')) {
    return Array.from(channelMap.values()).map((r) => ({
      channel: r.channel,
      score: r.score,
      weight: r.weight,
      details: (r.details || {}) as Record<string, unknown>,
    })) as ReturnType<typeof buildChannelScores>;
  }

  const audit = await runSeoAudit(profile.websiteUrl);
  return buildChannelScores(audit);
}

export async function createProposedTopicsForProfile(
  organizationId: string,
  profile: BrandProfile,
  options?: { persistScoresIfMissing?: boolean },
) {
  let channels = await loadChannelsForProfile(organizationId, profile);

  if (options?.persistScoresIfMissing) {
    const hasSeo = channels.some((c) => c.channel === 'SEO');
    if (!hasSeo) {
      const audit = await runSeoAudit(profile.websiteUrl);
      channels = buildChannelScores(audit);
      await prisma.brandScoreSnapshot.createMany({
        data: channels.map((c) => ({
          organizationId,
          brandProfileId: profile.id,
          channel: c.channel,
          score: c.score,
          weight: c.weight,
          details: c.details as object,
        })),
      });
    }
  }

  const { topics, usedFallback } = await generateTopics({
    brandName: profile.brandName,
    sector: profile.sector,
    competitorName: profile.competitorName,
    brandKeywords: parseBrandKeywords(profile.brandKeywords as string[]),
    channels,
  });

  if (topics.length === 0) return { created: [], usedFallback, keywordCount: 0 };

  const keywordCount = parseBrandKeywords(profile.brandKeywords as string[]).length;
  const created = await Promise.all(
    topics.map((t) =>
      prisma.brandArticle.create({
        data: {
          organizationId,
          brandProfileId: profile.id,
          status: 'PROPOSED',
          format: t.format,
          title: t.title,
          targetKeywords: t.targetKeywords,
          topicReason: { reason: t.reason, priority: t.priority, auto: true },
          estimatedImpact: t.estimatedImpact,
        },
      }),
    ),
  );

  return { created, usedFallback, keywordCount };
}
