import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';
import auth, { AuthRequest } from '../middleware/auth.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { getUploadsDir } from '../lib/uploadsDir.js';
import { mapOrganizationLogoInPlace, normalizeOrganizationLogoUrlForApi, organizationLogoFilenameFromStored } from '../lib/organizationLogoUrl.js';
import { parsePipelineThresholds, DEFAULT_PIPELINE_THRESHOLDS } from '../services/agent-memory/computePipelineStatus.js';
import { upsertCopilotOrgConfig } from '../services/copilot/orgConfig.js';
import { SECTOR_TEMPLATES, getSectorTemplate } from '../services/copilot/sectorTemplates.js';
import { ensureBillingSubscription, changeTier } from '../services/billing/billingService.js';
import type { BillingTier } from '@prisma/client';

export const organizationsRoutes = Router();
organizationsRoutes.use(auth);

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, getUploadsDir());
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'logo-' + uniqueSuffix + path.extname(file.originalname));
  },
});

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ALLOWED_IMAGE_TYPES.includes(file.mimetype) && ALLOWED_EXTENSIONS.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Seuls les fichiers images (JPEG, PNG, GIF, WebP) sont autorisés'));
    }
  },
});

const organizationSchema = z.object({
  name: z.string().min(1),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  tva: z.string().optional(),
  logoUrl: z.string().optional(),
});

// GET /api/organizations - Get current user's organization
organizationsRoutes.get('/', async (req: AuthRequest, res, next) => {
  try {
    const organization = await prisma.organization.findUnique({
      where: { id: req.organizationId },
      include: {
        _count: {
          select: {
            users: true,
            clients: true,
            affaires: true,
          },
        },
      },
    });

    if (!organization) return res.status(404).json({ error: 'Organisation introuvable' });
    res.json(mapOrganizationLogoInPlace(organization));
  } catch (e) { next(e); }
});

// GET /api/organizations/logo — authenticated binary logo (must be registered BEFORE /:id)
organizationsRoutes.get('/logo', async (req: AuthRequest, res, next) => {
  try {
    const org = await prisma.organization.findUnique({
      where: { id: req.organizationId as string },
      select: { logoUrl: true },
    });
    const filename = organizationLogoFilenameFromStored(org?.logoUrl ?? null);
    if (!filename) {
      return res.status(404).end();
    }
    const filePath = path.resolve(path.join(getUploadsDir(), filename));
    if (!filePath.startsWith(path.resolve(getUploadsDir()))) {
      return res.status(400).end();
    }
    if (!fs.existsSync(filePath)) {
      return res.status(404).end();
    }
    res.setHeader('Cache-Control', 'private, max-age=300');
    res.sendFile(filePath, (err) => {
      if (err) next(err);
    });
  } catch (e) {
    next(e);
  }
});

// GET /api/organizations/:id - Get single organization (must belong to user)
organizationsRoutes.get('/:id', async (req: AuthRequest, res, next) => {
  try {
    if (req.params.id !== req.organizationId) {
      return res.status(403).json({ error: 'Accès refusé' });
    }

    const organization = await prisma.organization.findUnique({
      where: { id: req.params.id as string },
      include: {
        users: {
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            createdAt: true,
          },
        },
        _count: {
          select: {
            users: true,
            clients: true,
            affaires: true,
          },
        },
      },
    });

    if (!organization) return res.status(404).json({ error: 'Organisation introuvable' });
    res.json(mapOrganizationLogoInPlace(organization));
  } catch (e) { next(e); }
});

// POST /api/organizations - Create new organization (owner only)
organizationsRoutes.post('/', async (req: AuthRequest, res, next) => {
  try {
    const currentUser = await prisma.user.findUnique({
      where: { id: req.userId },
    });

    if (!currentUser || currentUser.role !== 'OWNER') {
      return res.status(403).json({ error: 'Accès refusé' });
    }

    const data = organizationSchema.parse(req.body);

    const organization = await prisma.organization.create({
      data,
    });

    // Create default email templates for new organization
    await prisma.emailTemplate.createMany({
      data: [
        {
          organizationId: organization.id,
          name: 'Suivi de devis',
          subject: 'Votre devis de {montant} DT pour {titre}',
          body: `Bonjour {client},

Nous avons le plaisir de vous envoyer votre devis de {montant} DT concernant : {titre}.

Détails de l'affaire :
- Montant : {montant} DT
- Probabilité : {probabilite}
- Statut : {statut}
- Date : {date}

N'hésitez pas à nous contacter pour toute question.

Cordialement`,
          variables: JSON.stringify(['client', 'montant', 'titre', 'probabilite', 'statut', 'date']),
          isActive: true,
        },
        {
          organizationId: organization.id,
          name: 'Relance client',
          subject: 'Relance : Votre affaire {titre}',
          body: `Bonjour {client},

Nous faisons suite à notre dernière échange concernant votre affaire : {titre}.

Statut actuel : {statut}
Montant : {montant} DT

Nous restons à votre disposition pour avancer sur ce dossier.

Cordialement`,
          variables: JSON.stringify(['client', 'titre', 'statut', 'montant']),
          isActive: true,
        },
        {
          organizationId: organization.id,
          name: 'Confirmation de commande',
          subject: 'Confirmation de votre commande - {titre}',
          body: `Bonjour {client},

Nous avons bien reçu votre commande pour : {titre}.

Montant : {montant} DT
Date : {date}

Votre commande est maintenant en cours de traitement. Nous vous tiendrons informé de son évolution.

Merci pour votre confiance.

Cordialement`,
          variables: JSON.stringify(['client', 'titre', 'montant', 'date']),
          isActive: true,
        },
      ],
    });

    res.status(201).json(mapOrganizationLogoInPlace(organization));
  } catch (e) { next(e); }
});

organizationsRoutes.get('/config/pipeline', async (req: AuthRequest, res, next) => {
  try {
    const org = await prisma.organization.findUnique({
      where: { id: req.organizationId! },
      select: { pipelineThresholds: true },
    });
    res.json({ thresholds: parsePipelineThresholds(org?.pipelineThresholds) });
  } catch (e) { next(e); }
});

organizationsRoutes.put('/config/pipeline', async (req: AuthRequest, res, next) => {
  try {
    if (req.user?.role !== 'OWNER' && req.user?.role !== 'SUPERADMIN') {
      return res.status(403).json({ error: 'Réservé au propriétaire' });
    }
    const body = z
      .object({
        chaudScore: z.number().min(0).max(100),
        chaudJours: z.number().min(1).max(365),
        relanceJours: z.number().min(1).max(365),
        tiedeScore: z.number().min(0).max(100),
        archiveJours: z.number().min(1).max(730),
      })
      .parse(req.body);

    if (body.chaudScore < body.tiedeScore) {
      return res.status(400).json({ error: 'Le seuil "chaud" doit être ≥ au seuil "tiède".' });
    }

    await prisma.organization.update({
      where: { id: req.organizationId! },
      data: { pipelineThresholds: body },
    });
    res.json({ thresholds: body });
  } catch (e) { next(e); }
});

organizationsRoutes.get('/config/compliance', async (req: AuthRequest, res, next) => {
  try {
    const org = await prisma.organization.findUnique({
      where: { id: req.organizationId! },
      select: {
        agentEventRawRetentionDays: true,
        telephonyRecordingConsentMode: true,
        telephonyConsentConfirmedAt: true,
      },
    });
    res.json(org);
  } catch (e) { next(e); }
});

organizationsRoutes.put('/config/compliance', async (req: AuthRequest, res, next) => {
  try {
    if (req.user?.role !== 'OWNER' && req.user?.role !== 'SUPERADMIN') {
      return res.status(403).json({ error: 'Réservé au propriétaire' });
    }
    const body = z
      .object({
        agentEventRawRetentionDays: z.number().int().min(7).max(365).optional(),
      })
      .parse(req.body);

    const org = await prisma.organization.update({
      where: { id: req.organizationId! },
      data: {
        ...(body.agentEventRawRetentionDays
          ? { agentEventRawRetentionDays: body.agentEventRawRetentionDays }
          : {}),
      },
      select: {
        agentEventRawRetentionDays: true,
        telephonyRecordingConsentMode: true,
        telephonyConsentConfirmedAt: true,
      },
    });
    res.json(org);
  } catch (e) { next(e); }
});

organizationsRoutes.get('/sector-templates', async (_req: AuthRequest, res) => {
  res.json(SECTOR_TEMPLATES.map(({ id, label, sector }) => ({ id, label, sector })));
});

organizationsRoutes.post('/onboarding/complete', async (req: AuthRequest, res, next) => {
  try {
    const body = z
      .object({
        sectorTemplateId: z.string().min(1),
        tier: z.enum(['DECOUVERTE', 'CROISSANCE', 'PRO', 'ENTERPRISE']).optional(),
        agentSlugs: z.array(z.string()).optional(),
      })
      .parse(req.body);

    const template = getSectorTemplate(body.sectorTemplateId) || getSectorTemplate('generic')!;

    await upsertCopilotOrgConfig(req.organizationId!, {
      sector: template.sector,
      businessLexicon: template.businessLexicon,
      scoringGrid: template.scoringGrid,
    });

    const tier = (body.tier || 'DECOUVERTE') as BillingTier;
    await ensureBillingSubscription(req.organizationId!, tier);
    if (tier === 'DECOUVERTE') {
      await changeTier(req.organizationId!, tier);
    }

    if (body.agentSlugs?.length) {
      for (const slug of body.agentSlugs) {
        await prisma.organizationAgent.upsert({
          where: {
            organizationId_agentSlug: { organizationId: req.organizationId!, agentSlug: slug },
          },
          create: { organizationId: req.organizationId!, agentSlug: slug, active: true },
          update: { active: true, deactivatedAt: null },
        });
      }
    }

    await prisma.organization.update({
      where: { id: req.organizationId! },
      data: {
        onboardingCompletedAt: new Date(),
        onboardingSector: template.sector,
        pipelineThresholds: DEFAULT_PIPELINE_THRESHOLDS,
      },
    });

    res.json({ ok: true, sector: template.sector, tier });
  } catch (e) { next(e); }
});

// PUT /api/organizations/:id - Update organization (must belong to user)
organizationsRoutes.put('/:id', async (req: AuthRequest, res, next) => {
  try {
    if (req.params.id !== req.organizationId) {
      return res.status(403).json({ error: 'Accès refusé' });
    }

    const data = organizationSchema.partial().parse(req.body);

    const organization = await prisma.organization.update({
      where: { id: req.params.id as string },
      data,
    });

    res.json(mapOrganizationLogoInPlace(organization));
  } catch (e) { next(e); }
});

// DELETE /api/organizations/:id - Delete organization (must belong to user)
organizationsRoutes.delete('/:id', async (req: AuthRequest, res, next) => {
  try {
    if (req.params.id !== req.organizationId) {
      return res.status(403).json({ error: 'Accès refusé' });
    }

    // Check if organization has users
    const organization = await prisma.organization.findUnique({
      where: { id: req.params.id as string },
      include: { _count: { select: { users: true } } },
    });

    if (!organization) return res.status(404).json({ error: 'Organisation introuvable' });
    if (organization._count.users > 0) {
      return res.status(400).json({ error: 'Impossible de supprimer une organisation avec des utilisateurs' });
    }

    await prisma.organization.delete({
      where: { id: req.params.id as string },
    });

    res.json({ success: true });
  } catch (e) { next(e); }
});

// POST /api/organizations/:id/logo - Upload organization logo (must belong to user)
organizationsRoutes.post('/:id/logo', upload.single('logo'), async (req: AuthRequest, res, next) => {
  try {
    if (req.params.id !== req.organizationId) {
      return res.status(403).json({ error: 'Accès refusé' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'Aucun fichier fourni' });
    }

    const logoUrl = `/api/uploads/${req.file.filename}`;

    const organization = await prisma.organization.update({
      where: { id: req.params.id as string },
      data: { logoUrl },
    });

    const normalized = normalizeOrganizationLogoUrlForApi(logoUrl);
    res.json({
      logoUrl: normalized,
      organization: mapOrganizationLogoInPlace(organization),
    });
  } catch (e) { next(e); }
});
