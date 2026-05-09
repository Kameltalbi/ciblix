import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';
import auth, { AuthRequest, requirePaymentApproved } from '../middleware/auth.js';
import { ActiviteType } from '../lib/prismaInterop.js';
import { parsePagination } from '../lib/pagination.js';

export const activitesRoutes = Router();
activitesRoutes.use(auth);
activitesRoutes.use(requirePaymentApproved);

const RDV_CAL_PREFIX = 'SYNTH_RDV_ACTIVITE:';

const activiteSchema = z
  .object({
    affaireId: z.string(),
    type: z.nativeEnum(ActiviteType),
    title: z.string().min(1),
    content: z.string().optional(),
    /** ISO-ish string from datetime-local; used only when type = RDV to créer une entrée Calendrier */
    scheduledStart: z
      .preprocess((v) => {
        if (typeof v !== 'string') return undefined;
        const s = v.trim();
        if (!s) return undefined;
        const d = new Date(s);
        return Number.isNaN(d.getTime()) ? undefined : s;
      }, z.string().optional()),
  })
  .strict();

async function ensureAffaireInOrganization(affaireId: string, organizationId?: string) {
  if (!organizationId) return null;
  return prisma.affaire.findFirst({
    where: { id: affaireId, organizationId, deletedAt: null },
    select: { id: true },
  });
}

// ─── LIST ─────────────────────────────────────────────────────
activitesRoutes.get('/', async (req: AuthRequest, res, next) => {
  try {
    const { page, limit, skip } = parsePagination(req.query);
    const where = { organizationId: req.organizationId };

    const [activites, total] = await Promise.all([
      prisma.activite.findMany({
        where,
        include: { affaire: { include: { client: true } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.activite.count({ where }),
    ]);

    res.json({
      data: activites,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (e) { next(e); }
});

// ─── GET single ───────────────────────────────────────────────
activitesRoutes.get('/:id', async (req: AuthRequest, res, next) => {
  try {
    const activite = await prisma.activite.findFirst({
      where: { 
        id: req.params.id as string,
        organizationId: req.organizationId,
      },
      include: { affaire: { include: { client: true } } },
    });
    if (!activite) return res.status(404).json({ error: 'Activité introuvable' });
    res.json(activite);
  } catch (e) { next(e); }
});

// ─── CREATE ───────────────────────────────────────────────────
activitesRoutes.post('/', async (req: AuthRequest, res, next) => {
  try {
    const data = activiteSchema.parse(req.body);
    const { scheduledStart, ...rest } = data;
    const affaire = await ensureAffaireInOrganization(data.affaireId, req.organizationId);
    if (!affaire) return res.status(404).json({ error: 'Affaire introuvable' });

    const activite = await prisma.activite.create({
      data: { ...rest, organizationId: req.organizationId! },
      include: { affaire: { include: { client: true } } },
    });

    if (activite.type === 'RDV' && scheduledStart) {
      const startDate = new Date(scheduledStart);
      if (!Number.isNaN(startDate.getTime())) {
        const endDate = new Date(startDate.getTime() + 60 * 60 * 1000);
        await prisma.calendarEvent.create({
          data: {
            organizationId: req.organizationId!,
            createdById: req.userId ?? null,
            title: activite.title.slice(0, 250),
            description: `${RDV_CAL_PREFIX}${activite.id}\n${activite.content ?? ''}`.slice(0, 8000),
            startDate,
            endDate,
            allDay: false,
            eventType: 'MEETING',
            location: null,
            relatedAffaireId: activite.affaireId,
            status: 'SCHEDULED',
          },
        });
      }
    }
    res.status(201).json(activite);
  } catch (e) { next(e); }
});

// ─── UPDATE ───────────────────────────────────────────────────
activitesRoutes.put('/:id', async (req: AuthRequest, res, next) => {
  try {
    const data = activiteSchema.partial().parse(req.body);
    const existing = await prisma.activite.findFirst({
      where: { id: req.params.id as string, organizationId: req.organizationId },
    });
    if (!existing) return res.status(404).json({ error: 'Activité introuvable' });

    if (data.affaireId) {
      const affaire = await ensureAffaireInOrganization(data.affaireId, req.organizationId);
      if (!affaire) return res.status(404).json({ error: 'Affaire introuvable' });
    }

    const { scheduledStart: _ignoreScheduled, ...updates } = data;

    const activite = await prisma.activite.update({
      where: { id: req.params.id as string },
      data: updates,
      include: { affaire: { include: { client: true } } },
    });
    res.json(activite);
  } catch (e) { next(e); }
});

// ─── DELETE ───────────────────────────────────────────────────
activitesRoutes.delete('/:id', async (req: AuthRequest, res, next) => {
  try {
    const existing = await prisma.activite.findFirst({
      where: { id: req.params.id as string, organizationId: req.organizationId },
    });
    if (!existing) return res.status(404).json({ error: 'Activité introuvable' });

    if (existing.type === 'RDV') {
      const prefix = `${RDV_CAL_PREFIX}${existing.id}`;
      const cal = await prisma.calendarEvent.findFirst({
        where: {
          organizationId: req.organizationId!,
          deletedAt: null,
          description: { startsWith: prefix },
        },
      });
      if (cal) {
        await prisma.calendarEvent.update({
          where: { id: cal.id },
          data: { deletedAt: new Date() },
        });
      }
    }

    await prisma.activite.delete({ where: { id: req.params.id as string } });
    res.status(204).send();
  } catch (e) { next(e); }
});
