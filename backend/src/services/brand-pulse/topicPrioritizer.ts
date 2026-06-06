import { callOpenAI, parseJsonFromLlm } from './llm.js';
import { parseBrandKeywords } from './parseKeywords.js';
import type { ChannelScore, ProposedTopic } from './types.js';
import { lowestChannel } from './scoring.js';

export type TopicGenerationResult = {
  topics: ProposedTopic[];
  usedFallback: boolean;
};

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
}): Promise<TopicGenerationResult> {
  const keywords = parseBrandKeywords(params.brandKeywords);
  const weakChannel = lowestChannel(params.channels);
  const seoChannel = params.channels.find((c) => c.channel === 'SEO');
  const seoScore = seoChannel?.score ?? 50;
  const keywordSample = keywords.slice(0, 30).join(', ');

  const systemPrompt = `Tu es BrandPulse AI, expert SEO et stratégie de marque B2B.
Propose exactement 3 sujets d'articles de blog prioritaires en JSON.
Formats autorisés: SEO, LONGFORM, FAQ, COMPARATIVE.
RÈGLES OBLIGATOIRES:
- Chaque titre doit cibler au moins 1 mot-clé métier fourni (pas seulement le nom de marque).
- Les 3 sujets doivent couvrir des mots-clés DIFFÉRENTS de la liste.
- Le nom de marque peut apparaître mais ne doit pas être le seul angle du titre.
Réponds UNIQUEMENT en JSON valide: { "topics": [ { "title", "format", "targetKeywords": [], "reason", "estimatedImpact": 1-10, "priority": 1-3 } ] }`;

  const userPrompt = `Marque: ${params.brandName}
Secteur: ${params.sector || 'non précisé'}
Concurrent: ${params.competitorName || 'non précisé'}
Mots-clés métier (${keywords.length} au total): ${keywordSample || 'aucun — demander des sujets sectoriels génériques'}
Score SEO actuel: ${seoScore}/100
Canal le plus faible: ${weakChannel}
Priorise les sujets avec impact estimé > 5 points sur le score SEO.`;

  try {
    const raw = await callOpenAI(userPrompt, systemPrompt, 1200, 0.4);
    const parsed = parseJsonFromLlm<TopicLlmResponse>(raw);

    if (parsed?.topics?.length) {
      return {
        usedFallback: false,
        topics: parsed.topics.slice(0, 3).map((t) => ({
          title: t.title,
          format: (['SEO', 'LONGFORM', 'FAQ', 'COMPARATIVE'].includes(t.format) ? t.format : 'SEO') as ProposedTopic['format'],
          targetKeywords: Array.isArray(t.targetKeywords) ? t.targetKeywords : [],
          reason: t.reason,
          estimatedImpact: Math.min(10, Math.max(1, Number(t.estimatedImpact) || 5)),
          priority: Math.min(3, Math.max(1, Number(t.priority) || 2)),
        })),
      };
    }
  } catch (err) {
    console.warn('[brand-pulse] OpenAI topics fallback:', err instanceof Error ? err.message : err);
  }

  return { usedFallback: true, topics: fallbackTopics(params.brandName, params.sector, keywords, seoScore) };
}

function pickKeywordSpread(keywords: string[], count: number): string[] {
  if (keywords.length === 0) return [];
  if (keywords.length <= count) return keywords;
  const picked: string[] = [];
  for (let i = 0; i < count; i++) {
    const idx = Math.floor((i * keywords.length) / count);
    picked.push(keywords[idx]);
  }
  return [...new Set(picked)].slice(0, count);
}

function fallbackTopics(
  brandName: string,
  sector: string | null,
  keywords: string[],
  seoScore: number,
): ProposedTopic[] {
  const year = new Date().getFullYear();
  const picked = pickKeywordSpread(keywords, 3);

  if (picked.length >= 3) {
    return [
      {
        title: `Guide complet : ${picked[0]}${sector ? ` pour ${sector}` : ''}`,
        format: 'LONGFORM',
        targetKeywords: [picked[0], picked[1]].filter(Boolean),
        reason: `Cibler le mot-clé « ${picked[0]} » pour améliorer le référencement`,
        estimatedImpact: 7,
        priority: 1,
      },
      {
        title: `FAQ — ${picked[1]} : questions fréquentes`,
        format: 'FAQ',
        targetKeywords: [picked[1], 'questions fréquentes'],
        reason: `Capturer la longue traîne sur « ${picked[1]} »`,
        estimatedImpact: 6,
        priority: 2,
      },
      {
        title: `${picked[2]} : tendances et bonnes pratiques ${year}`,
        format: 'SEO',
        targetKeywords: [picked[2], sector || 'secteur'].filter(Boolean),
        reason: `Article d'autorité sur « ${picked[2]} »`,
        estimatedImpact: 6,
        priority: 3,
      },
    ];
  }

  const base = seoScore < 60 ? 'améliorer votre visibilité' : 'renforcer votre autorité';
  const kw = picked[0];
  return [
    {
      title: kw ? `${kw} : guide pratique ${year}` : `${brandName} : guide complet pour ${base}`,
      format: 'SEO',
      targetKeywords: kw ? [kw, brandName] : [brandName, 'guide'],
      reason: kw ? `Mot-clé prioritaire « ${kw} »` : 'Score SEO à renforcer — couvrir les mots-clés de marque',
      estimatedImpact: 6,
      priority: 1,
    },
    {
      title: kw ? `FAQ : tout savoir sur ${kw}` : `FAQ : tout savoir sur ${brandName}`,
      format: 'FAQ',
      targetKeywords: kw ? [kw, 'questions fréquentes'] : [brandName, 'questions fréquentes'],
      reason: 'Capturer la longue traîne et les requêtes LLM',
      estimatedImpact: 5,
      priority: 2,
    },
    {
      title: picked[1]
        ? `${picked[1]} vs alternatives : comment choisir ?`
        : `Pourquoi choisir ${brandName} en ${year} ?`,
      format: 'COMPARATIVE',
      targetKeywords: picked[1] ? [picked[1], 'comparatif'] : [brandName, 'avis'],
      reason: picked[1] ? `Comparatif sur « ${picked[1]} »` : 'Article de notoriété pour le canal SEO',
      estimatedImpact: 5,
      priority: 3,
    },
  ];
}
