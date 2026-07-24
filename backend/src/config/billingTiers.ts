import type { BillingTier } from '@prisma/client';
import type { AgentSlug } from './agentPlans.js';
import { TRIAL_DURATION_DAYS } from './trial.js';

export const TIER_ACTION_LIMITS: Record<BillingTier, number> = {
  DECOUVERTE: 100,
  CROISSANCE: 300,
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

/**
 * Agents inclus sur tous les paliers (sans Gmail — connecteur dès Croissance).
 */
export const CORE_SOLUTION_AGENTS: AgentSlug[] = [
  'hunt-ai',
  'copilot-ia',
  'scout-ai',
  'analyste-ai',
  'offre-bot',
];

/** @deprecated Prefer CORE_SOLUTION_AGENTS + gmail selon palier */
export const FULL_SOLUTION_AGENTS: AgentSlug[] = [...CORE_SOLUTION_AGENTS, 'gmail-ai'];

export const TIER_AGENTS: Record<BillingTier, AgentSlug[]> = {
  DECOUVERTE: [...CORE_SOLUTION_AGENTS],
  CROISSANCE: [...FULL_SOLUTION_AGENTS],
  PRO: [...FULL_SOLUTION_AGENTS],
  ENTERPRISE: [...FULL_SOLUTION_AGENTS],
};

/** Les 3 plans commercialisés (ENTERPRISE = legacy / hors catalogue). */
export const PUBLIC_TIERS = ['DECOUVERTE', 'CROISSANCE', 'PRO'] as const satisfies readonly BillingTier[];
export type PublicTier = (typeof PUBLIC_TIERS)[number];

/** Prix mensuels TND (source de vérité commerciale). */
export const TIER_PRICES: Record<BillingTier, { TND: number | null; EUR: number | null; USD: number | null }> = {
  DECOUVERTE: { TND: 65, EUR: 20, USD: 22 },
  CROISSANCE: { TND: 89, EUR: 28, USD: 30 },
  PRO: { TND: 129, EUR: 40, USD: 44 },
  ENTERPRISE: { TND: null, EUR: null, USD: null },
};

/** Prix annuels TND (= ~10 mois). */
export const TIER_PRICES_ANNUAL: Record<BillingTier, { TND: number | null; EUR: number | null; USD: number | null }> = {
  DECOUVERTE: { TND: 650, EUR: 200, USD: 220 },
  CROISSANCE: { TND: 890, EUR: 280, USD: 300 },
  PRO: { TND: 1290, EUR: 400, USD: 440 },
  ENTERPRISE: { TND: null, EUR: null, USD: null },
};

/** Nombre max d’utilisateurs inclus par palier (null = sur devis / illimité). */
export const TIER_MAX_USERS: Record<BillingTier, number | null> = {
  DECOUVERTE: 1,
  CROISSANCE: 3,
  PRO: 10,
  ENTERPRISE: null,
};

export const TIER_LABELS: Record<BillingTier, string> = {
  DECOUVERTE: 'Essentiel',
  CROISSANCE: 'Croissance',
  PRO: 'Pro',
  ENTERPRISE: 'Entreprise',
};

/** @deprecated Prefer TRIAL_DURATION_DAYS from config/trial.ts */
export const TRIAL_DAYS = TRIAL_DURATION_DAYS;

/** Price IDs Stripe — à configurer dans .env (un par tier × devise × intervalle). */
export function stripePriceId(tier: BillingTier, currency: string, interval: 'month' | 'year' = 'month'): string | null {
  const key =
    interval === 'year'
      ? `STRIPE_PRICE_${tier}_${currency}_YEAR`
      : `STRIPE_PRICE_${tier}_${currency}`;
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
