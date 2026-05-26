import { Router, type NextFunction, type Response } from 'express';
import { z } from 'zod';
import auth, { AuthRequest, requirePaymentApproved } from '../middleware/auth.js';
import { prisma } from '../db/prisma.js';

export const scoutAiRoutes = Router();

scoutAiRoutes.get('/ping', (_req, res) => {
  res.status(200).json({ ok: true, module: 'scout-ai', at: new Date().toISOString() });
});

scoutAiRoutes.use(auth);
scoutAiRoutes.use(requirePaymentApproved);

// ─── Types ──────────────────────────────────────────────────
interface ScoutResult {
  id: string;
  title: string;
  url: string;
  source: string;
  snippet: string;
  publishedAt: string | null;
  category: 'TENDER' | 'EVENT' | 'NEWS' | 'OTHER';
  relevanceScore: number;
  aiSummary: string | null;
  deadline: string | null;
  location: string | null;
  budget: string | null;
}

// ─── Helpers ────────────────────────────────────────────────

async function callOpenAI(prompt: string, systemPrompt?: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OpenAI API key not configured');

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
        { role: 'user', content: prompt },
      ],
      max_tokens: 2000,
      temperature: 0.3,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI API error: ${error}`);
  }

  const data = (await response.json()) as any;
  return data.choices?.[0]?.message?.content?.trim() || '';
}

/**
 * Recherche web via Google Custom Search JSON API.
 * Necessite GOOGLE_CSE_API_KEY et GOOGLE_CSE_ID dans .env
 * Fallback: retourne un tableau vide si non configure.
 */
async function searchWeb(query: string, num = 10): Promise<Array<{ title: string; link: string; snippet: string }>> {
  const apiKey = process.env.GOOGLE_CSE_API_KEY || process.env.GOOGLE_PLACES_API_KEY;
  const cseId = process.env.GOOGLE_CSE_ID;

  if (!apiKey || !cseId) {
    return searchWebFallback(query);
  }

  const params = new URLSearchParams({
    key: apiKey,
    cx: cseId,
    q: query,
    num: String(Math.min(num, 10)),
    lr: 'lang_fr',
    gl: 'tn',
  });

  const response = await fetch(`https://www.googleapis.com/customsearch/v1?${params}`);
  if (!response.ok) {
    console.warn('[Scout AI] Google CSE error, falling back', await response.text());
    return searchWebFallback(query);
  }

  const data = (await response.json()) as any;
  return (data.items || []).map((item: any) => ({
    title: item.title || '',
    link: item.link || '',
    snippet: item.snippet || '',
  }));
}

/**
 * Fallback: scrape les resultats depuis des sources connues d'appels d'offres tunisiens
 */
async function searchWebFallback(query: string): Promise<Array<{ title: string; link: string; snippet: string }>> {
  const results: Array<{ title: string; link: string; snippet: string }> = [];

  const sources = [
    `https://www.marchespublics.gov.tn/onmp/consultation/search?query=${encodeURIComponent(query)}`,
    `https://www.tuneps.tn`,
  ];

  for (const url of sources) {
    try {
      const resp = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CiblixScout/1.0)' },
        signal: AbortSignal.timeout(8000),
      });
      if (!resp.ok) continue;
      const html = await resp.text();

      const titleMatches = html.match(/<title[^>]*>([^<]+)<\/title>/i);
      if (titleMatches) {
        results.push({
          title: titleMatches[1].trim(),
          link: url,
          snippet: `Source: ${new URL(url).hostname}`,
        });
      }
    } catch {
      // ignore timeout / fetch errors
    }
  }

  return results;
}

/**
 * Analyse les resultats bruts avec l'IA pour extraire les opportunites structurees.
 */
async function analyzeResultsWithAI(
  rawResults: Array<{ title: string; link: string; snippet: string }>,
  keywords: string[],
  sectors: string[],
): Promise<ScoutResult[]> {
  if (rawResults.length === 0) return [];

  const resultsText = rawResults
    .map((r, i) => `[${i + 1}] Titre: ${r.title}\nURL: ${r.link}\nExtrait: ${r.snippet}`)
    .join('\n\n');

  const systemPrompt = `Tu es Scout AI, un agent spécialisé dans la veille d'opportunités commerciales en Tunisie.
Analyse les résultats de recherche et identifie les opportunités pertinentes.

Pour chaque résultat pertinent, extrais:
- category: TENDER (appel d'offres), EVENT (salon/conférence/forum), NEWS (actualité secteur), OTHER
- relevanceScore: 0-100 (pertinence par rapport aux mots-clés et secteurs)
- aiSummary: résumé en 1-2 phrases
- deadline: date limite si mentionnée (format ISO ou null)
- location: lieu si mentionné
- budget: budget si mentionné

Réponds UNIQUEMENT en JSON valide, un tableau d'objets:
[{"index": 1, "category": "TENDER", "relevanceScore": 85, "aiSummary": "...", "deadline": null, "location": "Tunis", "budget": null}]

Ne retourne que les résultats avec relevanceScore >= 30.`;

  const prompt = `Mots-clés de veille: ${keywords.join(', ')}
Secteurs: ${sectors.join(', ')}

Résultats à analyser:
${resultsText}`;

  try {
    const aiResponse = await callOpenAI(prompt, systemPrompt);
    const jsonMatch = aiResponse.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];

    const analyzed: Array<{
      index: number;
      category: string;
      relevanceScore: number;
      aiSummary: string;
      deadline: string | null;
      location: string | null;
      budget: string | null;
    }> = JSON.parse(jsonMatch[0]);

    return analyzed
      .filter((a) => a.relevanceScore >= 30)
      .map((a) => {
        const raw = rawResults[a.index - 1];
        if (!raw) return null;
        return {
          id: `scout-${Date.now()}-${a.index}`,
          title: raw.title,
          url: raw.link,
          source: new URL(raw.link).hostname,
          snippet: raw.snippet,
          publishedAt: null,
          category: (['TENDER', 'EVENT', 'NEWS', 'OTHER'].includes(a.category) ? a.category : 'OTHER') as ScoutResult['category'],
          relevanceScore: Math.min(100, Math.max(0, a.relevanceScore)),
          aiSummary: a.aiSummary || null,
          deadline: a.deadline || null,
          location: a.location || null,
          budget: a.budget || null,
        };
      })
      .filter(Boolean) as ScoutResult[];
  } catch (err) {
    console.error('[Scout AI] AI analysis error:', err);
    return rawResults.map((r, i) => ({
      id: `scout-${Date.now()}-${i}`,
      title: r.title,
      url: r.link,
      source: new URL(r.link).hostname,
      snippet: r.snippet,
      publishedAt: null,
      category: 'OTHER' as const,
      relevanceScore: 50,
      aiSummary: null,
      deadline: null,
      location: null,
      budget: null,
    }));
  }
}

// ─── Routes ─────────────────────────────────────────────────

const searchSchema = z.object({
  keywords: z.array(z.string().min(1)).min(1).max(10),
  sectors: z.array(z.string()).optional().default([]),
  country: z.string().optional().default('Tunisie'),
  categories: z.array(z.enum(['TENDER', 'EVENT', 'NEWS', 'ALL'])).optional().default(['ALL']),
});

/**
 * POST /api/scout-ai/search
 * Lance une recherche de veille sur les appels d'offres et evenements.
 */
scoutAiRoutes.post('/search', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const data = searchSchema.parse(req.body);
    const { keywords, sectors, country, categories } = data;

    const searchQueries: string[] = [];

    const wantAll = categories.includes('ALL');
    if (wantAll || categories.includes('TENDER')) {
      searchQueries.push(`appel d'offres ${keywords.join(' ')} ${country} 2026`);
      searchQueries.push(`marché public ${keywords.join(' ')} ${country}`);
    }
    if (wantAll || categories.includes('EVENT')) {
      searchQueries.push(`salon conférence forum ${keywords.join(' ')} ${country} 2026`);
    }
    if (wantAll || categories.includes('NEWS')) {
      searchQueries.push(`actualité ${keywords.join(' ')} ${sectors.join(' ')} ${country}`);
    }

    const allRawResults: Array<{ title: string; link: string; snippet: string }> = [];
    const seenUrls = new Set<string>();

    for (const query of searchQueries) {
      const results = await searchWeb(query, 10);
      for (const r of results) {
        if (!seenUrls.has(r.link)) {
          seenUrls.add(r.link);
          allRawResults.push(r);
        }
      }
    }

    const analyzed = await analyzeResultsWithAI(allRawResults, keywords, sectors);

    analyzed.sort((a, b) => b.relevanceScore - a.relevanceScore);

    res.json({
      results: analyzed,
      meta: {
        totalRaw: allRawResults.length,
        totalAnalyzed: analyzed.length,
        queries: searchQueries,
        searchedAt: new Date().toISOString(),
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/scout-ai/saved
 * Recupere les opportunites sauvegardees par l'organisation.
 */
scoutAiRoutes.get('/saved', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.organizationId!;
    const saved = await prisma.notification.findMany({
      where: {
        userId: req.userId!,
        type: 'SCOUT_OPPORTUNITY',
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    const opportunities = saved.map((n) => ({
      id: n.id,
      ...(typeof n.data === 'object' && n.data !== null ? n.data : {}),
      savedAt: n.createdAt,
    }));

    res.json({ opportunities });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/scout-ai/save
 * Sauvegarde une opportunite detectee.
 */
const saveSchema = z.object({
  title: z.string().min(1),
  url: z.string().url(),
  source: z.string(),
  category: z.enum(['TENDER', 'EVENT', 'NEWS', 'OTHER']),
  relevanceScore: z.number().min(0).max(100),
  aiSummary: z.string().nullable().optional(),
  deadline: z.string().nullable().optional(),
  location: z.string().nullable().optional(),
  budget: z.string().nullable().optional(),
});

scoutAiRoutes.post('/save', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const data = saveSchema.parse(req.body);

    const notification = await prisma.notification.create({
      data: {
        userId: req.userId!,
        type: 'SCOUT_OPPORTUNITY' as any,
        title: `Scout AI: ${data.title}`,
        message: data.aiSummary || `${data.category} — ${data.source}`,
        data: data as any,
      },
    });

    res.json({ saved: true, id: notification.id });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/scout-ai/analyze-url
 * Analyse une URL specifique pour extraire les informations d'opportunite.
 */
const analyzeUrlSchema = z.object({
  url: z.string().url(),
  context: z.string().optional().default(''),
});

scoutAiRoutes.post('/analyze-url', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { url, context } = analyzeUrlSchema.parse(req.body);

    let pageContent = '';
    try {
      const resp = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CiblixScout/1.0)' },
        signal: AbortSignal.timeout(10000),
      });
      if (resp.ok) {
        const html = await resp.text();
        pageContent = html
          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 5000);
      }
    } catch {
      // ignore fetch errors
    }

    const systemPrompt = `Tu es Scout AI, spécialisé dans l'analyse d'opportunités commerciales en Tunisie.
Analyse le contenu de cette page et extrais les informations clés.

Réponds en JSON:
{
  "type": "TENDER|EVENT|NEWS|OTHER",
  "title": "titre de l'opportunité",
  "summary": "résumé en 2-3 phrases",
  "deadline": "date limite si applicable (format DD/MM/YYYY) ou null",
  "budget": "montant si mentionné ou null",
  "location": "lieu si mentionné",
  "organizer": "organisme/entreprise qui publie",
  "requirements": ["condition 1", "condition 2"],
  "relevance": "pourquoi c'est pertinent pour une entreprise de conseil en Tunisie",
  "actionItems": ["action recommandée 1", "action recommandée 2"]
}`;

    const prompt = `URL: ${url}
${context ? `Contexte: ${context}` : ''}

Contenu de la page:
${pageContent || '(contenu non accessible)'}`;

    const aiResponse = await callOpenAI(prompt, systemPrompt);
    const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);

    let analysis = null;
    if (jsonMatch) {
      try {
        analysis = JSON.parse(jsonMatch[0]);
      } catch {
        analysis = { summary: aiResponse };
      }
    }

    res.json({ url, analysis, analyzedAt: new Date().toISOString() });
  } catch (err) {
    next(err);
  }
});
