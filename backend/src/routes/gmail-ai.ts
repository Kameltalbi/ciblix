import { Router, type NextFunction, type Response } from 'express';
import { z } from 'zod';
import auth, { AuthRequest, requirePaymentApproved } from '../middleware/auth.js';
import { checkAgentAccess } from '../middleware/planRestrictions.js';
import { prisma } from '../db/prisma.js';
import { gmailService } from '../services/gmail.js';
import { ensureGmailAiSyncState, syncGmailAiForUser } from '../services/gmail-ai/sync.js';
import { REVIEW_LABEL_NAME } from '../services/gmail-ai/messageUtils.js';

export const gmailAiRoutes = Router();

const settingsSchema = z.object({
  enabled: z.boolean().optional(),
  replyLanguage: z.enum(['fr', 'en', 'ar']).optional(),
  replyTone: z.enum(['professionnel', 'chaleureux', 'concis', 'creatif', 'commercial', 'technique']).optional(),
  signature: z.string().max(2000).nullable().optional(),
  ignoreNewsletters: z.boolean().optional(),
  ignorePromotions: z.boolean().optional(),
  ignoreSocial: z.boolean().optional(),
});

gmailAiRoutes.get('/ping', (_req, res) => {
  res.status(200).json({ ok: true, module: 'gmail-ai', at: new Date().toISOString() });
});

gmailAiRoutes.use(auth);
gmailAiRoutes.use(requirePaymentApproved);
gmailAiRoutes.use(checkAgentAccess('gmail-ai'));

/** Alias architecture : connecte via OAuth Gmail existant. */
gmailAiRoutes.post('/connect', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const url = gmailService.getAuthUrl(req.userId!);
    res.json({ url });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Gmail OAuth non configuré';
    res.status(500).json({ error: message, code: 'GMAIL_OAUTH_NOT_CONFIGURED' });
  }
});

gmailAiRoutes.get('/status', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId!;
    const token = await prisma.gmailToken.findUnique({ where: { userId } });
    const syncState = await prisma.gmailAiSyncState.findUnique({ where: { userId } });
    const email = token ? await gmailService.getEmail(token) : null;

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const [todayProcessed, todayErrors, pendingDrafts] = await Promise.all([
      prisma.gmailAiProcessedMessage.count({
        where: {
          userId,
          organizationId: req.organizationId!,
          status: 'PROCESSED',
          createdAt: { gte: startOfDay },
        },
      }),
      prisma.gmailAiProcessedMessage.count({
        where: {
          userId,
          organizationId: req.organizationId!,
          status: 'ERROR',
          createdAt: { gte: startOfDay },
        },
      }),
      prisma.gmailAiProcessedMessage.count({
        where: {
          userId,
          organizationId: req.organizationId!,
          status: 'PROCESSED',
          draftId: { not: null },
        },
      }),
    ]);

    res.json({
      connected: !!token,
      email,
      labelName: REVIEW_LABEL_NAME,
      labelId: syncState?.labelId || null,
      historyId: syncState?.historyId || null,
      enabled: syncState?.enabled ?? false,
      activatedAt: syncState?.activatedAt || null,
      lastSyncAt: syncState?.lastSyncAt || null,
      replyLanguage: syncState?.replyLanguage || 'fr',
      replyTone: syncState?.replyTone || 'professionnel',
      signature: syncState?.signature || null,
      ignoreNewsletters: syncState?.ignoreNewsletters ?? true,
      ignorePromotions: syncState?.ignorePromotions ?? true,
      ignoreSocial: syncState?.ignoreSocial ?? true,
      syncReady: !!(token && syncState?.historyId),
      neverAutoSend: true,
      today: {
        processed: todayProcessed,
        drafts: todayProcessed,
        errors: todayErrors,
        pendingDrafts,
      },
    });
  } catch (err) {
    next(err);
  }
});

/** Active sync + enabled=true (nouveaux mails uniquement). */
gmailAiRoutes.post('/activate', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const body = settingsSchema.parse(req.body || {});
    const state = await ensureGmailAiSyncState({
      userId: req.userId!,
      organizationId: req.organizationId!,
      enabled: true,
      replyLanguage: body.replyLanguage,
      replyTone: body.replyTone,
      signature: body.signature,
      ignoreNewsletters: body.ignoreNewsletters,
      ignorePromotions: body.ignorePromotions,
      ignoreSocial: body.ignoreSocial,
    });

    res.json({
      ok: true,
      syncReady: !!state.historyId,
      enabled: state.enabled,
      labelName: REVIEW_LABEL_NAME,
      state,
      message:
        'Gmail IA activé. Seuls les nouveaux e-mails seront traités. Validation = envoi manuel dans Gmail.',
    });
  } catch (err) {
    if (err instanceof Error && err.message === 'Gmail non connecté') {
      res.status(400).json({ error: err.message, code: 'GMAIL_NOT_CONNECTED' });
      return;
    }
    next(err);
  }
});

/** Compat ancien endpoint. */
gmailAiRoutes.post('/activate-sync', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const body = settingsSchema.parse(req.body || {});
    const state = await ensureGmailAiSyncState({
      userId: req.userId!,
      organizationId: req.organizationId!,
      enabled: true,
      replyLanguage: body.replyLanguage,
      replyTone: body.replyTone,
      signature: body.signature,
      ignoreNewsletters: body.ignoreNewsletters,
      ignorePromotions: body.ignorePromotions,
      ignoreSocial: body.ignoreSocial,
    });

    res.json({
      ok: true,
      syncReady: !!state.historyId,
      enabled: state.enabled,
      labelName: REVIEW_LABEL_NAME,
      state,
      message:
        'Gmail IA activé. Seuls les nouveaux e-mails seront traités. Validation = envoi manuel dans Gmail.',
    });
  } catch (err) {
    if (err instanceof Error && err.message === 'Gmail non connecté') {
      res.status(400).json({ error: err.message, code: 'GMAIL_NOT_CONNECTED' });
      return;
    }
    next(err);
  }
});

gmailAiRoutes.post('/settings', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const body = settingsSchema.parse(req.body || {});
    const existing = await prisma.gmailAiSyncState.findUnique({
      where: { userId: req.userId! },
    });
    if (!existing) {
      const state = await ensureGmailAiSyncState({
        userId: req.userId!,
        organizationId: req.organizationId!,
        ...body,
      });
      res.json({ ok: true, state });
      return;
    }

    const state = await prisma.gmailAiSyncState.update({
      where: { userId: req.userId! },
      data: {
        ...(body.enabled !== undefined ? { enabled: body.enabled } : {}),
        ...(body.replyLanguage ? { replyLanguage: body.replyLanguage } : {}),
        ...(body.replyTone ? { replyTone: body.replyTone } : {}),
        ...(body.signature !== undefined ? { signature: body.signature } : {}),
        ...(body.ignoreNewsletters !== undefined ? { ignoreNewsletters: body.ignoreNewsletters } : {}),
        ...(body.ignorePromotions !== undefined ? { ignorePromotions: body.ignorePromotions } : {}),
        ...(body.ignoreSocial !== undefined ? { ignoreSocial: body.ignoreSocial } : {}),
      },
    });
    res.json({ ok: true, state });
  } catch (err) {
    next(err);
  }
});

gmailAiRoutes.post('/sync', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    let state = await prisma.gmailAiSyncState.findUnique({
      where: { userId: req.userId! },
    });
    if (!state?.historyId) {
      state = await ensureGmailAiSyncState({
        userId: req.userId!,
        organizationId: req.organizationId!,
        enabled: true,
      });
    }

    const result = await syncGmailAiForUser(req.userId!);
    res.json({
      ok: true,
      ...result,
      neverAutoSend: true,
      labelName: REVIEW_LABEL_NAME,
    });
  } catch (err) {
    if (err instanceof Error && err.message.includes('Gmail non connecté')) {
      res.status(400).json({ error: err.message, code: 'GMAIL_NOT_CONNECTED' });
      return;
    }
    next(err);
  }
});

async function listMessages(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const take = Math.min(Number(req.query.limit) || 30, 100);
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;
    const rows = await prisma.gmailAiProcessedMessage.findMany({
      where: {
        userId: req.userId!,
        organizationId: req.organizationId!,
        ...(status === 'PROCESSED' || status === 'SKIPPED' || status === 'ERROR'
          ? { status }
          : {}),
      },
      orderBy: { createdAt: 'desc' },
      take,
    });

    const providerIds = rows.map((r) => r.providerMessageId).filter(Boolean);
    const contactByProvider =
      providerIds.length === 0
        ? []
        : await prisma.agentEvent.findMany({
            where: {
              organizationId: req.organizationId!,
              source: 'GMAIL',
              contactId: { not: null },
              sourceRef: { in: providerIds },
            },
            select: { sourceRef: true, contactId: true },
          });
    const contactMap = Object.fromEntries(
      contactByProvider
        .filter((e) => e.sourceRef && e.contactId)
        .map((e) => [e.sourceRef!, e.contactId!])
    );

    res.json({
      items: rows.map((r) => ({
        ...r,
        contactId: contactMap[r.providerMessageId] ?? null,
      })),
      labelName: REVIEW_LABEL_NAME,
      neverAutoSend: true,
    });
  } catch (err) {
    next(err);
  }
}

gmailAiRoutes.get('/messages', listMessages);
gmailAiRoutes.get('/processed', listMessages);

gmailAiRoutes.get('/statistics', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId!;
    const organizationId = req.organizationId!;
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const [processedToday, errorsToday, draftsTotal, highPriority, processedAll] = await Promise.all([
      prisma.gmailAiProcessedMessage.count({
        where: { userId, organizationId, status: 'PROCESSED', createdAt: { gte: startOfDay } },
      }),
      prisma.gmailAiProcessedMessage.count({
        where: { userId, organizationId, status: 'ERROR', createdAt: { gte: startOfDay } },
      }),
      prisma.gmailAiProcessedMessage.count({
        where: { userId, organizationId, status: 'PROCESSED', draftId: { not: null } },
      }),
      prisma.gmailAiProcessedMessage.count({
        where: { userId, organizationId, status: 'PROCESSED', priority: 'HIGH' },
      }),
      prisma.gmailAiProcessedMessage.count({
        where: { userId, organizationId, status: 'PROCESSED' },
      }),
    ]);

    // Estimation simple : ~4 min gagnées par brouillon
    const minutesSaved = processedToday * 4;
    const successRate =
      processedToday + errorsToday > 0
        ? Math.round((processedToday / (processedToday + errorsToday)) * 100)
        : 100;

    res.json({
      today: {
        emailsRead: processedToday + errorsToday,
        draftsCreated: processedToday,
        errors: errorsToday,
        successRate,
        minutesSaved,
      },
      totals: {
        drafts: draftsTotal,
        processed: processedAll,
        highPriority,
      },
      neverAutoSend: true,
      labelName: REVIEW_LABEL_NAME,
    });
  } catch (err) {
    next(err);
  }
});
