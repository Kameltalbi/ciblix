import { Router, raw } from 'express';
import { z } from 'zod';
import { BillingCurrency, BillingTier } from '@prisma/client';
import auth, { AuthRequest } from '../middleware/auth.js';
import {
  changeTier,
  checkQuota,
  createCheckoutSession,
  ensureBillingSubscription,
  getBillingContext,
  handleStripeWebhookEvent,
} from '../services/billing/billingService.js';
import { TIER_LABELS } from '../config/billingTiers.js';

export const billingRoutes = Router();
export const billingWebhookRoutes = Router();

function requireOwner(req: AuthRequest, res: import('express').Response, next: import('express').NextFunction) {
  if (!req.user || (req.user.role !== 'OWNER' && req.user.role !== 'SUPERADMIN')) {
    return res.status(403).json({ error: "Réservé au propriétaire de l'organisation" });
  }
  next();
}

billingRoutes.use(auth);

billingRoutes.get('/status', async (req: AuthRequest, res, next) => {
  try {
    const { sub, quota } = await getBillingContext(req.organizationId!);
    const quotaStatus = await checkQuota(req.organizationId!);
    res.json({
      tier: sub.tier,
      tierLabel: TIER_LABELS[sub.tier],
      currency: sub.currency,
      status: sub.status,
      currentPeriodEnd: sub.currentPeriodEnd,
      usage: {
        used: quota.agentActionsUsed,
        limit: quota.agentActionsLimit,
        overLimit: quotaStatus.overLimit,
        softCap: quotaStatus.softCap,
      },
    });
  } catch (e) {
    next(e);
  }
});

billingRoutes.post('/checkout', requireOwner, async (req: AuthRequest, res, next) => {
  try {
    const body = z
      .object({
        tier: z.nativeEnum(BillingTier),
        currency: z.nativeEnum(BillingCurrency).optional(),
      })
      .parse(req.body);

    const result = await createCheckoutSession(
      req.organizationId!,
      body.tier,
      body.currency || 'TND'
    );
    res.json(result);
  } catch (e) {
    next(e);
  }
});

billingRoutes.post('/change-tier', requireOwner, async (req: AuthRequest, res, next) => {
  try {
    const body = z.object({ tier: z.nativeEnum(BillingTier) }).parse(req.body);
    if (body.tier !== 'DECOUVERTE' && !process.env.STRIPE_SECRET_KEY) {
      return res.status(400).json({
        error: 'Paiement requis pour ce palier. Configurez Stripe ou restez sur Découverte.',
      });
    }
    const sub = await changeTier(req.organizationId!, body.tier);
    res.json({ tier: sub.tier, status: sub.status });
  } catch (e) {
    next(e);
  }
});

billingWebhookRoutes.post(
  '/stripe/webhook',
  raw({ type: 'application/json' }),
  async (req, res) => {
    const stripeSecret = process.env.STRIPE_SECRET_KEY;
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!stripeSecret || !webhookSecret) {
      return res.status(503).json({ error: 'stripe_not_configured' });
    }

    const sig = req.headers['stripe-signature'];
    if (!sig || typeof sig !== 'string') {
      return res.status(400).json({ error: 'missing_signature' });
    }

    try {
      const body = req.body as Buffer;
      const event = JSON.parse(body.toString()) as { type: string; data: { object: Record<string, unknown> } };
      await handleStripeWebhookEvent(event);
      res.json({ received: true });
    } catch (err) {
      console.warn('[billing] stripe webhook error', err);
      res.status(400).json({ error: 'webhook_error' });
    }
  }
);
