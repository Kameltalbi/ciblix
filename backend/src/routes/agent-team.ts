import { Router } from 'express';
import { z } from 'zod';
import auth, { AuthRequest, requirePaymentApproved } from '../middleware/auth.js';
import { prisma } from '../db/prisma.js';
import { overnightTeamStats } from '../services/agent-team/agentTaskService.js';
import { enqueueAgentTask } from '../services/agent-team/agentTaskService.js';
import { runOrchestratorTickNow } from '../services/agent-team/orchestrator.js';
import {
  ingestScribeInteraction,
  listBloqueesHumain,
  listFicheJournal,
} from '../services/company-fiche/index.js';
import { parseOfferSheet } from '../services/tenant-onboarding/index.js';

export const agentTeamRoutes = Router();

agentTeamRoutes.use(auth);
agentTeamRoutes.use(requirePaymentApproved);

const targetingSchema = z.object({
  activity: z.string().max(4000).nullable().optional(),
  companyBrief: z.string().max(8000).nullable().optional(),
  commercialPriorities: z.string().max(4000).nullable().optional(),
  identitySourceUrl: z.string().max(2000).nullable().optional(),
  inverseIcpText: z.string().max(4000).nullable().optional(),
  productsServices: z.array(z.string().max(200)).max(40).optional(),
  markets: z.array(z.string().max(120)).max(40).optional(),
  countries: z.array(z.string().max(120)).max(40).optional(),
  cities: z.array(z.string().max(120)).max(40).optional(),
  targetClients: z.array(z.string().max(200)).max(40).optional(),
  sectors: z.array(z.string().max(120)).max(40).optional(),
  keywords: z.array(z.string().max(120)).max(40).optional(),
  excludeCompanies: z.array(z.string().max(200)).max(80).optional(),
  orchestratorEnabled: z.boolean().optional(),
  orchestratorIntervalH: z.number().int().min(1).max(168).optional(),
  minScoutScoreToHandoff: z.number().int().min(0).max(100).optional(),
});

agentTeamRoutes.get('/targeting', async (req: AuthRequest, res, next) => {
  try {
    const profile = await prisma.orgTargetingProfile.findUnique({
      where: { organizationId: req.organizationId! },
    });
    res.json({
      profile: profile || {
        activity: null,
        productsServices: [],
        markets: [],
        countries: [],
        cities: [],
        targetClients: [],
        sectors: [],
        keywords: [],
        excludeCompanies: [],
        orchestratorEnabled: true,
        orchestratorIntervalH: 1,
        minScoutScoreToHandoff: 55,
        lastOrchestratorAt: null,
      },
    });
  } catch (err) {
    next(err);
  }
});

agentTeamRoutes.put('/targeting', async (req: AuthRequest, res, next) => {
  try {
    const body = targetingSchema.parse(req.body);
    const organizationId = req.organizationId!;

    const profile = await prisma.orgTargetingProfile.upsert({
      where: { organizationId },
      create: {
        organizationId,
        activity: body.activity ?? null,
        companyBrief: body.companyBrief ?? null,
        commercialPriorities: body.commercialPriorities ?? null,
        identitySourceUrl: body.identitySourceUrl ?? null,
        inverseIcpText: body.inverseIcpText ?? null,
        productsServices: body.productsServices ?? [],
        markets: body.markets ?? [],
        countries: body.countries ?? [],
        cities: body.cities ?? [],
        targetClients: body.targetClients ?? [],
        sectors: body.sectors ?? [],
        keywords: body.keywords ?? [],
        excludeCompanies: body.excludeCompanies ?? [],
        orchestratorEnabled: body.orchestratorEnabled ?? true,
        orchestratorIntervalH: body.orchestratorIntervalH ?? 1,
        minScoutScoreToHandoff: body.minScoutScoreToHandoff ?? 55,
      },
      update: {
        ...(body.activity !== undefined ? { activity: body.activity } : {}),
        ...(body.companyBrief !== undefined ? { companyBrief: body.companyBrief } : {}),
        ...(body.commercialPriorities !== undefined
          ? { commercialPriorities: body.commercialPriorities }
          : {}),
        ...(body.identitySourceUrl !== undefined
          ? {
              identitySourceUrl: body.identitySourceUrl,
              ...(body.identitySourceUrl ? { identitySourceType: 'website' as const } : {}),
            }
          : {}),
        ...(body.inverseIcpText !== undefined ? { inverseIcpText: body.inverseIcpText } : {}),
        ...(body.productsServices !== undefined ? { productsServices: body.productsServices } : {}),
        ...(body.markets !== undefined ? { markets: body.markets } : {}),
        ...(body.countries !== undefined ? { countries: body.countries } : {}),
        ...(body.cities !== undefined ? { cities: body.cities } : {}),
        ...(body.targetClients !== undefined ? { targetClients: body.targetClients } : {}),
        ...(body.sectors !== undefined ? { sectors: body.sectors } : {}),
        ...(body.keywords !== undefined ? { keywords: body.keywords } : {}),
        ...(body.excludeCompanies !== undefined ? { excludeCompanies: body.excludeCompanies } : {}),
        ...(body.orchestratorEnabled !== undefined
          ? { orchestratorEnabled: body.orchestratorEnabled }
          : {}),
        ...(body.orchestratorIntervalH !== undefined
          ? { orchestratorIntervalH: body.orchestratorIntervalH }
          : {}),
        ...(body.minScoutScoreToHandoff !== undefined
          ? { minScoutScoreToHandoff: body.minScoutScoreToHandoff }
          : {}),
      },
    });

    // Synchronise la fiche offre (messages IA) avec les produits saisis
    if (body.productsServices !== undefined) {
      const services = body.productsServices
        .map((s) => s.trim())
        .filter(Boolean)
        .map((libelle) => ({
          libelle,
          description_courte: '',
          cible_typique: '',
          valide_par_tenant: true,
          source_extraction: null as string | null,
        }));
      if (services.length > 0) {
        const existing = parseOfferSheet(profile.offerSheet);
        await prisma.orgTargetingProfile.update({
          where: { organizationId },
          data: {
            offerSheet: {
              services_valides: services,
              proposition_de_valeur:
                body.activity?.trim() ||
                existing?.proposition_de_valeur ||
                profile.companyBrief ||
                '',
              validee_le: new Date().toISOString(),
              validee_par: req.userId || null,
            },
            offerValidatedAt: new Date(),
            offerValidatedBy: req.userId || null,
          },
        });
      }
    }

    // Aligne le profil Veilleur existant sur le ciblage
    const geoZones = [...profile.countries, ...profile.cities, ...profile.markets];
    const scout = await prisma.scoutProfile.findUnique({ where: { organizationId } });
    if (scout) {
      await prisma.scoutProfile.update({
        where: { organizationId },
        data: {
          keywords: (profile.keywords.length ? profile.keywords : scout.keywords) as object,
          sectors: (profile.sectors.length ? profile.sectors : scout.sectors) as object,
          geoZones: (geoZones.length ? geoZones : scout.geoZones) as object,
          autoScanEnabled: profile.orchestratorEnabled,
          scanIntervalH: Math.max(6, profile.orchestratorIntervalH),
        },
      });
    } else if (profile.keywords.length > 0) {
      await prisma.scoutProfile.create({
        data: {
          organizationId,
          keywords: profile.keywords as object,
          sectors: profile.sectors as object,
          geoZones: geoZones as object,
          autoScanEnabled: profile.orchestratorEnabled,
          scanIntervalH: Math.max(6, profile.orchestratorIntervalH),
        },
      });
    }

    res.json({ profile });
  } catch (err) {
    next(err);
  }
});

/** Résumé de ce que l’équipe IA a fait pendant l’absence. */
agentTeamRoutes.get('/overnight', async (req: AuthRequest, res, next) => {
  try {
    let since: Date;
    if (typeof req.query.since === 'string' && req.query.since) {
      const parsed = new Date(req.query.since);
      since = Number.isNaN(parsed.getTime())
        ? new Date(Date.now() - 24 * 3600_000)
        : parsed;
    } else {
      const hours = Math.min(168, Math.max(1, Number(req.query.hours) || 24));
      since = new Date(Date.now() - hours * 3600_000);
    }
    // Cap à 7 jours
    const minSince = new Date(Date.now() - 168 * 3600_000);
    if (since < minSince) since = minSince;

    const stats = await overnightTeamStats(req.organizationId!, since);
    const targeting = await prisma.orgTargetingProfile.findUnique({
      where: { organizationId: req.organizationId! },
      select: {
        orchestratorEnabled: true,
        keywords: true,
        activity: true,
        companyBrief: true,
        lastOrchestratorAt: true,
        missionStatus: true,
        missionCompletedAt: true,
      },
    });
    const pendingTasks = await prisma.agentTask.count({
      where: {
        organizationId: req.organizationId!,
        status: { in: ['PENDING', 'RUNNING'] },
      },
    });

    const teamConfigured = Boolean(
      targeting?.missionStatus === 'ACTIVE' && targeting.missionCompletedAt
    );

    res.json({
      ...stats,
      teamConfigured,
      missionStatus: targeting?.missionStatus || 'NONE',
      orchestratorEnabled: targeting?.orchestratorEnabled ?? false,
      lastOrchestratorAt: targeting?.lastOrchestratorAt?.toISOString() ?? null,
      pendingTasks,
      teamWorking: teamConfigured && (pendingTasks > 0 || Boolean(targeting?.orchestratorEnabled)),
    });
  } catch (err) {
    next(err);
  }
});

agentTeamRoutes.get('/tasks', async (req: AuthRequest, res, next) => {
  try {
    const tasks = await prisma.agentTask.findMany({
      where: { organizationId: req.organizationId! },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    res.json({ tasks });
  } catch (err) {
    next(err);
  }
});

/** Lance un cycle immédiat (Veilleur) — utile après config du ciblage. */
agentTeamRoutes.post('/run-now', async (req: AuthRequest, res, next) => {
  try {
    const organizationId = req.organizationId!;
    const profile = await prisma.orgTargetingProfile.findUnique({
      where: { organizationId },
    });
    if (!profile || profile.missionStatus !== 'ACTIVE' || !profile.missionCompletedAt) {
      res.status(403).json({
        error: 'MISSION_REQUIRED',
        code: 'MISSION_REQUIRED',
        message: 'Complétez la Mission IA avant de lancer les agents.',
      });
      return;
    }
    await prisma.orgTargetingProfile.update({
      where: { organizationId },
      data: { lastOrchestratorAt: null, orchestratorEnabled: true },
    });
    await enqueueAgentTask({
      organizationId,
      assignee: 'SCOUT',
      kind: 'WATCH_SIGNALS',
      priority: 95,
      dedupeKey: `watch:manual:${organizationId}:${Date.now()}`,
      payload: { triggeredBy: 'manual' },
    });
    void runOrchestratorTickNow();
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

const scribeSchema = z.object({
  contactId: z.string().min(1),
  texteBrut: z.string().min(1).max(8000),
  canal: z.enum(['whatsapp', 'email', 'appel', 'note', 'vocal']).default('note'),
});

/** Scribe — le commercial dicte / colle une note, le CRM se remplit. */
agentTeamRoutes.post('/scribe/ingest', async (req: AuthRequest, res, next) => {
  try {
    const body = scribeSchema.parse(req.body);
    const result = await ingestScribeInteraction({
      organizationId: req.organizationId!,
      contactId: body.contactId,
      userId: req.userId!,
      canal: body.canal,
      texteBrut: body.texteBrut,
    });
    res.json({
      etat: result.etat,
      needsHumanChoice: result.needsHumanChoice,
      options: result.options,
      structured: result.structured,
      champsEcrits: result.champsEcrits,
      raison: result.transition.raison,
      disclaimer: 'Relisez la prochaine action avant de l’exécuter.',
    });
  } catch (err) {
    next(err);
  }
});

/** Scribe continu — force une ré-analyse des sources publiques pour un dossier. */
agentTeamRoutes.post('/scribe/enrich', async (req: AuthRequest, res, next) => {
  try {
    const contactId = z.string().min(1).parse(req.body?.contactId);
    const contact = await prisma.contact.findFirst({
      where: { id: contactId, organizationId: req.organizationId!, erasedAt: null },
      select: { id: true },
    });
    if (!contact) return res.status(404).json({ error: 'Dossier introuvable' });

    const { enrichScribeContact } = await import('../services/company-fiche/scribeEnrichService.js');
    const result = await enrichScribeContact({
      organizationId: req.organizationId!,
      contactId,
      triggeredBy: 'manual',
    });
    res.json({ ok: true, ...result });
  } catch (err) {
    next(err);
  }
});

/** File « En attente de vous » */
agentTeamRoutes.get('/attente-humain', async (req: AuthRequest, res, next) => {
  try {
    const items = await listBloqueesHumain(req.organizationId!, 50);
    res.json({
      count: items.length,
      items: items.map((c) => ({
        id: c.id,
        companyName: c.companyName,
        name: c.name,
        motif: c.ficheBlockReason,
        at: c.ficheEtatAt,
      })),
    });
  } catch (err) {
    next(err);
  }
});

agentTeamRoutes.get('/fiches/:contactId/journal', async (req: AuthRequest, res, next) => {
  try {
    const contactId = req.params.contactId as string;
    const journal = await listFicheJournal(req.organizationId!, contactId, 40);
    res.json({ journal });
  } catch (err) {
    next(err);
  }
});

const correctionSchema = z.object({
  entrepriseId: z.string().min(1),
  type: z.enum([
    'ENTREPRISE_FERMEE',
    'ADRESSE_ERRONEE',
    'TELEPHONE_ERRONE',
    'SITE_INVALIDE',
    'SECTEUR_FAUX',
    'DOUBLON',
  ]),
  champ: z.string().max(80).optional().nullable(),
  valeurApres: z.string().max(2000).optional().nullable(),
  motif: z.string().max(1000).optional().nullable(),
});

/** Signalement remontant (faits publics) — jamais de décideur / score / historique. */
agentTeamRoutes.post('/referentiel/corrections', async (req: AuthRequest, res, next) => {
  try {
    const body = correctionSchema.parse(req.body);
    const { reportReferentielCorrection } = await import('../services/referentiel/index.js');
    const created = await reportReferentielCorrection({
      organizationId: req.organizationId!,
      userId: req.userId!,
      entrepriseId: body.entrepriseId,
      type: body.type,
      champ: body.champ,
      valeurApres: body.valeurApres,
      motif: body.motif,
    });
    res.json({ correction: created });
  } catch (err) {
    if (err instanceof Error && err.message === 'CORRECTION_RATE_LIMIT') {
      return res.status(429).json({ error: 'Trop de signalements aujourd’hui' });
    }
    next(err);
  }
});

agentTeamRoutes.get('/referentiel/corrections', async (req: AuthRequest, res, next) => {
  try {
    const rows = await prisma.referentielCorrection.findMany({
      where: { organizationId: req.organizationId! },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    res.json({ corrections: rows });
  } catch (err) {
    next(err);
  }
});
