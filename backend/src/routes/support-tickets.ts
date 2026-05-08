import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';
import auth, { AuthRequest } from '../middleware/auth.js';
import { parsePagination } from '../lib/pagination.js';
import {
  NotificationType,
  SupportTicketCategory,
  SupportTicketPriority,
  SupportTicketStatus,
} from '@prisma/client';
import { sendSupportTicketEmail } from '../services/supportTicketMailer.js';

export const supportTicketsRoutes = Router();
supportTicketsRoutes.use(auth);

const createTicketSchema = z.object({
  subject: z.string().min(3).max(200),
  description: z.string().min(10).max(10000),
  priority: z.nativeEnum(SupportTicketPriority).default(SupportTicketPriority.MEDIUM),
  category: z.nativeEnum(SupportTicketCategory).default(SupportTicketCategory.OTHER),
});

const addMessageSchema = z.object({
  body: z.string().min(1).max(10000),
});

const updateTicketSchema = z.object({
  status: z.nativeEnum(SupportTicketStatus).optional(),
  priority: z.nativeEnum(SupportTicketPriority).optional(),
  assigneeId: z.string().nullable().optional(),
});

async function notifySuperAdminsNewTicket(ticket: any, creator: any) {
  const superAdmins = await prisma.user.findMany({
    where: { role: 'SUPERADMIN' },
    select: { id: true, email: true, name: true, organizationId: true },
  });
  if (superAdmins.length === 0) return;

  await prisma.notification.createMany({
    data: superAdmins.map((sa) => ({
      userId: sa.id,
      organizationId: sa.organizationId,
      type: NotificationType.SUPPORT_TICKET_NEW,
      title: `Nouveau ticket: ${ticket.subject}`,
      content: `${creator.name || creator.email} a créé un ticket (${ticket.priority}).`,
      link: '/admin',
      read: false,
    })),
  });

  await Promise.all(
    superAdmins.map((sa) =>
      sendSupportTicketEmail({
        toEmail: sa.email,
        subject: `[Support] Nouveau ticket - ${ticket.subject}`,
        text: `Nouveau ticket ${ticket.id}\nSujet: ${ticket.subject}\nPriorité: ${ticket.priority}\nOrganisation: ${ticket.organizationId}`,
        html: `<p>Nouveau ticket <strong>${ticket.id}</strong></p><p><strong>Sujet:</strong> ${ticket.subject}</p><p><strong>Priorité:</strong> ${ticket.priority}</p><p><strong>Créé par:</strong> ${creator.name || creator.email}</p>`,
      })
    )
  );
}

async function notifyTicketCreatorReply(ticket: any, author: any) {
  const creator = await prisma.user.findUnique({
    where: { id: ticket.createdById },
    select: { id: true, email: true, organizationId: true },
  });
  if (!creator) return;

  await prisma.notification.create({
    data: {
      userId: creator.id,
      organizationId: creator.organizationId,
      type: NotificationType.SUPPORT_TICKET_REPLY,
      title: `Réponse sur votre ticket: ${ticket.subject}`,
      content: `${author.name || author.email} a répondu à votre ticket.`,
      link: '/support',
      read: false,
    },
  });

  await sendSupportTicketEmail({
    toEmail: creator.email,
    subject: `[Support] Réponse sur votre ticket - ${ticket.subject}`,
    text: `Votre ticket ${ticket.id} a reçu une réponse.\nAuteur: ${author.name || author.email}`,
    html: `<p>Votre ticket <strong>${ticket.id}</strong> a reçu une réponse.</p><p><strong>Auteur:</strong> ${author.name || author.email}</p>`,
  });
}

// List tickets
supportTicketsRoutes.get('/', async (req: AuthRequest, res, next) => {
  try {
    const { page, limit, skip } = parsePagination(req.query);
    const status = req.query.status as SupportTicketStatus | undefined;
    const priority = req.query.priority as SupportTicketPriority | undefined;
    const mineOnly = req.query.mineOnly === '1';
    const q = (req.query.q as string | undefined)?.trim();

    const where: any = {};
    if (req.user?.role !== 'SUPERADMIN') where.organizationId = req.organizationId;
    if (mineOnly) where.createdById = req.userId;
    if (status) where.status = status;
    if (priority) where.priority = priority;
    if (q) {
      where.OR = [
        { subject: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      prisma.supportTicket.findMany({
        where,
        include: {
          createdBy: { select: { id: true, name: true, email: true } },
          assignee: { select: { id: true, name: true, email: true } },
          _count: { select: { messages: true } },
        },
        orderBy: { updatedAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.supportTicket.count({ where }),
    ]);

    res.json({
      data,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (e) {
    next(e);
  }
});

// Get ticket detail
supportTicketsRoutes.get('/:id', async (req: AuthRequest, res, next) => {
  try {
    const ticket = await prisma.supportTicket.findUnique({
      where: { id: String(req.params.id) },
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
        assignee: { select: { id: true, name: true, email: true } },
        messages: {
          orderBy: { createdAt: 'asc' },
          include: { author: { select: { id: true, name: true, email: true, role: true } } },
        },
      },
    });
    if (!ticket) return res.status(404).json({ error: 'Ticket introuvable' });
    if (req.user?.role !== 'SUPERADMIN' && ticket.organizationId !== req.organizationId) {
      return res.status(403).json({ error: 'Accès refusé' });
    }
    if (req.user?.role !== 'SUPERADMIN' && ticket.createdById !== req.userId) {
      return res.status(403).json({ error: 'Accès refusé' });
    }
    res.json(ticket);
  } catch (e) {
    next(e);
  }
});

// Create ticket
supportTicketsRoutes.post('/', async (req: AuthRequest, res, next) => {
  try {
    const payload = createTicketSchema.parse(req.body);
    const creator = req.user!;

    const ticket = await prisma.supportTicket.create({
      data: {
        organizationId: req.organizationId!,
        createdById: req.userId!,
        subject: payload.subject,
        description: payload.description,
        priority: payload.priority,
        category: payload.category,
        messages: {
          create: {
            organizationId: req.organizationId!,
            authorId: req.userId!,
            body: payload.description,
          },
        },
      },
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
      },
    });

    await notifySuperAdminsNewTicket(ticket, creator);

    res.status(201).json(ticket);
  } catch (e) {
    next(e);
  }
});

// Add message
supportTicketsRoutes.post('/:id/messages', async (req: AuthRequest, res, next) => {
  try {
    const payload = addMessageSchema.parse(req.body);
    const ticket = await prisma.supportTicket.findUnique({
      where: { id: String(req.params.id) },
      include: { createdBy: { select: { id: true, email: true } } },
    });
    if (!ticket) return res.status(404).json({ error: 'Ticket introuvable' });
    if (req.user?.role !== 'SUPERADMIN' && ticket.organizationId !== req.organizationId) {
      return res.status(403).json({ error: 'Accès refusé' });
    }
    if (req.user?.role !== 'SUPERADMIN' && ticket.createdById !== req.userId) {
      return res.status(403).json({ error: 'Accès refusé' });
    }

    const [message] = await prisma.$transaction([
      prisma.supportTicketMessage.create({
        data: {
          organizationId: ticket.organizationId,
          ticketId: ticket.id,
          authorId: req.userId!,
          body: payload.body,
        },
        include: { author: { select: { id: true, name: true, email: true, role: true } } },
      }),
      prisma.supportTicket.update({
        where: { id: ticket.id },
        data: {
          lastMessageAt: new Date(),
          status: req.user?.role === 'SUPERADMIN' ? SupportTicketStatus.WAITING_USER : SupportTicketStatus.IN_PROGRESS,
        },
      }),
    ]);

    if (req.user?.role === 'SUPERADMIN') {
      await notifyTicketCreatorReply(ticket, req.user);
    } else {
      await notifySuperAdminsNewTicket(ticket, req.user);
    }

    res.status(201).json(message);
  } catch (e) {
    next(e);
  }
});

// Update ticket (superadmin or creator close)
supportTicketsRoutes.patch('/:id', async (req: AuthRequest, res, next) => {
  try {
    const payload = updateTicketSchema.parse(req.body);
    const ticket = await prisma.supportTicket.findUnique({ where: { id: String(req.params.id) } });
    if (!ticket) return res.status(404).json({ error: 'Ticket introuvable' });

    if (req.user?.role !== 'SUPERADMIN') {
      if (ticket.organizationId !== req.organizationId || ticket.createdById !== req.userId) {
        return res.status(403).json({ error: 'Accès refusé' });
      }
      if (payload.status && payload.status !== SupportTicketStatus.CLOSED) {
        return res.status(403).json({ error: 'Seule la fermeture est autorisée' });
      }
    }

    const updated = await prisma.supportTicket.update({
      where: { id: ticket.id },
      data: {
        status: payload.status,
        priority: payload.priority,
        assigneeId: payload.assigneeId,
        closedAt: payload.status === SupportTicketStatus.CLOSED ? new Date() : null,
      },
    });

    res.json(updated);
  } catch (e) {
    next(e);
  }
});
