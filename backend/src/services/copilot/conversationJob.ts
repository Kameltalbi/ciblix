import { prisma } from '../../db/prisma.js';
import {
  createAgentEvent,
  createProcessingPlaceholder,
  updateAgentEvent,
} from '../agent-memory/agentEventService.js';
import { resolveEventWithKeys } from '../agent-memory/contactResolution.js';
import { putRawContent } from '../agent-memory/s3RawContent.js';
import { transcribeAudio, uploadAudioBuffer } from './audioProcessing.js';
import { analyzeConversation } from './conversationAnalysis.js';

export type ContactHint = {
  phone?: string;
  email?: string;
  whatsapp?: string;
  name?: string;
};

async function retentionExpiresAt(organizationId: string): Promise<Date> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { agentEventRawRetentionDays: true },
  });
  const days = org?.agentEventRawRetentionDays ?? 90;
  return new Date(Date.now() + days * 86_400_000);
}

async function applyContactHints(eventId: string, hint?: ContactHint) {
  if (!hint) return;
  await resolveEventWithKeys(
    eventId,
    {
      phone: hint.phone,
      email: hint.email,
      whatsappId: hint.whatsapp,
      name: hint.name,
    },
    'COPILOT',
    'COPILOT'
  );
}

async function finalizeEvent(
  eventId: string,
  organizationId: string,
  userId: string,
  opts: {
    rawText: string;
    contenuBrutRef: string | null;
    type: 'APPEL' | 'NOTE';
    hint?: ContactHint;
  }
) {
  const analysis = await analyzeConversation(organizationId, opts.rawText);
  const expiresAt = opts.contenuBrutRef ? await retentionExpiresAt(organizationId) : null;

  const updated = await updateAgentEvent(eventId, {
    contenuBrutRef: opts.contenuBrutRef,
    contenuBrutExpiresAt: expiresAt,
    resume: analysis.resume,
    score: analysis.score,
    actionsSuggerees: analysis.actionsSuggerees,
    analysisJson: {
      scoreDetail: analysis.scoreDetail,
      signauxAchat: analysis.signauxAchat,
    },
    processingStatus: 'DONE',
    processingError: null,
    type: opts.type,
    source: 'COPILOT',
    consentConfirmedBy: userId,
    consentConfirmedAt: new Date(),
  });

  await applyContactHints(eventId, opts.hint);

  const { resolveEventContact } = await import('../agent-memory/contactResolution.js');
  void resolveEventContact(eventId).catch((err) => {
    console.warn('[copilot] resolve after finalize failed', eventId, err);
  });

  return { event: updated, analysis };
}

/** Traitement synchrone pour texte collé */
export async function processTextConversation(opts: {
  organizationId: string;
  userId: string;
  text: string;
  hint?: ContactHint;
}) {
  const text = opts.text.trim();
  if (!text) throw new Error('Texte vide');

  const contenuBrutRef = await putRawContent({
    organizationId: opts.organizationId,
    userId: opts.userId,
    buffer: Buffer.from(text, 'utf8'),
    mimeType: 'text/plain',
    originalName: 'conversation.txt',
  });

  const event = await createAgentEvent({
    organizationId: opts.organizationId,
    userId: opts.userId,
    source: 'COPILOT',
    type: 'NOTE',
    contenuBrutRef,
    consentConfirmedBy: opts.userId,
    consentConfirmedAt: new Date(),
    processingStatus: 'PROCESSING',
  });

  try {
    const { event: done, analysis } = await finalizeEvent(event.id, opts.organizationId, opts.userId, {
      rawText: text,
      contenuBrutRef,
      type: 'NOTE',
      hint: opts.hint,
    });
    return { agentEventId: done.id, status: 'done' as const, ...analysis };
  } catch (err) {
    await updateAgentEvent(event.id, {
      processingStatus: 'ERROR',
      processingError: err instanceof Error ? err.message : 'processing_failed',
    });
    throw err;
  }
}

/** Démarre un job async pour audio */
export async function startAudioConversation(opts: {
  organizationId: string;
  userId: string;
  audioPath: string;
  audioMime: string;
  audioBuffer: Buffer;
  originalName: string;
  hint?: ContactHint;
}) {
  const placeholder = await createProcessingPlaceholder({
    organizationId: opts.organizationId,
    userId: opts.userId,
    type: 'APPEL',
    consentConfirmedBy: opts.userId,
  });

  void runAudioJob(placeholder.id, opts).catch((err) => {
    console.error('[copilot] audio job failed', placeholder.id, err);
  });

  return { agentEventId: placeholder.id, status: 'processing' as const };
}

async function runAudioJob(
  eventId: string,
  opts: {
    organizationId: string;
    userId: string;
    audioPath: string;
    audioMime: string;
    audioBuffer: Buffer;
    originalName: string;
    hint?: ContactHint;
  }
) {
  try {
    const contenuBrutRef = await uploadAudioBuffer({
      organizationId: opts.organizationId,
      userId: opts.userId,
      buffer: opts.audioBuffer,
      mimeType: opts.audioMime,
      originalName: opts.originalName,
    });

    const transcription = await transcribeAudio(opts.audioPath, opts.audioMime);
    await finalizeEvent(eventId, opts.organizationId, opts.userId, {
      rawText: transcription,
      contenuBrutRef,
      type: 'APPEL',
      hint: opts.hint,
    });
  } catch (err) {
    await updateAgentEvent(eventId, {
      processingStatus: 'ERROR',
      processingError: err instanceof Error ? err.message : 'audio_processing_failed',
    });
  }
}
