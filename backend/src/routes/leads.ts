import { Router } from 'express';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import auth, { AuthRequest, requirePaymentApproved } from '../middleware/auth.js';
import { checkProspectLimit } from '../middleware/planRestrictions.js';

export const leadsRoutes = Router();
const prisma = new PrismaClient();

// Apply auth middleware to all routes
leadsRoutes.use(auth);
leadsRoutes.use(requirePaymentApproved);

const toOptionalNumber = z.preprocess(
  (v) => (v === '' || v === null || v === undefined ? undefined : Number(v)),
  z.number().optional()
);

const leadSchema = z.object({
  name: z.string().min(1),
  contactName: z.string().optional(),
  email: z.preprocess((v) => (v === '' ? undefined : v), z.string().email().optional()),
  phone: z.string().optional(),
  company: z.string().optional(),
  source: z.string().optional(),
  status: z.string().optional(),
  score: z.preprocess(
    (v) => (v === '' || v === null || v === undefined ? undefined : Number(v)),
    z.number().min(0).max(100).optional()
  ),
  estimatedValue: toOptionalNumber,
  notes: z.string().optional(),
  clientId: z.preprocess((v) => (v === '' ? undefined : v), z.string().optional()),
});

const leadUpdateSchema = leadSchema.partial();
const convertLeadSchema = z.object({
  createAffaire: z.boolean().optional().default(true),
});

// GET /leads - Get all leads for the organization
leadsRoutes.get('/', async (req: any, res) => {
  try {
    const organizationId = req.organizationId;
    const { status, source, page = 1, limit = 50 } = req.query;

    const where: any = { organizationId, deletedAt: null };
    if (status) where.status = status;
    if (source) where.source = source;

    const skip = (Number(page) - 1) * Number(limit);

    const [data, total] = await Promise.all([
      prisma.lead.findMany({
        where,
        include: {
          client: true,
          createdBy: { select: { id: true, name: true, email: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: Number(limit),
      }),
      prisma.lead.count({ where }),
    ]);

    res.json({
      data,
      pagination: {
        currentPage: Number(page),
        totalPages: Math.ceil(total / Number(limit)),
        total,
      },
    });
  } catch (error) {
    console.error('Error fetching leads:', error);
    res.status(500).json({ error: 'Failed to fetch leads' });
  }
});

// GET /leads/:id - Get a single lead
leadsRoutes.get('/:id', async (req: any, res) => {
  try {
    const organizationId = req.organizationId;
    const lead = await prisma.lead.findFirst({
      where: { id: req.params.id, organizationId, deletedAt: null },
      include: {
        client: true,
        createdBy: { select: { id: true, name: true, email: true } },
        activites: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!lead) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    res.json(lead);
  } catch (error) {
    console.error('Error fetching lead:', error);
    res.status(500).json({ error: 'Failed to fetch lead' });
  }
});

// POST /leads - Create a new lead
leadsRoutes.post('/', checkProspectLimit, async (req: AuthRequest, res, next) => {
  try {
    const organizationId = req.organizationId;
    const userId = req.userId;

    const data = leadSchema.parse(req.body);
    if (data.clientId) {
      const client = await prisma.client.findFirst({
        where: { id: data.clientId, organizationId, deletedAt: null },
        select: { id: true },
      });
      if (!client) return res.status(404).json({ error: 'Client not found' });
    }

    const lead = await prisma.lead.create({
      data: {
        ...data,
        organizationId,
        createdById: userId,
      } as any,
      include: {
        client: true,
        createdBy: { select: { id: true, name: true, email: true } },
        activites: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    res.status(201).json(lead);
  } catch (error) {
    console.error('Error creating lead:', error);
    res.status(500).json({ error: 'Failed to create lead' });
  }
});

// PUT /leads/:id - Update a lead
leadsRoutes.put('/:id', async (req: any, res) => {
  try {
    const organizationId = req.organizationId;

    const existingLead = await prisma.lead.findFirst({
      where: { id: req.params.id, organizationId, deletedAt: null },
    });

    if (!existingLead) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    const data = leadUpdateSchema.parse(req.body);

    const lead = await prisma.lead.update({
      where: { id: req.params.id },
      data: data as any,
      include: {
        client: true,
        createdBy: { select: { id: true, name: true, email: true } },
      },
    });

    res.json(lead);
  } catch (error) {
    console.error('Error updating lead:', error);
    res.status(500).json({ error: 'Failed to update lead' });
  }
});

// DELETE /leads/:id - Soft delete a lead
leadsRoutes.delete('/:id', async (req: any, res) => {
  try {
    const organizationId = req.organizationId;

    const existingLead = await prisma.lead.findFirst({
      where: { id: req.params.id, organizationId, deletedAt: null },
    });

    if (!existingLead) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    await prisma.lead.update({
      where: { id: req.params.id },
      data: { deletedAt: new Date() },
    });

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting lead:', error);
    res.status(500).json({ error: 'Failed to delete lead' });
  }
});

// POST /leads/:id/convert - Convert lead to client
leadsRoutes.post('/:id/convert', async (req: any, res) => {
  try {
    const organizationId = req.organizationId;
    const userId = req.userId;
    const { createAffaire } = convertLeadSchema.parse(req.body ?? {});

    const lead = await prisma.lead.findFirst({
      where: { id: req.params.id, organizationId, deletedAt: null },
    });

    if (!lead) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    if (lead.status === 'CONVERTED') {
      return res.status(400).json({ error: 'Lead already converted' });
    }

    // Create client from lead
    const client = await prisma.client.create({
      data: {
        organizationId,
        createdById: userId,
        name: lead.company || lead.name,
        contactName: lead.contactName,
        email: lead.email,
        phone: lead.phone,
        notes: lead.notes,
        qualificatif: 'CLIENT',
      },
    });

    let affaire: any = null;
    if (createAffaire) {
      const now = new Date();
      const defaultType = lead.company || lead.name || 'Prospection';
      const defaultTitle = `Prospection - ${client.name}`;
      const normalizedScore = Number.isFinite(Number(lead.score))
        ? Math.max(0, Math.min(100, Number(lead.score)))
        : 50;
      const estimated = Number(lead.estimatedValue || 0);

      affaire = await prisma.affaire.create({
        data: {
          organizationId,
          createdById: userId,
          clientId: client.id,
          title: defaultTitle,
          type: defaultType,
          montantHT: estimated,
          statut: 'PROSPECT',
          probabilite: normalizedScore,
          moisPrevu: now.getMonth() + 1,
          anneePrevue: now.getFullYear(),
          notes: lead.notes || undefined,
        },
        include: {
          client: true,
          product: true,
        },
      });

      await prisma.activite.create({
        data: {
          organizationId,
          affaireId: affaire.id,
          type: 'AUTRE',
          title: 'Affaire créée depuis un prospect',
          content: `Conversion automatique du prospect ${lead.name}`,
        },
      });
    }

    // Update lead
    const updatedLead = await prisma.lead.update({
      where: { id: req.params.id },
      data: {
        status: 'CONVERTED',
        convertedToClientId: client.id,
      },
      include: {
        client: true,
        convertedToClient: true,
      },
    });

    res.json({ lead: updatedLead, client, affaire });
  } catch (error) {
    console.error('Error converting lead:', error);
    res.status(500).json({ error: 'Failed to convert lead' });
  }
});
