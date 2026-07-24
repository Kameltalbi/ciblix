import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';
import auth, { AuthRequest, requireSuperAdmin } from '../middleware/auth.js';
import { normalizePlan, syncAgentsForPlan } from '../config/agentPlans.js';
import { TIER_PRICES, TIER_PRICES_ANNUAL } from '../config/billingTiers.js';

export const subscriptionsRoutes = Router();
subscriptionsRoutes.use(auth);

const subscriptionSchema = z.object({
  plan: z.enum(['BASIC', 'BUSINESS', 'ENTERPRISE']),
  paymentMethod: z.enum(['VIREMENT', 'ESPECES']),
  billingPeriod: z.enum(['MONTHLY', 'YEARLY']).default('YEARLY'),
});

/**
 * Catalogue legacy BASIC / BUSINESS / ENTERPRISE
 * → Essentiel / Croissance / Pro (3 plans commercialisés).
 */
export const PLAN_CATALOG = {
  BASIC: {
    monthlyPrice: TIER_PRICES.DECOUVERTE.TND!,
    annualPrice: TIER_PRICES_ANNUAL.DECOUVERTE.TND!,
    maxUsers: 1,
    label: 'Essentiel',
    agents: ['Prospecteur', 'Veilleur', 'Analyste', 'Assistant'],
    features: [
      'Solution complète (4 agents)',
      '1 utilisateur',
      '100 actions IA / mois',
      'Essai 7 jours inclus',
    ],
  },
  BUSINESS: {
    monthlyPrice: TIER_PRICES.CROISSANCE.TND!,
    annualPrice: TIER_PRICES_ANNUAL.CROISSANCE.TND!,
    maxUsers: 3,
    label: 'Croissance',
    agents: ['Prospecteur', 'Veilleur', 'Analyste', 'Assistant'],
    features: [
      'Solution complète (4 agents)',
      "Jusqu'à 3 utilisateurs",
      '300 actions IA / mois',
      'Mémoire partagée & pipeline',
    ],
  },
  ENTERPRISE: {
    monthlyPrice: TIER_PRICES.PRO.TND!,
    annualPrice: TIER_PRICES_ANNUAL.PRO.TND!,
    maxUsers: 10,
    label: 'Pro',
    agents: ['Prospecteur', 'Veilleur', 'Analyste', 'Assistant'],
    features: [
      'Solution complète (4 agents)',
      "Jusqu'à 10 utilisateurs",
      '1 000 actions IA / mois',
      'Webhook CRM & soft-cap',
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
