import { callOpenAI, parseJsonFromLlm } from './llm.js';
import type { ArticleFormat } from './types.js';

export interface GeneratedArticle {
  title: string;
  slug: string;
  metaTitle: string;
  metaDescription: string;
  contentMarkdown: string;
  estimatedSeoScore: number;
}

interface ArticleLlmResponse {
  title: string;
  slug: string;
  metaTitle: string;
  metaDescription: string;
  contentMarkdown: string;
  estimatedSeoScore: number;
}

const FORMAT_HINTS: Record<ArticleFormat, string> = {
  SEO: '800-1500 mots, structure H2/H3, mot-clé principal dans H1 et introduction',
  LONGFORM: '2000-3500 mots, guide approfondi avec sections détaillées',
  FAQ: '600-1000 mots, format questions/réponses numérotées',
  COMPARATIVE: '1000-2000 mots, comparatif marque vs concurrent, tableau si pertinent',
};

export async function generateArticle(params: {
  brandName: string;
  sector: string | null;
  editorialTone: string;
  format: ArticleFormat;
  topicTitle: string;
  targetKeywords: string[];
  websiteUrl: string;
}): Promise<GeneratedArticle> {
  const systemPrompt = `Tu es BrandPulse AI, rédacteur SEO expert en français.
Rédige un article de blog complet en markdown.
Ton éditorial: ${params.editorialTone}.
${FORMAT_HINTS[params.format]}
Inclus: H1, introduction, corps H2/H3, CTA final, maillage vers ${params.websiteUrl}.
Réponds UNIQUEMENT en JSON: { "title", "slug", "metaTitle", "metaDescription", "contentMarkdown", "estimatedSeoScore": 0-100 }`;

  const userPrompt = `Marque: ${params.brandName}
Secteur: ${params.sector || 'général'}
Sujet: ${params.topicTitle}
Mots-clés: ${params.targetKeywords.join(', ')}`;

  const raw = await callOpenAI(userPrompt, systemPrompt, 4000, 0.55);
  const parsed = parseJsonFromLlm<ArticleLlmResponse>(raw);

  if (parsed?.contentMarkdown) {
    return {
      title: parsed.title || params.topicTitle,
      slug: parsed.slug || slugify(parsed.title || params.topicTitle),
      metaTitle: parsed.metaTitle || parsed.title || params.topicTitle,
      metaDescription: parsed.metaDescription || '',
      contentMarkdown: parsed.contentMarkdown,
      estimatedSeoScore: Math.min(100, Math.max(0, Number(parsed.estimatedSeoScore) || 70)),
    };
  }

  return {
    title: params.topicTitle,
    slug: slugify(params.topicTitle),
    metaTitle: `${params.topicTitle} | ${params.brandName}`,
    metaDescription: `Découvrez ${params.topicTitle} — ${params.brandName}.`,
    contentMarkdown: `# ${params.topicTitle}\n\nArticle en cours de génération. Réessayez dans quelques instants.`,
    estimatedSeoScore: 50,
  };
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
}
