import { prisma } from '../../db/prisma.js';
import { isAgentIncludedInPlan, normalizePlan } from '../../config/agentPlans.js';
import { syncGmailAiForUser } from './sync.js';

const TICK_MS = 2 * 60_000; // 2 min

async function tickOnce(): Promise<void> {
  if (process.env.GMAIL_AI_SCHEDULER_DISABLED === '1') return;

  const states = await prisma.gmailAiSyncState.findMany({
    where: { historyId: { not: null }, enabled: true },
    select: { userId: true, organizationId: true },
    take: 100,
  });

  for (const state of states) {
    try {
      const org = await prisma.organization.findUnique({
        where: { id: state.organizationId },
        select: { plan: true, paymentStatus: true, suspended: true },
      });
      if (!org || org.suspended) continue;

      const plan = normalizePlan(org.plan);
      if (!isAgentIncludedInPlan(plan, 'gmail-ai')) continue;

      const orgAgent = await prisma.organizationAgent.findUnique({
        where: {
          organizationId_agentSlug: {
            organizationId: state.organizationId,
            agentSlug: 'gmail-ai',
          },
        },
      });
      if (orgAgent && !orgAgent.active) continue;

      await syncGmailAiForUser(state.userId);
    } catch (err) {
      console.warn('[gmail-ai-scheduler] sync failed', state.userId, err);
    }
  }
}

let intervalId: ReturnType<typeof setInterval> | null = null;

export function startGmailAiScheduler(): void {
  if (intervalId) return;
  console.log('[gmail-ai-scheduler] actif (tick 2 min)');
  void tickOnce();
  intervalId = setInterval(() => void tickOnce(), TICK_MS);
}
