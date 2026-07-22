import type { Contact } from '@prisma/client';
import { prisma } from '../../db/prisma.js';
import { findOrCreateContact } from '../agent-memory/contactService.js';
import { createAgentEvent } from '../agent-memory/agentEventService.js';
import { putRawContent } from '../agent-memory/s3RawContent.js';
import { analyzeConversation } from '../copilot/conversationAnalysis.js';
import { getIntegrationUserId } from './orgIntegrationUser.js';
import {
  formatSessionTranscript,
  MAX_SESSION_MESSAGES,
  shouldCloseSession,
  type BufferedMessage,
} from './whatsappSessionUtils.js';

function parseMessages(raw: unknown): BufferedMessage[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((m) => m && typeof m === 'object' && 'text' in m)
    .map((m) => {
      const msg = m as BufferedMessage;
      return {
        direction: msg.direction === 'OUT' ? ('OUT' as const) : ('IN' as const),
        text: String(msg.text || ''),
        at: String(msg.at || new Date().toISOString()),
      };
    })
    .filter((m) => m.text.trim());
}

export async function appendWhatsAppMessage(opts: {
  organizationId: string;
  whatsappId: string;
  text: string;
  direction: 'IN' | 'OUT';
}): Promise<{ contact: Contact; shouldClose: boolean; sessionId: string }> {
  const org = await prisma.organization.findUnique({
    where: { id: opts.organizationId },
    select: { whatsappSessionTimeoutMinutes: true },
  });
  const timeoutMinutes = org?.whatsappSessionTimeoutMinutes ?? 30;

  const contact = await findOrCreateContact({
    organizationId: opts.organizationId,
    whatsappId: opts.whatsappId,
    createdVia: 'COPILOT',
    conflictSource: 'COPILOT',
  });

  const now = new Date();
  const newMsg: BufferedMessage = {
    direction: opts.direction,
    text: opts.text.trim(),
    at: now.toISOString(),
  };

  const existing = await prisma.whatsappSessionBuffer.findUnique({
    where: {
      organizationId_whatsappId: {
        organizationId: opts.organizationId,
        whatsappId: opts.whatsappId,
      },
    },
  });

  const messages = existing ? [...parseMessages(existing.messages), newMsg] : [newMsg];
  const capped = messages.slice(-MAX_SESSION_MESSAGES);

  const session = await prisma.whatsappSessionBuffer.upsert({
    where: {
      organizationId_whatsappId: {
        organizationId: opts.organizationId,
        whatsappId: opts.whatsappId,
      },
    },
    create: {
      organizationId: opts.organizationId,
      whatsappId: opts.whatsappId,
      contactId: contact.id,
      messages: capped,
      lastMessageAt: now,
    },
    update: {
      contactId: contact.id,
      messages: capped,
      lastMessageAt: now,
    },
  });

  const close = shouldCloseSession(session.lastMessageAt, capped.length, timeoutMinutes, now);
  return { contact, shouldClose: close, sessionId: session.id };
}

async function sessionAlreadyProcessed(sessionId: string, organizationId: string): Promise<boolean> {
  const existing = await prisma.agentEvent.findFirst({
    where: { organizationId, source: 'COPILOT', sourceRef: sessionId },
    select: { id: true },
  });
  return Boolean(existing);
}

export async function closeWhatsAppSession(
  organizationId: string,
  whatsappId: string
): Promise<{ processed: boolean; reason?: string; agentEventId?: string }> {
  const buffer = await prisma.whatsappSessionBuffer.findUnique({
    where: { organizationId_whatsappId: { organizationId, whatsappId } },
    include: { contact: true },
  });
  if (!buffer) return { processed: false, reason: 'no_session' };

  if (await sessionAlreadyProcessed(buffer.id, organizationId)) {
    await prisma.whatsappSessionBuffer.delete({ where: { id: buffer.id } });
    return { processed: false, reason: 'already_processed' };
  }

  const messages = parseMessages(buffer.messages);
  if (messages.length === 0) {
    await prisma.whatsappSessionBuffer.delete({ where: { id: buffer.id } });
    return { processed: false, reason: 'empty' };
  }

  const contact =
    buffer.contact ||
    (await prisma.contact.findFirst({
      where: { id: buffer.contactId || '', organizationId, erasedAt: null },
    }));

  if (!contact) {
    return { processed: false, reason: 'contact_missing' };
  }

  if (!contact.whatsappConsentAt) {
    return { processed: false, reason: 'consent_required' };
  }

  const transcript = formatSessionTranscript(messages);
  const userId = await getIntegrationUserId(organizationId);

  const contenuBrutRef = await putRawContent({
    organizationId,
    userId,
    buffer: Buffer.from(transcript, 'utf8'),
    mimeType: 'text/plain',
    originalName: `whatsapp-${whatsappId}.txt`,
  });

  const analysis = await analyzeConversation(organizationId, transcript);

  const event = await createAgentEvent({
    organizationId,
    userId,
    contactId: contact.id,
    source: 'COPILOT',
    type: 'WHATSAPP',
    contenuBrutRef,
    resume: analysis.resume,
    score: analysis.score,
    actionsSuggerees: analysis.actionsSuggerees,
    analysisJson: {
      scoreDetail: analysis.scoreDetail,
      signauxAchat: analysis.signauxAchat,
      channel: 'whatsapp',
      messageCount: messages.length,
    },
    sourceRef: buffer.id,
    processingStatus: 'DONE',
    consentConfirmedBy: userId,
    consentConfirmedAt: contact.whatsappConsentAt,
  });

  await prisma.whatsappSessionBuffer.delete({ where: { id: buffer.id } });
  return { processed: true, agentEventId: event.id };
}

export async function closeStaleWhatsAppSessions(batchSize = 50): Promise<number> {
  const orgs = await prisma.organization.findMany({
    where: { whatsappPhoneNumberId: { not: null } },
    select: { id: true, whatsappSessionTimeoutMinutes: true },
  });

  let closed = 0;
  for (const org of orgs) {
    const cutoff = new Date(Date.now() - (org.whatsappSessionTimeoutMinutes ?? 30) * 60_000);
    const stale = await prisma.whatsappSessionBuffer.findMany({
      where: { organizationId: org.id, lastMessageAt: { lt: cutoff } },
      take: batchSize,
      select: { whatsappId: true },
    });

    for (const row of stale) {
      try {
        const result = await closeWhatsAppSession(org.id, row.whatsappId);
        if (result.processed) closed += 1;
      } catch (err) {
        console.warn('[whatsapp] close stale failed', org.id, row.whatsappId, err);
      }
    }
  }
  return closed;
}

export async function recordWhatsAppConsent(contactId: string, organizationId: string): Promise<Contact> {
  const contact = await prisma.contact.findFirst({
    where: { id: contactId, organizationId, erasedAt: null },
  });
  if (!contact) throw new Error('Contact introuvable');

  return prisma.contact.update({
    where: { id: contactId },
    data: { whatsappConsentAt: new Date() },
  });
}
