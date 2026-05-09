import { Router } from 'express';
import { PrismaClient } from '../lib/prismaInterop.js';
import auth from '../middleware/auth.js';

export const calendarRoutes = Router();
const prisma = new PrismaClient();

// Apply auth middleware to all routes
calendarRoutes.use(auth);

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

// GET /calendar - Get all calendar events for the organization
calendarRoutes.get('/', async (req: any, res) => {
  try {
    const organizationId = req.organizationId;
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
  } catch (error) {
    console.error('Error fetching calendar events:', error);
    res.status(500).json({ error: 'Failed to fetch calendar events' });
  }
});

// GET /calendar/:id - Get a single calendar event
calendarRoutes.get('/:id', async (req: any, res) => {
  try {
    const organizationId = req.organizationId;
    const event = await prisma.calendarEvent.findFirst({
      where: { id: req.params.id, organizationId, deletedAt: null },
      include: {
        relatedAffaire: { include: { client: true } },
        relatedLead: true,
        createdBy: { select: { id: true, name: true, email: true } },
      },
    });

    if (!event) {
      return res.status(404).json({ error: 'Calendar event not found' });
    }

    res.json(event);
  } catch (error) {
    console.error('Error fetching calendar event:', error);
    res.status(500).json({ error: 'Failed to fetch calendar event' });
  }
});

// POST /calendar - Create a new calendar event
calendarRoutes.post('/', async (req: any, res) => {
  try {
    const organizationId = req.organizationId;
    const userId = req.userId;
    const {
      title,
      description,
      startDate,
      endDate,
      allDay,
      eventType,
      location,
      relatedAffaireId,
      relatedLeadId,
      status,
      reminderMinutes,
    } = req.body;

    const relationError = await validateRelatedRecords(organizationId, relatedAffaireId, relatedLeadId);
    if (relationError) return res.status(404).json({ error: relationError });

    const event = await prisma.calendarEvent.create({
      data: {
        organizationId,
        createdById: userId,
        title,
        description: description || null,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        allDay: allDay === true || allDay === 'true',
        eventType: eventType || 'MEETING',
        location: location || null,
        relatedAffaireId: relatedAffaireId && relatedAffaireId !== 'none' ? relatedAffaireId : null,
        relatedLeadId: relatedLeadId && relatedLeadId !== 'none' ? relatedLeadId : null,
        status: status || 'SCHEDULED',
        reminderMinutes: reminderMinutes ? Number(reminderMinutes) : null,
      },
      include: {
        relatedAffaire: { include: { client: true } },
        relatedLead: true,
        createdBy: { select: { id: true, name: true, email: true } },
      },
    });

    res.status(201).json(event);
  } catch (error) {
    console.error('Error creating calendar event:', error);
    res.status(500).json({ error: 'Failed to create calendar event' });
  }
});

// PUT /calendar/:id - Update a calendar event
calendarRoutes.put('/:id', async (req: any, res) => {
  try {
    const organizationId = req.organizationId;
    const {
      title,
      description,
      startDate,
      endDate,
      allDay,
      eventType,
      location,
      relatedAffaireId,
      relatedLeadId,
      status,
      reminderMinutes,
    } = req.body;

    const existingEvent = await prisma.calendarEvent.findFirst({
      where: { id: req.params.id, organizationId, deletedAt: null },
    });

    if (!existingEvent) {
      return res.status(404).json({ error: 'Calendar event not found' });
    }

    const relationError = await validateRelatedRecords(organizationId, relatedAffaireId, relatedLeadId);
    if (relationError) return res.status(404).json({ error: relationError });

    const event = await prisma.calendarEvent.update({
      where: { id: req.params.id },
      data: {
        ...(title !== undefined && { title }),
        ...(description !== undefined && { description: description || null }),
        ...(startDate !== undefined && { startDate: new Date(startDate) }),
        ...(endDate !== undefined && { endDate: new Date(endDate) }),
        ...(allDay !== undefined && { allDay: allDay === true || allDay === 'true' }),
        ...(eventType !== undefined && { eventType: eventType || 'MEETING' }),
        ...(location !== undefined && { location: location || null }),
        ...(relatedAffaireId !== undefined && { relatedAffaireId: relatedAffaireId && relatedAffaireId !== 'none' ? relatedAffaireId : null }),
        ...(relatedLeadId !== undefined && { relatedLeadId: relatedLeadId && relatedLeadId !== 'none' ? relatedLeadId : null }),
        ...(status !== undefined && { status: status || 'SCHEDULED' }),
        ...(reminderMinutes !== undefined && { reminderMinutes: reminderMinutes ? Number(reminderMinutes) : null }),
      },
      include: {
        relatedAffaire: { include: { client: true } },
        relatedLead: true,
        createdBy: { select: { id: true, name: true, email: true } },
      },
    });

    res.json(event);
  } catch (error) {
    console.error('Error updating calendar event:', error);
    res.status(500).json({ error: 'Failed to update calendar event' });
  }
});

// DELETE /calendar/:id - Soft delete a calendar event
calendarRoutes.delete('/:id', async (req: any, res) => {
  try {
    const organizationId = req.organizationId;

    const existingEvent = await prisma.calendarEvent.findFirst({
      where: { id: req.params.id, organizationId, deletedAt: null },
    });

    if (!existingEvent) {
      return res.status(404).json({ error: 'Calendar event not found' });
    }

    await prisma.calendarEvent.update({
      where: { id: req.params.id },
      data: { deletedAt: new Date() },
    });

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting calendar event:', error);
    res.status(500).json({ error: 'Failed to delete calendar event' });
  }
});
