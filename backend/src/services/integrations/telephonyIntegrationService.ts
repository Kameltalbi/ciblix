import { writeFile, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { prisma } from '../../db/prisma.js';
import { findOrCreateContact } from '../agent-memory/contactService.js';
import { createAgentEvent } from '../agent-memory/agentEventService.js';
import { putRawContent } from '../agent-memory/s3RawContent.js';
import { analyzeConversation } from '../copilot/conversationAnalysis.js';
import { transcribeAudio } from '../copilot/audioProcessing.js';
import { getIntegrationUserId } from './orgIntegrationUser.js';

async function assertTelephonyEnabled(organizationId: string): Promise<void> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { telephonyRecordingConsentMode: true },
  });
  if (!org || org.telephonyRecordingConsentMode !== 'CLIENT_RESPONSIBLE') {
    throw new Error('TELEPHONY_DISABLED');
  }
}

async function downloadRecording(url: string, headers?: Record<string, string>): Promise<Buffer> {
  const response = await fetch(url, { headers, signal: AbortSignal.timeout(120_000) });
  if (!response.ok) throw new Error(`download_failed:${response.status}`);
  const arrayBuf = await response.arrayBuffer();
  return Buffer.from(arrayBuf);
}

async function transcribeBuffer(buffer: Buffer, mimeType: string): Promise<string> {
  const tmpPath = join(tmpdir(), `ciblix-tel-${randomUUID()}`);
  await writeFile(tmpPath, buffer);
  try {
    return await transcribeAudio(tmpPath, mimeType);
  } finally {
    await unlink(tmpPath).catch(() => undefined);
  }
}

async function eventExists(organizationId: string, sourceRef: string): Promise<boolean> {
  const existing = await prisma.agentEvent.findFirst({
    where: { organizationId, source: 'COPILOT', sourceRef },
    select: { id: true },
  });
  return Boolean(existing);
}

export async function processTelephonyCallEnded(opts: {
  organizationId: string;
  callId: string;
  recordingUrl: string;
  callerPhone?: string | null;
  calleePhone?: string | null;
  mimeType?: string;
  authHeader?: string | null;
}): Promise<{ agentEventId: string }> {
  await assertTelephonyEnabled(opts.organizationId);
  if (await eventExists(opts.organizationId, opts.callId)) {
    throw new Error('CALL_ALREADY_PROCESSED');
  }

  const phone = opts.callerPhone || opts.calleePhone;
  if (!phone?.trim()) throw new Error('PHONE_REQUIRED');

  const contact = await findOrCreateContact({
    organizationId: opts.organizationId,
    phone: phone.trim(),
    createdVia: 'COPILOT',
    conflictSource: 'COPILOT',
    conflictSourceRef: opts.callId,
  });

  const userId = await getIntegrationUserId(opts.organizationId);
  const headers: Record<string, string> = {};
  if (opts.authHeader) headers.Authorization = opts.authHeader;

  const audioBuffer = await downloadRecording(opts.recordingUrl, headers);
  const mimeType = opts.mimeType || 'audio/mpeg';

  const contenuBrutRef = await putRawContent({
    organizationId: opts.organizationId,
    userId,
    buffer: audioBuffer,
    mimeType,
    originalName: `call-${opts.callId}`,
  });

  const transcription = await transcribeBuffer(audioBuffer, mimeType);
  const analysis = await analyzeConversation(opts.organizationId, transcription);

  const org = await prisma.organization.findUnique({
    where: { id: opts.organizationId },
    select: { telephonyConsentConfirmedAt: true },
  });

  const event = await createAgentEvent({
    organizationId: opts.organizationId,
    userId,
    contactId: contact.id,
    source: 'COPILOT',
    type: 'APPEL',
    contenuBrutRef,
    resume: analysis.resume,
    score: analysis.score,
    actionsSuggerees: analysis.actionsSuggerees,
    analysisJson: {
      scoreDetail: analysis.scoreDetail,
      signauxAchat: analysis.signauxAchat,
      channel: 'telephony',
      callId: opts.callId,
    },
    sourceRef: opts.callId,
    processingStatus: 'DONE',
    consentConfirmedBy: org?.telephonyConsentConfirmedAt ? userId : null,
    consentConfirmedAt: org?.telephonyConsentConfirmedAt ?? null,
  });

  return { agentEventId: event.id };
}

export async function processZoomRecording(opts: {
  organizationId: string;
  recordingId: string;
  downloadUrl: string;
  participantEmails?: string[];
  mimeType?: string;
}): Promise<{ agentEventId: string }> {
  await assertTelephonyEnabled(opts.organizationId);
  if (await eventExists(opts.organizationId, `zoom:${opts.recordingId}`)) {
    throw new Error('RECORDING_ALREADY_PROCESSED');
  }

  const org = await prisma.organization.findUnique({
    where: { id: opts.organizationId },
    select: { zoomOAuthToken: true, telephonyConsentConfirmedAt: true },
  });
  if (!org?.zoomOAuthToken) throw new Error('ZOOM_NOT_CONFIGURED');

  const externalEmail = opts.participantEmails?.find((e) => e.includes('@'));
  const contact = externalEmail
    ? await findOrCreateContact({
        organizationId: opts.organizationId,
        email: externalEmail,
        createdVia: 'COPILOT',
        conflictSource: 'COPILOT',
        conflictSourceRef: opts.recordingId,
      })
    : null;

  const userId = await getIntegrationUserId(opts.organizationId);
  const audioBuffer = await downloadRecording(opts.downloadUrl, {
    Authorization: `Bearer ${org.zoomOAuthToken}`,
  });
  const mimeType = opts.mimeType || 'audio/mpeg';

  const contenuBrutRef = await putRawContent({
    organizationId: opts.organizationId,
    userId,
    buffer: audioBuffer,
    mimeType,
    originalName: `zoom-${opts.recordingId}`,
  });

  const transcription = await transcribeBuffer(audioBuffer, mimeType);
  const analysis = await analyzeConversation(opts.organizationId, transcription);

  const event = await createAgentEvent({
    organizationId: opts.organizationId,
    userId,
    contactId: contact?.id ?? null,
    source: 'COPILOT',
    type: 'APPEL',
    contenuBrutRef,
    resume: analysis.resume,
    score: analysis.score,
    actionsSuggerees: analysis.actionsSuggerees,
    analysisJson: {
      scoreDetail: analysis.scoreDetail,
      signauxAchat: analysis.signauxAchat,
      channel: 'zoom',
      recordingId: opts.recordingId,
      participantEmails: opts.participantEmails ?? [],
    },
    sourceRef: `zoom:${opts.recordingId}`,
    processingStatus: 'DONE',
    consentConfirmedBy: org.telephonyConsentConfirmedAt ? userId : null,
    consentConfirmedAt: org.telephonyConsentConfirmedAt ?? null,
  });

  return { agentEventId: event.id };
}
