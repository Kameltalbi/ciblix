import { Router, type NextFunction, type Response } from 'express';
import { z } from 'zod';
import auth, { AuthRequest, requirePaymentApproved } from '../middleware/auth.js';
import { checkAgentAccess } from '../middleware/planRestrictions.js';
import { prisma } from '../db/prisma.js';

export const scoutAiRoutes = Router();

scoutAiRoutes.get('/ping', (_req, res) => {
  res.status(200).json({ ok: true, module: 'scout-ai', at: new Date().toISOString() });
});

scoutAiRoutes.use(auth);
scoutAiRoutes.use(requirePaymentApproved);
scoutAiRoutes.use(checkAgentAccess('scout-ai'));

// ─── Helpers ────────────────────────────────────────────────

async function callOpenAI(prompt: string, systemPrompt: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OpenAI API key not configured');

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt },
      ],
      max_tokens: 2500,
      temperature: 0.3,
    }),
  });

  if (!response.ok) throw new Error(`OpenAI API error: ${await response.text()}`);
  const data = (await response.json()) as any;
  return data.choices?.[0]?.message?.content?.trim() || '';
}

async function searchWeb(query: string, num = 10): Promise<Array<{ title: string; link: string; snippet: string }>> {
  const apiKey = process.env.GOOGLE_CSE_API_KEY || process.env.GOOGLE_PLACES_API_KEY;
  const cseId = process.env.GOOGLE_CSE_ID;
  if (!apiKey || !cseId) return [];

  const params = new URLSearchParams({
    key: apiKey, cx: cseId, q: query,
    num: String(Math.min(num, 10)), lr: 'lang_fr', gl: 'tn',
  });

  try {
    const response = await fetch(`https://www.googleapis.com/customsearch/v1?${params}`);
    if (!response.ok) return [];
    const data = (await response.json()) as any;
    return (data.items || []).map((item: any) => ({
      title: item.title || '', link: item.link || '', snippet: item.snippet || '',
    }));
  } catch { return []; }
}

function buildSearchQueries(keywords: string[], sectors: string[], geoZones: string[], category: 'TENDER' | 'EVENT' | 'NEWS'): string[] {
  const geo = geoZones.length > 0 ? geoZones.join(' ') : 'Tunisie';
  const kw = keywords.join(' ');
  const sec = sectors.join(' ');

  switch (category) {
    case 'TENDER':
      return [
        `appel d'offres ${kw} ${geo} 2026`,
        `marché public ${kw} ${sec} ${geo}`,
        `consultation ${kw} ${geo} site:marchespublics.gov.tn OR site:tuneps.tn`,
      ];
    case 'EVENT':
      return [
        `salon conférence forum ${kw} ${sec} ${geo} 2026`,
        `événement professionnel ${kw} ${geo} 2026`,
        `webinaire formation ${sec} ${geo}`,
      ];
    case 'NEWS':
      return [
        `actualité ${kw} ${sec} ${geo}`,
        `réglementation ${kw} ${geo} 2026`,
        `investissement financement ${sec} ${geo}`,
      ];
  }
}

async function analyzeWithAI(
  rawResults: Array<{ title: string; link: string; snippet: string }>,
  keywords: string[],
  sectors: string[],
  category: string,
): Promise<Array<{
  index: number;
  relevanceScore: number;
  aiSummary: string;
  deadline: string | null;
  location: string | null;
  budget: string | null;
}>> {
  if (rawResults.length === 0) return [];

  const resultsText = rawResults
    .map((r, i) => `[${i + 1}] ${r.title}\nURL: ${r.link}\nExtrait: ${r.snippet}`)
    .join('\n\n');

  const categoryLabels: Record<string, string> = {
    TENDER: "appels d'offres et marchés publics",
    EVENT: 'événements professionnels (salons, conférences, forums)',
    NEWS: 'actualités sectorielles et signaux faibles',
  };

  const systemPrompt = `Tu es Scout AI, spécialisé dans la veille d'opportunités commerciales en Tunisie.
Tu analyses des résultats de recherche pour identifier les ${categoryLabels[category] || 'opportunités'}.

Pour chaque résultat pertinent, extrais:
- relevanceScore: 0-100 (pertinence par rapport aux mots-clés et secteurs)
- aiSummary: résumé actionnable en 2-3 phrases
- deadline: date limite si applicable (format DD/MM/YYYY) ou null
- location: lieu si mentionné ou null
- budget: montant si mentionné ou null

Réponds en JSON: [{"index": 1, "relevanceScore": 85, "aiSummary": "...", "deadline": null, "location": "Tunis", "budget": null}]
Ne retourne que les résultats avec relevanceScore >= 25.`;

  const prompt = `Catégorie: ${category}\nMots-clés: ${keywords.join(', ')}\nSecteurs: ${sectors.join(', ')}\n\nRésultats:\n${resultsText}`;

  try {
    const aiResponse = await callOpenAI(prompt, systemPrompt);
    const jsonMatch = aiResponse.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];
    return JSON.parse(jsonMatch[0]);
  } catch {
    return rawResults.map((_, i) => ({
      index: i + 1, relevanceScore: 40, aiSummary: '', deadline: null, location: null, budget: null,
    }));
  }
}

// ═══════════════════════════════════════════════════════════════
//  PROFIL DE VEILLE
// ═══════════════════════════════════════════════════════════════

const profileSchema = z.object({
  keywords: z.array(z.string()).min(1).max(20),
  sectors: z.array(z.string()).max(10).optional().default([]),
  geoZones: z.array(z.string()).max(10).optional().default([]),
  tenderEnabled: z.boolean().optional().default(true),
  eventEnabled: z.boolean().optional().default(true),
  newsEnabled: z.boolean().optional().default(true),
  autoScanEnabled: z.boolean().optional().default(false),
  scanIntervalH: z.number().min(6).max(168).optional().default(24),
});

scoutAiRoutes.get('/profile', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const profile = await prisma.scoutProfile.findUnique({
      where: { organizationId: req.organizationId! },
    });
    res.json({ profile });
  } catch (err) { next(err); }
});

scoutAiRoutes.post('/profile', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const data = profileSchema.parse(req.body);
    const profile = await prisma.scoutProfile.upsert({
      where: { organizationId: req.organizationId! },
      update: data,
      create: { organizationId: req.organizationId!, ...data },
    });
    res.json({ profile });
  } catch (err) { next(err); }
});

// ═══════════════════════════════════════════════════════════════
//  SCAN — Lance une recherche par catégorie
// ═══════════════════════════════════════════════════════════════

const scanSchema = z.object({
  category: z.enum(['TENDER', 'EVENT', 'NEWS']),
});

scoutAiRoutes.post('/scan', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { category } = scanSchema.parse(req.body);
    const orgId = req.organizationId!;

    const profile = await prisma.scoutProfile.findUnique({ where: { organizationId: orgId } });
    if (!profile) {
      res.status(400).json({ error: 'Configurez votre profil de veille d\'abord.' });
      return;
    }

    const keywords = profile.keywords as string[];
    const sectors = profile.sectors as string[];
    const geoZones = profile.geoZones as string[];

    const queries = buildSearchQueries(keywords, sectors, geoZones, category);

    const allRaw: Array<{ title: string; link: string; snippet: string }> = [];
    const seenUrls = new Set<string>();

    for (const q of queries) {
      const results = await searchWeb(q, 8);
      for (const r of results) {
        if (!seenUrls.has(r.link)) {
          seenUrls.add(r.link);
          allRaw.push(r);
        }
      }
    }

    const analyzed = await analyzeWithAI(allRaw, keywords, sectors, category);

    const opportunities = analyzed
      .filter((a) => a.relevanceScore >= 25 && allRaw[a.index - 1])
      .map((a) => {
        const raw = allRaw[a.index - 1];
        return {
          organizationId: orgId,
          category,
          title: raw.title,
          url: raw.link,
          source: (() => { try { return new URL(raw.link).hostname; } catch { return 'unknown'; } })(),
          snippet: raw.snippet,
          aiSummary: a.aiSummary || null,
          relevanceScore: Math.min(100, Math.max(0, a.relevanceScore)),
          deadline: a.deadline || null,
          location: a.location || null,
          budget: a.budget || null,
          searchQuery: queries[0],
          status: 'NEW',
        };
      })
      .sort((a, b) => b.relevanceScore - a.relevanceScore);

    // Upsert : eviter les doublons par URL
    const saved = [];
    for (const opp of opportunities) {
      const existing = await prisma.scoutOpportunity.findFirst({
        where: { organizationId: orgId, url: opp.url },
      });
      if (existing) {
        const updated = await prisma.scoutOpportunity.update({
          where: { id: existing.id },
          data: { relevanceScore: opp.relevanceScore, aiSummary: opp.aiSummary },
        });
        saved.push(updated);
      } else {
        const created = await prisma.scoutOpportunity.create({ data: opp as any });
        saved.push(created);
      }
    }

    await prisma.scoutProfile.update({
      where: { organizationId: orgId },
      data: { lastScanAt: new Date() },
    });

    res.json({
      opportunities: saved,
      meta: { totalRaw: allRaw.length, totalSaved: saved.length, category, scannedAt: new Date().toISOString() },
    });
  } catch (err) { next(err); }
});

/**
 * POST /api/scout-ai/scan-all
 * Lance un scan sur toutes les catégories activées du profil.
 */
scoutAiRoutes.post('/scan-all', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.organizationId!;
    const profile = await prisma.scoutProfile.findUnique({ where: { organizationId: orgId } });
    if (!profile) {
      res.status(400).json({ error: 'Configurez votre profil de veille d\'abord.' });
      return;
    }

    const categories: Array<'TENDER' | 'EVENT' | 'NEWS'> = [];
    if (profile.tenderEnabled) categories.push('TENDER');
    if (profile.eventEnabled) categories.push('EVENT');
    if (profile.newsEnabled) categories.push('NEWS');

    const allResults: any[] = [];

    for (const cat of categories) {
      const keywords = profile.keywords as string[];
      const sectors = profile.sectors as string[];
      const geoZones = profile.geoZones as string[];
      const queries = buildSearchQueries(keywords, sectors, geoZones, cat);

      const allRaw: Array<{ title: string; link: string; snippet: string }> = [];
      const seenUrls = new Set<string>();

      for (const q of queries) {
        const results = await searchWeb(q, 6);
        for (const r of results) {
          if (!seenUrls.has(r.link)) { seenUrls.add(r.link); allRaw.push(r); }
        }
      }

      const analyzed = await analyzeWithAI(allRaw, keywords, sectors, cat);

      for (const a of analyzed) {
        if (a.relevanceScore < 25 || !allRaw[a.index - 1]) continue;
        const raw = allRaw[a.index - 1];
        const existing = await prisma.scoutOpportunity.findFirst({ where: { organizationId: orgId, url: raw.link } });
        if (!existing) {
          const created = await prisma.scoutOpportunity.create({
            data: {
              organizationId: orgId, category: cat, title: raw.title, url: raw.link,
              source: (() => { try { return new URL(raw.link).hostname; } catch { return 'unknown'; } })(),
              snippet: raw.snippet, aiSummary: a.aiSummary || null,
              relevanceScore: Math.min(100, Math.max(0, a.relevanceScore)),
              deadline: a.deadline, location: a.location, budget: a.budget,
              searchQuery: queries[0], status: 'NEW',
            },
          });
          allResults.push(created);
        }
      }
    }

    await prisma.scoutProfile.update({
      where: { organizationId: orgId },
      data: { lastScanAt: new Date() },
    });

    res.json({ newOpportunities: allResults.length, categories, scannedAt: new Date().toISOString() });
  } catch (err) { next(err); }
});

// ═══════════════════════════════════════════════════════════════
//  OPPORTUNITES — CRUD + filtres
// ═══════════════════════════════════════════════════════════════

scoutAiRoutes.get('/opportunities', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.organizationId!;
    const category = req.query.category as string | undefined;
    const status = req.query.status as string | undefined;
    const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 50));
    const offset = Math.max(0, Number(req.query.offset) || 0);

    const where: any = { organizationId: orgId };
    if (category && ['TENDER', 'EVENT', 'NEWS'].includes(category)) where.category = category;
    if (status && ['NEW', 'SAVED', 'DISMISSED', 'APPLIED'].includes(status)) where.status = status;

    const [opportunities, total] = await Promise.all([
      prisma.scoutOpportunity.findMany({
        where, orderBy: [{ relevanceScore: 'desc' }, { createdAt: 'desc' }],
        take: limit, skip: offset,
      }),
      prisma.scoutOpportunity.count({ where }),
    ]);

    const counts = await prisma.scoutOpportunity.groupBy({
      by: ['category'],
      where: { organizationId: orgId },
      _count: { id: true },
    });

    const statusCounts = await prisma.scoutOpportunity.groupBy({
      by: ['status'],
      where: { organizationId: orgId },
      _count: { id: true },
    });

    res.json({
      opportunities, total,
      categoryCounts: Object.fromEntries(counts.map((c) => [c.category, c._count.id])),
      statusCounts: Object.fromEntries(statusCounts.map((c) => [c.status, c._count.id])),
    });
  } catch (err) { next(err); }
});

/**
 * PATCH /api/scout-ai/opportunities/:id/status
 * Change le statut d'une opportunité (SAVED, DISMISSED, APPLIED).
 */
const statusSchema = z.object({
  status: z.enum(['NEW', 'SAVED', 'DISMISSED', 'APPLIED']),
});

scoutAiRoutes.patch('/opportunities/:id/status', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { status } = statusSchema.parse(req.body);

    const opp = await prisma.scoutOpportunity.updateMany({
      where: { id, organizationId: req.organizationId! },
      data: { status },
    });

    if (opp.count === 0) { res.status(404).json({ error: 'Not found' }); return; }
    res.json({ updated: true });
  } catch (err) { next(err); }
});

/**
 * POST /api/scout-ai/analyze-url
 * Analyse une URL spécifique.
 */
const analyzeUrlSchema = z.object({ url: z.string().url(), context: z.string().optional().default('') });

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
        pageContent = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
          .replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 5000);
      }
    } catch { /* ignore */ }

    const systemPrompt = `Tu es Scout AI. Analyse cette page et extrais les informations d'opportunité.
Réponds en JSON:
{"type":"TENDER|EVENT|NEWS|OTHER","title":"...","summary":"résumé 2-3 phrases","deadline":"DD/MM/YYYY ou null","budget":"montant ou null","location":"lieu","organizer":"organisme","requirements":["..."],"relevance":"pourquoi pertinent","actionItems":["action 1","action 2"]}`;

    const prompt = `URL: ${url}\n${context ? `Contexte: ${context}\n` : ''}Contenu:\n${pageContent || '(non accessible)'}`;
    const aiResponse = await callOpenAI(prompt, systemPrompt);
    const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
    let analysis = null;
    if (jsonMatch) { try { analysis = JSON.parse(jsonMatch[0]); } catch { analysis = { summary: aiResponse }; } }

    res.json({ url, analysis, analyzedAt: new Date().toISOString() });
  } catch (err) { next(err); }
});

/**
 * GET /api/scout-ai/stats
 * Statistiques du tableau de bord Scout.
 */
scoutAiRoutes.get('/stats', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.organizationId!;

    const [total, newCount, savedCount, byCat, profile] = await Promise.all([
      prisma.scoutOpportunity.count({ where: { organizationId: orgId } }),
      prisma.scoutOpportunity.count({ where: { organizationId: orgId, status: 'NEW' } }),
      prisma.scoutOpportunity.count({ where: { organizationId: orgId, status: 'SAVED' } }),
      prisma.scoutOpportunity.groupBy({ by: ['category'], where: { organizationId: orgId }, _count: { id: true } }),
      prisma.scoutProfile.findUnique({ where: { organizationId: orgId }, select: { lastScanAt: true, autoScanEnabled: true } }),
    ]);

    res.json({
      total, newCount, savedCount,
      byCategory: Object.fromEntries(byCat.map((c) => [c.category, c._count.id])),
      lastScanAt: profile?.lastScanAt,
      autoScanEnabled: profile?.autoScanEnabled ?? false,
    });
  } catch (err) { next(err); }
});
