import { prisma } from '../../db/prisma.js';
import {
  claimNextAgentTask,
  completeAgentTask,
  enqueueAgentTask,
  failAgentTask,
} from './agentTaskService.js';
import {
  handleAnalyzeFit,
  handleEnrichCompany,
  handlePrepareOutreach,
  handleWatchSignals,
} from './handlers.js';

const TICK_MS = 60_000;
const MAX_TASKS_PER_TICK = 8;
let running = false;
let intervalId: ReturnType<typeof setInterval> | null = null;

async function scheduleWatchJobs(): Promise<void> {
  const now = new Date();
  const profiles = await prisma.orgTargetingProfile.findMany({
    where: {
      orchestratorEnabled: true,
      missionStatus: 'ACTIVE',
      missionCompletedAt: { not: null },
      organization: { suspended: false },
    },
    take: 40,
  });

  for (const p of profiles) {
    const intervalMs = Math.max(1, p.orchestratorIntervalH) * 3600_000;
    if (p.lastOrchestratorAt && now.getTime() - p.lastOrchestratorAt.getTime() < intervalMs) {
      continue;
    }

    await enqueueAgentTask({
      organizationId: p.organizationId,
      assignee: 'SCOUT',
      kind: 'WATCH_SIGNALS',
      priority: 40,
      dedupeKey: `watch:${p.organizationId}:${now.toISOString().slice(0, 13)}`,
      payload: { triggeredBy: 'orchestrator' },
    });

    await prisma.orgTargetingProfile.update({
      where: { id: p.id },
      data: { lastOrchestratorAt: now },
    });
  }
}

async function processOneTask(): Promise<boolean> {
  const task = await claimNextAgentTask();
  if (!task) return false;

  const mission = await prisma.orgTargetingProfile.findUnique({
    where: { organizationId: task.organizationId },
    select: { missionStatus: true, missionCompletedAt: true },
  });
  if (mission?.missionStatus !== 'ACTIVE' || !mission.missionCompletedAt) {
    await prisma.agentTask.update({
      where: { id: task.id },
      data: {
        status: 'CANCELLED',
        error: 'MISSION_REQUIRED',
        completedAt: new Date(),
        startedAt: null,
      },
    });
    return true;
  }

  try {
    let result: Record<string, unknown>;
    switch (task.kind) {
      case 'WATCH_SIGNALS':
        result = await handleWatchSignals(task);
        break;
      case 'ENRICH_COMPANY':
        result = await handleEnrichCompany(task);
        break;
      case 'ANALYZE_FIT':
        result = await handleAnalyzeFit(task);
        break;
      case 'PREPARE_OUTREACH':
        result = await handlePrepareOutreach(task);
        break;
      default:
        result = { skipped: true, reason: 'unknown_kind' };
    }
    await completeAgentTask(task.id, result);
    console.log(
      `[agent-orchestrator] ${task.kind} org=${task.organizationId} task=${task.id} ok`
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await failAgentTask(task.id, msg);
    console.warn(`[agent-orchestrator] ${task.kind} failed`, task.id, msg);
  }
  return true;
}

async function tickOnce(): Promise<void> {
  if (process.env.AGENT_ORCHESTRATOR_DISABLED === '1') return;
  if (running) return;
  running = true;
  try {
    await scheduleWatchJobs();
    for (let i = 0; i < MAX_TASKS_PER_TICK; i++) {
      const did = await processOneTask();
      if (!did) break;
    }
  } catch (err) {
    console.warn('[agent-orchestrator] tick', err);
  } finally {
    running = false;
  }
}

export function startAgentOrchestrator(): void {
  if (intervalId) return;
  console.log('[agent-orchestrator] actif (tick 60s) — équipe Veilleur→Prospecteur→Analyste→Assistant');
  void tickOnce();
  intervalId = setInterval(() => {
    void tickOnce();
  }, TICK_MS);
}

/** Exposé pour tests / admin. */
export async function runOrchestratorTickNow(): Promise<void> {
  await tickOnce();
}
