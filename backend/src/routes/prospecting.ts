import { Router, type NextFunction, type Response } from 'express';
import { z } from 'zod';
import auth, { AuthRequest, requirePaymentApproved } from '../middleware/auth.js';
import { checkProspectLimit } from '../middleware/planRestrictions.js';
import { prisma } from '../db/prisma.js';
import { searchCompaniesWithFallback } from '../services/prospecting/index.js';
import { qualifyCompanyHit } from '../services/prospecting/qualifyWithAi.js';
import { generateOutreachMessage } from '../services/prospecting/generateOutreach.js';
import type { CompanySearchCriteria, OutreachMessageType } from '../services/prospecting/types.js';

export const prospectingRoutes = Router();
prospectingRoutes.use(auth);
prospectingRoutes.use(requirePaymentApproved);

const searchSchema = z.object({
  sector: z.string().optional(),
  country: z.string().optional(),
  city: z.string().optional(),
  companySize: z.string().optional(),
  keywords: z.string().optional(),
});

function parseSearchCriteria(req: AuthRequest): CompanySearchCriteria {
  const raw = req.method === 'GET' ? req.query : req.body;
  return searchSchema.parse(raw) as CompanySearchCriteria;
}

const messageSchema = z.object({
  messageType: z.enum(['FIRST_CONTACT', 'FOLLOW_UP', 'VALUE_PROPOSITION', 'LINKEDIN', 'WHATSAPP']),
  tone: z.enum(['doux', 'commercial', 'ferme']).optional().default('commercial'),
});

const scheduleSchema = z.object({
  dayOffset: z.union([z.literal(3), z.literal(7), z.literal(15)]),
});

function hitToProspectData(
  hit: import('../services/prospecting/types.js').CompanySearchHit,
  q: LeadQualificationLike,
  criteria: CompanySearchCriteria,
  rawProvider: string
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
    status: 'QUALIFIED' as const,
    lastSearchQuery: JSON.stringify(criteria),
    rawProvider,
  };
}

type LeadQualificationLike = Awaited<ReturnType<typeof qualifyCompanyHit>>;

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

// ─── Recherche + qualification (POST corps JSON, GET mêmes champs en query) ─
async function runProspectingSearch(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const criteria = parseSearchCriteria(req);
    const { hits, providerUsed } = await searchCompaniesWithFallback(criteria);

    const created: unknown[] = [];
    for (const hit of hits.slice(0, 10)) {
      const q = await qualifyCompanyHit(hit, criteria);
      const row = await prisma.aiProspect.create({
        data: {
          organizationId: req.organizationId!,
          ...hitToProspectData(hit, q, criteria, providerUsed),
        },
      });
      created.push(row);
    }

    res.json({
      providerUsed,
      count: created.length,
      prospects: created,
    });
  } catch (e) {
    next(e);
  }
}

prospectingRoutes.post('/search', runProspectingSearch);
prospectingRoutes.get('/search', runProspectingSearch);

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
    const q = await qualifyCompanyHit(hit, criteria);
    const updated = await prisma.aiProspect.update({
      where: { id },
      data: {
        score: q.score,
        scoreReason: q.scoreReason,
        suggestedPitch: q.suggestedPitch,
        aiTags: q.aiTags as object,
        potentialLevel: q.potentialLevel,
        commercialAngle: q.commercialAngle,
        aiSummary: q.aiSummary,
        interestProbability: q.interestProbability,
        followUpPlan: q.followUpPlan as object,
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
      row.aiSummary ? `Résumé IA : ${row.aiSummary}` : '',
      row.commercialAngle ? `Angle : ${row.commercialAngle}` : '',
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
      data: { leadId: lead.id, status: 'IN_PIPELINE' },
    });

    await prisma.leadActivite.create({
      data: {
        organizationId: req.organizationId!,
        leadId: lead.id,
        type: 'NOTE',
        title: 'Import Prospection IA',
        content: `Prospect IA #${row.id} — score ${row.score}`,
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
