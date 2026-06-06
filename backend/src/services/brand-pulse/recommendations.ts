import type { BrandChannel, ChannelScore } from './types.js';
import { scoreLabel } from './scoring.js';

export type RecommendationCta =
  | 'GENERATE_TOPICS'
  | 'SYNC_CHANNELS'
  | 'AUDIT_EXISTING'
  | 'CONNECT_REVIEWS'
  | null;

export interface BrandRecommendationItem {
  channel: BrandChannel;
  action: string;
  estimatedImpact: number;
  difficulty: 'EASY' | 'MEDIUM' | 'HARD';
  timeline: 'SHORT' | 'MEDIUM' | 'LONG';
  cta: RecommendationCta;
}

export function buildRecommendations(
  channels: ChannelScore[],
  brandName: string,
): BrandRecommendationItem[] {
  const items: BrandRecommendationItem[] = [];
  const seo = channels.find((c) => c.channel === 'SEO');

  if (seo && seo.score < 60) {
    items.push({
      channel: 'SEO',
      action: `Publier 2 articles SEO ciblant les mots-clés de marque pour ${brandName}`,
      estimatedImpact: 8,
      difficulty: 'MEDIUM',
      timeline: 'SHORT',
      cta: 'GENERATE_TOPICS',
    });
  }

  if (seo && seo.score < 75) {
    items.push({
      channel: 'SEO',
      action: 'Auditer et optimiser les articles existants du blog',
      estimatedImpact: 5,
      difficulty: 'MEDIUM',
      timeline: 'SHORT',
      cta: 'AUDIT_EXISTING',
    });
  }

  if (seo && seo.score < 80) {
    const audit = seo.details.audit as { issues?: string[] } | undefined;
    if (audit?.issues?.includes('Meta description absente')) {
      items.push({
        channel: 'SEO',
        action: 'Ajouter une meta description optimisée sur la page d\'accueil',
        estimatedImpact: 4,
        difficulty: 'EASY',
        timeline: 'SHORT',
        cta: null,
      });
    }
  }

  const global = channels.find((c) => c.channel === 'GLOBAL');
  if (global) {
    items.push({
      channel: 'GLOBAL',
      action: `Maintenir une cadence de ${scoreLabel(global.score) === 'Faible' ? '2' : '1'} article(s) par semaine`,
      estimatedImpact: 5,
      difficulty: 'MEDIUM',
      timeline: 'MEDIUM',
      cta: 'GENERATE_TOPICS',
    });
  }

  for (const ch of channels.filter((c) => c.details.comingSoon)) {
    const cta: RecommendationCta =
      ch.channel === 'REVIEWS' ? 'CONNECT_REVIEWS' : 'SYNC_CHANNELS';
    items.push({
      channel: ch.channel,
      action: `Connecter ou synchroniser le canal ${ch.channel} pour un score réel`,
      estimatedImpact: 3,
      difficulty: 'EASY',
      timeline: 'LONG',
      cta,
    });
  }

  return items.slice(0, 6);
}
