import type { BrandChannel } from './types.js';
import { CHANNEL_WEIGHTS } from './types.js';

const ESTIMATED: Partial<Record<BrandChannel, string>> = {
  SOCIAL: 'Estimation (50) tant que les réseaux ne sont pas détectés. Synchronisez pour un score réel.',
  REVIEWS: 'Estimation (50) sans fiche Google connectée. Recherchez votre établissement pour noter les avis.',
  PRESS: 'Estimation sans Google CSE. Avec CSE : mentions presse/blogs trouvées sur le web.',
  LLM: 'Estimation sans sondage IA. Avec OpenAI : notoriété perçue de votre marque par les LLMs.',
  WEBSITE: 'Estimation sans audit. Lancez un audit pour mesurer la qualité technique du site.',
};

const MEASURED: Record<Exclude<BrandChannel, 'GLOBAL'>, string> = {
  SEO: 'Audit de votre page d\'accueil : title, meta description, H1, HTTPS, vitesse et contenu. Chaque problème SEO retire ~8 pts.',
  SOCIAL: 'Présence des liens sociaux sur le site + signaux de mentions (recherche web). Plus de réseaux = score plus haut.',
  REVIEWS: 'Note Google (sur 5) pondérée à 70 % + volume d\'avis clients (jusqu\'à 50 avis).',
  PRESS: 'Nombre d\'articles et mentions presse/blogs trouvés via Google Custom Search.',
  LLM: 'Sondage IA : probabilité qu\'un assistant connaisse et décrive correctement votre marque.',
  WEBSITE: 'HTTPS, balises title/meta, H1 unique, Open Graph, temps de chargement et richesse du contenu.',
};

export function globalScoreExplanation(): string {
  const parts = (Object.entries(CHANNEL_WEIGHTS) as [Exclude<BrandChannel, 'GLOBAL'>, number][])
    .map(([ch, w]) => `${ch} ${Math.round(w * 100)} %`)
    .join(' · ');
  return `Moyenne pondérée des 6 canaux : ${parts}.`;
}

export function channelScoreExplanation(
  channel: BrandChannel,
  details: Record<string, unknown>,
): string | null {
  if (channel === 'GLOBAL') return globalScoreExplanation();

  if (details.comingSoon) {
    return ESTIMATED[channel] ?? 'Score estimé en attendant la connexion du canal.';
  }

  if (details.estimated === true && typeof details.message === 'string') {
    return details.message;
  }

  const base = MEASURED[channel as Exclude<BrandChannel, 'GLOBAL'>];
  if (!base) return null;

  if (channel === 'REVIEWS' && typeof details.rating === 'number') {
    return `${base} Actuel : ${details.rating}/5, ${details.reviewCount ?? 0} avis.`;
  }
  if (channel === 'SOCIAL' && details.mentionHits != null) {
    return `${base} Mentions détectées : ${details.mentionHits}.`;
  }
  if (channel === 'PRESS' && details.mentionCount != null) {
    return `${base} ${details.mentionCount} résultat(s) récent(s).`;
  }
  if (channel === 'LLM' && typeof details.summary === 'string') {
    return `${base} ${details.summary}`;
  }

  return base;
}
