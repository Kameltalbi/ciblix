import { Router, type NextFunction, type Response } from 'express';
import { z } from 'zod';
import multer from 'multer';
import fs from 'fs';
import auth, { AuthRequest, requirePaymentApproved } from '../middleware/auth.js';
import { checkAgentAccess } from '../middleware/planRestrictions.js';
import {
  qualifyProspect,
  refineMessage,
  generateInitialMessage,
  getAnalyticsSummary,
  getChannelId,
  getExtensionSession,
  listMessageHistory,
  listProspects,
  listTemplates,
  recordMessageAction,
  saveGeneratedMessage,
  trackAnalytics,
  upsertExtensionSession,
  updateUserTone,
  getUserMemory,
  listCommercialProducts,
  getProspectMemory,
  createExtensionAuthCode,
  exchangeExtensionAuthCode,
  refreshExtensionAccessToken,
  appendConversationEvent,
  listConversations,
  getConversationForProspect,
  createTemplateVersion,
  upsertProspect,
  listKnowledgeSources,
  deleteKnowledgeSource,
  ingestTextSource,
  ingestUrlSource,
  ingestFileSource,
  reindexSource,
  knowledgeUploadDir,
} from '../services/connect-ai/index.js';

export const connectAiRoutes = Router();

const channelSlugSchema = z.enum([
  'LINKEDIN',
  'GMAIL',
  'OUTLOOK',
  'WHATSAPP',
  'FACEBOOK',
  'INSTAGRAM',
  'TWITTER',
  'CRM',
  'HUBSPOT',
  'SALESFORCE',
]);

const strategySchema = z.enum([
  'CONNECTION',
  'FIRST_MESSAGE',
  'FOLLOW_UP',
  'POST_MEETING',
  'INTRODUCTION',
  'DEMO_INVITE',
  'MEETING_REQUEST',
  'CUSTOM',
]);

const toneSchema = z.enum(['professionnel', 'amical', 'premium']);

function slugToProductEnum(slug: string): 'CARBOSCAN' | 'SOFTFACTURE' | 'BOTH' | 'CUSTOM' {
  if (slug === 'carboscan') return 'CARBOSCAN';
  if (slug === 'softfacture') return 'SOFTFACTURE';
  if (slug.includes('both')) return 'BOTH';
  return 'CUSTOM';
}

const objectiveSchema = z.enum([
  'GET_MEETING',
  'PRESENT_CARBOSCAN',
  'PRESENT_SOFTFACTURE',
  'RE_ENGAGE',
  'INVITE_DEMO',
  'FIRST_CONTACT',
  'FOLLOW_UP',
  'CUSTOM',
]);

const profileSchema = z.record(z.unknown());

const analyzeBodySchema = z.object({
  channelSlug: channelSlugSchema,
  profile: profileSchema,
  saveProspect: z.boolean().optional(),
  objective: objectiveSchema.optional(),
});

const generateBodySchema = z.object({
  channelSlug: channelSlugSchema,
  strategy: strategySchema,
  objective: objectiveSchema.optional(),
  productSlug: z.string().optional(),
  profile: profileSchema,
  qualification: z.record(z.unknown()).optional(),
  analysis: z.record(z.unknown()).optional(),
  history: z.array(z.string()).optional(),
  context: z.string().optional(),
  customPrompt: z.string().optional(),
  prospectId: z.string().optional(),
});

const historyActionSchema = z.object({
  messageId: z.string(),
  action: z.enum(['copied', 'inserted', 'saved']),
  prospectId: z.string().optional(),
  channelSlug: channelSlugSchema.optional(),
});

const settingsSchema = z.object({
  language: z.string().optional(),
  tone: z.string().optional(),
  style: z.string().optional(),
  length: z.string().optional(),
  favoriteProducts: z.array(z.string()).optional(),
  signature: z.string().nullable().optional(),
  customPrompt: z.string().nullable().optional(),
  scope: z.enum(['user', 'org']).optional(),
});

const sessionSchema = z.object({
  browser: z.string().optional(),
  extensionVersion: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

connectAiRoutes.get('/ping', (_req, res) => {
  res.json({ ok: true, module: 'connect-ai', at: new Date().toISOString() });
});

/** OAuth extension — échange code PKCE (public). */
connectAiRoutes.post('/auth/token', async (req, res, next) => {
  try {
    const body = z
      .object({
        code: z.string().min(10),
        code_verifier: z.string().min(43).max(128),
        redirect_uri: z.string().url(),
      })
      .parse(req.body);
    const tokens = await exchangeExtensionAuthCode({
      code: body.code,
      codeVerifier: body.code_verifier,
      redirectUri: body.redirect_uri,
    });
    res.json(tokens);
  } catch (err) {
    next(err);
  }
});

connectAiRoutes.post('/auth/refresh', async (req, res, next) => {
  try {
    const { refreshToken } = z.object({ refreshToken: z.string() }).parse(req.body);
    const tokens = await refreshExtensionAccessToken(refreshToken);
    res.json(tokens);
  } catch (err) {
    res.status(401).json({ error: err instanceof Error ? err.message : 'Session expirée' });
  }
});

connectAiRoutes.use(auth);
connectAiRoutes.use(requirePaymentApproved);
connectAiRoutes.use(checkAgentAccess('connect-ai'));

/** Crée un code d'autorisation pour l'extension (utilisateur connecté sur Ciblix). */
connectAiRoutes.post('/auth/authorize', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const body = z
      .object({
        code_challenge: z.string().min(10),
        redirect_uri: z.string().url(),
      })
      .parse(req.body);
    const code = await createExtensionAuthCode({
      userId: req.userId!,
      organizationId: req.organizationId!,
      codeChallenge: body.code_challenge,
      redirectUri: body.redirect_uri,
    });
    res.json({ code, expiresIn: 120 });
  } catch (err) {
    next(err);
  }
});

/** Analyse / qualification commerciale complète. */
connectAiRoutes.post('/analyze', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const body = analyzeBodySchema.parse(req.body);
    const qualification = await qualifyProspect(
      req.organizationId!,
      req.userId!,
      body.channelSlug,
      body.profile
    );

    let prospect = null;
    if (body.saveProspect !== false) {
      prospect = await upsertProspect({
        organizationId: req.organizationId!,
        userId: req.userId!,
        channelSlug: body.channelSlug,
        profile: body.profile as never,
        analysis: qualification as never,
      });
      if (prospect) {
        const channelId = await getChannelId(body.channelSlug);
        await appendConversationEvent({
          organizationId: req.organizationId!,
          userId: req.userId!,
          prospectId: prospect.id,
          channelId,
          eventType: 'NOTE',
          content: `Qualification — score ${qualification.score}/100`,
          objective: body.objective,
          metadata: { score: qualification.score },
        });
      }
    }

    let memory = null;
    if (prospect?.id) {
      memory = await getProspectMemory(req.organizationId!, req.userId!, prospect.id);
    }

    await trackAnalytics({
      organizationId: req.organizationId!,
      userId: req.userId,
      channelSlug: body.channelSlug,
      eventType: 'PROFILE_ANALYZED',
      payload: { score: qualification.score, prospectId: prospect?.id },
    });

    res.json({ qualification, analysis: qualification, prospect, memory });
  } catch (err) {
    next(err);
  }
});

/** Génère un message initial (copilote). */
connectAiRoutes.post('/generate', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const body = generateBodySchema.parse(req.body);
    const memory = await getUserMemory(req.userId!);
    const qualification = (body.qualification ?? body.analysis) as import('../services/connect-ai/core/types.js').ProspectQualification | undefined;
    if (!qualification) {
      res.status(400).json({ error: 'Qualification requise — lancez d\'abord l\'analyse.' });
      return;
    }

    const content = await generateInitialMessage({
      organizationId: req.organizationId!,
      userId: req.userId!,
      profile: body.profile as never,
      qualification,
      objective: body.objective,
      tone: memory.preferredTone,
    });

    const channelId = await getChannelId(body.channelSlug);
    const productSlug = qualification?.recommendedProductSlug ?? 'carboscan';
    const started = Date.now();

    const saved = await saveGeneratedMessage({
      organizationId: req.organizationId!,
      userId: req.userId!,
      channelId,
      prospectId: body.prospectId,
      strategy: body.strategy,
      product: slugToProductEnum(productSlug),
      content,
      generationMs: Date.now() - started,
      metadata: { productSlug, source: 'copilot' },
    });

    await trackAnalytics({
      organizationId: req.organizationId!,
      userId: req.userId,
      channelSlug: body.channelSlug,
      eventType: 'MESSAGE_GENERATED',
      payload: { messageId: saved.id, strategy: body.strategy },
    });

    if (body.prospectId) {
      await appendConversationEvent({
        organizationId: req.organizationId!,
        userId: req.userId!,
        prospectId: body.prospectId,
        channelId,
        eventType: 'MESSAGE_GENERATED',
        content: content.slice(0, 500),
        messageId: saved.id,
        objective: body.objective,
      });
    }

    res.json({
      message: saved,
      content,
      product: productSlug,
      generationMs: Date.now() - started,
      source: 'copilot',
      disclaimer: 'Message prêt. Cliquez sur Envoyer vous-même — aucun envoi automatique.',
    });
  } catch (err) {
    next(err);
  }
});

/** Enregistre une action utilisateur (copier / insérer / sauvegarder). */
connectAiRoutes.post('/history', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const body = historyActionSchema.parse(req.body);
    await recordMessageAction(body.messageId, req.organizationId!, body.action);

    const eventType =
      body.action === 'copied'
        ? 'MESSAGE_COPIED'
        : body.action === 'inserted'
          ? 'MESSAGE_INSERTED'
          : 'MESSAGE_SAVED';

    await trackAnalytics({
      organizationId: req.organizationId!,
      userId: req.userId,
      eventType,
      payload: { messageId: body.messageId },
    });

    if (body.prospectId && body.channelSlug && body.action === 'inserted') {
      const channelId = await getChannelId(body.channelSlug);
      await appendConversationEvent({
        organizationId: req.organizationId!,
        userId: req.userId!,
        prospectId: body.prospectId,
        channelId,
        eventType: 'MESSAGE_INSERTED',
        messageId: body.messageId,
      });
    }

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

/** Historique des messages générés. */
connectAiRoutes.get('/history', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const limit = Math.min(100, Number(req.query.limit) || 50);
    const history = await listMessageHistory(req.organizationId!, limit);
    res.json({ history });
  } catch (err) {
    next(err);
  }
});

/** Templates de prompts versionnés. */
connectAiRoutes.get('/templates', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const templates = await listTemplates(req.organizationId!);
    res.json({ templates });
  } catch (err) {
    next(err);
  }
});

/** Analytics agrégées. */
connectAiRoutes.get('/analytics', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const days = Math.min(90, Number(req.query.days) || 30);
    const summary = await getAnalyticsSummary(req.organizationId!, days);
    res.json(summary);
  } catch (err) {
    next(err);
  }
});

/** Prospects capturés. */
connectAiRoutes.get('/prospects', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const prospects = await listProspects(req.organizationId!);
    res.json({ prospects });
  } catch (err) {
    next(err);
  }
});

/** Mode conversationnel — affiner le message ("plus court", "en anglais"…). */
connectAiRoutes.post('/refine', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const body = z
      .object({
        message: z.string().min(1),
        instruction: z.string().min(1),
        profile: profileSchema.optional(),
        qualification: z.record(z.unknown()).optional(),
        objective: z.string().optional(),
      })
      .parse(req.body);

    const result = await refineMessage({
      organizationId: req.organizationId!,
      userId: req.userId!,
      message: body.message,
      instruction: body.instruction,
      profile: body.profile as never,
      qualification: body.qualification as never,
      objective: body.objective,
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
});

/** Mémoire prospect (retour après 3 mois). */
connectAiRoutes.get('/prospects/:prospectId/memory', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const memory = await getProspectMemory(
      req.organizationId!,
      req.userId!,
      String(req.params.prospectId)
    );
    res.json({ memory });
  } catch (err) {
    next(err);
  }
});

/** Catalogue produits commercial. */
connectAiRoutes.get('/products', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const products = await listCommercialProducts(req.organizationId!);
    res.json({ products });
  } catch (err) {
    next(err);
  }
});

/** Paramètres minimaux — ton uniquement. */
connectAiRoutes.get('/settings', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const [memory, session] = await Promise.all([
      getUserMemory(req.userId!),
      getExtensionSession(req.organizationId!, req.userId!),
    ]);
    res.json({ tone: memory.preferredTone, memory, session, extensionVersion: '0.2.0' });
  } catch (err) {
    next(err);
  }
});

connectAiRoutes.patch('/settings', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const body = z.object({ tone: toneSchema }).parse(req.body);
    await updateUserTone(req.userId!, body.tone);
    const memory = await getUserMemory(req.userId!);
    res.json({ tone: memory.preferredTone, memory });
  } catch (err) {
    next(err);
  }
});

/** @deprecated — utiliser PATCH /settings avec tone */
connectAiRoutes.patch('/settings/legacy', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const body = settingsSchema.parse(req.body);
    if (body.tone && ['professionnel', 'amical', 'premium'].includes(body.tone)) {
      await updateUserTone(req.userId!, body.tone as 'professionnel' | 'amical' | 'premium');
    }
    const memory = await getUserMemory(req.userId!);
    res.json({ memory });
  } catch (err) {
    next(err);
  }
});

/** Sync session extension. */
connectAiRoutes.post('/session', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const body = sessionSchema.parse(req.body);
    const session = await upsertExtensionSession({
      organizationId: req.organizationId!,
      userId: req.userId!,
      ...body,
    });
    await trackAnalytics({
      organizationId: req.organizationId!,
      userId: req.userId,
      eventType: 'EXTENSION_SYNC',
      payload: body.metadata,
    });
    res.json({ session });
  } catch (err) {
    next(err);
  }
});

/** Créer une nouvelle version de template (admin org). */
connectAiRoutes.post('/templates', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const body = z
      .object({
        slug: z.string().min(2),
        name: z.string().min(2),
        strategy: strategySchema,
        systemPrompt: z.string().min(10),
        userPrompt: z.string().min(10),
        scope: z.enum(['org', 'global']).optional(),
      })
      .parse(req.body);

    const result = await createTemplateVersion({
      organizationId: body.scope === 'global' ? undefined : req.organizationId!,
      slug: body.slug,
      name: body.name,
      strategy: body.strategy,
      systemPrompt: body.systemPrompt,
      userPrompt: body.userPrompt,
      createdById: req.userId,
    });

    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

/** Conversations avec historique contextuel. */
connectAiRoutes.get('/conversations', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const conversations = await listConversations(req.organizationId!, req.userId!);
    res.json({ conversations });
  } catch (err) {
    next(err);
  }
});

connectAiRoutes.get('/conversations/:prospectId', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const prospectId = String(req.params.prospectId);
    const conversation = await getConversationForProspect(
      req.organizationId!,
      req.userId!,
      prospectId
    );
    res.json({ conversation });
  } catch (err) {
    next(err);
  }
});

connectAiRoutes.post('/conversations/events', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const body = z
      .object({
        prospectId: z.string(),
        channelSlug: channelSlugSchema,
        eventType: z.enum(['MESSAGE_SENT', 'REPLY_RECEIVED', 'MEETING_BOOKED', 'NOTE', 'PIPELINE_UPDATE']),
        content: z.string().optional(),
        messageId: z.string().optional(),
        objective: objectiveSchema.optional(),
        pipelineStage: z.string().optional(),
      })
      .parse(req.body);

    const channelId = await getChannelId(body.channelSlug);
    const result = await appendConversationEvent({
      organizationId: req.organizationId!,
      userId: req.userId!,
      prospectId: body.prospectId,
      channelId,
      eventType: body.eventType,
      content: body.content,
      messageId: body.messageId,
      objective: body.objective,
      pipelineStage: body.pipelineStage,
    });
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

const knowledgeUpload = multer({
  storage: multer.diskStorage({
    destination: (req, _file, cb) => {
      const orgId = (req as AuthRequest).organizationId || 'unknown';
      const dir = knowledgeUploadDir(orgId);
      fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (_req, file, cb) => {
      const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120);
      cb(null, `${Date.now()}-${safe}`);
    },
  }),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok =
      file.mimetype === 'application/pdf' ||
      file.mimetype.startsWith('text/') ||
      /\.(pdf|txt|md|csv|html?)$/i.test(file.originalname);
    if (!ok) {
      cb(new Error('Format non supporté (PDF, TXT, MD, CSV, HTML)'));
      return;
    }
    cb(null, true);
  },
});

/** Liste des sources de connaissance entreprise. */
connectAiRoutes.get('/knowledge/sources', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const sources = await listKnowledgeSources(req.organizationId!);
    res.json({ sources });
  } catch (err) {
    next(err);
  }
});

/** Ajoute une source texte / FAQ / tarifs. */
connectAiRoutes.post('/knowledge/sources/text', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const body = z
      .object({
        name: z.string().min(2).max(200),
        content: z.string().min(40).max(200_000),
        type: z.enum(['TEXT', 'FAQ', 'PRICING']).optional(),
      })
      .parse(req.body);
    const result = await ingestTextSource({
      organizationId: req.organizationId!,
      userId: req.userId!,
      name: body.name,
      content: body.content,
      type: body.type,
    });
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

/** Indexe une page web publique. */
connectAiRoutes.post('/knowledge/sources/url', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const body = z
      .object({
        url: z.string().url(),
        name: z.string().min(2).max(200).optional(),
      })
      .parse(req.body);
    const result = await ingestUrlSource({
      organizationId: req.organizationId!,
      userId: req.userId!,
      url: body.url,
      name: body.name,
    });
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

/** Upload PDF / texte. */
connectAiRoutes.post(
  '/knowledge/sources/upload',
  knowledgeUpload.single('file'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.file) {
        res.status(400).json({ error: 'Fichier requis' });
        return;
      }
      const name = typeof req.body?.name === 'string' ? req.body.name : undefined;
      const result = await ingestFileSource({
        organizationId: req.organizationId!,
        userId: req.userId!,
        filePath: req.file.path,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        name,
      });
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  }
);

/** Réindexe une source. */
connectAiRoutes.post('/knowledge/sources/:sourceId/reindex', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = await reindexSource(req.organizationId!, String(req.params.sourceId));
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/** Supprime une source + ses chunks. */
connectAiRoutes.delete('/knowledge/sources/:sourceId', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const deleted = await deleteKnowledgeSource(req.organizationId!, String(req.params.sourceId));
    if (!deleted) {
      res.status(404).json({ error: 'Source introuvable' });
      return;
    }
    if (deleted.storageRef) {
      try {
        fs.unlinkSync(deleted.storageRef);
      } catch {
        /* ignore missing file */
      }
    }
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});
