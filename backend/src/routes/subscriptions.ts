import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';
import auth, { AuthRequest, requireSuperAdmin } from '../middleware/auth.js';
import { normalizePlan, syncAgentsForPlan } from '../config/agentPlans.js';

export const subscriptionsRoutes = Router();
subscriptionsRoutes.use(auth);

const subscriptionSchema = z.object({
  plan: z.enum(['BASIC', 'BUSINESS', 'ENTERPRISE']),
  paymentMethod: z.enum(['VIREMENT', 'ESPECES']),
  billingPeriod: z.enum(['MONTHLY', 'YEARLY']).default('YEARLY'),
});

export const PLAN_CATALOG = {
  BASIC: {
    monthlyPrice: 40,
    annualPrice: 480,
    maxUsers: 5,
    label: 'Basic',
    agents: ['Chasseur IA', 'Assistant IA'],
    features: [
      'Prospects illimités',
      "Jusqu'à 5 utilisateurs",
      'Pipeline Kanban & objectifs',
      'Chasseur IA — prospection intelligente',
      'Assistant IA — copilote commercial',
    ],
  },
  BUSINESS: {
    monthlyPrice: 98,
    annualPrice: 980,
    maxUsers: 20,
    label: 'Business',
    agents: ['Chasseur IA', 'Assistant IA', 'Veilleur IA', 'Rédacteur d\'offres'],
    features: [
      'Tout le plan Basic',
      "Jusqu'à 20 utilisateurs",
      'Reporting avancé & support prioritaire',
      'Veilleur IA — veille d\'opportunités',
      'Rédacteur d\'offres — propositions commerciales',
    ],
  },
  ENTERPRISE: {
    monthlyPrice: 175,
    /** Annuel aligné sur 175 × 12 (ajuste si promo annuelle différente) */
    annualPrice: 2100,
    maxUsers: 50,
    label: 'Professionnel',
    agents: ['Chasseur IA', 'Assistant IA', 'Veilleur IA', 'Rédacteur d\'offres', 'Vérificateur IA'],
    features: [
      'Tout le plan Business',
      "Jusqu'à 50 utilisateurs",
      'Vérificateur IA — contrôle des informations',
      'Dépenses, commissions & Softfacture',
    ],
  },
} as const;

// GET /api/subscriptions/plans - catalogue public pour le front / admin
subscriptionsRoutes.get('/plans', (_, res) => {
  res.json(PLAN_CATALOG);
});

subscriptionsRoutes.get('/current', async (req: AuthRequest, res, next) => {
  try {
    const subscription = await prisma.subscription.findFirst({
      where: {
        organizationId: req.organizationId,
        paymentStatus: 'PAID',
        endDate: { gte: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(subscription);
  } catch (e) {
    next(e);
  }
});

subscriptionsRoutes.post('/', async (req: AuthRequest, res, next) => {
  try {
    const { plan, paymentMethod, billingPeriod } = subscriptionSchema.parse(req.body);
    const planConfig = PLAN_CATALOG[plan];

    const existing = await prisma.subscription.findFirst({
      where: {
        organizationId: req.organizationId,
        paymentStatus: 'PAID',
        endDate: { gte: new Date() },
      },
    });

    if (existing) {
      return res.status(400).json({ error: 'Vous avez déjà un abonnement actif' });
    }

    const startDate = new Date();
    const endDate = new Date(startDate);
    if (billingPeriod === 'MONTHLY') {
      endDate.setMonth(endDate.getMonth() + 1);
    } else {
      endDate.setFullYear(endDate.getFullYear() + 1);
    }

    const price =
      billingPeriod === 'MONTHLY' ? planConfig.monthlyPrice : planConfig.annualPrice;

    const subscription = await prisma.subscription.create({
      data: {
        organizationId: req.organizationId!,
        plan,
        price,
        billingPeriod,
        paymentMethod,
        paymentStatus: 'PENDING',
        startDate,
        endDate,
      },
    });

    res.status(201).json(subscription);
  } catch (e) {
    next(e);
  }
});

subscriptionsRoutes.post('/:id/confirm', requireSuperAdmin, async (req: AuthRequest, res, next) => {
  try {
    const subscription = await prisma.subscription.findFirst({
      where: { id: req.params.id as string },
    });

    if (!subscription) {
      return res.status(404).json({ error: 'Abonnement introuvable' });
    }

    const updated = await prisma.subscription.update({
      where: { id: req.params.id as string },
      data: { paymentStatus: 'PAID' },
    });

    const orgPlan = normalizePlan(updated.plan);
    await prisma.organization.update({
      where: { id: updated.organizationId },
      data: { plan: orgPlan, paymentStatus: 'APPROVED' },
    });
    await syncAgentsForPlan(updated.organizationId, orgPlan);

    res.json(updated);
  } catch (e) {
    next(e);
  }
});
