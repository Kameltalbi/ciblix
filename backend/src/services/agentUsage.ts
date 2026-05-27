import type { Response } from 'express';
import { prisma } from '../db/prisma.js';
import { getAgentQuota, getAllQuotasForPlan } from '../config/agentQuotas.js';
import { type AgentSlug, type PlanType } from '../config/agentPlans.js';
import { resolveOrganizationPlan } from '../middleware/planRestrictions.js';

export class AgentQuotaExceededError extends Error {
  readonly usage: number;
  readonly limit: number;
  readonly agentSlug: AgentSlug;

  constructor(agentSlug: AgentSlug, usage: number, limit: number) {
    super('Agent quota exceeded');
    this.name = 'AgentQuotaExceededError';
    this.agentSlug = agentSlug;
    this.usage = usage;
    this.limit = limit;
  }
}

function currentMonthKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export async function getAgentUsageCount(organizationId: string, agentSlug: AgentSlug): Promise<number> {
  const row = await prisma.agentUsageMonthly.findUnique({
    where: {
      organizationId_monthKey_agentSlug: {
        organizationId,
        monthKey: currentMonthKey(),
        agentSlug,
      },
    },
    select: { usageCount: true },
  });
  return row?.usageCount ?? 0;
}

export async function consumeAgentQuota(organizationId: string, agentSlug: AgentSlug, amount = 1): Promise<void> {
  const plan = await resolveOrganizationPlan(organizationId);
  const limit = getAgentQuota(plan, agentSlug);

  if (limit == null) {
    return;
  }

  const monthKey = currentMonthKey();

  await prisma.$transaction(async (tx) => {
    const row = await tx.agentUsageMonthly.upsert({
      where: {
        organizationId_monthKey_agentSlug: { organizationId, monthKey, agentSlug },
      },
      create: { organizationId, monthKey, agentSlug, usageCount: 0 },
      update: {},
    });

    if (row.usageCount + amount > limit) {
      throw new AgentQuotaExceededError(agentSlug, row.usageCount, limit);
    }

    await tx.agentUsageMonthly.update({
      where: { id: row.id },
      data: { usageCount: { increment: amount } },
    });
  });
}

export async function getOrganizationAgentUsageSummary(organizationId: string, plan: PlanType) {
  const monthKey = currentMonthKey();
  const quotas = getAllQuotasForPlan(plan);
  const rows = await prisma.agentUsageMonthly.findMany({
    where: { organizationId, monthKey },
    select: { agentSlug: true, usageCount: true },
  });
  const usageMap = new Map(rows.map((r) => [r.agentSlug, r.usageCount]));

  return Object.entries(quotas).map(([agentSlug, limit]) => ({
    agentSlug,
    usage: usageMap.get(agentSlug) ?? 0,
    limit,
    monthKey,
  }));
}

export function respondAgentQuotaExceeded(res: Response, error: AgentQuotaExceededError): void {
  res.status(429).json({
    error: 'Agent quota exceeded',
    agentSlug: error.agentSlug,
    usage: error.usage,
    limit: error.limit,
    message: `Quota mensuel atteint pour cet agent (${error.usage}/${error.limit}). Passez au plan supérieur ou attendez le mois prochain.`,
  });
}

export async function tryConsumeAgentQuota(
  organizationId: string,
  agentSlug: AgentSlug,
  res: Response,
  amount = 1,
): Promise<boolean> {
  try {
    await consumeAgentQuota(organizationId, agentSlug, amount);
    return true;
  } catch (error) {
    if (error instanceof AgentQuotaExceededError) {
      respondAgentQuotaExceeded(res, error);
      return false;
    }
    throw error;
  }
}
