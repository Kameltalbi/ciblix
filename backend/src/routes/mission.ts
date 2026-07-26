import { Router } from 'express';
import { z } from 'zod';
import auth, { AuthRequest, requirePaymentApproved } from '../middleware/auth.js';
import { DETECT_SIGNAL_OPTIONS } from '../services/agent-team/missionConstants.js';
import {
  activateMission,
  applyMissionUpdate,
  extractInsightsFromBrief,
  getMissionStatus,
  getOrCreateMissionProfile,
  saveMissionDraft,
  buildMissionSummary,
} from '../services/agent-team/missionService.js';
import {
  GEO_ZONE_PRESETS,
  confirmInverseIcp,
  recordProspectFeedback,
  runOnboardingBootstrap,
  validateOfferSheet,
  parseOfferSheet,
  isOfferSheetValidated,
} from '../services/tenant-onboarding/index.js';

export const missionRoutes = Router();

missionRoutes.use(auth);
missionRoutes.use(requirePaymentApproved);

const idealProfileSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(200),
  description: z.string().max(2000).default(''),
  importance: z.number().int().min(1).max(5).default(3),
  sector: z.string().max(200).optional(),
  companySize: z.string().max(120).optional(),
  constraints: z.string().max(1000).optional(),
});

const draftSchema = z.object({
  missionStep: z.number().int().min(1).max(7).optional(),
  companyBrief: z.string().max(8000).nullable().optional(),
  countries: z.array(z.string().max(120)).max(40).optional(),
  regions: z.array(z.string().max(120)).max(40).optional(),
  cities: z.array(z.string().max(120)).max(40).optional(),
  markets: z.array(z.string().max(120)).max(40).optional(),
  idealProfiles: z.array(idealProfileSchema).max(20).optional(),
  detectSignals: z.array(z.string().max(80)).max(30).optional(),
  commercialPriorities: z.string().max(4000).nullable().optional(),
  excludeCompanies: z.array(z.string().max(200)).max(80).optional(),
  excludeClients: z.array(z.string().max(200)).max(80).optional(),
  excludeCompetitors: z.array(z.string().max(200)).max(80).optional(),
  excludePartners: z.array(z.string().max(200)).max(80).optional(),
  excludeSectors: z.array(z.string().max(200)).max(40).optional(),
  excludeCountries: z.array(z.string().max(120)).max(40).optional(),
});

missionRoutes.get('/status', async (req: AuthRequest, res, next) => {
  try {
    const status = await getMissionStatus(req.organizationId!);
    res.json(status);
  } catch (err) {
    next(err);
  }
});

missionRoutes.get('/signals', (_req, res) => {
  res.json({
    signals: DETECT_SIGNAL_OPTIONS.map((s) => ({
      id: s.id,
      labelFr: s.labelFr,
      labelEn: s.labelEn,
    })),
  });
});

missionRoutes.get('/', async (req: AuthRequest, res, next) => {
  try {
    const profile = await getOrCreateMissionProfile(req.organizationId!);
    res.json({
      profile,
      signals: DETECT_SIGNAL_OPTIONS,
      geoZonePresets: GEO_ZONE_PRESETS,
      offerValidated: isOfferSheetValidated(parseOfferSheet(profile.offerSheet)),
    });
  } catch (err) {
    next(err);
  }
});

/** Onboarding V2 — 3 champs → extraction + ICP inversé + brouillon offre */
missionRoutes.post('/onboarding/bootstrap', async (req: AuthRequest, res, next) => {
  try {
    const body = z
      .object({
        sourceType: z.enum(['website', 'facebook', 'linkedin', 'pdf', 'name_brief']),
        sourceUrl: z.string().max(2000).nullable().optional(),
        sourceLabel: z.string().max(500).nullable().optional(),
        freeText: z.string().max(8000).nullable().optional(),
        referenceClients: z.array(z.string().min(1).max(200)).min(1).max(8),
        geoZonePresets: z.array(z.string().max(80)).min(1).max(8),
        customGeo: z.array(z.string().max(120)).max(20).optional(),
      })
      .parse(req.body);

    if (
      ['website', 'facebook', 'linkedin'].includes(body.sourceType) &&
      !body.sourceUrl?.trim() &&
      !body.freeText?.trim()
    ) {
      res.status(400).json({ error: 'SOURCE_REQUIRED', code: 'SOURCE_REQUIRED' });
      return;
    }
    if (body.sourceType === 'name_brief' && !body.freeText?.trim()) {
      res.status(400).json({ error: 'BRIEF_REQUIRED', code: 'BRIEF_REQUIRED' });
      return;
    }

    const result = await runOnboardingBootstrap(req.organizationId!, {
      sourceType: body.sourceType,
      sourceUrl: body.sourceUrl,
      sourceLabel: body.sourceLabel,
      freeText: body.freeText,
      referenceClients: body.referenceClients,
      geoZonePresets: body.geoZonePresets,
      customGeo: body.customGeo,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

missionRoutes.post('/onboarding/confirm-icp', async (req: AuthRequest, res, next) => {
  try {
    const body = z
      .object({
        accepted: z.boolean(),
        secteurs_cibles: z.array(z.string()).max(20).optional(),
        zones: z.array(z.string()).max(20).optional(),
        taille_min: z.number().int().min(1).max(100000).nullable().optional(),
        taille_max: z.number().int().min(1).max(100000).nullable().optional(),
        type_acheteur: z.string().max(40).optional(),
        texte_naturel: z.string().max(2000).optional(),
      })
      .parse(req.body);
    const profile = await confirmInverseIcp(req.organizationId!, body);
    res.json({ profile });
  } catch (err) {
    next(err);
  }
});

missionRoutes.post('/onboarding/validate-offer', async (req: AuthRequest, res, next) => {
  try {
    const body = z
      .object({
        services_valides: z
          .array(
            z.object({
              libelle: z.string().min(1).max(200),
              description_courte: z.string().max(1000).default(''),
              cible_typique: z.string().max(400).default(''),
              valide_par_tenant: z.boolean(),
              source_extraction: z.string().max(2000).nullable().optional(),
            })
          )
          .max(40),
        proposition_de_valeur: z.string().max(4000).default(''),
      })
      .parse(req.body);
    const profile = await validateOfferSheet(req.organizationId!, req.userId!, {
      services_valides: body.services_valides.map((s) => ({
        ...s,
        source_extraction: s.source_extraction ?? null,
      })),
      proposition_de_valeur: body.proposition_de_valeur,
      validee_le: null,
      validee_par: null,
    });
    res.json({ profile, offerValidated: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === 'OFFER_SHEET_EMPTY') {
      res.status(400).json({ error: msg, code: msg });
      return;
    }
    next(err);
  }
});

missionRoutes.post('/feedback/prospect', async (req: AuthRequest, res, next) => {
  try {
    const body = z
      .object({
        pertinent: z.boolean(),
        motif: z
          .enum([
            'trop_petite',
            'trop_grande',
            'mauvais_secteur',
            'mauvaise_zone',
            'deja_client',
            'concurrent',
            'autre',
          ])
          .nullable()
          .optional(),
        companyName: z.string().max(200).nullable().optional(),
      })
      .parse(req.body);
    const result = await recordProspectFeedback({
      organizationId: req.organizationId!,
      pertinent: body.pertinent,
      motif: body.motif,
      companyName: body.companyName,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/** Sauvegarde auto du brouillon (à chaque étape). */
missionRoutes.put('/draft', async (req: AuthRequest, res, next) => {
  try {
    const body = draftSchema.parse(req.body);
    const profile = await saveMissionDraft(req.organizationId!, body);
    if (profile.missionStatus === 'ACTIVE') {
      await applyMissionUpdate(req.organizationId!);
    }
    const fresh = await getOrCreateMissionProfile(req.organizationId!);
    res.json({ profile: fresh });
  } catch (err) {
    next(err);
  }
});

/** Étape 1 — analyse IA de la description entreprise. */
missionRoutes.post('/extract', async (req: AuthRequest, res, next) => {
  try {
    const body = z.object({ brief: z.string().min(20).max(8000) }).parse(req.body);
    const insights = await extractInsightsFromBrief(body.brief);
    const profile = await saveMissionDraft(req.organizationId!, {
      companyBrief: body.brief,
      extractedInsights: insights,
      sectors: insights.sectors,
      productsServices: [...insights.products, ...insights.services],
      keywords: insights.keywords,
      excludeCompanies: insights.potentialExclusions,
      missionStep: 2,
    });
    res.json({ insights, profile });
  } catch (err) {
    next(err);
  }
});

missionRoutes.post('/preview-summary', async (req: AuthRequest, res, next) => {
  try {
    const profile = await getOrCreateMissionProfile(req.organizationId!);
    const summary = await buildMissionSummary(profile);
    const updated = await saveMissionDraft(req.organizationId!, {
      missionStep: 7,
    });
    await import('../db/prisma.js').then(({ prisma }) =>
      prisma.orgTargetingProfile.update({
        where: { organizationId: req.organizationId! },
        data: { missionSummary: summary },
      })
    );
    res.json({ summary, profile: { ...updated, missionSummary: summary } });
  } catch (err) {
    next(err);
  }
});

/** Lance la mission — démarre les agents. */
missionRoutes.post('/activate', async (req: AuthRequest, res, next) => {
  try {
    const profile = await activateMission(req.organizationId!);
    res.json({ ok: true, profile });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.startsWith('MISSION_')) {
      res.status(400).json({ error: msg, code: msg });
      return;
    }
    next(err);
  }
});
