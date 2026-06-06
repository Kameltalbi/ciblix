import type { BrandChannel, ChannelScore } from './types.js';
import { scoreLabel } from './scoring.js';

export interface BrandRecommendationItem {
  channel: BrandChannel;
  action: string;
  estimatedImpact: number;
  difficulty: 'EASY' | 'MEDIUM' | 'HARD';
  timeline: 'SHORT' | 'MEDIUM' | 'LONG';
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
    });
  }

  for (const ch of channels.filter((c) => c.details.comingSoon)) {
    items.push({
      channel: ch.channel,
      action: `Connecter le canal ${ch.channel} (bientôt disponible) pour un score réel`,
      estimatedImpact: 3,
      difficulty: 'EASY',
      timeline: 'LONG',
    });
  }

  return items.slice(0, 6);
}
