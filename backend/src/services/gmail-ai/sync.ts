import { prisma } from '../../db/prisma.js';
import { gmailService } from '../gmail.js';
import { consumeAgentQuota, AgentQuotaExceededError } from '../agentUsage.js';
import {
  buildDraftBody,
  generateSummaryAndReply,
} from './summarize.js';
import { recordGmailInboundEmail } from '../agent-memory/agentIntegrations.js';
import {
  REVIEW_LABEL_NAME,
  extractEmailAddress,
  extractPlainText,
  getHeader,
  isInboundMessage,
  shouldSkipByCategory,
} from './messageUtils.js';

export async function ensureGmailAiSyncState(opts: {
  userId: string;
  organizationId: string;
  replyLanguage?: string;
  replyTone?: string;
  enabled?: boolean;
  signature?: string | null;
  ignoreNewsletters?: boolean;
  ignorePromotions?: boolean;
  ignoreSocial?: boolean;
}) {
  const token = await prisma.gmailToken.findUnique({ where: { userId: opts.userId } });
  if (!token) {
    throw new Error('Gmail non connecté');
  }

  const labelId = await gmailService.ensureLabel(token, REVIEW_LABEL_NAME);
  const historyId = await gmailService.getProfileHistoryId(token);

  const existing = await prisma.gmailAiSyncState.findUnique({
    where: { userId: opts.userId },
  });

  const settingsPatch = {
    ...(opts.replyLanguage ? { replyLanguage: opts.replyLanguage } : {}),
    ...(opts.replyTone ? { replyTone: opts.replyTone } : {}),
    ...(opts.enabled !== undefined ? { enabled: opts.enabled } : {}),
    ...(opts.signature !== undefined ? { signature: opts.signature } : {}),
    ...(opts.ignoreNewsletters !== undefined ? { ignoreNewsletters: opts.ignoreNewsletters } : {}),
    ...(opts.ignorePromotions !== undefined ? { ignorePromotions: opts.ignorePromotions } : {}),
    ...(opts.ignoreSocial !== undefined ? { ignoreSocial: opts.ignoreSocial } : {}),
  };

  if (existing) {
    return prisma.gmailAiSyncState.update({
      where: { userId: opts.userId },
      data: {
        organizationId: opts.organizationId,
        labelId,
        historyId: existing.historyId || historyId,
        enabled: opts.enabled ?? true,
        ...settingsPatch,
      },
    });
  }

  return prisma.gmailAiSyncState.create({
    data: {
      organizationId: opts.organizationId,
      userId: opts.userId,
      historyId,
      labelId,
      enabled: opts.enabled ?? true,
      activatedAt: new Date(),
      replyLanguage: opts.replyLanguage || 'fr',
      replyTone: opts.replyTone || 'professionnel',
      signature: opts.signature || null,
      ignoreNewsletters: opts.ignoreNewsletters ?? true,
      ignorePromotions: opts.ignorePromotions ?? true,
      ignoreSocial: opts.ignoreSocial ?? true,
    },
  });
}

async function processOneMessage(opts: {
  userId: string;
  organizationId: string;
  messageId: string;
  labelId: string;
  replyLanguage: string;
  replyTone: string;
  signature: string | null;
  ignoreNewsletters: boolean;
  ignorePromotions: boolean;
  ignoreSocial: boolean;
}): Promise<'processed' | 'skipped' | 'error' | 'quota'> {
  const already = await prisma.gmailAiProcessedMessage.findUnique({
    where: {
      userId_providerMessageId: {
        userId: opts.userId,
        providerMessageId: opts.messageId,
      },
    },
  });
  if (already) {
    // Les échecs (ex. mauvaise clé OpenAI) doivent pouvoir être retraités après correctif.
    if (already.status === 'ERROR') {
      await prisma.gmailAiProcessedMessage.delete({ where: { id: already.id } });
    } else {
      return 'skipped';
    }
  }

  const token = await prisma.gmailToken.findUnique({ where: { userId: opts.userId } });
  if (!token) return 'error';

  try {
    const message = await gmailService.getMessage(token, opts.messageId);
    const myEmail = await gmailService.getEmail(token);
    const threadId = message.threadId || opts.messageId;
    const subject = getHeader(message, 'Subject') || '(sans objet)';
    const fromHeader = getHeader(message, 'From') || '';
    const fromEmail = extractEmailAddress(fromHeader);

    const skip =
      !isInboundMessage(message, myEmail) ||
      shouldSkipByCategory(message, {
        ignoreNewsletters: opts.ignoreNewsletters,
        ignorePromotions: opts.ignorePromotions,
        ignoreSocial: opts.ignoreSocial,
      });

    if (skip) {
      await prisma.gmailAiProcessedMessage.create({
        data: {
          organizationId: opts.organizationId,
          userId: opts.userId,
          providerMessageId: opts.messageId,
          threadId,
          subject,
          fromEmail: fromEmail || null,
          status: 'SKIPPED',
        },
      });
      return 'skipped';
    }

    try {
      await consumeAgentQuota(opts.organizationId, 'gmail-ai', 1);
    } catch (err) {
      if (err instanceof AgentQuotaExceededError) return 'quota';
      throw err;
    }

    const body = extractPlainText(message);
    const ai = await generateSummaryAndReply({
      from: fromHeader || fromEmail,
      subject,
      body,
      language: opts.replyLanguage,
      tone: opts.replyTone,
      signature: opts.signature,
    });

    const draftBody = buildDraftBody(ai, opts.signature);

    // Pas de brouillon Gmail automatique sur le fil → évite le badge rouge « Brouillon »
    // partout dans la boîte. La réponse reste dans Ciblix + libellé « Réponse à valider ».
    // L’utilisateur crée le brouillon Gmail à la demande depuis l’UI (validation humaine).
    try {
      await gmailService.addLabelsToMessage(token, opts.messageId, [opts.labelId]);
    } catch {
      console.warn('[gmail-ai] label on inbound failed', opts.messageId);
    }

    await prisma.gmailAiProcessedMessage.create({
      data: {
        organizationId: opts.organizationId,
        userId: opts.userId,
        providerMessageId: opts.messageId,
        threadId,
        subject,
        fromEmail: fromEmail || null,
        summary: ai.summary,
        actionRequested: ai.actionRequested,
        analysis: ai.analysis,
        priority: ai.priority,
        suggestedReply: draftBody,
        draftId: null,
        status: 'PROCESSED',
      },
    });

    void recordGmailInboundEmail({
      organizationId: opts.organizationId,
      userId: opts.userId,
      fromEmail: fromEmail || '',
      fromName: fromHeader,
      summary: ai.summary,
      gmailMessageId: opts.messageId,
    }).catch((err) => {
      console.warn('[gmail-ai] agent-memory write failed', opts.messageId, err);
    });

    return 'processed';
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown_error';
    console.warn('[gmail-ai] process message failed', opts.messageId, msg);
    try {
      await prisma.gmailAiProcessedMessage.create({
        data: {
          organizationId: opts.organizationId,
          userId: opts.userId,
          providerMessageId: opts.messageId,
          threadId: opts.messageId,
          status: 'ERROR',
          errorMessage: msg.slice(0, 500),
        },
      });
    } catch {
      // ignore unique race
    }
    return 'error';
  }
}

export async function syncGmailAiForUser(userId: string): Promise<{
  processed: number;
  skipped: number;
  errors: number;
  quotaStopped: boolean;
}> {
  const state = await prisma.gmailAiSyncState.findUnique({ where: { userId } });
  if (!state?.historyId) {
    throw new Error('Sync non initialisée — activez l’agent Gmail IA');
  }
  if (!state.enabled) {
    return { processed: 0, skipped: 0, errors: 0, quotaStopped: false };
  }

  const token = await prisma.gmailToken.findUnique({ where: { userId } });
  if (!token) throw new Error('Gmail non connecté');

  let labelId = state.labelId;
  if (!labelId) {
    labelId = await gmailService.ensureLabel(token, REVIEW_LABEL_NAME);
    await prisma.gmailAiSyncState.update({
      where: { userId },
      data: { labelId },
    });
  }

  let messageIds: string[] = [];
  let newHistoryId: string | null = null;

  try {
    const history = await gmailService.listHistoryMessageIds(token, state.historyId);
    messageIds = history.messageIds;
    newHistoryId = history.newHistoryId;
  } catch (err: unknown) {
    const status =
      (err as { code?: number; response?: { status?: number } })?.code ||
      (err as { response?: { status?: number } })?.response?.status;
    if (status === 404) {
      const fresh = await gmailService.getProfileHistoryId(token);
      await prisma.gmailAiSyncState.update({
        where: { userId },
        data: { historyId: fresh, lastSyncAt: new Date() },
      });
      return { processed: 0, skipped: 0, errors: 0, quotaStopped: false };
    }
    throw err;
  }

  let processed = 0;
  let skipped = 0;
  let errors = 0;
  let quotaStopped = false;

  const failedRows = await prisma.gmailAiProcessedMessage.findMany({
    where: { userId, status: 'ERROR' },
    orderBy: { createdAt: 'desc' },
    take: 25,
    select: { providerMessageId: true },
  });
  const retryIds = failedRows.map((r: { providerMessageId: string }) => r.providerMessageId);
  const toProcess = [...new Set([...retryIds, ...messageIds])];

  for (const messageId of toProcess) {
    const result = await processOneMessage({
      userId,
      organizationId: state.organizationId,
      messageId,
      labelId: labelId!,
      replyLanguage: state.replyLanguage,
      replyTone: state.replyTone,
      signature: state.signature,
      ignoreNewsletters: state.ignoreNewsletters,
      ignorePromotions: state.ignorePromotions,
      ignoreSocial: state.ignoreSocial,
    });
    if (result === 'processed') processed += 1;
    else if (result === 'skipped') skipped += 1;
    else if (result === 'error') errors += 1;
    else if (result === 'quota') {
      quotaStopped = true;
      break;
    }
  }

  if (!quotaStopped) {
    const fallbackHistory = newHistoryId || (await gmailService.getProfileHistoryId(token));
    await prisma.gmailAiSyncState.update({
      where: { userId },
      data: {
        historyId: fallbackHistory || state.historyId,
        lastSyncAt: new Date(),
        labelId,
      },
    });
  } else {
    await prisma.gmailAiSyncState.update({
      where: { userId },
      data: { lastSyncAt: new Date() },
    });
  }

  return { processed, skipped, errors, quotaStopped };
}
