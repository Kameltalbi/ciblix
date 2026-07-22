import { prisma } from '../../db/prisma.js';
import {
  computePipelineStatus,
  explainPipelineStatus,
  parsePipelineThresholds,
} from './computePipelineStatus.js';

export async function recalculateForContact(contactId: string): Promise<void> {
  const contact = await prisma.contact.findUnique({ where: { id: contactId } });
  if (!contact || contact.erasedAt) return;

  const org = await prisma.organization.findUnique({
    where: { id: contact.organizationId },
    select: { pipelineThresholds: true },
  });
  const thresholds = parsePipelineThresholds(org?.pipelineThresholds);

  const events = await prisma.agentEvent.findMany({
    where: { contactId, organizationId: contact.organizationId },
    orderBy: { createdAt: 'desc' },
    take: 50,
    select: { score: true, createdAt: true },
  });

  const { status, score } = computePipelineStatus(events, new Date(), thresholds);

  await prisma.contact.update({
    where: { id: contactId },
    data: {
      pipelineStatus: status,
      pipelineStatusScore: score,
      pipelineStatusAt: new Date(),
    },
  });
}

export async function recalculateStaleContacts(
  organizationId?: string,
  batchSize = 500
): Promise<number> {
  const staleBefore = new Date(Date.now() - 24 * 3_600_000);
  const contacts = await prisma.contact.findMany({
    where: {
      erasedAt: null,
      ...(organizationId ? { organizationId } : {}),
      OR: [{ pipelineStatusAt: null }, { pipelineStatusAt: { lt: staleBefore } }],
    },
    orderBy: { pipelineStatusAt: 'asc' },
    take: Math.min(batchSize, 500),
    select: { id: true },
  });

  for (const { id } of contacts) {
    await recalculateForContact(id);
  }

  return contacts.length;
}

export async function getPipelineStatusExplanation(contactId: string, organizationId: string) {
  const contact = await prisma.contact.findFirst({
    where: { id: contactId, organizationId, erasedAt: null },
    select: {
      pipelineStatus: true,
      pipelineStatusScore: true,
      pipelineStatusAt: true,
    },
  });
  if (!contact) return null;

  const lastEvent = await prisma.agentEvent.findFirst({
    where: { contactId, organizationId },
    orderBy: { createdAt: 'desc' },
    select: { createdAt: true },
  });

  return {
    status: contact.pipelineStatus,
    score: contact.pipelineStatusScore,
    calculatedAt: contact.pipelineStatusAt,
    explanation: explainPipelineStatus(
      contact.pipelineStatus,
      contact.pipelineStatusScore,
      lastEvent?.createdAt ?? null
    ),
  };
}
