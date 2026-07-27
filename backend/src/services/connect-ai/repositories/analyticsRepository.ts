import type { Prisma } from '@prisma/client';
import { prisma } from '../../../db/prisma.js';
import type {
  ConnectAnalyticsEventType,
  ConnectChannelSlug,
  ConnectMessageStrategy,
  ConnectProductChoice,
} from '@prisma/client';

export async function saveGeneratedMessage(params: {
  organizationId: string;
  userId: string;
  channelId: string;
  prospectId?: string;
  strategy: ConnectMessageStrategy;
  product: ConnectProductChoice;
  content: string;
  promptVersionId?: string;
  aiModel?: string;
  generationMs?: number;
  metadata?: Record<string, unknown>;
}) {
  return prisma.connectGeneratedMessage.create({
    data: {
      organizationId: params.organizationId,
      userId: params.userId,
      channelId: params.channelId,
      prospectId: params.prospectId,
      strategy: params.strategy,
      product: params.product,
      content: params.content,
      promptVersionId: params.promptVersionId,
      aiModel: params.aiModel,
      generationMs: params.generationMs,
      metadata: params.metadata as Prisma.InputJsonValue | undefined,
      versions: { create: { version: 1, content: params.content } },
    },
    include: { channel: true, prospect: true },
  });
}

export async function listMessageHistory(organizationId: string, limit = 50) {
  return prisma.connectGeneratedMessage.findMany({
    where: { organizationId },
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: {
      channel: true,
      prospect: true,
      promptVersion: { include: { template: true } },
    },
  });
}

export async function recordMessageAction(
  messageId: string,
  organizationId: string,
  action: 'copied' | 'inserted' | 'saved'
) {
  const field =
    action === 'copied' ? 'copiedAt' : action === 'inserted' ? 'insertedAt' : 'savedAt';
  return prisma.connectGeneratedMessage.updateMany({
    where: { id: messageId, organizationId },
    data: { [field]: new Date() },
  });
}

export async function trackAnalytics(params: {
  organizationId: string;
  userId?: string;
  channelSlug?: ConnectChannelSlug;
  eventType: ConnectAnalyticsEventType;
  payload?: Record<string, unknown>;
}) {
  let channelId: string | undefined;
  if (params.channelSlug) {
    const ch = await prisma.connectChannel.findUnique({ where: { slug: params.channelSlug } });
    channelId = ch?.id;
  }
  return prisma.connectAnalyticsEvent.create({
    data: {
      organizationId: params.organizationId,
      userId: params.userId,
      channelId,
      eventType: params.eventType,
      payload: params.payload as Prisma.InputJsonValue | undefined,
    },
  });
}

export async function getAnalyticsSummary(organizationId: string, days = 30) {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const events = await prisma.connectAnalyticsEvent.findMany({
    where: { organizationId, createdAt: { gte: since } },
    include: { channel: true },
  });

  const messages = await prisma.connectGeneratedMessage.findMany({
    where: { organizationId, createdAt: { gte: since } },
    select: {
      product: true,
      generationMs: true,
      copiedAt: true,
      insertedAt: true,
      channel: { select: { slug: true, name: true } },
    },
  });

  const byType: Record<string, number> = {};
  const byChannel: Record<string, number> = {};
  const byProduct: Record<string, number> = {};

  for (const e of events) {
    byType[e.eventType] = (byType[e.eventType] || 0) + 1;
    if (e.channel?.slug) byChannel[e.channel.slug] = (byChannel[e.channel.slug] || 0) + 1;
  }

  for (const m of messages) {
    byProduct[m.product] = (byProduct[m.product] || 0) + 1;
    if (m.channel?.slug) byChannel[m.channel.slug] = (byChannel[m.channel.slug] || 0) + 1;
  }

  const genTimes = messages.map((m) => m.generationMs).filter((n): n is number => n != null);
  const avgGenerationMs = genTimes.length
    ? Math.round(genTimes.reduce((a, b) => a + b, 0) / genTimes.length)
    : null;

  const convEvents = await prisma.connectConversationEvent.findMany({
    where: {
      createdAt: { gte: since },
      conversation: { organizationId },
    },
    select: { eventType: true },
  });

  return {
    periodDays: days,
    eventsTotal: events.length,
    messagesGenerated: messages.length,
    messagesCopied: messages.filter((m) => m.copiedAt).length,
    messagesInserted: messages.filter((m) => m.insertedAt).length,
    avgGenerationMs,
    funnel: {
      generated: messages.length,
      inserted: messages.filter((m) => m.insertedAt).length,
      sent: convEvents.filter((e) => e.eventType === 'MESSAGE_SENT').length,
      replies: convEvents.filter((e) => e.eventType === 'REPLY_RECEIVED').length,
      meetings: convEvents.filter((e) => e.eventType === 'MEETING_BOOKED').length,
    },
    byEventType: byType,
    byChannel,
    byProduct,
  };
}
