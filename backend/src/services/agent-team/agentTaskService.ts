import type { AgentRole, AgentTask, AgentTaskKind } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { prisma } from '../../db/prisma.js';

export type EnqueueAgentTaskInput = {
  organizationId: string;
  assignee: AgentRole;
  kind: AgentTaskKind;
  payload?: Record<string, unknown>;
  priority?: number;
  parentTaskId?: string | null;
  contactId?: string | null;
  /** Clé anti-doublon (ex: enrich:scoutOpp:xyz). Null = pas de dédup. */
  dedupeKey?: string | null;
  availableAt?: Date;
};

/**
 * Crée une tâche pour un autre agent. Ignore silencieusement les doublons (dedupeKey).
 */
export async function enqueueAgentTask(input: EnqueueAgentTaskInput): Promise<AgentTask | null> {
  const dedupeKey = input.dedupeKey?.trim() || null;
  if (dedupeKey) {
    const existing = await prisma.agentTask.findUnique({
      where: {
        organizationId_dedupeKey: {
          organizationId: input.organizationId,
          dedupeKey,
        },
      },
    });
    if (existing && existing.status !== 'FAILED' && existing.status !== 'CANCELLED') {
      return existing;
    }
    if (existing) {
      return prisma.agentTask.update({
        where: { id: existing.id },
        data: {
          status: 'PENDING',
          assignee: input.assignee,
          kind: input.kind,
          payload: (input.payload ?? {}) as Prisma.InputJsonValue,
          priority: input.priority ?? 50,
          parentTaskId: input.parentTaskId ?? null,
          contactId: input.contactId ?? null,
          error: null,
          result: Prisma.DbNull,
          attempts: 0,
          availableAt: input.availableAt ?? new Date(),
          startedAt: null,
          completedAt: null,
        },
      });
    }
  }

  try {
    return await prisma.agentTask.create({
      data: {
        organizationId: input.organizationId,
        assignee: input.assignee,
        kind: input.kind,
        payload: (input.payload ?? {}) as Prisma.InputJsonValue,
        priority: input.priority ?? 50,
        parentTaskId: input.parentTaskId ?? null,
        contactId: input.contactId ?? null,
        dedupeKey,
        availableAt: input.availableAt ?? new Date(),
      },
    });
  } catch (err) {
    const code = (err as { code?: string })?.code;
    if (code === 'P2002' && dedupeKey) {
      return prisma.agentTask.findUnique({
        where: {
          organizationId_dedupeKey: {
            organizationId: input.organizationId,
            dedupeKey,
          },
        },
      });
    }
    throw err;
  }
}

/** Claim atomique d’une tâche PENDING. */
export async function claimNextAgentTask(opts?: {
  assignees?: AgentRole[];
  organizationId?: string;
}): Promise<AgentTask | null> {
  const now = new Date();
  const where: Prisma.AgentTaskWhereInput = {
    status: 'PENDING',
    availableAt: { lte: now },
    ...(opts?.organizationId ? { organizationId: opts.organizationId } : {}),
    ...(opts?.assignees?.length ? { assignee: { in: opts.assignees } } : {}),
  };

  const candidate = await prisma.agentTask.findFirst({
    where,
    orderBy: [{ priority: 'desc' }, { availableAt: 'asc' }, { createdAt: 'asc' }],
  });
  if (!candidate) return null;

  const claimed = await prisma.agentTask.updateMany({
    where: { id: candidate.id, status: 'PENDING' },
    data: {
      status: 'RUNNING',
      startedAt: now,
      attempts: { increment: 1 },
    },
  });
  if (claimed.count === 0) return null;

  return prisma.agentTask.findUnique({ where: { id: candidate.id } });
}

export async function completeAgentTask(
  taskId: string,
  result?: Record<string, unknown>
): Promise<AgentTask> {
  return prisma.agentTask.update({
    where: { id: taskId },
    data: {
      status: 'DONE',
      completedAt: new Date(),
      result: (result ?? {}) as Prisma.InputJsonValue,
      error: null,
    },
  });
}

export async function failAgentTask(taskId: string, error: string): Promise<AgentTask> {
  const task = await prisma.agentTask.findUniqueOrThrow({ where: { id: taskId } });
  const retry = task.attempts < task.maxAttempts;
  return prisma.agentTask.update({
    where: { id: taskId },
    data: {
      status: retry ? 'PENDING' : 'FAILED',
      error: error.slice(0, 4000),
      availableAt: retry ? new Date(Date.now() + Math.min(task.attempts, 5) * 5 * 60_000) : undefined,
      startedAt: null,
      completedAt: retry ? null : new Date(),
    },
  });
}

export async function overnightTeamStats(organizationId: string, since: Date) {
  const [tasksDone, byKind, events, scoutNew, suggestions] = await Promise.all([
    prisma.agentTask.count({
      where: { organizationId, status: 'DONE', completedAt: { gte: since } },
    }),
    prisma.agentTask.groupBy({
      by: ['kind'],
      where: { organizationId, status: 'DONE', completedAt: { gte: since } },
      _count: { _all: true },
    }),
    prisma.agentEvent.count({
      where: { organizationId, createdAt: { gte: since } },
    }),
    prisma.scoutOpportunity.count({
      where: { organizationId, createdAt: { gte: since }, status: 'NEW' },
    }),
    prisma.suggestion.count({
      where: { organizationId, createdAt: { gte: since }, status: 'PENDING' },
    }),
  ]);

  const kindMap = Object.fromEntries(byKind.map((k) => [k.kind, k._count._all]));

  const priorityContacts = await prisma.contact.count({
    where: {
      organizationId,
      erasedAt: null,
      pipelineStatus: { in: ['CHAUD'] },
      updatedAt: { gte: since },
    },
  });

  const scoreUp = await prisma.agentEvent.count({
    where: {
      organizationId,
      source: 'ANALYSTE',
      createdAt: { gte: since },
      score: { gte: 70 },
    },
  });

  return {
    since: since.toISOString(),
    tasksCompleted: tasksDone,
    companiesDetected: kindMap.WATCH_SIGNALS ?? scoutNew,
    companiesEnriched: kindMap.ENRICH_COMPANY ?? 0,
    opportunitiesAnalyzed: kindMap.ANALYZE_FIT ?? 0,
    messagesPrepared: kindMap.PREPARE_OUTREACH ?? suggestions,
    priorityOpportunities: priorityContacts,
    scoreIncreased: scoreUp,
    eventsLogged: events,
    scoutSignals: scoutNew,
  };
}
