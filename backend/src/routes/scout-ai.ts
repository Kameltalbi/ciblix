import { Router, type NextFunction, type Response } from 'express';
import { z } from 'zod';
import auth, { AuthRequest, requirePaymentApproved } from '../middleware/auth.js';
import { checkAgentAccess } from '../middleware/planRestrictions.js';
import { prisma } from '../db/prisma.js';
import { tryConsumeAgentQuota } from '../services/agentUsage.js';
import { recordScoutOpportunity } from '../services/agent-memory/agentIntegrations.js';
import { isPastScoutOpportunity } from '../services/scout/scoutFreshness.js';

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

type SearchHit = { title: string; link: string; snippet: string };

async function searchGoogleCse(query: string, num: number, gl: string): Promise<SearchHit[]> {
  const apiKey = process.env.GOOGLE_CSE_API_KEY || process.env.GOOGLE_PLACES_API_KEY;
  const cseId = process.env.GOOGLE_CSE_ID;
  if (!apiKey || !cseId) {
    console.warn('[scout-ai] GOOGLE_CSE_API_KEY / GOOGLE_CSE_ID manquants');
    return [];
  }

  const run = async (useGl: string) => {
    const params = new URLSearchParams({
      key: apiKey,
      cx: cseId,
      q: query,
      num: String(Math.min(num, 10)),
      lr: 'lang_fr',
    });
    if (useGl) params.set('gl', useGl);

    const response = await fetch(`https://www.googleapis.com/customsearch/v1?${params}`);
    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      console.warn(`[scout-ai] CSE HTTP ${response.status}: ${errText.slice(0, 240)}`);
      return [] as SearchHit[];
    }
    const data = (await response.json()) as {
      items?: Array<{ title?: string; link?: string; snippet?: string }>;
      searchInformation?: { totalResults?: string };
      error?: { message?: string };
    };
    if (data.error?.message) {
      console.warn(`[scout-ai] CSE error body: ${data.error.message}`);
    }
    console.log(
      `[scout-ai] CSE q="${query}" gl=${useGl || '—'} totalReported=${data.searchInformation?.totalResults ?? '?'} items=${data.items?.length ?? 0}`
    );
    return (data.items || []).map((item) => ({
      title: item.title || '',
      link: item.link || '',
      snippet: item.snippet || '',
    }));
  };

  let hits = await run(gl);
  if (hits.length === 0 && gl) hits = await run('');
  return hits;
}

async function searchSerper(query: string, num: number, gl: string): Promise<SearchHit[]> {
  const apiKey = process.env.SERPER_API_KEY?.trim();
  if (!apiKey) return [];
  try {
    const res = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-KEY': apiKey },
      body: JSON.stringify({ q: query, num: Math.min(num, 10), gl: gl || 'fr', hl: 'fr' }),
    });
    if (!res.ok) {
      console.warn(`[scout-ai] Serper HTTP ${res.status}`);
      return [];
    }
    const data = (await res.json()) as {
      organic?: Array<{ title?: string; link?: string; snippet?: string }>;
    };
    const hits = (data.organic || []).map((item) => ({
      title: item.title || '',
      link: item.link || '',
      snippet: item.snippet || '',
    }));
    console.log(`[scout-ai] Serper q="${query}" → ${hits.length}`);
    return hits;
  } catch (err) {
    console.warn('[scout-ai] Serper error', err);
    return [];
  }
}

/** Fallback gratuit si CSE/Serper ne renvoient rien. */
async function searchDuckDuckGo(query: string, num: number): Promise<SearchHit[]> {
  try {
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    const res = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (compatible; CiblixScout/1.0; +https://ciblix.com)',
        Accept: 'text/html',
      },
    });
    if (!res.ok) {
      console.warn(`[scout-ai] DDG HTTP ${res.status}`);
      return [];
    }
    const html = await res.text();
    const hits: SearchHit[] = [];
    const re =
      /class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?class="result__snippet"[^>]*>([\s\S]*?)<\/(?:a|td)/gi;
    let m: RegExpExecArray | null;
    const decode = (s: string) =>
      s
        .replace(/<[^>]+>/g, '')
        .replace(/&amp;/g, '&')
        .replace(/&#x27;/g, "'")
        .replace(/&quot;/g, '"')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .trim();

    while ((m = re.exec(html)) && hits.length < num) {
      let link = m[1];
      // DDG wraps redirects: /l/?uddg=<encoded>
      try {
        const u = new URL(link, 'https://duckduckgo.com');
        const uddg = u.searchParams.get('uddg');
        if (uddg) link = decodeURIComponent(uddg);
      } catch {
        /* keep raw */
      }
      const title = decode(m[2]);
      const snippet = decode(m[3]);
      if (link.startsWith('http') && title) {
        hits.push({ title, link, snippet });
      }
    }
    console.log(`[scout-ai] DDG q="${query}" → ${hits.length}`);
    return hits;
  } catch (err) {
    console.warn('[scout-ai] DDG error', err);
    return [];
  }
}

async function searchWeb(query: string, num = 10, gl = ''): Promise<SearchHit[]> {
  // 1) Google CSE
  let hits = await searchGoogleCse(query, num, gl);
  if (hits.length > 0) return hits;

  // 2) Serper (si clé)
  hits = await searchSerper(query, num, gl);
  if (hits.length > 0) return hits;

  // 3) DuckDuckGo fallback — pour que l'agent ne reste pas à 0
  hits = await searchDuckDuckGo(query, num);
  return hits;
}

function inferSearchGl(geoZones: string[], marketCountry?: string | null): string {
  const marketGl: Record<string, string> = {
    TN: 'tn',
    FR: 'fr',
    DZ: 'dz',
    MA: 'ma',
    BE: 'be',
    CA: 'ca',
    SN: 'sn',
    CI: 'ci',
  };
  if (marketCountry && marketGl[marketCountry]) return marketGl[marketCountry];

  const hay = geoZones.join(' ').toLowerCase();
  if (/tunis|nabeul|sfax|sousse|tunisie|hammamet|monastir/.test(hay)) return 'tn';
  if (/paris|lyon|marseille|france|lille|toulouse/.test(hay)) return 'fr';
  if (/alger|oran|algérie|algerie/.test(hay)) return 'dz';
  if (/casablanca|rabat|maroc|marrakech/.test(hay)) return 'ma';
  if (/bruxelles|belgique|anvers/.test(hay)) return 'be';
  if (/montréal|montreal|canada|toronto|québec|quebec/.test(hay)) return 'ca';
  if (/dakar|sénégal|senegal/.test(hay)) return 'sn';
  if (/abidjan|côte d|cote d/.test(hay)) return 'ci';
  return '';
}

function buildSearchQueries(
  keywords: string[],
  sectors: string[],
  geoZones: string[],
  category: 'TENDER' | 'EVENT' | 'NEWS'
): string[] {
  // Requêtes courtes = bien plus de hits CSE qu'une phrase surchargée
  const kw = keywords.slice(0, 2).join(' ') || 'entreprise';
  const sec = sectors.slice(0, 1).join(' ');
  const geo = geoZones.slice(0, 2).join(' ');
  const year = new Date().getFullYear();

  const queries: string[] = [];
  switch (category) {
    case 'TENDER':
      queries.push(`appel d'offres ${kw} ${geo}`.trim());
      queries.push(`marché public ${kw} ${geo || sec}`.trim());
      if (/tunisie|tunis|sfax|sousse|nabeul/i.test(geo)) {
        queries.push(`${kw} site:marchespublics.gov.tn`);
      } else if (/france|paris|lyon/i.test(geo)) {
        queries.push(`${kw} appel d'offres site:boamp.fr OR site:marches-publics.gouv.fr`);
      } else {
        queries.push(`appel d'offres ${kw} ${sec} ${geo} ${year}`.trim());
      }
      break;
    case 'EVENT':
      queries.push(`salon ${kw} ${geo} ${year}`.trim());
      queries.push(`conférence ${kw} ${geo || sec} ${year}`.trim());
      queries.push(`forum professionnel ${sec || kw} ${geo} ${year} à venir`.trim());
      break;
    case 'NEWS':
      queries.push(`actualité ${kw} ${geo}`.trim());
      queries.push(`${kw} ${sec} ${geo} ${year}`.trim());
      queries.push(`investissement ${kw} ${geo || sec}`.trim());
      break;
  }
  return [...new Set(queries.filter((q) => q.replace(/\s+/g, ' ').trim().length > 3))];
}

/** Événement / AO déjà passé → à jeter (AI score bas ou date détectée dans le texte). */
function isStaleAnalyzedHit(
  category: string,
  raw: { title: string; snippet: string },
  a: { relevanceScore: number; deadline: string | null; aiSummary: string },
): boolean {
  if (a.relevanceScore < 15) return true;
  return isPastScoutOpportunity({
    category,
    title: raw.title,
    snippet: raw.snippet,
    aiSummary: a.aiSummary,
    deadline: a.deadline,
  });
}

async function analyzeWithAI(
  rawResults: Array<{ title: string; link: string; snippet: string }>,
  keywords: string[],
  sectors: string[],
  category: string,
  marketLabel: string,
): Promise<Array<{
  index: number;
  relevanceScore: number;
  aiSummary: string;
  deadline: string | null;
  location: string | null;
  budget: string | null;
  companyName?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
}>> {
  if (rawResults.length === 0) return [];

  const fallback = () =>
    rawResults.map((_, i) => ({
      index: i + 1,
      relevanceScore: 45,
      aiSummary: rawResults[i]?.snippet?.slice(0, 220) || '',
      deadline: null as string | null,
      location: null as string | null,
      budget: null as string | null,
      companyName: null as string | null,
      contactEmail: null as string | null,
      contactPhone: null as string | null,
    }));

  const resultsText = rawResults
    .map((r, i) => `[${i + 1}] ${r.title}\nURL: ${r.link}\nExtrait: ${r.snippet}`)
    .join('\n\n');

  const categoryLabels: Record<string, string> = {
    TENDER: "appels d'offres et marchés publics",
    EVENT: 'événements professionnels (salons, conférences, forums)',
    NEWS: 'actualités sectorielles et signaux faibles',
  };

  const market = marketLabel || 'le marché ciblé';
  const todayIso = new Date().toISOString().slice(0, 10);

  const freshnessRule =
    category === 'EVENT'
      ? `Règle STRICTE (aujourd'hui = ${todayIso}): si l'événement a déjà eu lieu (date dans le titre/extrait avant aujourd'hui), mets relevanceScore à 0 et deadline à la date de fin (YYYY-MM-DD). Ne valorise que les événements à venir.`
      : category === 'TENDER'
        ? `Règle STRICTE (aujourd'hui = ${todayIso}): si la date limite de réponse est déjà dépassée, mets relevanceScore à 0. Extrais la deadline en YYYY-MM-DD.`
        : `Aujourd'hui = ${todayIso}. Pour les actualités, une date passée est normale.`;

  const systemPrompt = `Tu es Scout AI, spécialisé dans la veille d'opportunités commerciales pour ${market}.
Tu analyses des résultats de recherche pour identifier les ${categoryLabels[category] || 'opportunités'}.

${freshnessRule}

Pour chaque résultat, donne un score même s'il est moyen — ne sois pas trop strict (sauf règle de fraîcheur ci-dessus).
Extrais:
- relevanceScore: 0-100
- aiSummary: résumé actionnable en 2-3 phrases
- deadline: date limite ou date de fin d'événement en YYYY-MM-DD (ou null)
- location, budget, companyName, contactEmail, contactPhone (ou null)

Réponds UNIQUEMENT en JSON array:
[{"index": 1, "relevanceScore": 70, "aiSummary": "...", "deadline": null, "location": null, "budget": null, "companyName": null, "contactEmail": null, "contactPhone": null}]
Inclus les résultats avec relevanceScore >= 15 (les périmés doivent être à 0).`;

  const prompt = `Marché: ${market}\nCatégorie: ${category}\nMots-clés: ${keywords.join(', ')}\nSecteurs: ${sectors.join(', ')}\n\nRésultats:\n${resultsText}`;

  try {
    const aiResponse = await callOpenAI(prompt, systemPrompt);
    const jsonMatch = aiResponse.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      console.warn('[scout-ai] AI sans JSON — fallback scores bruts');
      return fallback();
    }
    const parsed = JSON.parse(jsonMatch[0]) as Array<{ index: number; relevanceScore?: number }>;
    if (!Array.isArray(parsed) || parsed.length === 0) return fallback();
    return parsed as ReturnType<typeof fallback>;
  } catch (err) {
    console.warn('[scout-ai] analyzeWithAI fallback', err);
    return fallback();
  }
}

async function persistScoutMemory(opts: {
  organizationId: string;
  userId: string;
  opportunity: {
    id: string;
    title: string;
    snippet?: string | null;
    aiSummary?: string | null;
    relevanceScore: number;
    rawData?: unknown;
  };
}) {
  const raw = (opts.opportunity.rawData || {}) as {
    companyName?: string;
    contactEmail?: string;
    contactPhone?: string;
  };
  await recordScoutOpportunity({
    organizationId: opts.organizationId,
    userId: opts.userId,
    opportunityId: opts.opportunity.id,
    title: opts.opportunity.title,
    description: opts.opportunity.aiSummary || opts.opportunity.snippet || '',
    hints: {
      companyName: raw.companyName,
      contactEmail: raw.contactEmail,
      contactPhone: raw.contactPhone,
      highConfidence: opts.opportunity.relevanceScore >= 70,
    },
  }).catch((err) => console.warn('[scout] agent-memory', opts.opportunity.id, err));
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
  /** Hint UI only — not persisted (country is reflected in geoZones). */
  marketCountry: z.string().max(8).optional(),
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
    const { marketCountry: _market, ...data } = profileSchema.parse(req.body);
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
    const orgId = req.organizationId!;
    if (!(await tryConsumeAgentQuota(orgId, 'scout-ai', res))) return;

    const { category } = scanSchema.parse(req.body);

    const profile = await prisma.scoutProfile.findUnique({ where: { organizationId: orgId } });
    if (!profile) {
      res.status(400).json({ error: 'Configurez votre profil de veille d\'abord.' });
      return;
    }

    const keywords = profile.keywords as string[];
    const sectors = profile.sectors as string[];
    const geoZones = profile.geoZones as string[];
    const gl = inferSearchGl(geoZones);

    const queries = buildSearchQueries(keywords, sectors, geoZones, category);

    const allRaw: Array<{ title: string; link: string; snippet: string }> = [];
    const seenUrls = new Set<string>();

    for (const q of queries) {
      const results = await searchWeb(q, 8, gl);
      for (const r of results) {
        if (!seenUrls.has(r.link)) {
          seenUrls.add(r.link);
          allRaw.push(r);
        }
      }
    }

    const analyzed = await analyzeWithAI(
      allRaw,
      keywords,
      sectors,
      category,
      geoZones.slice(0, 2).join(', ') || 'marché ciblé'
    );

    const opportunities = analyzed
      .filter((a) => {
        const raw = allRaw[a.index - 1];
        return raw && !isStaleAnalyzedHit(category, raw, a);
      })
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
          rawData: {
            companyName: a.companyName || null,
            contactEmail: a.contactEmail || null,
            contactPhone: a.contactPhone || null,
          },
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
          data: {
            relevanceScore: opp.relevanceScore,
            aiSummary: opp.aiSummary,
            rawData: opp.rawData,
          },
        });
        saved.push(updated);
        if (req.userId) {
          void persistScoutMemory({
            organizationId: orgId,
            userId: req.userId,
            opportunity: updated,
          });
        }
      } else {
        const created = await prisma.scoutOpportunity.create({ data: opp as any });
        saved.push(created);
        if (req.userId) {
          void persistScoutMemory({
            organizationId: orgId,
            userId: req.userId,
            opportunity: created,
          });
        }
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
    if (!(await tryConsumeAgentQuota(orgId, 'scout-ai', res))) return;

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
    let totalRaw = 0;

    for (const cat of categories) {
      const keywords = profile.keywords as string[];
      const sectors = profile.sectors as string[];
      const geoZones = profile.geoZones as string[];
      const gl = inferSearchGl(geoZones);
      const queries = buildSearchQueries(keywords, sectors, geoZones, cat);

      const allRaw: Array<{ title: string; link: string; snippet: string }> = [];
      const seenUrls = new Set<string>();

      for (const q of queries) {
        const results = await searchWeb(q, 8, gl);
        for (const r of results) {
          if (!seenUrls.has(r.link)) {
            seenUrls.add(r.link);
            allRaw.push(r);
          }
        }
      }
      totalRaw += allRaw.length;

      const analyzed = await analyzeWithAI(
        allRaw,
        keywords,
        sectors,
        cat,
        geoZones.slice(0, 2).join(', ') || 'marché ciblé'
      );

      for (const a of analyzed) {
        const raw = allRaw[a.index - 1];
        if (!raw || isStaleAnalyzedHit(cat, raw, a)) continue;
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
              rawData: {
                companyName: a.companyName || null,
                contactEmail: a.contactEmail || null,
                contactPhone: a.contactPhone || null,
              },
            },
          });
          allResults.push(created);
          if (req.userId) {
            void persistScoutMemory({
              organizationId: orgId,
              userId: req.userId,
              opportunity: created,
            });
          }
        }
      }
    }

    await prisma.scoutProfile.update({
      where: { organizationId: orgId },
      data: { lastScanAt: new Date() },
    });

    res.json({
      newOpportunities: allResults.length,
      categories,
      totalRaw,
      scannedAt: new Date().toISOString(),
    });
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

    const [rawOpportunities, total] = await Promise.all([
      prisma.scoutOpportunity.findMany({
        where, orderBy: [{ relevanceScore: 'desc' }, { createdAt: 'desc' }],
        take: Math.min(300, limit + 50), skip: offset,
      }),
      prisma.scoutOpportunity.count({ where }),
    ]);

    // Masque + archive les événements / AO déjà passés (scans précédents)
    const staleIds: string[] = [];
    const opportunities = rawOpportunities.filter((o) => {
      const stale = isPastScoutOpportunity({
        category: o.category,
        title: o.title,
        snippet: o.snippet,
        aiSummary: o.aiSummary,
        deadline: o.deadline,
      });
      if (stale && o.status === 'NEW') staleIds.push(o.id);
      return !stale;
    }).slice(0, limit);

    if (staleIds.length > 0) {
      void prisma.scoutOpportunity.updateMany({
        where: { id: { in: staleIds }, organizationId: orgId },
        data: { status: 'DISMISSED' },
      }).catch((err) => console.warn('[scout-ai] dismiss stale', err));
    }

    const counts = await prisma.scoutOpportunity.groupBy({
      by: ['category'],
      where: { organizationId: orgId, status: { not: 'DISMISSED' } },
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
    const id = req.params.id as string;
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
    if (!(await tryConsumeAgentQuota(req.organizationId!, 'scout-ai', res))) return;

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
