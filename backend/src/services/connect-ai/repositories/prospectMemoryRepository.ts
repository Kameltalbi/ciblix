import { prisma } from '../../../db/prisma.js';
import type { ProspectMemorySummary } from '../core/types.js';

function sentimentFromContent(content?: string | null): 'positive' | 'neutral' | 'negative' | null {
  if (!content) return null;
  const lower = content.toLowerCase();
  if (/positiv|intéress|rdv|merci|oui|volontiers|happy|great/i.test(lower)) return 'positive';
  if (/non|pas intéress|refus|busy|occupé/i.test(lower)) return 'negative';
  return 'neutral';
}

export async function getProspectMemory(
  organizationId: string,
  userId: string,
  prospectId: string
): Promise<ProspectMemorySummary | null> {
  const prospect = await prisma.connectProspect.findFirst({
    where: { id: prospectId, organizationId },
  });
  if (!prospect) return null;

  const conversation = await prisma.connectConversation.findUnique({
    where: {
      organizationId_prospectId_userId: { organizationId, prospectId, userId },
    },
    include: {
      events: { orderBy: { createdAt: 'desc' }, take: 20 },
    },
  });

  const lastMessage = await prisma.connectGeneratedMessage.findFirst({
    where: { organizationId, prospectId, userId },
    orderBy: { createdAt: 'desc' },
  });

  const events = conversation?.events ?? [];
  const lastSent = events.find((e) => e.eventType === 'MESSAGE_SENT');
  const lastReply = events.find((e) => e.eventType === 'REPLY_RECEIVED');
  const lastMeeting = events.find((e) => e.eventType === 'MEETING_BOOKED');
  const lastContact = lastSent || lastReply || events[0];

  const qual = prospect.aiQualification as { recommendedProductSlug?: string; recommendedProductName?: string } | null;

  return {
    prospectId,
    fullName: prospect.fullName,
    company: prospect.company,
    lastContactAt: lastContact?.createdAt.toISOString() ?? prospect.updatedAt.toISOString(),
    lastContactType: lastContact?.eventType ?? null,
    lastResponseSentiment: sentimentFromContent(lastReply?.content),
    lastMeetingAt: lastMeeting?.createdAt.toISOString() ?? null,
    lastProductSlug: qual?.recommendedProductSlug ?? lastMessage?.product?.toLowerCase() ?? null,
    lastProductName: qual?.recommendedProductName ?? null,
    lastMessagePreview: lastMessage?.content?.slice(0, 200) ?? null,
    objective: conversation?.objective ?? null,
    pipelineStage: conversation?.pipelineStage ?? null,
    events: events.map((e) => ({
      type: e.eventType,
      content: e.content,
      createdAt: e.createdAt.toISOString(),
    })),
  };
}
