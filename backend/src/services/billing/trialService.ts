import type { BillingCurrency, BillingTier, SubscriptionStatus } from '@prisma/client';
import { AuditAction } from '@prisma/client';
import { prisma } from '../../db/prisma.js';
import {
  TRIAL_DAYS,
  TIER_ACTION_LIMITS,
  TIER_AGENTS,
  TIER_OVERAGE_ALLOWED,
  TIER_TO_PLAN,
  addDays,
  currentMonthKey,
} from '../../config/billingTiers.js';
import { ALL_AGENT_SLUGS, normalizePlan } from '../../config/agentPlans.js';
import { structuredLog } from '../../lib/structuredLog.js';
import { sendTrialEmail } from '../mail/trialMailer.js';

export async function syncAgentsForTier(organizationId: string, tier: BillingTier): Promise<void> {
  const allowed = new Set(TIER_AGENTS[tier]);
  for (const slug of ALL_AGENT_SLUGS) {
    const existing = await prisma.organizationAgent.findUnique({
      where: { organizationId_agentSlug: { organizationId, agentSlug: slug } },
    });
    if (allowed.has(slug)) {
      if (!existing) {
        await prisma.organizationAgent.create({
          data: { organizationId, agentSlug: slug, active: true },
        });
      } else if (!existing.active) {
        await prisma.organizationAgent.update({
          where: { id: existing.id },
          data: { active: true, deactivatedAt: null, activatedAt: new Date() },
        });
      }
    } else if (existing?.active) {
      await prisma.organizationAgent.update({
        where: { id: existing.id },
        data: { active: false, deactivatedAt: new Date() },
      });
    }
  }
}

export async function startTrialSubscription(params: {
  organizationId: string;
  tier: BillingTier;
  currency?: BillingCurrency;
}) {
  const now = new Date();
  const trialEndsAt = addDays(now, TRIAL_DAYS);
  const currency = params.currency || 'TND';

  const sub = await prisma.billingSubscription.upsert({
    where: { organizationId: params.organizationId },
    create: {
      organizationId: params.organizationId,
      tier: params.tier,
      currency,
      status: 'TRIALING',
      trialStartedAt: now,
      trialEndsAt,
    },
    update: {
      tier: params.tier,
      currency,
      status: 'TRIALING',
      trialStartedAt: now,
      trialEndsAt,
      trialExtensionCount: 0,
      trialExtendedBy: null,
    },
  });

  const month = currentMonthKey();
  await prisma.usageQuota.upsert({
    where: { organizationId_month: { organizationId: params.organizationId, month } },
    create: {
      organizationId: params.organizationId,
      month,
      agentActionsLimit: TIER_ACTION_LIMITS[params.tier],
      overageAllowed: TIER_OVERAGE_ALLOWED[params.tier],
    },
    update: {
      agentActionsLimit: TIER_ACTION_LIMITS[params.tier],
      overageAllowed: TIER_OVERAGE_ALLOWED[params.tier],
    },
  });

  const plan = normalizePlan(TIER_TO_PLAN[params.tier]);
  await prisma.organization.update({
    where: { id: params.organizationId },
    data: { plan },
  });
  await syncAgentsForTier(params.organizationId, params.tier);

  return sub;
}

export function isAgentWriteBlocked(status: SubscriptionStatus): boolean {
  return status === 'TRIAL_EXPIRED' || status === 'CANCELED' || status === 'PAST_DUE';
}

export async function assertAgentActionsAllowed(organizationId: string): Promise<void> {
  const sub = await prisma.billingSubscription.findUnique({ where: { organizationId } });
  if (!sub) return;
  if (isAgentWriteBlocked(sub.status)) {
    const err = new Error('TRIAL_EXPIRED_READONLY') as Error & { statusCode?: number; code?: string };
    err.statusCode = 402;
    err.code = 'TRIAL_EXPIRED_READONLY';
    throw err;
  }
}

/** Cron quotidien : expire les essais sans paiement. */
export async function checkExpiredTrials(): Promise<{ expired: number; activated: number }> {
  const now = new Date();
  const due = await prisma.billingSubscription.findMany({
    where: { status: 'TRIALING', trialEndsAt: { lt: now } },
    include: {
      organization: { select: { id: true, email: true, name: true } },
    },
  });

  let expired = 0;
  let activated = 0;

  for (const sub of due) {
    const hasPayment = Boolean(sub.stripeCustomerId && sub.stripeSubscriptionId);
    if (hasPayment) {
      await prisma.billingSubscription.update({
        where: { id: sub.id },
        data: { status: 'ACTIVE' },
      });
      activated += 1;
      structuredLog({
        service: 'trialService',
        event: 'trial_activated',
        organizationId: sub.organizationId,
      });
    } else {
      await prisma.billingSubscription.update({
        where: { id: sub.id },
        data: { status: 'TRIAL_EXPIRED' },
      });
      expired += 1;
      structuredLog({
        service: 'trialService',
        event: 'trial_expired',
        organizationId: sub.organizationId,
      });
      if (sub.organization.email) {
        void sendTrialEmail({
          kind: 'expired',
          toEmail: sub.organization.email,
          orgName: sub.organization.name,
        });
      }
    }
  }

  return { expired, activated };
}

/** Rappels J-2 (essai se termine dans ~2 jours). */
export async function sendTrialReminders(): Promise<number> {
  const now = new Date();
  const inTwoDaysStart = addDays(now, 2);
  inTwoDaysStart.setUTCHours(0, 0, 0, 0);
  const inTwoDaysEnd = addDays(now, 2);
  inTwoDaysEnd.setUTCHours(23, 59, 59, 999);

  const due = await prisma.billingSubscription.findMany({
    where: {
      status: 'TRIALING',
      trialEndsAt: { gte: inTwoDaysStart, lte: inTwoDaysEnd },
    },
    include: { organization: { select: { email: true, name: true } } },
  });

  for (const sub of due) {
    if (!sub.organization.email) continue;
    void sendTrialEmail({
      kind: 'reminder',
      toEmail: sub.organization.email,
      orgName: sub.organization.name,
      trialEndsAt: sub.trialEndsAt,
    });
  }
  return due.length;
}

export async function extendTrial(params: {
  organizationId: string;
  additionalDays: number;
  reason: string;
  superadminUserId: string;
}) {
  const { organizationId, additionalDays, reason, superadminUserId } = params;
  if (!Number.isFinite(additionalDays) || additionalDays < 1 || additionalDays > 365) {
    throw Object.assign(new Error('additionalDays invalide (1–365)'), { statusCode: 400 });
  }
  if (!reason.trim()) {
    throw Object.assign(new Error('reason obligatoire'), { statusCode: 400 });
  }

  const sub = await prisma.billingSubscription.findUnique({ where: { organizationId } });
  if (!sub) {
    throw Object.assign(new Error('Abonnement introuvable'), { statusCode: 404 });
  }
  if (sub.status !== 'TRIALING' && sub.status !== 'TRIAL_EXPIRED') {
    throw Object.assign(new Error('Prolongation autorisée uniquement pour TRIALING ou TRIAL_EXPIRED'), {
      statusCode: 400,
    });
  }

  const base = sub.trialEndsAt > new Date() ? sub.trialEndsAt : new Date();
  const trialEndsAt = addDays(base, additionalDays);

  const updated = await prisma.$transaction(async (tx) => {
    const next = await tx.billingSubscription.update({
      where: { id: sub.id },
      data: {
        trialEndsAt,
        status: 'TRIALING',
        trialExtendedBy: superadminUserId,
        trialExtensionCount: { increment: 1 },
      },
    });
    await tx.trialExtensionLog.create({
      data: {
        subscriptionId: sub.id,
        extendedBy: superadminUserId,
        additionalDays,
        reason: reason.trim(),
      },
    });
    await tx.auditLog.create({
      data: {
        organizationId,
        userId: superadminUserId,
        action: AuditAction.UPDATE,
        entityType: 'BillingSubscription',
        entityId: sub.id,
        oldValues: JSON.stringify({ status: sub.status, trialEndsAt: sub.trialEndsAt }),
        newValues: JSON.stringify({
          action: 'subscription.trial_extended',
          status: 'TRIALING',
          trialEndsAt,
          additionalDays,
          reason: reason.trim(),
        }),
      },
    });
    return next;
  });

  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { email: true, name: true },
  });
  if (org?.email) {
    void sendTrialEmail({
      kind: 'extended',
      toEmail: org.email,
      orgName: org.name,
      additionalDays,
      trialEndsAt: updated.trialEndsAt,
    });
  }

  return updated;
}

export async function activateSubscriptionManually(params: {
  organizationId: string;
  superadminUserId: string;
  reason?: string;
}) {
  const sub = await prisma.billingSubscription.findUnique({ where: { organizationId: params.organizationId } });
  if (!sub) {
    throw Object.assign(new Error('Abonnement introuvable'), { statusCode: 404 });
  }

  const updated = await prisma.$transaction(async (tx) => {
    const next = await tx.billingSubscription.update({
      where: { id: sub.id },
      data: { status: 'ACTIVE' },
    });
    await tx.auditLog.create({
      data: {
        organizationId: params.organizationId,
        userId: params.superadminUserId,
        action: AuditAction.UPDATE,
        entityType: 'BillingSubscription',
        entityId: sub.id,
        oldValues: JSON.stringify({ status: sub.status }),
        newValues: JSON.stringify({
          action: 'subscription.manual_activate',
          status: 'ACTIVE',
          reason: params.reason || null,
        }),
      },
    });
    return next;
  });

  return updated;
}
