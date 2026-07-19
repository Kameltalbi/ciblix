import { prisma } from '../db/prisma.js';

export type PlanType = 'FREE' | 'BASIC' | 'BUSINESS' | 'ENTERPRISE';

export const ALL_AGENT_SLUGS = [
  'hunt-ai',
  'copilot-ia',
  'scout-ai',
  'offre-bot',
  'gmail-ai',
  'factcheck-ai',
  'brand-pulse-ai',
] as const;

export type AgentSlug = (typeof ALL_AGENT_SLUGS)[number];

/** Plan minimum requis pour activer chaque agent. */
export const AGENT_MIN_PLAN: Record<AgentSlug, PlanType> = {
  'hunt-ai': 'BASIC',
  'copilot-ia': 'BASIC',
  'scout-ai': 'BUSINESS',
  'offre-bot': 'BUSINESS',
  'gmail-ai': 'BUSINESS',
  'factcheck-ai': 'ENTERPRISE',
  'brand-pulse-ai': 'ENTERPRISE',
};

const PLAN_ORDER: PlanType[] = ['FREE', 'BASIC', 'BUSINESS', 'ENTERPRISE'];

export const PLAN_AGENT_LABELS: Record<PlanType, string> = {
  FREE: 'Gratuit',
  BASIC: 'Basic',
  BUSINESS: 'Business',
  ENTERPRISE: 'Professionnel',
};

export function normalizePlan(raw: string | null | undefined): PlanType {
  const upper = (raw || 'FREE').toUpperCase();
  if (upper === 'STARTER') return 'BASIC';
  if (upper === 'PRO') return 'BUSINESS';
  if (PLAN_ORDER.includes(upper as PlanType)) return upper as PlanType;
  return 'FREE';
}

export function planRank(plan: PlanType): number {
  return PLAN_ORDER.indexOf(plan);
}

export function getAgentsForPlan(plan: PlanType): AgentSlug[] {
  return ALL_AGENT_SLUGS.filter((slug) => planRank(plan) >= planRank(AGENT_MIN_PLAN[slug]));
}

export function isAgentIncludedInPlan(plan: PlanType, slug: string): slug is AgentSlug {
  return getAgentsForPlan(plan).includes(slug as AgentSlug);
}

export function getMinimumPlanForAgent(slug: string): PlanType | null {
  if (!(slug in AGENT_MIN_PLAN)) return null;
  return AGENT_MIN_PLAN[slug as AgentSlug];
}

/**
 * Aligne les agents actifs avec le plan de l'organisation.
 * Les agents hors plan sont désactivés ; les agents inclus sont activés s'ils n'existent pas encore.
 */
export async function syncAgentsForPlan(organizationId: string, plan: PlanType): Promise<void> {
  const allowed = new Set(getAgentsForPlan(plan));

  for (const slug of ALL_AGENT_SLUGS) {
    const existing = await prisma.organizationAgent.findUnique({
      where: { organizationId_agentSlug: { organizationId, agentSlug: slug } },
    });

    if (allowed.has(slug)) {
      if (!existing) {
        await prisma.organizationAgent.create({
          data: { organizationId, agentSlug: slug, active: true },
        });
      }
      continue;
    }

    await prisma.organizationAgent.upsert({
      where: { organizationId_agentSlug: { organizationId, agentSlug: slug } },
      update: { active: false, deactivatedAt: new Date() },
      create: { organizationId, agentSlug: slug, active: false },
    });
  }
}
