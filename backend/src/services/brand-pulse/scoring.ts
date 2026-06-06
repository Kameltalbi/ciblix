import type { BrandChannel, ChannelScore, SeoAuditResult } from './types.js';
import { CHANNEL_WEIGHTS } from './types.js';
import { seoScoreFromAudit } from './seoAudit.js';
import type { SyncedChannelData } from './channelSync.js';

export function websiteScoreFromAudit(audit: SeoAuditResult): number {
  let score = 0;
  if (audit.https) score += 20;
  if (audit.title) score += 15;
  if (audit.metaDescription) score += 15;
  if (audit.h1Count === 1) score += 15;
  if (audit.hasOgTitle) score += 10;
  if (audit.responseMs < 2000) score += 15;
  else if (audit.responseMs < 4000) score += 8;
  if (audit.wordCountApprox > 300) score += 10;
  return Math.min(100, score);
}

function channelEntry(
  channel: BrandChannel,
  score: number,
  details: Record<string, unknown>,
): ChannelScore {
  return { channel, score, weight: CHANNEL_WEIGHTS[channel as Exclude<BrandChannel, 'GLOBAL'>], details };
}

export function buildChannelScores(
  seoAudit: SeoAuditResult | null,
  synced: SyncedChannelData = {},
): ChannelScore[] {
  const seoScore = seoAudit ? seoScoreFromAudit(seoAudit) : 50;

  const channels: ChannelScore[] = [
    channelEntry('SEO', seoScore, {
      comingSoon: false,
      audit: seoAudit,
      interpretation: scoreLabel(seoScore),
    }),
    channelEntry(
      'SOCIAL',
      synced.SOCIAL?.score ?? 50,
      synced.SOCIAL
        ? { comingSoon: false, ...synced.SOCIAL.details, interpretation: scoreLabel(synced.SOCIAL.score) }
        : { comingSoon: true, message: 'Connectez le canal social (Phase 2)', interpretation: 'Estimation' },
    ),
    channelEntry(
      'REVIEWS',
      synced.REVIEWS?.score ?? 50,
      synced.REVIEWS
        ? { comingSoon: false, ...synced.REVIEWS.details, interpretation: scoreLabel(synced.REVIEWS.score) }
        : { comingSoon: true, message: 'Connectez Google Business (Phase 2)', interpretation: 'Estimation' },
    ),
    channelEntry(
      'PRESS',
      synced.PRESS?.score ?? 50,
      synced.PRESS
        ? { comingSoon: false, ...synced.PRESS.details, interpretation: scoreLabel(synced.PRESS.score) }
        : { comingSoon: true, message: 'Score presse via Google CSE (Phase 5)', interpretation: 'Estimation' },
    ),
    channelEntry(
      'LLM',
      synced.LLM?.score ?? 50,
      synced.LLM
        ? { comingSoon: false, ...synced.LLM.details, interpretation: scoreLabel(synced.LLM.score) }
        : { comingSoon: true, message: 'Analyse LLM (Phase 5)', interpretation: 'Estimation' },
    ),
    channelEntry(
      'WEBSITE',
      seoAudit ? websiteScoreFromAudit(seoAudit) : 50,
      seoAudit
        ? { comingSoon: false, interpretation: scoreLabel(websiteScoreFromAudit(seoAudit)) }
        : { comingSoon: true, interpretation: 'Estimation' },
    ),
  ];

  const globalScore = Math.round(channels.reduce((sum, c) => sum + c.score * c.weight, 0));

  channels.push({
    channel: 'GLOBAL',
    score: globalScore,
    weight: 1,
    details: { formula: 'Moyenne pondérée 6 canaux', interpretation: scoreLabel(globalScore) },
  });

  return channels;
}

export function scoreLabel(score: number): string {
  if (score >= 80) return 'Excellent';
  if (score >= 60) return 'Bon';
  if (score >= 40) return 'Moyen';
  return 'Faible';
}

export function lowestChannel(channels: ChannelScore[]): BrandChannel | null {
  const measurable = channels.filter((c) => c.channel !== 'GLOBAL' && !c.details.comingSoon);
  if (measurable.length === 0) return 'SEO';
  return measurable.reduce((a, b) => (a.score <= b.score ? a : b)).channel;
}
