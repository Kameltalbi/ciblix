import { callOpenAI, parseJsonFromLlm } from './llm.js';
import type { ChannelScore, ProposedTopic } from './types.js';
import { lowestChannel } from './scoring.js';

interface TopicLlmResponse {
  topics: Array<{
    title: string;
    format: string;
    targetKeywords: string[];
    reason: string;
    estimatedImpact: number;
    priority: number;
  }>;
}

export async function generateTopics(params: {
  brandName: string;
  sector: string | null;
  competitorName: string | null;
  brandKeywords: string[];
  channels: ChannelScore[];
}): Promise<ProposedTopic[]> {
  const weakChannel = lowestChannel(params.channels);
  const seoChannel = params.channels.find((c) => c.channel === 'SEO');
  const seoScore = seoChannel?.score ?? 50;

  const systemPrompt = `Tu es BrandPulse AI, expert SEO et stratégie de marque B2B.
Propose exactement 3 sujets d'articles de blog prioritaires en JSON.
Formats autorisés: SEO, LONGFORM, FAQ, COMPARATIVE.
Réponds UNIQUEMENT en JSON valide: { "topics": [ { "title", "format", "targetKeywords": [], "reason", "estimatedImpact": 1-10, "priority": 1-3 } ] }`;

  const userPrompt = `Marque: ${params.brandName}
Secteur: ${params.sector || 'non précisé'}
Concurrent: ${params.competitorName || 'non précisé'}
Mots-clés marque: ${params.brandKeywords.join(', ') || 'aucun'}
Score SEO actuel: ${seoScore}/100
Canal le plus faible: ${weakChannel}
Priorise les sujets avec impact estimé > 5 points sur le score SEO.`;

  const raw = await callOpenAI(userPrompt, systemPrompt, 1200, 0.4);
  const parsed = parseJsonFromLlm<TopicLlmResponse>(raw);

  if (parsed?.topics?.length) {
    return parsed.topics.slice(0, 3).map((t) => ({
      title: t.title,
      format: (['SEO', 'LONGFORM', 'FAQ', 'COMPARATIVE'].includes(t.format) ? t.format : 'SEO') as ProposedTopic['format'],
      targetKeywords: Array.isArray(t.targetKeywords) ? t.targetKeywords : [],
      reason: t.reason,
      estimatedImpact: Math.min(10, Math.max(1, Number(t.estimatedImpact) || 5)),
      priority: Math.min(3, Math.max(1, Number(t.priority) || 2)),
    }));
  }

  return fallbackTopics(params.brandName, seoScore);
}

function fallbackTopics(brandName: string, seoScore: number): ProposedTopic[] {
  const base = seoScore < 60 ? 'améliorer votre visibilité' : 'renforcer votre autorité';
  return [
    {
      title: `${brandName} : guide complet pour ${base}`,
      format: 'SEO',
      targetKeywords: [brandName, 'guide'],
      reason: 'Score SEO à renforcer — couvrir les mots-clés de marque',
      estimatedImpact: 6,
      priority: 1,
    },
    {
      title: `FAQ : tout savoir sur ${brandName}`,
      format: 'FAQ',
      targetKeywords: [brandName, 'questions fréquentes'],
      reason: 'Capturer la longue traîne et les requêtes LLM',
      estimatedImpact: 5,
      priority: 2,
    },
    {
      title: `Pourquoi choisir ${brandName} en ${new Date().getFullYear()} ?`,
      format: 'SEO',
      targetKeywords: [brandName, 'avis'],
      reason: 'Article de notoriété pour le canal SEO',
      estimatedImpact: 5,
      priority: 3,
    },
  ];
}
