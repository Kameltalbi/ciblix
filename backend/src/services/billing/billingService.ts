import type { BillingCurrency, BillingTier } from '@prisma/client';
import { prisma } from '../../db/prisma.js';
import {
  currentMonthKey,
  stripePriceId,
  TIER_ACTION_LIMITS,
  TIER_OVERAGE_ALLOWED,
  TIER_TO_PLAN,
} from '../../config/billingTiers.js';
import { normalizePlan, syncAgentsForPlan } from '../../config/agentPlans.js';
import { structuredLog } from '../../lib/structuredLog.js';

export type QuotaCheckResult = {
  used: number;
  limit: number;
  overLimit: boolean;
  softCap: boolean;
  tier: BillingTier;
};

const SOFT_CAP_ENABLED = process.env.BILLING_SOFT_CAP !== '0';

export async function ensureBillingSubscription(organizationId: string, tier: BillingTier = 'DECOUVERTE') {
  const existing = await prisma.billingSubscription.findUnique({ where: { organizationId } });
  if (existing) return existing;

  return prisma.billingSubscription.create({
    data: {
      organizationId,
      tier,
      currency: 'TND',
      status: 'trialing',
    },
  });
}

export async function ensureUsageQuota(organizationId: string, tier: BillingTier) {
  const month = currentMonthKey();
  const limit = TIER_ACTION_LIMITS[tier];
  const overageAllowed = TIER_OVERAGE_ALLOWED[tier];

  return prisma.usageQuota.upsert({
    where: { organizationId_month: { organizationId, month } },
    create: { organizationId, month, agentActionsLimit: limit, overageAllowed },
    update: {},
  });
}

export async function getBillingContext(organizationId: string) {
  const sub = await ensureBillingSubscription(organizationId);
  const quota = await ensureUsageQuota(organizationId, sub.tier);
  return { sub, quota };
}

export async function checkQuota(organizationId: string): Promise<QuotaCheckResult> {
  const { sub, quota } = await getBillingContext(organizationId);
  const overLimit = quota.agentActionsUsed >= quota.agentActionsLimit;
  return {
    used: quota.agentActionsUsed,
    limit: quota.agentActionsLimit,
    overLimit,
    softCap: SOFT_CAP_ENABLED,
    tier: sub.tier,
  };
}

/** Soft-cap : on incrémente toujours, on log si dépassement mais on ne bloque pas. */
export async function consumeAgentAction(organizationId: string, units = 1): Promise<QuotaCheckResult> {
  const { sub, quota } = await getBillingContext(organizationId);
  const updated = await prisma.usageQuota.update({
    where: { id: quota.id },
    data: { agentActionsUsed: { increment: units } },
  });

  const overLimit = updated.agentActionsUsed > updated.agentActionsLimit;
  if (overLimit) {
    structuredLog({
      service: 'billingService',
      event: 'quota_exceeded',
      organizationId,
      meta: {
        used: updated.agentActionsUsed,
        limit: updated.agentActionsLimit,
        softCap: SOFT_CAP_ENABLED,
      },
    });
  }

  return {
    used: updated.agentActionsUsed,
    limit: updated.agentActionsLimit,
    overLimit,
    softCap: SOFT_CAP_ENABLED,
    tier: sub.tier,
  };
}

export async function changeTier(organizationId: string, newTier: BillingTier) {
  const sub = await prisma.billingSubscription.upsert({
    where: { organizationId },
    create: { organizationId, tier: newTier, status: 'active' },
    update: { tier: newTier, status: 'active' },
  });

  const month = currentMonthKey();
  await prisma.usageQuota.upsert({
    where: { organizationId_month: { organizationId, month } },
    create: {
      organizationId,
      month,
      agentActionsLimit: TIER_ACTION_LIMITS[newTier],
      overageAllowed: TIER_OVERAGE_ALLOWED[newTier],
    },
    update: {
      agentActionsLimit: TIER_ACTION_LIMITS[newTier],
      overageAllowed: TIER_OVERAGE_ALLOWED[newTier],
    },
  });

  const plan = normalizePlan(TIER_TO_PLAN[newTier]);
  await prisma.organization.update({
    where: { id: organizationId },
    data: { plan },
  });
  await syncAgentsForPlan(organizationId, plan);

  return sub;
}

export async function createCheckoutSession(
  organizationId: string,
  tier: BillingTier,
  currency: BillingCurrency
): Promise<{ url: string | null; message?: string }> {
  const stripeSecret = process.env.STRIPE_SECRET_KEY;
  if (!stripeSecret) {
    await changeTier(organizationId, tier);
    return {
      url: null,
      message: 'Stripe non configuré — tier mis à jour localement (mode essai).',
    };
  }

  const priceId = stripePriceId(tier, currency);
  if (!priceId) {
    return { url: null, message: `Price Stripe manquant pour ${tier}/${currency}` };
  }

  const sub = await ensureBillingSubscription(organizationId);
  const frontend = process.env.FRONTEND_URL || 'http://localhost:5173';

  const params = new URLSearchParams();
  params.set('mode', 'subscription');
  params.set('success_url', `${frontend}/settings?billing=success`);
  params.set('cancel_url', `${frontend}/settings?billing=cancel`);
  params.set('line_items[0][price]', priceId);
  params.set('line_items[0][quantity]', '1');
  params.set('client_reference_id', organizationId);
  params.set('metadata[tier]', tier);
  params.set('metadata[currency]', currency);
  if (sub.stripeCustomerId) {
    params.set('customer', sub.stripeCustomerId);
  }

  const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${stripeSecret}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params,
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Stripe checkout failed: ${errText}`);
  }

  const data = (await response.json()) as { url?: string; customer?: string; subscription?: string };
  if (data.customer) {
    await prisma.billingSubscription.update({
      where: { organizationId },
      data: { stripeCustomerId: data.customer },
    });
  }

  return { url: data.url || null };
}

export async function handleStripeWebhookEvent(event: {
  type: string;
  data: { object: Record<string, unknown> };
}): Promise<void> {
  const obj = event.data.object;

  if (event.type === 'checkout.session.completed') {
    const meta = (obj.metadata && typeof obj.metadata === 'object' ? obj.metadata : {}) as Record<
      string,
      unknown
    >;
    const orgId = String(obj.client_reference_id || meta.organizationId || '');
    const tier = String(meta.tier || 'DECOUVERTE') as BillingTier;
    if (orgId) {
      await prisma.billingSubscription.upsert({
        where: { organizationId: orgId },
        create: {
          organizationId: orgId,
          tier,
          status: 'active',
          stripeCustomerId: obj.customer ? String(obj.customer) : null,
          stripeSubscriptionId: obj.subscription ? String(obj.subscription) : null,
        },
        update: {
          tier,
          status: 'active',
          stripeCustomerId: obj.customer ? String(obj.customer) : undefined,
          stripeSubscriptionId: obj.subscription ? String(obj.subscription) : undefined,
        },
      });
      await changeTier(orgId, tier);
    }
    return;
  }

  if (event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.deleted') {
    const subId = String(obj.id || '');
    const status = String(obj.status || 'canceled');
    const existing = await prisma.billingSubscription.findFirst({
      where: { stripeSubscriptionId: subId },
    });
    if (!existing) return;

    await prisma.billingSubscription.update({
      where: { id: existing.id },
      data: {
        status,
        currentPeriodEnd: obj.current_period_end
          ? new Date(Number(obj.current_period_end) * 1000)
          : null,
      },
    });
  }

  if (event.type === 'invoice.paid') {
    const customerId = obj.customer ? String(obj.customer) : null;
    if (!customerId) return;
    await prisma.billingSubscription.updateMany({
      where: { stripeCustomerId: customerId },
      data: { status: 'active' },
    });
  }
}
