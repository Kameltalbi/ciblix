import type { BrandChannel, ChannelScore, SeoAuditResult } from './types.js';
import { CHANNEL_WEIGHTS } from './types.js';
import { seoScoreFromAudit } from './seoAudit.js';

const PLACEHOLDER_CHANNELS: Exclude<BrandChannel, 'SEO' | 'GLOBAL'>[] = [
  'SOCIAL',
  'REVIEWS',
  'PRESS',
  'LLM',
  'WEBSITE',
];

export function buildChannelScores(seoAudit: SeoAuditResult | null): ChannelScore[] {
  const seoScore = seoAudit ? seoScoreFromAudit(seoAudit) : 50;

  const channels: ChannelScore[] = [
    {
      channel: 'SEO',
      score: seoScore,
      weight: CHANNEL_WEIGHTS.SEO,
      details: {
        comingSoon: false,
        audit: seoAudit,
        interpretation: scoreLabel(seoScore),
      },
    },
    ...PLACEHOLDER_CHANNELS.map((channel) => ({
      channel,
      score: 50,
      weight: CHANNEL_WEIGHTS[channel],
      details: {
        comingSoon: true,
        message: 'Connecteurs canal en cours de déploiement (Phase 2-5)',
        interpretation: 'Estimation',
      },
    })),
  ];

  const globalScore = Math.round(
    channels.reduce((sum, c) => sum + c.score * c.weight, 0),
  );

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
