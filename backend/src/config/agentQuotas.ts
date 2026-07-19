import { type AgentSlug } from './agentPlans.js';
import type { PlanType } from './agentPlans.js';

/** Quotas mensuels d'appels IA par agent et par plan (usage PME standard). */
export const AGENT_QUOTAS: Record<PlanType, Partial<Record<AgentSlug, number>>> = {
  FREE: {},
  BASIC: {
    'hunt-ai': 150,
    'copilot-ia': 80,
  },
  BUSINESS: {
    'hunt-ai': 400,
    'copilot-ia': 200,
    'scout-ai': 30,
    'offre-bot': 25,
    'gmail-ai': 1000,
  },
  ENTERPRISE: {
    'hunt-ai': 800,
    'copilot-ia': 400,
    'scout-ai': 60,
    'offre-bot': 50,
    'gmail-ai': 2500,
    'brand-pulse-ai': 8,
    'factcheck-ai': 25,
  },
};

export function getAgentQuota(plan: PlanType, agentSlug: AgentSlug): number | null {
  const limit = AGENT_QUOTAS[plan]?.[agentSlug];
  return limit ?? null;
}

export function getAllQuotasForPlan(plan: PlanType): Partial<Record<AgentSlug, number>> {
  return AGENT_QUOTAS[plan] ?? {};
}
