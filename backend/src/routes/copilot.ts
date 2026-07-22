import { Router } from 'express';
import type { NextFunction, Response } from 'express';
import multer from 'multer';
import path from 'node:path';
import { z } from 'zod';
import auth, { AuthRequest } from '../middleware/auth.js';
import { checkAgentAccess } from '../middleware/planRestrictions.js';
import { tryConsumeAgentQuota } from '../services/agentUsage.js';
import { getUploadsDir } from '../lib/uploadsDir.js';
import { getAgentEventForOrg } from '../services/agent-memory/agentEventService.js';
import { buildCopilotBriefing } from '../services/copilot/briefing.js';
import { listCopilotMessages, sendCopilotChat } from '../services/copilot/chatService.js';
import {
  processTextConversation,
  startAudioConversation,
  type ContactHint,
} from '../services/copilot/conversationJob.js';
import { isAllowedAudioMime } from '../services/copilot/audioProcessing.js';
import {
  getCopilotOrgConfigForEdit,
  upsertCopilotOrgConfig,
  type ScoringCriterion,
} from '../services/copilot/orgConfig.js';

export const copilotRoutes = Router();

copilotRoutes.use(auth);
copilotRoutes.use(checkAgentAccess('copilot-ia'));

const audioStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, getUploadsDir()),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || '.audio';
    cb(null, `copilot-audio-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
  },
});

const audioUpload = multer({
  storage: audioStorage,
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!isAllowedAudioMime(file.mimetype)) {
      return cb(new Error('Format audio non supporté'));
    }
    cb(null, true);
  },
});

function parseContactHint(body: Record<string, unknown>): ContactHint | undefined {
  const phone = typeof body.contactHintPhone === 'string' ? body.contactHintPhone.trim() : '';
  const email = typeof body.contactHintEmail === 'string' ? body.contactHintEmail.trim() : '';
  const whatsapp = typeof body.contactHintWhatsapp === 'string' ? body.contactHintWhatsapp.trim() : '';
  const name = typeof body.contactHintName === 'string' ? body.contactHintName.trim() : '';
  if (!phone && !email && !whatsapp && !name) return undefined;
  return { phone: phone || undefined, email: email || undefined, whatsapp: whatsapp || undefined, name: name || undefined };
}

function parseConsent(body: Record<string, unknown>): boolean {
  const v = body.consentConfirmed;
  return v === true || v === 'true' || v === '1' || v === 1;
}

function serializeEvent(event: NonNullable<Awaited<ReturnType<typeof getAgentEventForOrg>>>) {
  const analysis = (event.analysisJson || {}) as {
    scoreDetail?: Record<string, string | number>;
    signauxAchat?: string[];
  };

  const status =
    event.processingStatus === 'ERROR'
      ? 'error'
      : event.processingStatus === 'PROCESSING'
        ? 'processing'
        : 'done';

  return {
    agentEventId: event.id,
    status,
    processingError: event.processingError,
    resume: event.resume,
    score: event.score,
    actionsSuggerees: event.actionsSuggerees,
    scoreDetail: analysis.scoreDetail ?? {},
    signauxAchat: analysis.signauxAchat ?? [],
    contactId: event.contactId,
    contact: event.contact,
    createdAt: event.createdAt.toISOString(),
  };
}

copilotRoutes.get('/briefing', async (req: AuthRequest, res, next) => {
  try {
    const briefing = await buildCopilotBriefing(req.organizationId!);
    res.json(briefing);
  } catch (e) {
    next(e);
  }
});

copilotRoutes.post(
  '/conversations',
  audioUpload.single('file'),
  async (req: AuthRequest, res, next) => {
    try {
      if (!(await tryConsumeAgentQuota(req.organizationId!, 'copilot-ia', res))) return;

      const body = req.body as Record<string, unknown>;
      if (!parseConsent(body)) {
        return res.status(400).json({ error: 'Le consentement est obligatoire pour traiter la conversation.' });
      }

      const text = typeof body.texte === 'string' ? body.texte.trim() : '';
      const hint = parseContactHint(body);
      const orgId = req.organizationId!;
      const userId = req.userId!;

      if (req.file) {
        const buffer = await import('node:fs/promises').then((fs) => fs.readFile(req.file!.path));
        const started = await startAudioConversation({
          organizationId: orgId,
          userId,
          audioPath: req.file.path,
          audioMime: req.file.mimetype,
          audioBuffer: buffer,
          originalName: req.file.originalname,
          hint,
        });
        return res.status(202).json(started);
      }

      if (!text) {
        return res.status(400).json({ error: 'Fournissez un fichier audio ou un texte à analyser.' });
      }

      const result = await processTextConversation({
        organizationId: orgId,
        userId,
        text,
        hint,
      });

      return res.status(200).json({
        agentEventId: result.agentEventId,
        status: result.status,
        resume: result.resume,
        score: result.score,
        actionsSuggerees: result.actionsSuggerees,
        scoreDetail: result.scoreDetail,
        signauxAchat: result.signauxAchat,
      });
    } catch (e) {
      next(e);
    }
  }
);

copilotRoutes.get('/conversations/:agentEventId', async (req: AuthRequest, res, next) => {
  try {
    const agentEventId = String(req.params.agentEventId);
    const event = await getAgentEventForOrg(req.organizationId!, agentEventId);
    if (!event) return res.status(404).json({ error: 'Conversation introuvable' });
    res.json(serializeEvent(event));
  } catch (e) {
    next(e);
  }
});

const chatSchema = z.object({
  message: z.string().min(1),
  contactId: z.string().optional(),
  agentEventId: z.string().optional(),
});

copilotRoutes.get('/chat/messages', async (req: AuthRequest, res, next) => {
  try {
    const contactId = typeof req.query.contactId === 'string' ? req.query.contactId : undefined;
    const agentEventId = typeof req.query.agentEventId === 'string' ? req.query.agentEventId : undefined;
    const messages = await listCopilotMessages({
      organizationId: req.organizationId!,
      userId: req.userId!,
      contactId,
      agentEventId,
    });
    res.json({ messages });
  } catch (e) {
    next(e);
  }
});

copilotRoutes.post('/chat', async (req: AuthRequest, res, next) => {
  try {
    if (!(await tryConsumeAgentQuota(req.organizationId!, 'copilot-ia', res))) return;

    const body = chatSchema.parse(req.body);
    const result = await sendCopilotChat({
      organizationId: req.organizationId!,
      userId: req.userId!,
      message: body.message,
      contactId: body.contactId,
      agentEventId: body.agentEventId,
    });

    res.json({
      reply: result.reply,
      userMessageId: result.userMessage.id,
      assistantMessageId: result.assistantMessage.id,
    });
  } catch (e) {
    next(e);
  }
});

const orgConfigSchema = z.object({
  sector: z.string().max(200).optional().nullable(),
  businessLexicon: z.string().max(8000).optional().nullable(),
  scoringGrid: z
    .array(
      z.object({
        key: z.string().min(1).max(80),
        label: z.string().min(1).max(200),
        weight: z.number().min(0).max(100),
      })
    )
    .optional()
    .nullable(),
});

function requireOrgOwner(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.user || (req.user.role !== 'OWNER' && req.user.role !== 'SUPERADMIN')) {
    return res.status(403).json({ error: "Réservé au propriétaire de l'organisation" });
  }
  next();
}

copilotRoutes.get('/org-config', async (req: AuthRequest, res, next) => {
  try {
    const config = await getCopilotOrgConfigForEdit(req.organizationId!);
    res.json(config);
  } catch (e) {
    next(e);
  }
});

copilotRoutes.put('/org-config', requireOrgOwner, async (req: AuthRequest, res, next) => {
  try {
    const body = orgConfigSchema.parse(req.body);
    await upsertCopilotOrgConfig(req.organizationId!, {
      sector: body.sector,
      businessLexicon: body.businessLexicon,
      scoringGrid: (body.scoringGrid as ScoringCriterion[] | null | undefined) ?? null,
    });
    const config = await getCopilotOrgConfigForEdit(req.organizationId!);
    res.json(config);
  } catch (e) {
    next(e);
  }
});
