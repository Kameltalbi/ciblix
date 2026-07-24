import type { BillingCurrency, BillingTier, SubscriptionStatus } from '@prisma/client';
import { AuditAction } from '@prisma/client';
import { prisma } from '../../db/prisma.js';
import {
  TIER_ACTION_LIMITS,
  TIER_AGENTS,
  TIER_LABELS,
  TIER_OVERAGE_ALLOWED,
  TIER_TO_PLAN,
  addDays,
  currentMonthKey,
} from '../../config/billingTiers.js';
import {
  TRIAL_AGENT_LABELS,
  TRIAL_AGENTS,
  TRIAL_DURATION_DAYS,
  TRIAL_QUOTA,
  type TrialAgentSlug,
} from '../../config/trial.js';
import { ALL_AGENT_SLUGS, normalizePlan, type AgentSlug } from '../../config/agentPlans.js';
import { structuredLog } from '../../lib/structuredLog.js';
import { sendTrialEmail } from '../mail/trialMailer.js';

/** Active uniquement les agents d'essai (upsert enabled) — ne désactive pas les autres. */
export async function activateTrialAgents(organizationId: string): Promise<void> {
  for (const slug of TRIAL_AGENTS) {
    const existing = await prisma.organizationAgent.findUnique({
      where: { organizationId_agentSlug: { organizationId, agentSlug: slug } },
    });
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
  }
}

/**
 * Applique le jeu d'agents du tier (post-essai / changement de palier).
 * Tous les paliers reçoivent la solution complète — seule l’usage change.
 */
export async function activateTierAgents(
  organizationId: string,
  tier: BillingTier,
  _options?: { selectedDiscoveryAgent?: string | null; requireSelection?: boolean }
): Promise<AgentSlug[]> {
  const targetAgents: AgentSlug[] = [...TIER_AGENTS[tier]];

  const allowed = new Set(targetAgents);
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

  return targetAgents;
}

/** @deprecated Prefer activateTierAgents */
export async function syncAgentsForTier(organizationId: string, tier: BillingTier): Promise<void> {
  const sub = await prisma.billingSubscription.findUnique({ where: { organizationId } });
  await activateTierAgents(organizationId, tier, {
    selectedDiscoveryAgent: sub?.selectedDiscoveryAgent,
  });
}

export async function startTrialSubscription(params: {
  organizationId: string;
  tier: BillingTier;
  currency?: BillingCurrency;
}) {
  const now = new Date();
  const trialEndsAt = addDays(now, TRIAL_DURATION_DAYS);
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
      selectedDiscoveryAgent: null,
    },
  });

  const month = currentMonthKey();
  await prisma.usageQuota.upsert({
    where: { organizationId_month: { organizationId: params.organizationId, month } },
    create: {
      organizationId: params.organizationId,
      month,
      agentActionsLimit: TRIAL_QUOTA.agentActionsLimit,
      overageAllowed: TRIAL_QUOTA.overageAllowed,
    },
    update: {
      agentActionsLimit: TRIAL_QUOTA.agentActionsLimit,
      overageAllowed: TRIAL_QUOTA.overageAllowed,
    },
  });

  // Plan org aligné sur le tier post-essai, mais agents = TRIAL_AGENTS (pas le tier).
  const plan = normalizePlan(TIER_TO_PLAN[params.tier]);
  await prisma.organization.update({
    where: { id: params.organizationId },
    data: { plan },
  });
  await activateTrialAgents(params.organizationId);

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

async function applyPostTrialQuota(organizationId: string, tier: BillingTier): Promise<void> {
  const month = currentMonthKey();
  await prisma.usageQuota.upsert({
    where: { organizationId_month: { organizationId, month } },
    create: {
      organizationId,
      month,
      agentActionsLimit: TIER_ACTION_LIMITS[tier],
      overageAllowed: TIER_OVERAGE_ALLOWED[tier],
    },
    update: {
      agentActionsLimit: TIER_ACTION_LIMITS[tier],
      overageAllowed: TIER_OVERAGE_ALLOWED[tier],
    },
  });
}

/** Cron quotidien : expire les essais sans paiement / active ceux avec Stripe. */
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
      const activeAgents = await activateTierAgents(sub.organizationId, sub.tier);
      await applyPostTrialQuota(sub.organizationId, sub.tier);
      await prisma.billingSubscription.update({
        where: { id: sub.id },
        data: { status: 'ACTIVE' },
      });
      activated += 1;
      structuredLog({
        service: 'trialService',
        event: 'trial_activated',
        organizationId: sub.organizationId,
        meta: { tier: sub.tier, agents: activeAgents },
      });
      if (sub.organization.email) {
        void sendTrialEmail({
          kind: 'expired',
          toEmail: sub.organization.email,
          orgName: sub.organization.name,
          tier: sub.tier,
          hasPaymentMethod: true,
          remainingAgents: activeAgents,
        });
      }
    } else {
      // Lecture seule : on laisse les agents visibles mais les écritures sont bloquées via status.
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
          tier: sub.tier,
          hasPaymentMethod: false,
          remainingAgents: [],
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
      tier: sub.tier,
      selectedDiscoveryAgent: sub.selectedDiscoveryAgent,
    });
  }
  return due.length;
}

export async function selectDiscoveryAgent(params: {
  organizationId: string;
  agentSlug: string;
}): Promise<{ selectedDiscoveryAgent: TrialAgentSlug | null; deprecated: true }> {
  // Legacy no-op : tous les paliers incluent désormais la solution complète.
  const sub = await prisma.billingSubscription.findUnique({
    where: { organizationId: params.organizationId },
  });
  if (!sub) {
    throw Object.assign(new Error('Abonnement introuvable'), { statusCode: 404 });
  }
  return { selectedDiscoveryAgent: null, deprecated: true };
}

export async function getTrialAgentUsageSummary(organizationId: string) {
  const month = currentMonthKey();
  const usageRows = await prisma.agentUsageMonthly.findMany({
    where: { organizationId, monthKey: month, agentSlug: { in: [...TRIAL_AGENTS] } },
    select: { agentSlug: true, usageCount: true },
  });
  const usageMap = new Map(usageRows.map((r) => [r.agentSlug, r.usageCount]));

  const [prospects, conversations] = await Promise.all([
    prisma.aiProspect.count({ where: { organizationId } }),
    prisma.agentEvent.count({ where: { organizationId } }),
  ]);
  const offreUsage = usageMap.get('offre-bot') || 0;

  return TRIAL_AGENTS.map((slug) => {
    const usageCount = usageMap.get(slug) || 0;
    const summary =
      slug === 'hunt-ai'
        ? `${prospects} prospect${prospects === 1 ? '' : 's'} trouvé${prospects === 1 ? '' : 's'}`
        : slug === 'copilot-ia'
          ? `${conversations} conversation${conversations === 1 ? '' : 's'} analysée${conversations === 1 ? '' : 's'}`
          : `${offreUsage} action${offreUsage === 1 ? '' : 's'} Rédacteur d'offres`;
    return { slug, label: TRIAL_AGENT_LABELS[slug], usageCount, summary };
  });
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

  await activateTrialAgents(organizationId);
  const month = currentMonthKey();
  await prisma.usageQuota.upsert({
    where: { organizationId_month: { organizationId, month } },
    create: {
      organizationId,
      month,
      agentActionsLimit: TRIAL_QUOTA.agentActionsLimit,
      overageAllowed: TRIAL_QUOTA.overageAllowed,
    },
    update: {
      agentActionsLimit: TRIAL_QUOTA.agentActionsLimit,
      overageAllowed: TRIAL_QUOTA.overageAllowed,
    },
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
      tier: sub.tier,
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

  const activeAgents = await activateTierAgents(params.organizationId, sub.tier);
  await applyPostTrialQuota(params.organizationId, sub.tier);

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
          agents: activeAgents,
        }),
      },
    });
    return next;
  });

  return updated;
}

export function trialBannerPayload(sub: {
  status: SubscriptionStatus;
  tier: BillingTier;
  trialEndsAt: Date;
  selectedDiscoveryAgent: string | null;
}) {
  if (sub.status !== 'TRIALING') return null;
  const msLeft = sub.trialEndsAt.getTime() - Date.now();
  const daysLeft = Math.ceil(msLeft / 86_400_000);
  if (daysLeft > 2 || daysLeft < 0) return null;

  return {
    daysLeft,
    tier: sub.tier,
    tierLabel: TIER_LABELS[sub.tier],
    trialAgents: TRIAL_AGENTS.map((slug) => ({ slug, label: TRIAL_AGENT_LABELS[slug] })),
    needsDiscoveryChoice: false,
    selectedDiscoveryAgent: sub.selectedDiscoveryAgent,
  };
}
