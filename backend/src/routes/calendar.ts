import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';
import auth, { AuthRequest } from '../middleware/auth.js';

export const calendarRoutes = Router();

calendarRoutes.use(auth);

const calendarEventSchema = z.object({
  title: z.string().min(1),
  description: z.string().nullable().optional(),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  allDay: z.union([z.boolean(), z.literal('true'), z.literal('false')]).optional(),
  eventType: z.string().optional().default('MEETING'),
  location: z.string().nullable().optional(),
  relatedAffaireId: z.string().nullable().optional(),
  relatedLeadId: z.string().nullable().optional(),
  status: z.string().optional().default('SCHEDULED'),
  reminderMinutes: z.union([z.number(), z.string()]).nullable().optional(),
});

async function validateRelatedRecords(
  organizationId: string,
  relatedAffaireId?: string | null,
  relatedLeadId?: string | null
) {
  if (relatedAffaireId && relatedAffaireId !== 'none') {
    const affaire = await prisma.affaire.findFirst({
      where: { id: relatedAffaireId, organizationId, deletedAt: null },
      select: { id: true },
    });
    if (!affaire) return 'Affaire introuvable';
  }

  if (relatedLeadId && relatedLeadId !== 'none') {
    const lead = await prisma.lead.findFirst({
      where: { id: relatedLeadId, organizationId, deletedAt: null },
      select: { id: true },
    });
    if (!lead) return 'Lead introuvable';
  }

  return null;
}

calendarRoutes.get('/', async (req: AuthRequest, res, next) => {
  try {
    const organizationId = req.organizationId as string;
    const { startDate, endDate, eventType, page = 1, limit = 50 } = req.query;

    const where: any = { organizationId, deletedAt: null };
    if (startDate) where.startDate = { gte: new Date(startDate as string) };
    if (endDate) where.endDate = { lte: new Date(endDate as string) };
    if (eventType) where.eventType = eventType;

    const skip = (Number(page) - 1) * Number(limit);

    const [events, total] = await Promise.all([
      prisma.calendarEvent.findMany({
        where,
        include: {
          relatedAffaire: { include: { client: true } },
          relatedLead: true,
          createdBy: { select: { id: true, name: true, email: true } },
        },
        orderBy: { startDate: 'asc' },
        skip,
        take: Number(limit),
      }),
      prisma.calendarEvent.count({ where }),
    ]);

    res.json({
      data: events,
      pagination: {
        currentPage: Number(page),
        totalPages: Math.ceil(total / Number(limit)),
        total,
      },
    });
  } catch (e) { next(e); }
});

calendarRoutes.get('/:id', async (req: AuthRequest, res, next) => {
  try {
    const event = await prisma.calendarEvent.findFirst({
      where: { id: req.params.id, organizationId: req.organizationId as string, deletedAt: null },
      include: {
        relatedAffaire: { include: { client: true } },
        relatedLead: true,
        createdBy: { select: { id: true, name: true, email: true } },
      },
    });

    if (!event) return res.status(404).json({ error: 'Événement introuvable' });
    res.json(event);
  } catch (e) { next(e); }
});

calendarRoutes.post('/', async (req: AuthRequest, res, next) => {
  try {
    const data = calendarEventSchema.parse(req.body);
    const organizationId = req.organizationId as string;
    const userId = req.userId as string;

    const relationError = await validateRelatedRecords(organizationId, data.relatedAffaireId, data.relatedLeadId);
    if (relationError) return res.status(404).json({ error: relationError });

    const event = await prisma.calendarEvent.create({
      data: {
        organizationId,
        createdById: userId,
        title: data.title,
        description: data.description || null,
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
        allDay: data.allDay === true || data.allDay === 'true',
        eventType: data.eventType,
        location: data.location || null,
        relatedAffaireId: data.relatedAffaireId && data.relatedAffaireId !== 'none' ? data.relatedAffaireId : null,
        relatedLeadId: data.relatedLeadId && data.relatedLeadId !== 'none' ? data.relatedLeadId : null,
        status: data.status,
        reminderMinutes: data.reminderMinutes ? Number(data.reminderMinutes) : null,
      },
      include: {
        relatedAffaire: { include: { client: true } },
        relatedLead: true,
        createdBy: { select: { id: true, name: true, email: true } },
      },
    });

    res.status(201).json(event);
  } catch (e) { next(e); }
});

calendarRoutes.put('/:id', async (req: AuthRequest, res, next) => {
  try {
    const data = calendarEventSchema.partial().parse(req.body);
    const organizationId = req.organizationId as string;

    const existingEvent = await prisma.calendarEvent.findFirst({
      where: { id: req.params.id, organizationId, deletedAt: null },
    });
    if (!existingEvent) return res.status(404).json({ error: 'Événement introuvable' });

    const relationError = await validateRelatedRecords(organizationId, data.relatedAffaireId, data.relatedLeadId);
    if (relationError) return res.status(404).json({ error: relationError });

    const event = await prisma.calendarEvent.update({
      where: { id: req.params.id },
      data: {
        ...(data.title !== undefined && { title: data.title }),
        ...(data.description !== undefined && { description: data.description || null }),
        ...(data.startDate !== undefined && { startDate: new Date(data.startDate) }),
        ...(data.endDate !== undefined && { endDate: new Date(data.endDate) }),
        ...(data.allDay !== undefined && { allDay: data.allDay === true || data.allDay === 'true' }),
        ...(data.eventType !== undefined && { eventType: data.eventType }),
        ...(data.location !== undefined && { location: data.location || null }),
        ...(data.relatedAffaireId !== undefined && { relatedAffaireId: data.relatedAffaireId && data.relatedAffaireId !== 'none' ? data.relatedAffaireId : null }),
        ...(data.relatedLeadId !== undefined && { relatedLeadId: data.relatedLeadId && data.relatedLeadId !== 'none' ? data.relatedLeadId : null }),
        ...(data.status !== undefined && { status: data.status }),
        ...(data.reminderMinutes !== undefined && { reminderMinutes: data.reminderMinutes ? Number(data.reminderMinutes) : null }),
      },
      include: {
        relatedAffaire: { include: { client: true } },
        relatedLead: true,
        createdBy: { select: { id: true, name: true, email: true } },
      },
    });

    res.json(event);
  } catch (e) { next(e); }
});

calendarRoutes.delete('/:id', async (req: AuthRequest, res, next) => {
  try {
    const existingEvent = await prisma.calendarEvent.findFirst({
      where: { id: req.params.id, organizationId: req.organizationId as string, deletedAt: null },
    });
    if (!existingEvent) return res.status(404).json({ error: 'Événement introuvable' });

    await prisma.calendarEvent.update({
      where: { id: req.params.id },
      data: { deletedAt: new Date() },
    });

    res.status(204).send();
  } catch (e) { next(e); }
});
