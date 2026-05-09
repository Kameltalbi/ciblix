import { Router } from 'express';
import { z } from 'zod';
import { PrismaClient } from '../lib/prismaInterop.js';
import auth, { AuthRequest } from '../middleware/auth.js';
import { checkPlanFeature } from '../middleware/planRestrictions.js';

export const expensesRoutes = Router();
const prisma = new PrismaClient();

// Apply auth and plan feature middleware to all routes
expensesRoutes.use(auth);
expensesRoutes.use(checkPlanFeature('expenses'));

const toOptionalString = z.preprocess((v) => (v === '' ? undefined : v), z.string().optional());

const expenseSchema = z.object({
  title: z.string().min(1),
  description: toOptionalString,
  amount: z.preprocess(
    (v) => (v === '' || v === null || v === undefined ? undefined : Number(v)),
    z.number().nonnegative()
  ),
  currency: z.string().default('TND'),
  category: z.string().default('Autre'),
  date: toOptionalString,
  relatedAffaireId: toOptionalString,
  relatedLeadId: toOptionalString,
  status: z.string().default('PENDING'),
  receiptUrl: toOptionalString,
  isRecurrent: z.preprocess((v) => (v === '' || v === undefined ? undefined : v), z.boolean().optional()),
  recurrenceMonths: toOptionalString,
  notes: toOptionalString,
});

const expenseUpdateSchema = expenseSchema.partial();

async function validateRelatedRecords(
  organizationId: string,
  relatedAffaireId?: string,
  relatedLeadId?: string
) {
  if (relatedAffaireId) {
    const affaire = await prisma.affaire.findFirst({
      where: { id: relatedAffaireId, organizationId, deletedAt: null },
      select: { id: true },
    });
    if (!affaire) return 'Affaire introuvable';
  }

  if (relatedLeadId) {
    const lead = await prisma.lead.findFirst({
      where: { id: relatedLeadId, organizationId, deletedAt: null },
      select: { id: true },
    });
    if (!lead) return 'Lead introuvable';
  }

  return null;
}

// GET /expenses - List expenses with pagination
expensesRoutes.get('/', checkPlanFeature('expenses'), async (req: AuthRequest, res, next) => {
  try {
    const userId = (req as any).userId;
    const organizationId = (req as any).organizationId;

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const skip = (page - 1) * limit;

    const category = req.query.category as string;
    const status = req.query.status as string;
    const month = req.query.month as string;
    const semester = req.query.semester as string;
    const year = req.query.year as string;

    const where: any = {
      organizationId,
      deletedAt: null,
    };

    if (category) where.category = category;
    if (status) where.status = status;
    if (month || semester || year) {
      const dateFilter: any = {};
      if (month) {
        dateFilter.gte = new Date(parseInt(year || '2026'), parseInt(month) - 1, 1);
        dateFilter.lt = new Date(parseInt(year || '2026'), parseInt(month), 1);
      } else if (semester === 'S1') {
        // S1: January to June (months 1-6)
        dateFilter.gte = new Date(parseInt(year || '2026'), 0, 1);
        dateFilter.lt = new Date(parseInt(year || '2026'), 6, 1);
      } else if (semester === 'S2') {
        // S2: July to December (months 7-12)
        dateFilter.gte = new Date(parseInt(year || '2026'), 6, 1);
        dateFilter.lt = new Date(parseInt(year || '2026') + 1, 0, 1);
      } else if (year) {
        dateFilter.gte = new Date(parseInt(year), 0, 1);
        dateFilter.lt = new Date(parseInt(year) + 1, 0, 1);
      }
      where.date = dateFilter;
    }

    const [data, total] = await Promise.all([
      prisma.expense.findMany({
        where,
        include: {
          relatedAffaire: { include: { client: true } },
          relatedLead: true,
          createdBy: { select: { id: true, name: true, email: true } },
        },
        orderBy: { date: 'desc' },
        skip,
        take: limit,
      }),
      prisma.expense.count({ where }),
    ]);

    res.json({
      data,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        total,
        limit,
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /expenses/:id - Get expense by ID
expensesRoutes.get('/:id', checkPlanFeature('expenses'), async (req: AuthRequest, res, next) => {
  try {
    const userId = (req as any).userId;
    const organizationId = (req as any).organizationId;

    const expense = await prisma.expense.findFirst({
      where: {
        id: req.params.id as string,
        organizationId,
        deletedAt: null,
      },
      include: {
        relatedAffaire: { include: { client: true } },
        relatedLead: true,
        createdBy: { select: { id: true, name: true, email: true } },
      },
    });

    if (!expense) {
      return res.status(404).json({ error: 'Dépense non trouvée' });
    }

    res.json(expense);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /expenses - Create expense
expensesRoutes.post('/', checkPlanFeature('expenses'), async (req: AuthRequest, res, next) => {
  try {
    const userId = (req as any).userId;
    const organizationId = (req as any).organizationId;

    const data = expenseSchema.parse(req.body);
    const relationError = await validateRelatedRecords(organizationId, data.relatedAffaireId, data.relatedLeadId);
    if (relationError) return res.status(404).json({ error: relationError });

    const expense = await prisma.expense.create({
      data: {
        organizationId,
        ...data,
        date: data.date ? new Date(data.date) : new Date(),
        createdById: userId,
      } as any,
      include: {
        relatedAffaire: { include: { client: true } },
        relatedLead: true,
        createdBy: { select: { id: true, name: true, email: true } },
      },
    });

    res.status(201).json(expense);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /expenses/:id - Update expense
expensesRoutes.put('/:id', checkPlanFeature('expenses'), async (req: AuthRequest, res, next) => {
  try {
    const userId = (req as any).userId;
    const organizationId = (req as any).organizationId;

    const existing = await prisma.expense.findFirst({
      where: { id: req.params.id as string, organizationId, deletedAt: null },
    });
    if (!existing) return res.status(404).json({ error: 'Dépense non trouvée' });

    const data = expenseUpdateSchema.parse(req.body);
    const relationError = await validateRelatedRecords(organizationId, data.relatedAffaireId, data.relatedLeadId);
    if (relationError) return res.status(404).json({ error: relationError });

    const expense = await prisma.expense.update({
      where: { id: req.params.id as string },
      data: {
        ...data,
        date: data.date ? new Date(data.date) : undefined,
      } as any,
      include: {
        relatedAffaire: { include: { client: true } },
        relatedLead: true,
        createdBy: { select: { id: true, name: true, email: true } },
      },
    });

    res.json(expense);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /expenses/:id - Soft delete expense
expensesRoutes.delete('/:id', checkPlanFeature('expenses'), async (req: AuthRequest, res, next) => {
  try {
    const organizationId = (req as any).organizationId;

    const existing = await prisma.expense.findFirst({
      where: { id: req.params.id as string, organizationId, deletedAt: null },
    });
    if (!existing) return res.status(404).json({ error: 'Dépense non trouvée' });

    await prisma.expense.update({
      where: { id: req.params.id as string },
      data: { deletedAt: new Date() },
    });

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});
