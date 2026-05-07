import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';
import auth, { AuthRequest, requirePaymentApproved } from '../middleware/auth.js';
import { AuditAction } from '@prisma/client';
import { logAudit } from '../lib/audit.js';
import { parsePagination, PaginationResult } from '../lib/pagination.js';

export const clientsRoutes = Router();
clientsRoutes.use(auth);
clientsRoutes.use(requirePaymentApproved);

const clientSchema = z.object({
  name: z.string().min(1),
  contactName: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional(),
  address: z.string().optional(),
  matricule: z.string().optional(),
  qualificatif: z.string().optional(),
  notes: z.string().optional(),
});

clientsRoutes.get('/', async (req: AuthRequest, res, next) => {
  try {
    const { page, limit, skip } = parsePagination(req.query);
    const where = { organizationId: req.organizationId, deletedAt: null };

    const [clients, total] = await Promise.all([
      prisma.client.findMany({
        where,
        orderBy: { name: 'asc' },
        skip,
        take: limit,
        include: { _count: { select: { affaires: true } } },
      }),
      prisma.client.count({ where }),
    ]);

    res.json({
      data: clients,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (e) { next(e); }
});

clientsRoutes.get('/:id', async (req: AuthRequest, res, next) => {
  try {
    const client = await prisma.client.findFirst({
      where: { 
        id: req.params.id as string,
        organizationId: req.organizationId!,
      },
      include: {
        affaires: {
          include: {
            _count: { select: { activites: true } },
            activites: {
              orderBy: { createdAt: 'desc' },
            },
            product: true,
          },
          orderBy: [{ anneePrevue: 'desc' }, { moisPrevu: 'desc' }],
        },
      },
    });
    if (!client) return res.status(404).json({ error: 'Client introuvable' });
    res.json(client);
  } catch (e) { next(e); }
});

clientsRoutes.post('/', async (req: AuthRequest, res, next) => {
  try {
    const data = clientSchema.parse(req.body);

    // Check for duplicate client name in the same organization
    const existing = await prisma.client.findFirst({
      where: {
        organizationId: req.organizationId!,
        name: { equals: data.name, mode: 'insensitive' },
        deletedAt: null,
      },
    });
    if (existing) {
      return res.status(409).json({
        error: `Un client avec la raison sociale « ${data.name} » existe déjà (même organisation, majuscules ignorées). Utilisez la recherche sur la page Clients ou ouvrez la fiche pour la modifier.`,
      });
    }

    const client = await prisma.client.create({
      data: { ...data, createdById: req.userId, organizationId: req.organizationId! },
    });

    // Log audit
    await logAudit({
      organizationId: req.organizationId!,
      userId: req.userId!,
      action: AuditAction.CREATE,
      entityType: 'Client',
      entityId: client.id,
      newValues: data,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.status(201).json(client);
  } catch (e) { next(e); }
});

clientsRoutes.put('/:id', async (req: AuthRequest, res, next) => {
  try {
    const data = clientSchema.parse(req.body);
    const id = req.params.id as string;
    const oldClient = await prisma.client.findFirst({
      where: { id, organizationId: req.organizationId! },
    });
    if (!oldClient) return res.status(404).json({ error: 'Client introuvable' });
    const client = await prisma.client.update({
      where: { id },
      data,
    });

    // Log audit
    if (oldClient) {
      await logAudit({
        organizationId: req.organizationId!,
        userId: req.userId!,
        action: AuditAction.UPDATE,
        entityType: 'Client',
        entityId: client.id,
        oldValues: oldClient,
        newValues: data,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });
    }

    res.json(client);
  } catch (e) { next(e); }
});

clientsRoutes.delete('/:id', async (req: AuthRequest, res, next) => {
  try {
    const id = req.params.id as string;
    const oldClient = await prisma.client.findFirst({
      where: { id, organizationId: req.organizationId! },
    });
    if (!oldClient) return res.status(404).json({ error: 'Client introuvable' });
    await prisma.client.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    // Log audit
    if (oldClient) {
      await logAudit({
        organizationId: req.organizationId!,
        userId: req.userId!,
        action: AuditAction.DELETE,
        entityType: 'Client',
        entityId: id,
        oldValues: oldClient,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });
    }

    res.json({ success: true });
  } catch (e) { next(e); }
});

clientsRoutes.post('/import', async (req: AuthRequest, res, next) => {
  try {
    const importSchema = z.object({
      clients: z.array(clientSchema),
    });
    const { clients } = importSchema.parse(req.body);

    const createdClients = await prisma.client.createMany({
      data: clients.map(c => ({
        ...c,
        createdById: req.userId,
        organizationId: req.organizationId!,
      })),
      skipDuplicates: true,
    });

    // Log audit
    await logAudit({
      organizationId: req.organizationId!,
      userId: req.userId!,
      action: AuditAction.IMPORT,
      entityType: 'Client',
      entityId: 'bulk',
      newValues: { count: createdClients.count },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.status(201).json({ success: true, count: createdClients.count });
  } catch (e) { next(e); }
});
