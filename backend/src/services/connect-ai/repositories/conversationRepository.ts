import type { Prisma } from '@prisma/client';
import { prisma } from '../../../db/prisma.js';
import type { ConnectChannelSlug, ConnectProspectObjective } from '../core/types.js';
import type { ConnectConversationEventType } from '@prisma/client';

export async function getOrCreateConversation(params: {
  organizationId: string;
  userId: string;
  prospectId: string;
  channelId: string;
  objective?: ConnectProspectObjective;
}) {
  const existing = await prisma.connectConversation.findUnique({
    where: {
      organizationId_prospectId_userId: {
        organizationId: params.organizationId,
        prospectId: params.prospectId,
        userId: params.userId,
      },
    },
    include: { events: { orderBy: { createdAt: 'desc' }, take: 30 } },
  });

  if (existing) {
    if (params.objective && existing.objective !== params.objective) {
      return prisma.connectConversation.update({
        where: { id: existing.id },
        data: { objective: params.objective },
        include: { events: { orderBy: { createdAt: 'desc' }, take: 30 } },
      });
    }
    return existing;
  }

  return prisma.connectConversation.create({
    data: {
      organizationId: params.organizationId,
      userId: params.userId,
      prospectId: params.prospectId,
      channelId: params.channelId,
      objective: params.objective,
    },
    include: { events: { orderBy: { createdAt: 'desc' }, take: 30 } },
  });
}

export async function appendConversationEvent(params: {
  organizationId: string;
  userId: string;
  prospectId: string;
  channelId: string;
  eventType: ConnectConversationEventType;
  content?: string;
  messageId?: string;
  objective?: ConnectProspectObjective;
  pipelineStage?: string;
  metadata?: Record<string, unknown>;
}) {
  const conversation = await getOrCreateConversation({
    organizationId: params.organizationId,
    userId: params.userId,
    prospectId: params.prospectId,
    channelId: params.channelId,
    objective: params.objective,
  });

  const event = await prisma.connectConversationEvent.create({
    data: {
      conversationId: conversation.id,
      eventType: params.eventType,
      content: params.content,
      messageId: params.messageId,
      metadata: params.metadata as Prisma.InputJsonValue | undefined,
    },
  });

  if (params.pipelineStage) {
    await prisma.connectConversation.update({
      where: { id: conversation.id },
      data: { pipelineStage: params.pipelineStage },
    });
  }

  return { conversation, event };
}

export async function listConversations(organizationId: string, userId: string, limit = 30) {
  return prisma.connectConversation.findMany({
    where: { organizationId, userId },
    orderBy: { updatedAt: 'desc' },
    take: limit,
    include: {
      prospect: true,
      events: { orderBy: { createdAt: 'desc' }, take: 5 },
    },
  });
}

export async function getConversationForProspect(
  organizationId: string,
  userId: string,
  prospectId: string
) {
  return prisma.connectConversation.findUnique({
    where: {
      organizationId_prospectId_userId: { organizationId, prospectId, userId },
    },
    include: {
      prospect: true,
      events: { orderBy: { createdAt: 'asc' } },
    },
  });
}

export async function recordConversationFromChannel(
  organizationId: string,
  userId: string,
  channelSlug: ConnectChannelSlug,
  prospectId: string,
  eventType: ConnectConversationEventType,
  extra?: { content?: string; messageId?: string; objective?: ConnectProspectObjective }
) {
  const channel = await prisma.connectChannel.findUnique({ where: { slug: channelSlug } });
  if (!channel) return null;
  return appendConversationEvent({
    organizationId,
    userId,
    prospectId,
    channelId: channel.id,
    eventType,
    ...extra,
  });
}
