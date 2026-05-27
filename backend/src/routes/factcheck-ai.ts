import { Router, type NextFunction, type Response } from 'express';
import { z } from 'zod';
import auth, { AuthRequest, requirePaymentApproved } from '../middleware/auth.js';
import { checkAgentAccess } from '../middleware/planRestrictions.js';

export const factcheckAiRoutes = Router();

factcheckAiRoutes.get('/ping', (_req, res) => {
  res.status(200).json({ ok: true, module: 'factcheck-ai', at: new Date().toISOString() });
});

factcheckAiRoutes.use(auth);
factcheckAiRoutes.use(requirePaymentApproved);
factcheckAiRoutes.use(checkAgentAccess('factcheck-ai'));

// ─── Helpers ────────────────────────────────────────────────

async function callOpenAI(prompt: string, systemPrompt: string, maxTokens = 2000): Promise<string> {
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
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt },
      ],
      max_tokens: maxTokens,
      temperature: 0.2,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI API error: ${error}`);
  }

  const data = (await response.json()) as any;
  return data.choices?.[0]?.message?.content?.trim() || '';
}

async function searchWeb(query: string, num = 8): Promise<Array<{ title: string; link: string; snippet: string }>> {
  const apiKey = process.env.GOOGLE_CSE_API_KEY || process.env.GOOGLE_PLACES_API_KEY;
  const cseId = process.env.GOOGLE_CSE_ID;

  if (!apiKey || !cseId) return [];

  const params = new URLSearchParams({
    key: apiKey,
    cx: cseId,
    q: query,
    num: String(Math.min(num, 10)),
  });

  try {
    const response = await fetch(`https://www.googleapis.com/customsearch/v1?${params}`);
    if (!response.ok) return [];
    const data = (await response.json()) as any;
    return (data.items || []).map((item: any) => ({
      title: item.title || '',
      link: item.link || '',
      snippet: item.snippet || '',
    }));
  } catch {
    return [];
  }
}

async function fetchPageContent(url: string): Promise<string> {
  try {
    const resp = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CiblixFactCheck/1.0)' },
      signal: AbortSignal.timeout(8000),
    });
    if (!resp.ok) return '';
    const html = await resp.text();
    return html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 3000);
  } catch {
    return '';
  }
}

// ─── Routes ─────────────────────────────────────────────────

const checkClaimSchema = z.object({
  claim: z.string().min(5).max(2000),
  language: z.enum(['fr', 'en', 'ar']).optional().default('fr'),
});

/**
 * POST /api/factcheck-ai/check
 * Verifie une affirmation en croisant des sources web.
 */
factcheckAiRoutes.post('/check', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { claim, language } = checkClaimSchema.parse(req.body);

    const searchQueries = [
      claim,
      `"${claim.slice(0, 80)}" vérification`,
      `${claim.slice(0, 60)} fact check`,
    ];

    const allResults: Array<{ title: string; link: string; snippet: string }> = [];
    const seenUrls = new Set<string>();

    for (const q of searchQueries) {
      const results = await searchWeb(q, 5);
      for (const r of results) {
        if (!seenUrls.has(r.link)) {
          seenUrls.add(r.link);
          allResults.push(r);
        }
      }
    }

    const topResults = allResults.slice(0, 8);
    const sourceContents: Array<{ url: string; title: string; content: string }> = [];

    const fetchPromises = topResults.slice(0, 4).map(async (r) => {
      const content = await fetchPageContent(r.link);
      if (content) {
        sourceContents.push({ url: r.link, title: r.title, content: content.slice(0, 2000) });
      }
    });
    await Promise.all(fetchPromises);

    const langMap: Record<string, string> = {
      fr: 'Réponds en français.',
      en: 'Réponds en anglais.',
      ar: 'Réponds en arabe.',
    };

    const systemPrompt = `Tu es FactCheck AI, un agent spécialisé dans la vérification d'informations.
Tu analyses les sources fournies et donnes un verdict clair et argumenté.
${langMap[language]}

Réponds UNIQUEMENT en JSON valide:
{
  "verdict": "TRUE" | "FALSE" | "PARTIALLY_TRUE" | "UNVERIFIABLE" | "MISLEADING",
  "confidence": number (0-100),
  "summary": "Résumé clair du verdict en 2-3 phrases",
  "analysis": "Analyse détaillée avec arguments pour et contre",
  "sources": [
    {
      "url": "url de la source",
      "title": "titre",
      "stance": "SUPPORTS" | "CONTRADICTS" | "NEUTRAL",
      "keyQuote": "extrait pertinent de la source"
    }
  ],
  "context": "Contexte important à connaître pour comprendre cette affirmation",
  "recommendation": "Recommandation: que faire avec cette information"
}`;

    const sourcesText = topResults
      .map((r, i) => {
        const fetched = sourceContents.find((s) => s.url === r.link);
        return `[Source ${i + 1}] ${r.title}\nURL: ${r.link}\nExtrait: ${r.snippet}${fetched ? `\nContenu: ${fetched.content.slice(0, 800)}` : ''}`;
      })
      .join('\n\n');

    const prompt = `AFFIRMATION À VÉRIFIER:
"${claim}"

SOURCES TROUVÉES:
${sourcesText || '(Aucune source trouvée)'}

Analyse ces sources et donne ton verdict sur l'affirmation.`;

    const aiResponse = await callOpenAI(prompt, systemPrompt, 2500);
    const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);

    let result: any = null;
    if (jsonMatch) {
      try {
        result = JSON.parse(jsonMatch[0]);
      } catch {
        result = {
          verdict: 'UNVERIFIABLE',
          confidence: 0,
          summary: aiResponse,
          analysis: '',
          sources: [],
          context: '',
          recommendation: '',
        };
      }
    } else {
      result = {
        verdict: 'UNVERIFIABLE',
        confidence: 0,
        summary: aiResponse || 'Impossible d\'analyser cette affirmation.',
        analysis: '',
        sources: [],
        context: '',
        recommendation: '',
      };
    }

    res.json({
      claim,
      result,
      meta: {
        sourcesFound: allResults.length,
        sourcesFetched: sourceContents.length,
        checkedAt: new Date().toISOString(),
      },
    });
  } catch (err) {
    next(err);
  }
});

const checkUrlSchema = z.object({
  url: z.string().url(),
  language: z.enum(['fr', 'en', 'ar']).optional().default('fr'),
});

/**
 * POST /api/factcheck-ai/check-url
 * Analyse la fiabilite d'un article/page web.
 */
factcheckAiRoutes.post('/check-url', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { url, language } = checkUrlSchema.parse(req.body);

    const content = await fetchPageContent(url);

    const langMap: Record<string, string> = { fr: 'Réponds en français.', en: 'Réponds en anglais.', ar: 'Réponds en arabe.' };

    const systemPrompt = `Tu es FactCheck AI. Analyse cette page web et évalue sa fiabilité.
${langMap[language]}

Réponds en JSON:
{
  "reliability": "HIGH" | "MEDIUM" | "LOW" | "UNKNOWN",
  "score": number (0-100),
  "title": "titre de l'article",
  "mainClaims": ["affirmation principale 1", "affirmation 2"],
  "analysis": "analyse détaillée de la fiabilité",
  "redFlags": ["signal d'alerte 1"],
  "positiveSignals": ["signal positif 1"],
  "sourceType": "MEDIA" | "BLOG" | "GOVERNMENT" | "ACADEMIC" | "SOCIAL" | "COMMERCIAL" | "UNKNOWN",
  "recommendation": "recommandation"
}`;

    const prompt = `URL: ${url}

Contenu de la page:
${content || '(Contenu non accessible)'}`;

    const aiResponse = await callOpenAI(prompt, systemPrompt);
    const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);

    let analysis: any = null;
    if (jsonMatch) {
      try {
        analysis = JSON.parse(jsonMatch[0]);
      } catch {
        analysis = { reliability: 'UNKNOWN', score: 0, analysis: aiResponse };
      }
    }

    res.json({ url, analysis, checkedAt: new Date().toISOString() });
  } catch (err) {
    next(err);
  }
});
