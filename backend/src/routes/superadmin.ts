import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';
import { normalizePlan, syncAgentsForPlan } from '../config/agentPlans.js';
import auth, { requireSuperAdmin, AuthRequest } from '../middleware/auth.js';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';

export const superadminRoutes = Router();
superadminRoutes.use(auth);
superadminRoutes.use(requireSuperAdmin);

const updatePaymentStatusSchema = z.object({
  paymentStatus: z.enum(['PENDING', 'APPROVED', 'REJECTED']),
});

const updatePlanSchema = z.object({
  plan: z.enum(['FREE', 'BASIC', 'BUSINESS', 'ENTERPRISE']),
});

const createSubscriptionSchema = z.object({
  organizationId: z.string().min(1),
  plan: z.string().min(1),
  price: z.union([z.number(), z.string()]),
  paymentMethod: z.string().min(1),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  billingPeriod: z.enum(['MONTHLY', 'YEARLY']).optional(),
});

const updateSubscriptionSchema = z.object({
  organizationId: z.string().optional(),
  plan: z.string().optional(),
  price: z.union([z.number(), z.string()]).optional(),
  billingPeriod: z.enum(['MONTHLY', 'YEARLY']).optional(),
  paymentMethod: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  paymentStatus: z.enum(['PENDING', 'PAID', 'REFUSED']).optional(),
});

const toOrganizationPlan = (plan: string): string => {
  const raw = typeof plan === 'string' ? plan.trim() : '';
  const u = raw.toUpperCase();
  switch (u) {
    case 'STARTER':
      return 'FREE';
    case 'PRO':
      return 'BUSINESS';
    case 'FREE':
    case 'BASIC':
    case 'BUSINESS':
    case 'ENTERPRISE':
      return u;
    default:
      break;
  }
  const lc = raw.toLowerCase();
  if (lc === 'gratuit') return 'FREE';
  if (lc === 'basic') return 'BASIC';
  if (lc === 'business') return 'BUSINESS';
  if (lc === 'entreprise' || lc === 'professionnel') return 'ENTERPRISE';
  return raw.length > 0 ? raw : 'FREE';
};

const toOrganizationPaymentStatus = (paymentStatus: string) => {
  if (paymentStatus === 'PAID') return 'APPROVED';
  if (paymentStatus === 'REFUSED') return 'REJECTED';
  return 'PENDING';
};

const getAuthoritativeSubscription = <T extends { paymentStatus: string; endDate: Date; createdAt: Date }>(subscriptions: T[]) => {
  const now = new Date();
  return (
    subscriptions.find((s) => s.paymentStatus === 'PAID' && s.endDate >= now) ||
    subscriptions.find((s) => s.paymentStatus === 'PAID') ||
    subscriptions[0]
  );
};

// GET all organizations with payment status
superadminRoutes.get('/organizations', async (req: AuthRequest, res, next) => {
  try {
    const organizations = await prisma.organization.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        paymentStatus: true,
        plan: true,
        suspended: true,
        createdAt: true,
        users: {
          where: { role: 'OWNER' },
          select: { id: true, name: true, email: true },
          take: 1,
        },
        _count: {
          select: {
            users: true,
            clients: true,
            affaires: true,
          },
        },
        subscriptions: {
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            plan: true,
            paymentStatus: true,
            startDate: true,
            endDate: true,
            createdAt: true,
          },
        },
        billingSubscription: {
          select: {
            id: true,
            tier: true,
            status: true,
            currency: true,
            trialStartedAt: true,
            trialEndsAt: true,
            trialExtensionCount: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const filter = String(req.query.trialFilter || '');
    const statusFilter = String(req.query.status || '');
    const tierFilter = String(req.query.tier || '');
    const q = String(req.query.q || '').trim().toLowerCase();
    const now = new Date();
    const in3Days = new Date(now.getTime() + 3 * 86_400_000);
    const inactiveSince = new Date(now.getTime() - 30 * 86_400_000);

    const mapped = organizations.map((org) => {
      const latestSubscription = getAuthoritativeSubscription(org.subscriptions);
      const billing = org.billingSubscription;
      let trialBadge: string | null = null;
      if (billing) {
        if (billing.status === 'TRIALING') {
          const daysLeft = Math.ceil((billing.trialEndsAt.getTime() - now.getTime()) / 86_400_000);
          trialBadge = daysLeft >= 0 ? `Essai (J-${daysLeft})` : 'Essai (expiré)';
        } else if (billing.status === 'ACTIVE') trialBadge = 'Actif';
        else if (billing.status === 'TRIAL_EXPIRED') trialBadge = 'Essai expiré';
        else if (billing.status === 'PAST_DUE') trialBadge = 'Impayé';
        else if (billing.status === 'CANCELED') trialBadge = 'Annulé';
      }
      return {
        ...org,
        plan: latestSubscription ? toOrganizationPlan(latestSubscription.plan) : org.plan,
        paymentStatus: latestSubscription
          ? toOrganizationPaymentStatus(latestSubscription.paymentStatus)
          : org.paymentStatus,
        latestSubscription,
        billingSubscription: billing,
        trialBadge,
        subscriptions: undefined,
      };
    });

    let filtered = mapped;

    if (filter === 'expiring' || statusFilter === 'expiring') {
      filtered = filtered.filter(
        (o) =>
          o.billingSubscription?.status === 'TRIALING' &&
          o.billingSubscription.trialEndsAt <= in3Days &&
          o.billingSubscription.trialEndsAt >= now
      );
    } else if (filter === 'expired' || statusFilter === 'expired' || statusFilter === 'TRIAL_EXPIRED') {
      filtered = filtered.filter((o) => o.billingSubscription?.status === 'TRIAL_EXPIRED');
    } else if (filter === 'past_due' || statusFilter === 'past_due' || statusFilter === 'PAST_DUE') {
      filtered = filtered.filter((o) => o.billingSubscription?.status === 'PAST_DUE');
    } else if (
      filter === 'trialing' ||
      statusFilter === 'TRIALING' ||
      statusFilter === 'trialing'
    ) {
      filtered = filtered.filter((o) => o.billingSubscription?.status === 'TRIALING');
    } else if (statusFilter === 'ACTIVE' || statusFilter === 'active') {
      filtered = filtered.filter((o) => o.billingSubscription?.status === 'ACTIVE');
    } else if (statusFilter === 'CANCELED' || statusFilter === 'canceled') {
      filtered = filtered.filter((o) => o.billingSubscription?.status === 'CANCELED');
    } else if (filter === 'inactive30' || statusFilter === 'inactive30') {
      filtered = filtered.filter((o) => o.createdAt < inactiveSince);
    }

    if (tierFilter && tierFilter !== 'all') {
      const tier = tierFilter.toUpperCase();
      filtered = filtered.filter((o) => o.billingSubscription?.tier === tier);
    }

    if (q) {
      filtered = filtered.filter(
        (o) =>
          o.name.toLowerCase().includes(q) ||
          (o.email || '').toLowerCase().includes(q) ||
          (o.users?.[0]?.email || '').toLowerCase().includes(q)
      );
    }

    res.json(filtered);
  } catch (e) { next(e); }
});

// GET organization details
superadminRoutes.get('/organizations/:id', async (req: AuthRequest, res, next) => {
  try {
    const organization = await prisma.organization.findUnique({
      where: { id: req.params.id as string },
      include: {
        users: {
          select: {
            id: true,
            email: true,
            name: true,
            phone: true,
            role: true,
            createdAt: true,
          },
        },
        billingSubscription: {
          include: {
            extensionLogs: {
              orderBy: { createdAt: 'desc' },
              take: 50,
            },
          },
        },
        _count: {
          select: {
            clients: true,
            affaires: true,
            leads: true,
          },
        },
      },
    });
    if (!organization) {
      return res.status(404).json({ error: 'Organisation introuvable' });
    }
    res.json(organization);
  } catch (e) { next(e); }
});

superadminRoutes.post('/organizations/:id/extend-trial', async (req: AuthRequest, res, next) => {
  try {
    const body = z
      .object({
        additionalDays: z.number().int().min(1).max(365),
        reason: z.string().min(3).max(2000),
      })
      .parse(req.body);
    const { extendTrial } = await import('../services/billing/trialService.js');
    const sub = await extendTrial({
      organizationId: req.params.id as string,
      additionalDays: body.additionalDays,
      reason: body.reason,
      superadminUserId: req.user!.id,
    });
    res.json({
      status: sub.status,
      trialEndsAt: sub.trialEndsAt,
      trialExtensionCount: sub.trialExtensionCount,
    });
  } catch (e: any) {
    if (e?.statusCode) return res.status(e.statusCode).json({ error: e.message });
    next(e);
  }
});

superadminRoutes.post('/organizations/:id/activate-subscription', async (req: AuthRequest, res, next) => {
  try {
    const body = z.object({ reason: z.string().max(2000).optional() }).parse(req.body || {});
    const { activateSubscriptionManually } = await import('../services/billing/trialService.js');
    const sub = await activateSubscriptionManually({
      organizationId: req.params.id as string,
      superadminUserId: req.user!.id,
      reason: body.reason,
    });
    res.json({ status: sub.status });
  } catch (e: any) {
    if (e?.statusCode) return res.status(e.statusCode).json({ error: e.message });
    next(e);
  }
});

// DELETE organization
superadminRoutes.delete('/organizations/:id', async (req: AuthRequest, res, next) => {
  try {
    const organizationId = req.params.id as string;

    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { id: true, name: true },
    });

    if (!organization) {
      return res.status(404).json({ error: 'Organisation introuvable' });
    }

    const users = await prisma.user.findMany({
      where: { organizationId },
      select: { id: true },
    });
    const userIds = users.map((user) => user.id);

    await prisma.$transaction(async (tx) => {
      // Suppression explicite pour éviter les blocages FK si une cascade manque en production.
      await tx.leadActivite.deleteMany({ where: { organizationId } });
      await tx.activite.deleteMany({ where: { organizationId } });
      await tx.calendarEvent.deleteMany({ where: { organizationId } });
      await tx.expense.deleteMany({ where: { organizationId } });
      await tx.email.deleteMany({ where: { organizationId } });
      await tx.notification.deleteMany({ where: { organizationId } });
      await tx.gmailToken.deleteMany({ where: { organizationId } });
      if (userIds.length > 0) {
        await tx.refreshToken.deleteMany({ where: { userId: { in: userIds } } });
      }
      await tx.auditLog.deleteMany({ where: { organizationId } });
      await tx.userPermission.deleteMany({ where: { organizationId } });
      await tx.salesObjective.deleteMany({ where: { organizationId } });
      await tx.commissionConfig.deleteMany({ where: { organizationId } });
      await tx.emailTemplate.deleteMany({ where: { organizationId } });
      await tx.customCategory.deleteMany({ where: { organizationId } });
      await tx.previsionMois.deleteMany({ where: { organizationId } });
      await tx.subscription.deleteMany({ where: { organizationId } });
      await tx.affaire.deleteMany({ where: { organizationId } });
      await tx.lead.deleteMany({ where: { organizationId } });
      await tx.client.deleteMany({ where: { organizationId } });
      await tx.product.deleteMany({ where: { organizationId } });
      await tx.user.deleteMany({ where: { organizationId } });
      await tx.organization.delete({ where: { id: organizationId } });
    });

    res.json({
      success: true,
      message: `Organisation "${organization.name}" supprimée avec succès`,
    });
  } catch (e) { next(e); }
});

// PUT update payment status
superadminRoutes.put('/organizations/:id/payment-status', async (req: AuthRequest, res, next) => {
  try {
    const organizationId = req.params.id as string;
    const { paymentStatus } = updatePaymentStatusSchema.parse(req.body);

    const existing = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { id: true, plan: true },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Organisation introuvable ou déjà supprimée. Rafraîchis la page.' });
    }

    const organization = await prisma.$transaction(async (tx) => {
      const latestSubscription = await tx.subscription.findFirst({
        where: { organizationId },
        orderBy: { createdAt: 'desc' },
      });

      const nextPlan =
        paymentStatus === 'APPROVED' && latestSubscription
          ? toOrganizationPlan(latestSubscription.plan)
          : existing.plan;

      const updated = await tx.organization.update({
        where: { id: organizationId },
        data: { paymentStatus, plan: nextPlan },
      });

      const subscriptionStatus =
        paymentStatus === 'APPROVED' ? 'PAID' :
        paymentStatus === 'REJECTED' ? 'REFUSED' :
        'PENDING';

      await tx.subscription.updateMany({
        where: { organizationId },
        data: {
          paymentStatus: subscriptionStatus,
          plan: updated.plan,
        },
      });

      return updated;
    });

    res.json(organization);
  } catch (e) { next(e); }
});

// PUT toggle suspend
superadminRoutes.put('/organizations/:id/suspend', async (req: AuthRequest, res, next) => {
  try {
    const organizationId = req.params.id as string;
    const { suspended } = req.body;

    const result = await prisma.organization.updateMany({
      where: { id: organizationId },
      data: { suspended: Boolean(suspended) },
    });

    if (result.count === 0) {
      return res.status(404).json({ error: 'Organisation introuvable ou déjà supprimée. Rafraîchis la page.' });
    }

    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
    });

    res.json(organization);
  } catch (e) { next(e); }
});

// PUT update organization plan
superadminRoutes.put('/organizations/:id/plan', async (req: AuthRequest, res, next) => {
  try {
    const organizationId = req.params.id as string;
    const { plan } = updatePlanSchema.parse(req.body);

    const existing = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { id: true },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Organisation introuvable ou déjà supprimée. Rafraîchis la page.' });
    }

    const organization = await prisma.$transaction(async (tx) => {
      const updated = await tx.organization.update({
        where: { id: organizationId },
        data: { plan },
      });

      await tx.subscription.updateMany({
        where: { organizationId },
        data: { plan },
      });

      return updated;
    });

    await syncAgentsForPlan(organizationId, normalizePlan(plan));

    res.json(organization);
  } catch (e) { next(e); }
});

// POST sync all subscriptions with organization plans
superadminRoutes.post('/subscriptions/sync-plans', async (req: AuthRequest, res, next) => {
  try {
    const organizations = await prisma.organization.findMany({
      select: { id: true },
    });

    let updatedCount = 0;
    for (const org of organizations) {
      const subscriptions = await prisma.subscription.findMany({
        where: { organizationId: org.id },
        orderBy: { createdAt: 'desc' },
        select: { plan: true, paymentStatus: true, endDate: true, createdAt: true },
      });
      const latestSubscription = getAuthoritativeSubscription(subscriptions);

      if (!latestSubscription) continue;

      const result = await prisma.organization.updateMany({
        where: { id: org.id },
        data: {
          plan: toOrganizationPlan(latestSubscription.plan),
          paymentStatus: toOrganizationPaymentStatus(latestSubscription.paymentStatus),
        },
      });
      updatedCount += result.count;
    }
    
    res.json({ message: `Synced ${updatedCount} organizations`, updatedCount });
  } catch (e) { next(e); }
});

// SUBSCRIPTIONS MANAGEMENT
superadminRoutes.get('/subscriptions', async (req: AuthRequest, res, next) => {
  try {
    const subscriptions = await prisma.subscription.findMany({
      include: {
        organization: {
          select: { name: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    const now = new Date();
    res.json(subscriptions.map((s: any) => ({
      ...s,
      organizationName: s.organization?.name || 'N/A',
      status: s.paymentStatus === 'PAID' && new Date(s.endDate) > now ? 'actif' : 
              s.paymentStatus === 'PENDING' ? 'en_attente' : 
              s.paymentStatus === 'REFUSED' ? 'refusé' : 'expiré',
    })));
  } catch (e) { next(e); }
});

// PAYMENTS MANAGEMENT
superadminRoutes.get('/payments', async (req: AuthRequest, res, next) => {
  try {
    const payments = await prisma.subscription.findMany({
      include: {
        organization: {
          select: { name: true, paymentStatus: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(payments.map((payment: any) => ({
      id: payment.id,
      organizationName: payment.organization?.name || 'N/A',
      organizationId: payment.organizationId,
      organizationPaymentStatus: payment.organization?.paymentStatus || 'PENDING',
      plan: payment.plan,
      price: payment.price,
      paymentMethod: payment.paymentMethod,
      paymentStatus: payment.paymentStatus,
      startDate: payment.startDate,
      endDate: payment.endDate,
      createdAt: payment.createdAt,
      updatedAt: payment.updatedAt,
    })));
  } catch (e) { next(e); }
});

superadminRoutes.post('/payments/:id/validate', async (req: AuthRequest, res, next) => {
  try {
    const now = new Date();

    const subscription = await prisma.subscription.findUnique({
      where: { id: req.params.id as string },
    });

    if (!subscription) {
      return res.status(404).json({ error: 'Paiement introuvable' });
    }

    const validatedEnd = new Date(now);
    const cycle = subscription.billingPeriod === 'MONTHLY' ? 'MONTHLY' : 'YEARLY';
    if (cycle === 'MONTHLY') {
      validatedEnd.setMonth(validatedEnd.getMonth() + 1);
    } else {
      validatedEnd.setFullYear(validatedEnd.getFullYear() + 1);
    }

    const updated = await prisma.$transaction(async (tx) => {
      const paidSubscription = await tx.subscription.update({
        where: { id: subscription.id },
        data: {
          paymentStatus: 'PAID',
          startDate: now,
          endDate: validatedEnd,
        },
      });

      await tx.organization.update({
        where: { id: subscription.organizationId },
        data: {
          paymentStatus: 'APPROVED',
          plan: toOrganizationPlan(subscription.plan),
        },
      });

      return paidSubscription;
    });

    res.json({ message: 'Paiement validé', subscription: updated });
  } catch (e) { next(e); }
});

superadminRoutes.post('/payments/:id/reject', async (req: AuthRequest, res, next) => {
  try {
    const subscription = await prisma.subscription.findUnique({
      where: { id: req.params.id as string },
    });

    if (!subscription) {
      return res.status(404).json({ error: 'Paiement introuvable' });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const refusedSubscription = await tx.subscription.update({
        where: { id: subscription.id },
        data: { paymentStatus: 'REFUSED' },
      });

      await tx.organization.update({
        where: { id: subscription.organizationId },
        data: { paymentStatus: 'REJECTED' },
      });

      return refusedSubscription;
    });

    res.json({ message: 'Paiement refusé', subscription: updated });
  } catch (e) { next(e); }
});

superadminRoutes.post('/subscriptions', async (req: AuthRequest, res, next) => {
  try {
    const { organizationId, plan, price, paymentMethod, startDate, endDate, billingPeriod } =
      createSubscriptionSchema.parse(req.body);
    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { id: true },
    });
    if (!organization) {
      return res.status(404).json({ error: 'Organisation introuvable' });
    }
    
    const orgPlan = toOrganizationPlan(plan);

    const subscription = await prisma.subscription.create({
      data: {
        organizationId,
        plan,
        price: Number(price),
        billingPeriod: billingPeriod || 'YEARLY',
        paymentMethod,
        paymentStatus: 'PAID',
        startDate: new Date(startDate),
        endDate: new Date(endDate),
      },
    });
    
    // Update organization plan
    await prisma.organization.update({
      where: { id: organizationId },
      data: { plan: orgPlan, paymentStatus: 'APPROVED' },
    });
    
    res.status(201).json(subscription);
  } catch (e) { next(e); }
});

// DELETE subscription
superadminRoutes.delete('/subscriptions/:id', async (req: AuthRequest, res, next) => {
  try {
    const id = req.params.id as string;
    const existing = await prisma.subscription.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Abonnement introuvable ou déjà supprimé. Rafraîchis la page.' });
    }

    await prisma.subscription.deleteMany({ where: { id } });
    res.json({ success: true });
  } catch (e) { next(e); }
});

superadminRoutes.put('/subscriptions/:id', async (req: AuthRequest, res, next) => {
  try {
    const id = req.params.id as string;
    const { organizationId, plan, price, billingPeriod, paymentMethod, startDate, endDate, paymentStatus } =
      updateSubscriptionSchema.parse(req.body);

    const existing = await prisma.subscription.findUnique({
      where: { id },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Abonnement introuvable ou déjà supprimé. Rafraîchis la page.' });
    }
    if (organizationId && organizationId !== existing.organizationId) {
      return res.status(400).json({ error: 'Le changement d’organisation d’un abonnement est interdit.' });
    }

    const subscription = await prisma.subscription.update({
      where: { id },
      data: {
        plan: plan || undefined,
        price: price !== undefined && price !== '' ? Number(price) : undefined,
        billingPeriod: billingPeriod || undefined,
        paymentMethod: paymentMethod || undefined,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
        paymentStatus: paymentStatus || undefined,
      },
    });

    const targetOrganizationId = subscription.organizationId;
    if (paymentStatus === 'PAID') {
      await prisma.organization.updateMany({
        where: { id: targetOrganizationId },
        data: {
          paymentStatus: 'APPROVED',
          plan: toOrganizationPlan(subscription.plan),
        },
      });
    } else if (paymentStatus === 'REFUSED') {
      await prisma.organization.updateMany({
        where: { id: targetOrganizationId },
        data: { paymentStatus: 'REJECTED' },
      });
    } else if (paymentStatus === 'PENDING') {
      await prisma.organization.updateMany({
        where: { id: targetOrganizationId },
        data: { paymentStatus: 'PENDING' },
      });
    } else if (plan) {
      await prisma.organization.updateMany({
        where: { id: targetOrganizationId },
        data: { plan: toOrganizationPlan(subscription.plan) },
      });
    }
    
    res.json(subscription);
  } catch (e) { next(e); }
});

// GET overview — cards + prioritized action queue
superadminRoutes.get('/overview', async (req: AuthRequest, res, next) => {
  try {
    const now = new Date();
    const in3Days = new Date(now.getTime() + 3 * 86_400_000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 86_400_000);

    const [activeTrials, expiringIn3Days, pastDue, newOrgs7d, tierBreakdown] = await Promise.all([
      prisma.billingSubscription.count({ where: { status: 'TRIALING' } }),
      prisma.billingSubscription.count({
        where: {
          status: 'TRIALING',
          trialEndsAt: { gte: now, lte: in3Days },
        },
      }),
      prisma.billingSubscription.count({ where: { status: 'PAST_DUE' } }),
      prisma.organization.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
      prisma.billingSubscription.groupBy({
        by: ['tier'],
        _count: { _all: true },
      }),
    ]);

    const attentionSubs = await prisma.billingSubscription.findMany({
      where: {
        OR: [
          { status: 'PAST_DUE' },
          { status: 'TRIAL_EXPIRED' },
          {
            status: 'TRIALING',
            trialEndsAt: { lte: in3Days },
          },
        ],
      },
      select: {
        id: true,
        status: true,
        tier: true,
        trialEndsAt: true,
        organization: {
          select: { id: true, name: true, email: true, suspended: true },
        },
      },
      take: 80,
    });

    const dayMs = 86_400_000;
    const priority = (status: string, trialEndsAt: Date) => {
      if (status === 'PAST_DUE') return 0;
      if (status === 'TRIALING' && trialEndsAt < now) return 1;
      if (status === 'TRIALING') return 2;
      if (status === 'TRIAL_EXPIRED') return 3;
      return 9;
    };

    const formatDue = (status: string, trialEndsAt: Date) => {
      if (status === 'PAST_DUE' || status === 'TRIAL_EXPIRED') {
        return { dueAt: null as string | null, dueLabel: '—' };
      }
      const days = Math.ceil((trialEndsAt.getTime() - now.getTime()) / dayMs);
      if (days <= 0) return { dueAt: trialEndsAt.toISOString(), dueLabel: 'Expiré' };
      if (days === 1) return { dueAt: trialEndsAt.toISOString(), dueLabel: 'Demain' };
      return { dueAt: trialEndsAt.toISOString(), dueLabel: `Dans ${days} j` };
    };

    const actionQueue = attentionSubs
      .map((sub) => {
        const { dueAt, dueLabel } = formatDue(sub.status, sub.trialEndsAt);
        let kind: 'TRIAL_EXPIRING' | 'TRIAL_OVERDUE' | 'TRIAL_EXPIRED' | 'PAST_DUE';
        let statusLabel: string;
        let actions: string[];

        if (sub.status === 'PAST_DUE') {
          kind = 'PAST_DUE';
          statusLabel = 'Impayé';
          actions = ['contact', 'detail', 'suspend'];
        } else if (sub.status === 'TRIAL_EXPIRED') {
          kind = 'TRIAL_EXPIRED';
          statusLabel = 'Essai expiré';
          actions = ['activate', 'extend'];
        } else if (sub.trialEndsAt < now) {
          kind = 'TRIAL_OVERDUE';
          const daysLate = Math.ceil((now.getTime() - sub.trialEndsAt.getTime()) / dayMs);
          statusLabel = `Essai (expiré depuis ${daysLate} j)`;
          actions = ['activate', 'extend'];
        } else {
          kind = 'TRIAL_EXPIRING';
          const daysLeft = Math.max(0, Math.ceil((sub.trialEndsAt.getTime() - now.getTime()) / dayMs));
          statusLabel = `Essai (J-${daysLeft})`;
          actions = ['extend', 'contact'];
        }

        return {
          organizationId: sub.organization.id,
          organizationName: sub.organization.name,
          organizationEmail: sub.organization.email,
          suspended: sub.organization.suspended,
          subscriptionId: sub.id,
          tier: sub.tier,
          kind,
          status: sub.status,
          statusLabel,
          trialEndsAt: sub.trialEndsAt.toISOString(),
          dueAt,
          dueLabel,
          actions,
          _priority: priority(sub.status, sub.trialEndsAt),
          _sortDate: sub.trialEndsAt.getTime(),
        };
      })
      .sort((a, b) => a._priority - b._priority || a._sortDate - b._sortDate)
      .slice(0, 25)
      .map(({ _priority, _sortDate, ...rest }) => rest);

    res.json({
      cards: {
        activeTrials,
        expiringIn3Days,
        pastDue,
        newOrgs7d,
      },
      actionQueue,
      tierBreakdown: tierBreakdown.map((row) => ({
        tier: row.tier,
        count: row._count._all,
      })),
      generatedAt: now.toISOString(),
    });
  } catch (e) {
    next(e);
  }
});

// GET statistics
superadminRoutes.get('/stats', async (req: AuthRequest, res, next) => {
  try {
    const totalOrganizations = await prisma.organization.count();
    const pendingPayments = await prisma.organization.count({
      where: { paymentStatus: 'PENDING' },
    });
    const approvedPayments = await prisma.organization.count({
      where: { paymentStatus: 'APPROVED' },
    });
    const rejectedPayments = await prisma.organization.count({
      where: { paymentStatus: 'REJECTED' },
    });

    const totalUsers = await prisma.user.count();
    const totalClients = await prisma.client.count();
    const totalAffaires = await prisma.affaire.count();

    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const in3Days = new Date(now.getTime() + 3 * 86_400_000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 86_400_000);

    const [
      newClientsThisMonth,
      activeUsers,
      activeTrials,
      expiringIn3Days,
      pastDue,
      newOrgs7d,
    ] = await Promise.all([
      prisma.organization.count({ where: { createdAt: { gte: firstDayOfMonth } } }),
      prisma.user.count({
        where: { updatedAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } },
      }),
      prisma.billingSubscription.count({ where: { status: 'TRIALING' } }),
      prisma.billingSubscription.count({
        where: {
          status: 'TRIALING',
          trialEndsAt: { gte: now, lte: in3Days },
        },
      }),
      prisma.billingSubscription.count({ where: { status: 'PAST_DUE' } }),
      prisma.organization.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
    ]);

    res.json({
      organizations: {
        total: totalOrganizations,
        pending: pendingPayments,
        approved: approvedPayments,
        rejected: rejectedPayments,
      },
      users: totalUsers,
      clients: totalClients,
      affaires: totalAffaires,
      mrr: null,
      churnRate: null,
      newClientsThisMonth,
      activeUsers,
      billing: {
        activeTrials,
        expiringIn3Days,
        pastDue,
        newOrgs7d,
      },
    });
  } catch (e) {
    next(e);
  }
});

// USERS MANAGEMENT
superadminRoutes.get('/users', async (req: AuthRequest, res, next) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        organizationId: true,
        createdAt: true,
        updatedAt: true,
        failedLoginAttempts: true,
        lockedUntil: true,
        organization: {
          select: { name: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(users.map((u: any) => ({
      ...u,
      organizationName: u.organization.name,
      blocked: u.failedLoginAttempts >= 5,
      lastLogin: u.updatedAt,
    })));
  } catch (e) { next(e); }
});

superadminRoutes.post('/users/:userId/block', async (req: AuthRequest, res, next) => {
  try {
    await prisma.user.update({
      where: { id: req.params.userId as string },
      data: { failedLoginAttempts: 5, lockedUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) },
    });
    res.json({ success: true });
  } catch (e) { next(e); }
});

superadminRoutes.post('/users/:userId/unblock', async (req: AuthRequest, res, next) => {
  try {
    await prisma.user.update({
      where: { id: req.params.userId as string },
      data: { failedLoginAttempts: 0, lockedUntil: null },
    });
    res.json({ success: true });
  } catch (e) { next(e); }
});

// IMPERSONATION
superadminRoutes.post('/impersonate', async (req: AuthRequest, res, next) => {
  try {
    const { userId } = req.body;
    
    // Get the target user
    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      include: { organization: true },
    });
    
    if (!targetUser) {
      return res.status(404).json({ error: 'Utilisateur introuvable' });
    }
    
    // Generate new token for target user
    const accessToken = jwt.sign({ userId: targetUser.id }, process.env.JWT_SECRET!, {
      expiresIn: '15m',
    });

    const refreshToken = jwt.sign({ userId: targetUser.id }, process.env.JWT_SECRET!, {
      expiresIn: '30d',
    });
    const refreshTokenHash = await bcrypt.hash(refreshToken, 10);

    await prisma.refreshToken.create({
      data: {
        token: refreshTokenHash,
        userId: targetUser.id,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });
    
    res.json({
      accessToken,
      refreshToken,
      user: {
        id: targetUser.id,
        email: targetUser.email,
        name: targetUser.name,
        role: targetUser.role,
        organizationId: targetUser.organizationId,
      },
    });
  } catch (e) { next(e); }
});

// SETTINGS
superadminRoutes.get('/settings', async (req: AuthRequest, res, next) => {
  try {
    // For now, return default settings
    // In production, these would be stored in a database
    res.json({
      currency: 'TND',
      language: 'fr',
      vatRate: 19,
      smtpHost: '',
      smtpPort: 587,
      smtpUser: '',
    });
  } catch (e) { next(e); }
});

superadminRoutes.put('/settings', async (req: AuthRequest, res, next) => {
  try {
    const { currency, language, vatRate, smtpHost, smtpPort, smtpUser, smtpPassword } = req.body;
    
    // In production, these would be stored in a database
    // For now, just return success
    res.json({
      currency,
      language,
      vatRate,
      smtpHost,
      smtpPort,
      smtpUser,
      smtpPasswordConfigured: Boolean(smtpPassword),
    });
  } catch (e) { next(e); }
});

// ─── Agent memory (Phase 1) ───────────────────────────────────

superadminRoutes.get('/agent-events', async (req: AuthRequest, res, next) => {
  try {
    const status =
      typeof req.query.resolutionStatus === 'string'
        ? req.query.resolutionStatus
        : 'NEEDS_REVIEW';
    const organizationId =
      typeof req.query.organizationId === 'string' ? req.query.organizationId : null;

    const { listUnresolvedEvents } = await import('../services/agent-memory/agentEventService.js');
    const items = await listUnresolvedEvents(organizationId, status as any, {
      take: Math.min(Number(req.query.limit) || 50, 200),
    });
    res.json({ items });
  } catch (e) {
    next(e);
  }
});

superadminRoutes.post('/agent-events/:id/resolve', async (req: AuthRequest, res, next) => {
  try {
    const { contactId, organizationId } = req.body as {
      contactId?: string;
      organizationId?: string;
    };
    if (!contactId || !organizationId) {
      return res.status(400).json({ error: 'contactId et organizationId requis' });
    }

    const { assignEventToContact } = await import('../services/agent-memory/agentEventService.js');
    const event = await assignEventToContact(String(req.params.id), contactId, organizationId);
    res.json({ event });
  } catch (e) {
    next(e);
  }
});

superadminRoutes.post('/contacts/:id/erase', async (req: AuthRequest, res, next) => {
  try {
    const { organizationId } = req.body as { organizationId?: string };
    if (!organizationId) {
      return res.status(400).json({ error: 'organizationId requis' });
    }

    const { eraseContactData } = await import('../services/agent-memory/contactErasure.js');
    await eraseContactData({
      organizationId,
      contactId: String(req.params.id),
      actorUserId: req.userId!,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

superadminRoutes.get('/legacy-vs-agent-memory', async (req: AuthRequest, res, next) => {
  try {
    const days = Math.min(Math.max(Number(req.query.days) || 30, 7), 90);
    const since = new Date(Date.now() - days * 86_400_000);
    const organizationId =
      typeof req.query.organizationId === 'string' ? req.query.organizationId : undefined;

    const orgFilter = organizationId ? { organizationId } : {};

    const [legacyLead, legacyClient, legacyAffaire, agentEvent] = await Promise.all([
      prisma.lead.count({ where: { ...orgFilter, createdAt: { gte: since }, deletedAt: null } }),
      prisma.client.count({ where: { ...orgFilter, createdAt: { gte: since }, deletedAt: null } }),
      prisma.affaire.count({ where: { ...orgFilter, createdAt: { gte: since }, deletedAt: null } }),
      prisma.agentEvent.count({ where: { ...orgFilter, createdAt: { gte: since } } }),
    ]);

    res.json({
      windowDays: days,
      since: since.toISOString(),
      organizationId: organizationId || null,
      buckets: [
        { bucket: 'legacy_lead', count: legacyLead },
        { bucket: 'legacy_client', count: legacyClient },
        { bucket: 'legacy_affaire', count: legacyAffaire },
        { bucket: 'agent_event', count: agentEvent },
      ],
      readyForDeprecation:
        legacyLead === 0 && legacyClient === 0 && legacyAffaire === 0 && agentEvent > 0,
    });
  } catch (e) {
    next(e);
  }
});

superadminRoutes.get('/observability/overview', async (req: AuthRequest, res, next) => {
  try {
    const days = Math.min(Math.max(Number(req.query.days) || 7, 1), 30);
    const since = new Date(Date.now() - days * 86_400_000);

    const [
      llmByOrg,
      resolutionPending,
      needsReview,
      webhookFailed,
      whatsappBuffers,
      analysisErrors,
    ] = await Promise.all([
      prisma.llmUsageLog.groupBy({
        by: ['organizationId'],
        where: { createdAt: { gte: since } },
        _sum: { costEstimateUsd: true, durationMs: true },
        _count: { id: true },
      }),
      prisma.agentEvent.count({ where: { resolutionStatus: 'PENDING', contactId: null } }),
      prisma.agentEvent.count({ where: { resolutionStatus: 'NEEDS_REVIEW' } }),
      prisma.webhookDeliveryLog.count({ where: { status: 'failed', lastAttemptAt: { gte: since } } }),
      prisma.whatsappSessionBuffer.count(),
      prisma.agentEvent.count({
        where: { processingStatus: 'ERROR', createdAt: { gte: since } },
      }),
    ]);

    const orgIds = llmByOrg.map((r) => r.organizationId);
    const orgs = await prisma.organization.findMany({
      where: { id: { in: orgIds } },
      select: { id: true, name: true },
    });
    const orgNames = new Map(orgs.map((o) => [o.id, o.name]));

    res.json({
      windowDays: days,
      since: since.toISOString(),
      llmCostByOrg: llmByOrg.map((r) => ({
        organizationId: r.organizationId,
        organizationName: orgNames.get(r.organizationId) || r.organizationId,
        calls: r._count.id,
        costEstimateUsd: r._sum.costEstimateUsd ?? 0,
        durationMs: r._sum.durationMs ?? 0,
      })),
      jobs: {
        resolutionPending,
        needsReview,
        webhookFailed,
        whatsappOpenSessions: whatsappBuffers,
        copilotAnalysisErrors: analysisErrors,
      },
      alerts: {
        highLlmCost: llmByOrg.some((r) => (r._sum.costEstimateUsd ?? 0) > 50),
        resolutionBacklog: resolutionPending > 100,
        webhookFailures: webhookFailed > 20,
      },
    });
  } catch (e) {
    next(e);
  }
});
