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

/** Catalogue legacy BASIC/BUSINESS/ENTERPRISE — aligné sur Croissance / Pro / Entreprise. */
export const PLAN_CATALOG = {
  BASIC: {
    monthlyPrice: 85,
    annualPrice: 1020,
    maxUsers: 3,
    label: 'Croissance',
    agents: ['Chasseur IA', 'Assistant IA', 'Gmail IA'],
    features: [
      'Prospects illimités',
      "Jusqu'à 3 utilisateurs",
      'Pipeline Kanban & objectifs',
      'Agents : Chasseur IA, Assistant IA, Gmail IA',
    ],
  },
  BUSINESS: {
    monthlyPrice: 149,
    annualPrice: 1788,
    maxUsers: 10,
    label: 'Pro',
    agents: [
      'Chasseur IA',
      'Assistant IA',
      'Gmail IA',
      'Veilleur IA',
      "Rédacteur d'offres",
      'Vérificateur IA',
    ],
    features: [
      'Tout le plan Croissance',
      "Jusqu'à 10 utilisateurs",
      'Agents : les 6 agents complets',
      'Reporting avancé & support prioritaire',
      'Webhook CRM externe',
    ],
  },
  ENTERPRISE: {
    monthlyPrice: 0,
    annualPrice: 0,
    maxUsers: null,
    label: 'Entreprise',
    agents: [
      'Chasseur IA',
      'Assistant IA',
      'Gmail IA',
      'Veilleur IA',
      "Rédacteur d'offres",
      'Vérificateur IA',
      'BrandPulse AI',
    ],
    features: [
      'Tout le plan Pro',
      'Utilisateurs illimités',
      'Agents : tous les agents Pro + BrandPulse / config sectorielle',
      'SLA dédié & config sectorielle',
      'Tarif sur devis',
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
