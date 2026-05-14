import { Router, type NextFunction, type Response } from 'express';
import { z } from 'zod';
import auth, { AuthRequest, requirePaymentApproved } from '../middleware/auth.js';
import { checkProspectLimit } from '../middleware/planRestrictions.js';
import { prisma } from '../db/prisma.js';
import { searchCompaniesWithCache, enrichHitWebsiteCached } from '../services/prospecting/index.js';
import { qualifyCompanyHit } from '../services/prospecting/qualifyWithAi.js';
import { emptyWebEnrichment } from '../services/prospecting/websiteEnrichment.js';
import { generateOutreachMessage } from '../services/prospecting/generateOutreach.js';
import type { CompanySearchCriteria, CompanySearchHit, OutreachMessageType, WebEnrichmentResult } from '../services/prospecting/types.js';

type LeadQualificationLike = Awaited<ReturnType<typeof qualifyCompanyHit>>;

export const prospectingRoutes = Router();

/** Santé du module (sans auth) — utile pour vérifier Nginx / déploiement si /dashboard renvoie 404. */
prospectingRoutes.get('/ping', (_req, res) => {
  res.status(200).json({ ok: true, module: 'prospecting', at: new Date().toISOString() });
});

prospectingRoutes.use(auth);
prospectingRoutes.use(requirePaymentApproved);

/**
 * GET /api/prospecting/all
 * Liste tous les prospects IA générés pour l'organisation.
 */
prospectingRoutes.get('/all', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const prospects = await prisma.aiProspect.findMany({
      where: {
        organizationId: req.organizationId!,
        deletedAt: null,
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    res.json({ prospects });
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/prospecting/:id
 * Met à jour un prospect (status, notes, etc.).
 */
prospectingRoutes.patch('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const idStr = Array.isArray(id) ? id[0] : id;
    const updateData: Record<string, unknown> = req.body;
    delete updateData.id;
    delete updateData.organizationId;
    delete updateData.createdAt;

    const prospect = await prisma.aiProspect.update({
      where: {
        id: idStr,
        organizationId: req.organizationId!,
      },
      data: updateData,
    });
    res.json({ prospect });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/prospecting/:id
 * Supprime (soft delete) un prospect.
 */
prospectingRoutes.delete('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const idStr = Array.isArray(id) ? id[0] : id;
    await prisma.aiProspect.update({
      where: {
        id: idStr,
        organizationId: req.organizationId!,
      },
      data: {
        deletedAt: new Date(),
      },
    });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

const searchSchema = z.object({
  sector: z.string().optional(),
  country: z.string().optional(),
  city: z.string().optional(),
  companySize: z.string().optional(),
  keywords: z.string().optional(),
  refresh: z.union([z.boolean(), z.string()]).optional(),
});

function parseSearchCriteria(req: AuthRequest): CompanySearchCriteria {
  const raw = req.method === 'GET' ? req.query : req.body;
  const { refresh, ...criteria } = searchSchema.parse(raw);
  void refresh;
  return criteria as CompanySearchCriteria;
}

function parseRefreshSearch(req: AuthRequest): boolean {
  const raw = req.method === 'GET' ? req.query : req.body;
  const refresh = searchSchema.parse(raw).refresh;
  return refresh === true || refresh === 'true' || refresh === '1';
}

const messageSchema = z.object({
  messageType: z.enum(['FIRST_CONTACT', 'FOLLOW_UP', 'VALUE_PROPOSITION', 'LINKEDIN', 'WHATSAPP']),
  tone: z.enum(['doux', 'commercial', 'ferme']).optional().default('commercial'),
});

const scheduleSchema = z.object({
  dayOffset: z.union([z.literal(3), z.literal(7), z.literal(15)]),
});

function enrichmentPersistFields(e: WebEnrichmentResult) {
  return {
    websiteTitle: e.websiteTitle,
    websiteDescription: e.websiteDescription,
    detectedEmails: e.detectedEmails.length ? e.detectedEmails : undefined,
    facebookUrl: e.facebookUrl,
    instagramUrl: e.instagramUrl,
    faviconUrl: e.faviconUrl,
    hasResponsiveWebsite: e.hasResponsiveWebsite,
    hasSsl: e.hasSsl,
    seoScore: e.seoScore,
    digitalPresenceLevel: e.digitalPresenceLevel,
    technologiesDetected: e.technologiesDetected.length ? e.technologiesDetected : undefined,
  };
}

function hitToProspectData(
  hit: import('../services/prospecting/types.js').CompanySearchHit,
  q: LeadQualificationLike,
  criteria: CompanySearchCriteria,
  rawProvider: string,
  enrichment: WebEnrichmentResult
) {
  return {
    companyName: hit.companyName,
    website: hit.website || null,
    linkedin: hit.linkedin || null,
    phone: hit.phone || null,
    email: hit.email || null,
    city: hit.city || null,
    country: hit.country || null,
    industry: hit.industry || criteria.sector || null,
    companySize: hit.companySize || criteria.companySize || null,
    score: q.score,
    scoreReason: q.scoreReason,
    suggestedPitch: q.suggestedPitch,
    aiTags: q.aiTags as object,
    potentialLevel: q.potentialLevel,
    commercialAngle: q.commercialAngle,
    aiSummary: q.aiSummary,
    interestProbability: q.interestProbability,
    followUpPlan: q.followUpPlan as object,
    probableBusinessProblem: q.probableBusinessProblem,
    suggestedOffer: q.suggestedOffer,
    status: 'QUALIFIED' as const,
    lastSearchQuery: JSON.stringify(criteria),
    rawProvider,
    ...enrichmentPersistFields(enrichment),
  };
}

function dedupeProviderKey(providerUsed: string, hit: CompanySearchHit): string {
  const tail = (hit.externalId || hit.companyName || 'unknown').toString().trim();
  return `${providerUsed}:${tail}`.slice(0, 450);
}

/** Persistance « brute » : affichage immédiat, score / IA en second temps. */
function hitToFoundProspectData(
  hit: CompanySearchHit,
  criteria: CompanySearchCriteria,
  rawProviderDedupe: string,
  enrichment: WebEnrichmentResult
) {
  return {
    companyName: hit.companyName,
    website: hit.website || null,
    linkedin: hit.linkedin || null,
    phone: hit.phone || null,
    email: hit.email || null,
    city: hit.city || null,
    country: hit.country || null,
    industry: hit.industry || criteria.sector || null,
    companySize: hit.companySize || criteria.companySize || null,
    score: 0,
    status: 'FOUND' as const,
    lastSearchQuery: JSON.stringify(criteria),
    rawProvider: rawProviderDedupe,
    ...enrichmentPersistFields(enrichment),
  };
}

function prismaRowToSearchHit(row: {
  companyName: string;
  website: string | null;
  linkedin: string | null;
  phone: string | null;
  email: string | null;
  city: string | null;
  country: string | null;
  industry: string | null;
  companySize: string | null;
}): CompanySearchHit {
  return {
    companyName: row.companyName,
    website: row.website,
    linkedin: row.linkedin,
    phone: row.phone,
    email: row.email,
    city: row.city,
    country: row.country,
    industry: row.industry,
    companySize: row.companySize,
  };
}

// ─── Dashboard prospection ─────────────────────────────────────
prospectingRoutes.get('/dashboard', async (req: AuthRequest, res, next) => {
  try {
    const organizationId = req.organizationId!;
    const base = { organizationId, deletedAt: null };
    const [
      totalFound,
      hot,
      contacted,
      inPipeline,
      aiLeads,
      recentProspects,
    ] = await Promise.all([
      prisma.aiProspect.count({ where: { ...base, status: { in: ['FOUND', 'QUALIFIED'] } } }),
      prisma.aiProspect.count({ where: { ...base, score: { gte: 70 }, status: { not: 'IGNORED' } } }),
      prisma.aiProspect.count({ where: { ...base, status: 'CONTACTED' } }),
      prisma.aiProspect.count({ where: { ...base, status: 'IN_PIPELINE' } }),
      prisma.lead.count({ where: { organizationId, deletedAt: null, source: 'AI_PROSPECTION' } }),
      prisma.aiProspect.findMany({
        where: base,
        orderBy: { createdAt: 'desc' },
        take: 6,
        select: {
          id: true,
          companyName: true,
          score: true,
          potentialLevel: true,
          status: true,
          createdAt: true,
        },
      }),
    ]);

    res.json({
      prospectsFound: totalFound,
      hotLeads: hot,
      prospectsContacted: contacted,
      inPipeline,
      opportunitiesFromAi: aiLeads,
      responseRate: null,
      responseRateNote: 'Suivi ouvertures / clics / réponses — branchement futur.',
      recentProspects,
      alerts: hot > 0 ? [{ type: 'HOT', message: `${hot} prospect(s) à fort potentiel à traiter.` }] : [],
    });
  } catch (e) {
    next(e);
  }
});

// ─── Liste récents ──────────────────────────────────────────────
prospectingRoutes.get('/prospects', async (req: AuthRequest, res, next) => {
  try {
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 40));
    const rows = await prisma.aiProspect.findMany({
      where: { organizationId: req.organizationId!, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    res.json({ data: rows });
  } catch (e) {
    next(e);
  }
});

// ─── Timeline / tracking (champs + activités futures) ───────────
prospectingRoutes.get('/prospects/:id/timeline', async (req: AuthRequest, res, next) => {
  try {
    const id = req.params.id as string;
    const row = await prisma.aiProspect.findFirst({
      where: { id, organizationId: req.organizationId!, deletedAt: null },
      include: {
        activities: { orderBy: { createdAt: 'desc' }, take: 40 },
      },
    });
    if (!row) return res.status(404).json({ error: 'Prospect introuvable' });

    type Item = { at: string; type: string; title: string; meta?: Record<string, unknown> };
    const items: Item[] = [];

    items.push({
      at: row.createdAt.toISOString(),
      type: 'SYSTEM',
      title: 'Prospect créé (recherche IA)',
    });
    if (row.emailOpenedAt) {
      items.push({
        at: row.emailOpenedAt.toISOString(),
        type: 'EMAIL_OPENED',
        title: 'Email ouvert',
      });
    }
    if (row.linkClickedAt) {
      items.push({
        at: row.linkClickedAt.toISOString(),
        type: 'LINK_CLICKED',
        title: 'Lien cliqué',
      });
    }
    if (row.lastReplyAt) {
      items.push({
        at: row.lastReplyAt.toISOString(),
        type: 'REPLY',
        title: 'Réponse reçue',
      });
    }
    if (row.lastContactAt) {
      items.push({
        at: row.lastContactAt.toISOString(),
        type: 'CONTACT',
        title: 'Dernier contact',
      });
    }

    for (const a of row.activities) {
      items.push({
        at: a.createdAt.toISOString(),
        type: a.type,
        title: a.title || a.type,
        meta: (a.metadata as Record<string, unknown>) || undefined,
      });
    }

    items.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
    res.json({ events: items });
  } catch (e) {
    next(e);
  }
});

// ─── Recherche brute (POST / GET) : import massif FOUND, pas d’IA bloquante ───
async function runProspectingSearch(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const criteria = parseSearchCriteria(req);
    const refresh = parseRefreshSearch(req);
    const { hits, providerUsed, fromCache } = await searchCompaniesWithCache(req.organizationId!, criteria, { refresh });

    const importMax = Math.min(
      120,
      Math.max(10, Number(process.env.PROSPECTING_IMPORT_MAX) || 80)
    );
    const tagBase = fromCache ? `${providerUsed}|search_cache` : providerUsed;
    const empty = emptyWebEnrichment();

    const created: unknown[] = [];
    const dedupeKeys = new Set<string>();

    for (const hitBase of hits.slice(0, importMax)) {
      const dedupeKey = dedupeProviderKey(tagBase, hitBase);
      if (dedupeKeys.has(dedupeKey)) continue;
      dedupeKeys.add(dedupeKey);

      const existing = await prisma.aiProspect.findFirst({
        where: {
          organizationId: req.organizationId!,
          deletedAt: null,
          rawProvider: dedupeKey,
        },
      });
      if (existing) {
        created.push(existing);
        continue;
      }

      const row = await prisma.aiProspect.create({
        data: {
          organizationId: req.organizationId!,
          ...hitToFoundProspectData(hitBase, criteria, dedupeKey, empty),
        },
      });
      created.push(row);
    }

    res.json({
      providerUsed,
      fromCache,
      count: created.length,
      rawHits: hits.length,
      prospects: created,
    });
  } catch (e) {
    next(e);
  }
}

prospectingRoutes.post('/search', runProspectingSearch);
prospectingRoutes.get('/search', runProspectingSearch);

// ─── Qualification IA + enrichissement par lots (prospects status FOUND) ───
prospectingRoutes.post('/qualify-batch', async (req: AuthRequest, res, next) => {
  try {
    const body = req.body as { limit?: number; prospectIds?: string[] };
    const limit = Math.min(30, Math.max(1, Number(body?.limit) || 20));
    const idFilter =
      Array.isArray(body?.prospectIds) && body.prospectIds.length > 0
        ? { id: { in: body.prospectIds.map(String).filter(Boolean).slice(0, 120) } }
        : {};

    const pending = await prisma.aiProspect.findMany({
      where: {
        organizationId: req.organizationId!,
        deletedAt: null,
        status: 'FOUND',
        ...idFilter,
      },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });

    const updated: unknown[] = [];
    for (const row of pending) {
      try {
        const criteria = (row.lastSearchQuery ? JSON.parse(row.lastSearchQuery) : {}) as CompanySearchCriteria;
        const hit = prismaRowToSearchHit(row);
        const { hit: merged, enrichment } = await enrichHitWebsiteCached(hit);
        const q = await qualifyCompanyHit(merged, criteria, enrichment);
        const u = await prisma.aiProspect.update({
          where: { id: row.id },
          data: {
            ...hitToProspectData(merged, q, criteria, row.rawProvider || 'google_places', enrichment),
            phone: merged.phone,
            email: merged.email,
            linkedin: merged.linkedin,
            website: merged.website,
          },
        });
        updated.push(u);
      } catch (err) {
        console.error('[prospecting] qualify-batch', row.id, err);
      }
    }

    const remainingInBatch = await prisma.aiProspect.count({
      where: {
        organizationId: req.organizationId!,
        deletedAt: null,
        status: 'FOUND',
        ...idFilter,
      },
    });

    res.json({
      qualified: updated.length,
      prospects: updated,
      remainingFound: remainingInBatch,
    });
  } catch (e) {
    next(e);
  }
});

// ─── Re-qualifier un prospect ───────────────────────────────────
prospectingRoutes.post('/prospects/:id/qualify', async (req: AuthRequest, res, next) => {
  try {
    const id = req.params.id as string;
    const row = await prisma.aiProspect.findFirst({
      where: { id, organizationId: req.organizationId!, deletedAt: null },
    });
    if (!row) return res.status(404).json({ error: 'Prospect introuvable' });

    const criteria = (row.lastSearchQuery ? JSON.parse(row.lastSearchQuery) : {}) as CompanySearchCriteria;
    const hit = {
      companyName: row.companyName,
      website: row.website,
      linkedin: row.linkedin,
      phone: row.phone,
      email: row.email,
      city: row.city,
      country: row.country,
      industry: row.industry,
      companySize: row.companySize,
    };
    const { hit: merged, enrichment } = await enrichHitWebsiteCached(hit);
    const q = await qualifyCompanyHit(merged, criteria, enrichment);
    const updated = await prisma.aiProspect.update({
      where: { id },
      data: {
        ...enrichmentPersistFields(enrichment),
        score: q.score,
        scoreReason: q.scoreReason,
        suggestedPitch: q.suggestedPitch,
        aiTags: q.aiTags as object,
        potentialLevel: q.potentialLevel,
        commercialAngle: q.commercialAngle,
        aiSummary: q.aiSummary,
        interestProbability: q.interestProbability,
        followUpPlan: q.followUpPlan as object,
        probableBusinessProblem: q.probableBusinessProblem,
        suggestedOffer: q.suggestedOffer,
        phone: merged.phone,
        email: merged.email,
        linkedin: merged.linkedin,
        status: 'QUALIFIED',
      },
    });
    res.json(updated);
  } catch (e) {
    next(e);
  }
});

// ─── Génération message (aperçu — validation humaine côté UI) ───
prospectingRoutes.post('/prospects/:id/generate-message', async (req: AuthRequest, res, next) => {
  try {
    const id = req.params.id as string;
    const { messageType, tone } = messageSchema.parse(req.body);

    const row = await prisma.aiProspect.findFirst({
      where: { id, organizationId: req.organizationId!, deletedAt: null },
    });
    if (!row) return res.status(404).json({ error: 'Prospect introuvable' });

    const hit = {
      companyName: row.companyName,
      website: row.website,
      linkedin: row.linkedin,
      phone: row.phone,
      email: row.email,
      city: row.city,
      country: row.country,
      industry: row.industry,
      companySize: row.companySize,
    };
    const { body, source } = await generateOutreachMessage(hit, messageType as OutreachMessageType, tone);
    res.json({
      disclaimer: 'Message généré à titre d’aide — relisez et validez avant tout envoi.',
      messageType,
      tone,
      body,
      source,
    });
  } catch (e) {
    next(e);
  }
});

// ─── Ignorer ───────────────────────────────────────────────────
prospectingRoutes.post('/prospects/:id/ignore', async (req: AuthRequest, res, next) => {
  try {
    const id = req.params.id as string;
    const row = await prisma.aiProspect.findFirst({
      where: { id, organizationId: req.organizationId!, deletedAt: null },
    });
    if (!row) return res.status(404).json({ error: 'Prospect introuvable' });
    const updated = await prisma.aiProspect.update({
      where: { id },
      data: { status: 'IGNORED' },
    });
    res.json(updated);
  } catch (e) {
    next(e);
  }
});

// ─── Ajouter au pipeline (lead) ─────────────────────────────────
prospectingRoutes.post('/prospects/:id/add-to-pipeline', checkProspectLimit, async (req: AuthRequest, res, next) => {
  try {
    const id = req.params.id as string;
    const row = await prisma.aiProspect.findFirst({
      where: { id, organizationId: req.organizationId!, deletedAt: null },
    });
    if (!row) return res.status(404).json({ error: 'Prospect introuvable' });
    if (row.leadId) {
      return res.status(400).json({ error: 'Déjà lié à un lead', leadId: row.leadId });
    }

    const notes = [
      'Créé depuis Prospection IA',
      `Score IA : ${row.score}/100 — Niveau : ${row.potentialLevel || '—'}`,
      row.aiSummary ? `Résumé IA :\n${row.aiSummary}` : '',
      row.scoreReason ? `Pourquoi ce score :\n${row.scoreReason}` : '',
      row.commercialAngle ? `Angle d'approche :\n${row.commercialAngle}` : '',
      row.probableBusinessProblem ? `Problème métier probable :\n${row.probableBusinessProblem}` : '',
      row.suggestedOffer ? `Offre suggérée :\n${row.suggestedOffer}` : '',
      row.websiteTitle ? `Site — ${row.websiteTitle}` : '',
      row.websiteDescription ? `Description site :\n${String(row.websiteDescription).slice(0, 500)}` : '',
      row.digitalPresenceLevel ? `Présence digitale : ${row.digitalPresenceLevel}` : '',
      row.seoScore != null ? `Score SEO (heuristique) : ${row.seoScore}/100` : '',
    ]
      .filter(Boolean)
      .join('\n\n');

    const lead = await prisma.lead.create({
      data: {
        organizationId: req.organizationId!,
        createdById: req.userId,
        name: row.companyName,
        company: row.companyName,
        email: row.email || undefined,
        phone: row.phone || undefined,
        source: 'AI_PROSPECTION',
        status: 'NEW',
        score: row.score,
        notes,
      },
    });

    const updated = await prisma.aiProspect.update({
      where: { id },
      data: {
        leadId: lead.id,
        status: 'IN_PIPELINE',
        lastContactAt: new Date(),
      },
    });

    await prisma.aiProspectActivity.create({
      data: {
        organizationId: req.organizationId!,
        aiProspectId: id,
        type: 'SYSTEM',
        title: 'Ajout au pipeline CRM',
        metadata: { leadId: lead.id } as object,
      },
    });

    await prisma.leadActivite.create({
      data: {
        organizationId: req.organizationId!,
        leadId: lead.id,
        type: 'NOTE',
        title: 'Import Prospection IA',
        content: `Prospect IA #${row.id} — score ${row.score}. Enrichissement et résumé IA dans les notes du lead.`,
      },
    });

    res.status(201).json({ lead, aiProspect: updated });
  } catch (e) {
    next(e);
  }
});

// ─── Programmer relance (calendrier) ───────────────────────────
prospectingRoutes.post('/prospects/:id/schedule-followup', async (req: AuthRequest, res, next) => {
  try {
    const id = req.params.id as string;
    const { dayOffset } = scheduleSchema.parse(req.body);

    const row = await prisma.aiProspect.findFirst({
      where: { id, organizationId: req.organizationId!, deletedAt: null },
    });
    if (!row) return res.status(404).json({ error: 'Prospect introuvable' });

    const start = new Date();
    start.setDate(start.getDate() + dayOffset);
    start.setHours(10, 0, 0, 0);
    const end = new Date(start);
    end.setHours(end.getHours() + 1);

    const event = await prisma.calendarEvent.create({
      data: {
        organizationId: req.organizationId!,
        createdById: req.userId,
        title: `Relance prospection — ${row.companyName}`,
        description: `Rappel J+${dayOffset}\n${row.website || ''}\n${row.linkedin || ''}\n\n${row.aiSummary || ''}`.slice(0, 8000),
        startDate: start,
        endDate: end,
        allDay: false,
        eventType: 'REMINDER',
        relatedLeadId: row.leadId,
        status: 'SCHEDULED',
      },
    });

    await prisma.aiProspect.update({
      where: { id },
      data: { status: row.status === 'IN_PIPELINE' ? 'IN_PIPELINE' : 'CONTACTED' },
    });

    res.status(201).json(event);
  } catch (e) {
    next(e);
  }
});
