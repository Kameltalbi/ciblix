import { Router, type NextFunction, type Response } from 'express';
import { z } from 'zod';
import auth, { AuthRequest, requirePaymentApproved } from '../middleware/auth.js';
import { checkAgentAccess } from '../middleware/planRestrictions.js';
import { prisma } from '../db/prisma.js';
import { tryConsumeAgentQuota } from '../services/agentUsage.js';
import { recordScoutOpportunity } from '../services/agent-memory/agentIntegrations.js';
import { isPastScoutOpportunity } from '../services/scout/scoutFreshness.js';
import { fitsScoutCategory, keywordsForCategory } from '../services/scout/scoutCategoryFit.js';
import { fitsScoutMarket, inferMarketCode, marketLabel, type ScoutMarketCode } from '../services/scout/scoutMarketFit.js';

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
  // Ne pas retomber sans gl : ça mélange les pays (ex. Tunisie dans un scan France)
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

function inferSearchGl(geoZones: string[]): string {
  return inferMarketCode(geoZones) || '';
}

function buildSearchQueries(
  keywords: string[],
  sectors: string[],
  geoZones: string[],
  category: 'TENDER' | 'EVENT' | 'NEWS',
  market: ScoutMarketCode = '',
): string[] {
  const kwList = keywordsForCategory(keywords, category);
  const kw = kwList.slice(0, 2).join(' ') || 'entreprise';
  const sec = sectors.slice(0, 1).join(' ');
  const country = marketLabel(market);
  // Prefer country name over mixed city list to avoid Tunis leaking into France queries
  const geo = country !== 'marché ciblé'
    ? country
    : geoZones.slice(0, 2).join(' ');
  const year = new Date().getFullYear();
  const m = market || inferMarketCode(geoZones);

  const queries: string[] = [];
  switch (category) {
    case 'TENDER':
      queries.push(`"appel d'offres" ${kw} ${geo}`.trim());
      queries.push(`"marché public" ${kw} ${geo || sec}`.trim());
      if (m === 'tn') {
        queries.push(`${kw} site:marchespublics.gov.tn`);
        queries.push(`"appel d'offres" ${kw} Tunisie ${year}`);
      } else if (m === 'fr') {
        queries.push(`"${kw}" "appel d'offres" site:boamp.fr`);
        queries.push(`"${kw}" marché public site:marches-publics.gouv.fr`);
        queries.push(`"appel d'offres" ${kw} France ${year}`);
      } else if (m === 'ma') {
        queries.push(`"appel d'offres" ${kw} Maroc ${year}`);
      } else if (m === 'dz') {
        queries.push(`"appel d'offres" ${kw} Algérie ${year}`);
      } else {
        queries.push(`"appel d'offres" ${kw} ${sec} ${geo} ${year}`.trim());
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

/** Hors catégorie, mauvais pays, date passée, ou score trop bas → à jeter. */
function isStaleAnalyzedHit(
  category: string,
  raw: { title: string; link: string; snippet: string },
  a: { relevanceScore: number; deadline: string | null; aiSummary: string; location?: string | null },
  market: ScoutMarketCode,
): boolean {
  if (a.relevanceScore < 15) return true;
  if (!fitsScoutCategory(category, raw.title, raw.snippet, a.aiSummary)) return true;
  if (!fitsScoutMarket({
    market,
    url: raw.link,
    title: raw.title,
    snippet: raw.snippet,
    aiSummary: a.aiSummary,
    location: a.location,
  })) return true;
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
        ? `Règle STRICTE (aujourd'hui = ${todayIso}):
- Ne garde QUE les vrais appels d'offres / marchés publics / consultations.
- Si c'est une formation, bootcamp, atelier, salon ou conférence (sans marché public), mets relevanceScore à 0.
- Si la date limite de réponse est déjà dépassée, mets relevanceScore à 0.
- Extrais la deadline en YYYY-MM-DD.`
        : `Aujourd'hui = ${todayIso}. Si c'est une simple pub de formation/salon déjà passé, score 0. Sinon une date passée d'article d'actualité est acceptable.`;

  const systemPrompt = `Tu es Scout AI, spécialisé dans la veille d'opportunités commerciales pour ${market}.
Tu analyses des résultats de recherche pour identifier les ${categoryLabels[category] || 'opportunités'}.

${freshnessRule}

Pour chaque résultat, donne un score même s'il est moyen — ne sois pas trop strict (sauf règles STRICTES ci-dessus).
Extrais:
- relevanceScore: 0-100
- aiSummary: résumé actionnable en 2-3 phrases
- deadline: date limite ou date de fin d'événement en YYYY-MM-DD (ou null)
- location, budget, companyName, contactEmail, contactPhone (ou null)

Réponds UNIQUEMENT en JSON array:
[{"index": 1, "relevanceScore": 70, "aiSummary": "...", "deadline": null, "location": null, "budget": null, "companyName": null, "contactEmail": null, "contactPhone": null}]
Inclus les résultats avec relevanceScore >= 15 (les hors-sujet et périmés doivent être à 0).`;

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

const interpretBriefSchema = z.object({
  brief: z.string().min(8).max(1200),
});

/**
 * POST /api/scout-ai/interpret-brief
 * Transforme une phrase métier en profil de veille structuré.
 */
scoutAiRoutes.post('/interpret-brief', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!(await tryConsumeAgentQuota(req.organizationId!, 'scout-ai', res))) return;
    const { brief } = interpretBriefSchema.parse(req.body);

    const systemPrompt = `Tu es Scout AI (Ciblix). L'utilisateur décrit une mission de veille commerciale en une phrase.
Construis un profil de veille STRICT et actionnable.

Règles:
- marketCountry: un seul code parmi TN, FR, DZ, MA, BE, CA, SN, CI, INT
- geoZones: 1 à 4 zones (inclure le nom du pays + éventuellement "X entière" ou 1-2 villes)
- keywords: 3 à 8 mots-clés métier CONCRETS (pas de verbes vagues). Si la mission est des appels d'offres, N'inclus PAS "formation", "bootcamp", "cours" — ce sont des événements/formations, pas des AO.
- sectors: 1 à 4 secteurs
- tenderEnabled / eventEnabled / newsEnabled: selon l'intention. Par défaut AO=true. Formations/salons → eventEnabled=true, tenderEnabled=false sauf si AO aussi demandés. Actualités seulement si explicitement demandé.
- summary: 1-2 phrases qui reformulent la mission
- missionTitle: titre court (max 8 mots)

Réponds UNIQUEMENT en JSON:
{"missionTitle":"...","summary":"...","marketCountry":"FR","geoZones":["France","France entière"],"keywords":["..."],"sectors":["..."],"tenderEnabled":true,"eventEnabled":false,"newsEnabled":false}`;

    let parsed: {
      missionTitle?: string;
      summary?: string;
      marketCountry?: string;
      geoZones?: string[];
      keywords?: string[];
      sectors?: string[];
      tenderEnabled?: boolean;
      eventEnabled?: boolean;
      newsEnabled?: boolean;
    } | null = null;

    try {
      const ai = await callOpenAI(`Mission: ${brief}`, systemPrompt);
      const jsonMatch = ai.match(/\{[\s\S]*\}/);
      if (jsonMatch) parsed = JSON.parse(jsonMatch[0]);
    } catch (err) {
      console.warn('[scout-ai] interpret-brief AI', err);
    }

    // Fallback heuristique si l'IA échoue
    if (!parsed?.keywords?.length) {
      const lower = brief.toLowerCase();
      let marketCountry = 'FR';
      if (/tunisie|tunis/.test(lower)) marketCountry = 'TN';
      else if (/algérie|algerie|alger/.test(lower)) marketCountry = 'DZ';
      else if (/maroc|casablanca/.test(lower)) marketCountry = 'MA';
      else if (/belgique|bruxelles/.test(lower)) marketCountry = 'BE';
      else if (/canada|montréal|montreal/.test(lower)) marketCountry = 'CA';
      else if (/sénégal|senegal|dakar/.test(lower)) marketCountry = 'SN';
      else if (/ivoire|abidjan/.test(lower)) marketCountry = 'CI';
      else if (/france|paris|lyon/.test(lower)) marketCountry = 'FR';

      const wantEvents = /salon|conférence|forum|formation|bootcamp|événement|evenement/.test(lower);
      const wantTender = /appel d['']offre|marché public|ao\b|tender|consultation/.test(lower) || !wantEvents;
      const wantNews = /actualité|actu\b|veille media|presse/.test(lower);

      parsed = {
        missionTitle: 'Mission de veille',
        summary: brief.slice(0, 220),
        marketCountry,
        geoZones: [],
        keywords: brief
          .split(/[\s,;]+/)
          .map((w) => w.trim())
          .filter((w) => w.length > 3)
          .slice(0, 5),
        sectors: [],
        tenderEnabled: wantTender,
        eventEnabled: wantEvents,
        newsEnabled: wantNews,
      };
    }

    const marketCountry = String(parsed.marketCountry || 'FR').toUpperCase();
    const marketNames: Record<string, string> = {
      TN: 'Tunisie', FR: 'France', DZ: 'Algérie', MA: 'Maroc',
      BE: 'Belgique', CA: 'Canada', SN: 'Sénégal', CI: "Côte d'Ivoire", INT: '',
    };
    const country = marketNames[marketCountry] || 'France';
    let geoZones = Array.isArray(parsed.geoZones) ? parsed.geoZones.map(String).filter(Boolean).slice(0, 6) : [];
    if (country) {
      if (geoZones.length === 0) {
        if (country === 'France') geoZones = ['France', 'France entière'];
        else if (country === 'Tunisie') geoZones = ['Tunisie', 'Tunisie entière'];
        else geoZones = [country];
      } else if (!geoZones.some((z) => z.toLowerCase().includes(country.toLowerCase()))) {
        geoZones = [country, ...geoZones].slice(0, 6);
      }
    }

    let keywords = (parsed.keywords || []).map(String).map((k) => k.trim()).filter(Boolean).slice(0, 10);
    const tenderEnabled = parsed.tenderEnabled !== false;
    const eventEnabled = Boolean(parsed.eventEnabled);
    const newsEnabled = Boolean(parsed.newsEnabled);
    // Si AO seuls : retirer les mots « formation » qui polluent
    if (tenderEnabled && !eventEnabled) {
      keywords = keywords.filter((k) => !/formation|bootcamp|cours|atelier/i.test(k));
    }
    if (keywords.length === 0) keywords = ['opportunité commerciale'];

    res.json({
      proposal: {
        missionTitle: parsed.missionTitle || 'Mission de veille',
        summary: parsed.summary || brief.slice(0, 220),
        marketCountry,
        geoZones,
        keywords,
        sectors: (parsed.sectors || []).map(String).filter(Boolean).slice(0, 6),
        tenderEnabled,
        eventEnabled,
        newsEnabled,
      },
    });
  } catch (err) { next(err); }
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
    const orgId = req.organizationId!;
    const { marketCountry: _market, ...data } = profileSchema.parse(req.body);
    const previous = await prisma.scoutProfile.findUnique({ where: { organizationId: orgId } });
    const prevMarket = previous ? inferMarketCode(previous.geoZones as string[]) : '';
    const nextMarket = inferMarketCode((data.geoZones || []) as string[]);

    const profile = await prisma.scoutProfile.upsert({
      where: { organizationId: orgId },
      update: data,
      create: { organizationId: orgId, ...data },
    });

    // Changement de pays → tout archiver (évite Tunisie qui reste après un switch France)
    if (previous && prevMarket && nextMarket && prevMarket !== nextMarket) {
      await prisma.scoutOpportunity.updateMany({
        where: { organizationId: orgId, status: { in: ['NEW', 'SAVED'] } },
        data: { status: 'DISMISSED' },
      });
    } else {
      const disabled: string[] = [];
      if (!profile.tenderEnabled) disabled.push('TENDER');
      if (!profile.eventEnabled) disabled.push('EVENT');
      if (!profile.newsEnabled) disabled.push('NEWS');
      if (disabled.length > 0) {
        await prisma.scoutOpportunity.updateMany({
          where: {
            organizationId: orgId,
            category: { in: disabled },
            status: { in: ['NEW', 'SAVED'] },
          },
          data: { status: 'DISMISSED' },
        });
      }
    }

    res.json({ profile, marketReset: Boolean(previous && prevMarket !== nextMarket) });
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
    const market = inferMarketCode(geoZones);
    const gl = market || inferSearchGl(geoZones);

    const queries = buildSearchQueries(keywords, sectors, geoZones, category, market);

    const allRaw: Array<{ title: string; link: string; snippet: string }> = [];
    const seenUrls = new Set<string>();

    for (const q of queries) {
      const results = await searchWeb(q, 8, gl);
      for (const r of results) {
        if (seenUrls.has(r.link)) continue;
        if (!fitsScoutMarket({ market, url: r.link, title: r.title, snippet: r.snippet })) continue;
        seenUrls.add(r.link);
        allRaw.push(r);
      }
    }

    const analyzed = await analyzeWithAI(
      allRaw,
      keywords,
      sectors,
      category,
      marketLabel(market),
    );

    const opportunities = analyzed
      .filter((a) => {
        const raw = allRaw[a.index - 1];
        return raw && !isStaleAnalyzedHit(category, raw, a, market);
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

    // Nettoyer les catégories désactivées même après un scan ciblé
    const disabled: string[] = [];
    if (!profile.tenderEnabled) disabled.push('TENDER');
    if (!profile.eventEnabled) disabled.push('EVENT');
    if (!profile.newsEnabled) disabled.push('NEWS');
    if (disabled.length > 0) {
      await prisma.scoutOpportunity.updateMany({
        where: {
          organizationId: orgId,
          category: { in: disabled },
          status: { in: ['NEW', 'SAVED'] },
        },
        data: { status: 'DISMISSED' },
      });
    }

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
      const market = inferMarketCode(geoZones);
      const gl = market || inferSearchGl(geoZones);
      const queries = buildSearchQueries(keywords, sectors, geoZones, cat, market);

      const allRaw: Array<{ title: string; link: string; snippet: string }> = [];
      const seenUrls = new Set<string>();

      for (const q of queries) {
        const results = await searchWeb(q, 8, gl);
        for (const r of results) {
          if (seenUrls.has(r.link)) continue;
          if (!fitsScoutMarket({ market, url: r.link, title: r.title, snippet: r.snippet })) continue;
          seenUrls.add(r.link);
          allRaw.push(r);
        }
      }
      totalRaw += allRaw.length;

      const analyzed = await analyzeWithAI(
        allRaw,
        keywords,
        sectors,
        cat,
        marketLabel(market),
      );

      for (const a of analyzed) {
        const raw = allRaw[a.index - 1];
        if (!raw || isStaleAnalyzedHit(cat, raw, a, market)) continue;
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

    // Après scan : ranger les catégories non activées (anciens résultats)
    const disabled: string[] = [];
    if (!profile.tenderEnabled) disabled.push('TENDER');
    if (!profile.eventEnabled) disabled.push('EVENT');
    if (!profile.newsEnabled) disabled.push('NEWS');
    if (disabled.length > 0) {
      await prisma.scoutOpportunity.updateMany({
        where: {
          organizationId: orgId,
          category: { in: disabled },
          status: { in: ['NEW', 'SAVED'] },
        },
        data: { status: 'DISMISSED' },
      });
    }

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

    const profile = await prisma.scoutProfile.findUnique({ where: { organizationId: orgId } });
    const enabledCats: string[] = [];
    if (!profile || profile.tenderEnabled) enabledCats.push('TENDER');
    if (!profile || profile.eventEnabled) enabledCats.push('EVENT');
    if (!profile || profile.newsEnabled) enabledCats.push('NEWS');

    const where: any = {
      organizationId: orgId,
      category: { in: enabledCats },
    };
    if (category && ['TENDER', 'EVENT', 'NEWS'].includes(category)) {
      if (!enabledCats.includes(category)) {
        res.json({
          opportunities: [],
          total: 0,
          categoryCounts: Object.fromEntries(enabledCats.map((c) => [c, 0])),
          statusCounts: {},
          enabledCategories: enabledCats,
        });
        return;
      }
      where.category = category;
    }
    if (status && ['NEW', 'SAVED', 'DISMISSED', 'APPLIED'].includes(status)) where.status = status;
    else where.status = { not: 'DISMISSED' };

    const [rawOpportunities, total] = await Promise.all([
      prisma.scoutOpportunity.findMany({
        where, orderBy: [{ relevanceScore: 'desc' }, { createdAt: 'desc' }],
        take: Math.min(300, limit + 50), skip: offset,
      }),
      prisma.scoutOpportunity.count({ where }),
    ]);

    const market = profile ? inferMarketCode(profile.geoZones as string[]) : '';

    // Masque + archive hors-sujet / mauvais pays / dates passées
    const staleIds: string[] = [];
    const opportunities = rawOpportunities.filter((o) => {
      const wrongCat = !fitsScoutCategory(o.category, o.title, o.snippet, o.aiSummary);
      const wrongMarket = !fitsScoutMarket({
        market,
        url: o.url,
        title: o.title,
        snippet: o.snippet,
        aiSummary: o.aiSummary,
        location: o.location,
        source: o.source,
      });
      const stale = isPastScoutOpportunity({
        category: o.category,
        title: o.title,
        snippet: o.snippet,
        aiSummary: o.aiSummary,
        deadline: o.deadline,
      });
      if (wrongCat || wrongMarket || stale) staleIds.push(o.id);
      return !wrongCat && !wrongMarket && !stale;
    }).slice(0, limit);

    if (staleIds.length > 0) {
      void prisma.scoutOpportunity.updateMany({
        where: { id: { in: staleIds }, organizationId: orgId },
        data: { status: 'DISMISSED' },
      }).catch((err) => console.warn('[scout-ai] dismiss stale', err));
    }

    // Compteurs uniquement sur catégories actives + non dismiss
    const counts = await prisma.scoutOpportunity.groupBy({
      by: ['category'],
      where: {
        organizationId: orgId,
        category: { in: enabledCats },
        status: { not: 'DISMISSED' },
      },
      _count: { id: true },
    });

    const statusCounts = await prisma.scoutOpportunity.groupBy({
      by: ['status'],
      where: { organizationId: orgId, category: { in: enabledCats } },
      _count: { id: true },
    });

    res.json({
      opportunities, total,
      categoryCounts: Object.fromEntries(counts.map((c) => [c.category, c._count.id])),
      statusCounts: Object.fromEntries(statusCounts.map((c) => [c.status, c._count.id])),
      enabledCategories: enabledCats,
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
