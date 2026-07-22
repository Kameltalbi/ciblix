import type { BillingTier } from '@prisma/client';

export const TIER_ACTION_LIMITS: Record<BillingTier, number> = {
  DECOUVERTE: 50,
  CROISSANCE: 200,
  PRO: 1000,
  ENTERPRISE: 5000,
};

export const TIER_OVERAGE_ALLOWED: Record<BillingTier, boolean> = {
  DECOUVERTE: false,
  CROISSANCE: false,
  PRO: true,
  ENTERPRISE: true,
};

/** Mapping vers le plan agents existant (agentPlans.ts). */
export const TIER_TO_PLAN: Record<BillingTier, string> = {
  DECOUVERTE: 'FREE',
  CROISSANCE: 'BASIC',
  PRO: 'BUSINESS',
  ENTERPRISE: 'ENTERPRISE',
};

export const TIER_LABELS: Record<BillingTier, string> = {
  DECOUVERTE: 'Découverte',
  CROISSANCE: 'Croissance',
  PRO: 'Pro',
  ENTERPRISE: 'Enterprise',
};

/** Price IDs Stripe — à configurer dans .env (un par tier × devise). */
export function stripePriceId(tier: BillingTier, currency: string): string | null {
  const key = `STRIPE_PRICE_${tier}_${currency}`;
  return process.env[key] || null;
}

export function currentMonthKey(date = new Date()): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}
