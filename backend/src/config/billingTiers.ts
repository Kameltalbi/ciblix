import type { BillingTier } from '@prisma/client';
import type { AgentSlug } from './agentPlans.js';

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

/** Agents inclus par palier (aligné page tarifs). */
export const TIER_AGENTS: Record<BillingTier, AgentSlug[]> = {
  DECOUVERTE: ['hunt-ai'],
  CROISSANCE: ['hunt-ai', 'copilot-ia', 'scout-ai'],
  PRO: ['hunt-ai', 'copilot-ia', 'scout-ai', 'offre-bot', 'gmail-ai', 'factcheck-ai'],
  ENTERPRISE: [
    'hunt-ai',
    'copilot-ia',
    'scout-ai',
    'offre-bot',
    'gmail-ai',
    'factcheck-ai',
    'brand-pulse-ai',
  ],
};

export const TIER_PRICES: Record<BillingTier, { TND: number | null; EUR: number | null; USD: number | null }> = {
  DECOUVERTE: { TND: 49, EUR: 19, USD: 21 },
  CROISSANCE: { TND: 149, EUR: 49, USD: 55 },
  PRO: { TND: 299, EUR: 99, USD: 109 },
  ENTERPRISE: { TND: null, EUR: null, USD: null },
};

export const TIER_LABELS: Record<BillingTier, string> = {
  DECOUVERTE: 'Découverte',
  CROISSANCE: 'Croissance',
  PRO: 'Pro',
  ENTERPRISE: 'Enterprise',
};

export const TRIAL_DAYS = 7;

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

export function addDays(from: Date, days: number): Date {
  const d = new Date(from);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}
