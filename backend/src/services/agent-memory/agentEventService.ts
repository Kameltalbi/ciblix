import type {
  AgentEvent,
  AgentEventResolutionStatus,
  AgentEventSource,
  AgentEventType,
  Prisma,
} from '@prisma/client';
import { prisma } from '../../db/prisma.js';
import { scheduleOrgRescan } from './contactResolution.js';

export type CreateAgentEventInput = {
  organizationId: string;
  userId: string;
  contactId?: string | null;
  source: AgentEventSource;
  type: AgentEventType;
  contenuBrutRef?: string | null;
  resume?: string | null;
  score?: number | null;
  actionsSuggerees?: string[];
  consentConfirmedBy?: string | null;
  consentConfirmedAt?: Date | null;
  sourceRef?: string | null;
};

async function retentionExpiresAt(organizationId: string): Promise<Date | null> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { agentEventRawRetentionDays: true },
  });
  const days = org?.agentEventRawRetentionDays ?? 90;
  return new Date(Date.now() + days * 86_400_000);
}

/**
 * Seule porte d'entrée pour créer un AgentEvent.
 */
export async function createAgentEvent(input: CreateAgentEventInput): Promise<AgentEvent> {
  const hasRaw = Boolean(input.contenuBrutRef);
  const expiresAt = hasRaw ? await retentionExpiresAt(input.organizationId) : null;

  const event = await prisma.agentEvent.create({
    data: {
      organizationId: input.organizationId,
      userId: input.userId,
      contactId: input.contactId || null,
      source: input.source,
      type: input.type,
      contenuBrutRef: input.contenuBrutRef || null,
      contenuBrutExpiresAt: expiresAt,
      resume: input.resume || null,
      score: input.score ?? null,
      actionsSuggerees: input.actionsSuggerees ?? [],
      consentConfirmedBy: input.consentConfirmedBy || null,
      consentConfirmedAt: input.consentConfirmedAt || null,
      sourceRef: input.sourceRef || null,
      resolutionStatus: input.contactId ? 'RESOLVED' : 'PENDING',
      resolutionNextRetryAt: input.contactId ? null : new Date(),
    },
  });

  if (!input.contactId) {
    const { resolveEventContact } = await import('./contactResolution.js');
    void resolveEventContact(event.id).catch((err) => {
      console.warn('[agent-memory] resolve after create failed', event.id, err);
    });
  }

  return event;
}

export async function listEventsForContact(
  organizationId: string,
  contactId: string,
  opts: { take?: number; skip?: number } = {}
): Promise<{ items: AgentEvent[]; total: number }> {
  const take = Math.min(opts.take ?? 50, 100);
  const skip = opts.skip ?? 0;
  const where: Prisma.AgentEventWhereInput = { organizationId, contactId };

  const [items, total] = await Promise.all([
    prisma.agentEvent.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take,
      skip,
    }),
    prisma.agentEvent.count({ where }),
  ]);

  return { items, total };
}

export async function listUnresolvedEvents(
  organizationId: string | null,
  status: AgentEventResolutionStatus | AgentEventResolutionStatus[],
  opts: { take?: number } = {}
) {
  const take = Math.min(opts.take ?? 50, 200);
  const statuses = Array.isArray(status) ? status : [status];

  return prisma.agentEvent.findMany({
    where: {
      ...(organizationId ? { organizationId } : {}),
      resolutionStatus: { in: statuses },
      contactId: null,
    },
    orderBy: { createdAt: 'desc' },
    take,
  });
}

export async function assignEventToContact(
  eventId: string,
  contactId: string,
  organizationId: string
): Promise<AgentEvent> {
  const contact = await prisma.contact.findFirst({
    where: { id: contactId, organizationId, erasedAt: null },
  });
  if (!contact) throw new Error('Contact introuvable');

  const updated = await prisma.agentEvent.update({
    where: { id: eventId },
    data: {
      contactId,
      resolutionStatus: 'RESOLVED',
      resolutionNextRetryAt: null,
    },
  });

  scheduleOrgRescan(organizationId);
  return updated;
}
