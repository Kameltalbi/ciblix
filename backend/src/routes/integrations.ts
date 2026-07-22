import { Router, type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';
import { AgentEventType } from '@prisma/client';
import { prisma } from '../db/prisma.js';
import auth, { AuthRequest } from '../middleware/auth.js';
import { verifyMetaWebhookSignature } from '../services/integrations/webhookCrypto.js';
import {
  appendWhatsAppMessage,
  closeWhatsAppSession,
  recordWhatsAppConsent,
} from '../services/integrations/whatsappSessionService.js';
import { processTelephonyCallEnded, processZoomRecording } from '../services/integrations/telephonyIntegrationService.js';
import { randomBytes } from 'node:crypto';

export const integrationsRoutes = Router();
export const integrationsWebhookRoutes = Router();

type RawBodyRequest = Request & { rawBody?: Buffer };

function requireOwner(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.user || (req.user.role !== 'OWNER' && req.user.role !== 'SUPERADMIN')) {
    return res.status(403).json({ error: "Réservé au propriétaire de l'organisation" });
  }
  next();
}

integrationsRoutes.use(auth);
integrationsRoutes.use(requireOwner);

const whatsappConfigSchema = z.object({
  whatsappBusinessAccountId: z.string().max(200).optional().nullable(),
  whatsappPhoneNumberId: z.string().max(200).optional().nullable(),
  whatsappWebhookToken: z.string().max(200).optional().nullable(),
  whatsappSessionTimeoutMinutes: z.number().int().min(5).max(240).optional(),
});

const outboundWebhookSchema = z.object({
  targetUrl: z.string().url(),
  secret: z.string().min(8).max(500).optional(),
  enabled: z.boolean(),
  eventTypes: z.array(z.nativeEnum(AgentEventType)).optional(),
});

const telephonyConfigSchema = z.object({
  telephonyWebhookSecret: z.string().min(8).max(200).optional().nullable(),
  telephonyRecordingConsentMode: z.enum(['DISABLED', 'CLIENT_RESPONSIBLE']),
  confirmClientResponsible: z.boolean().optional(),
});

const zoomConfigSchema = z.object({
  zoomOAuthToken: z.string().min(10).max(4000).optional().nullable(),
});

integrationsRoutes.get('/config', async (req: AuthRequest, res, next) => {
  try {
    const org = await prisma.organization.findUnique({
      where: { id: req.organizationId! },
      select: {
        whatsappBusinessAccountId: true,
        whatsappPhoneNumberId: true,
        whatsappWebhookToken: true,
        whatsappSessionTimeoutMinutes: true,
        zoomOAuthToken: true,
        telephonyWebhookSecret: true,
        telephonyRecordingConsentMode: true,
        telephonyConsentConfirmedAt: true,
        outboundWebhookConfig: {
          select: {
            targetUrl: true,
            enabled: true,
            eventTypes: true,
            secret: true,
          },
        },
      },
    });
    if (!org) return res.status(404).json({ error: 'Organisation introuvable' });

    res.json({
      whatsapp: {
        businessAccountId: org.whatsappBusinessAccountId,
        phoneNumberId: org.whatsappPhoneNumberId,
        webhookTokenSet: Boolean(org.whatsappWebhookToken),
        sessionTimeoutMinutes: org.whatsappSessionTimeoutMinutes,
        webhookUrl: `${process.env.BACKEND_PUBLIC_URL || process.env.FRONTEND_URL || ''}/api/integrations/whatsapp/webhook/${req.organizationId}`,
      },
      telephony: {
        webhookSecretSet: Boolean(org.telephonyWebhookSecret),
        consentMode: org.telephonyRecordingConsentMode,
        consentConfirmedAt: org.telephonyConsentConfirmedAt,
        webhookUrl: `${process.env.BACKEND_PUBLIC_URL || process.env.FRONTEND_URL || ''}/api/integrations/telephony/webhook/${req.organizationId}`,
      },
      zoom: {
        configured: Boolean(org.zoomOAuthToken),
        webhookUrl: `${process.env.BACKEND_PUBLIC_URL || process.env.FRONTEND_URL || ''}/api/integrations/zoom/webhook/${req.organizationId}`,
      },
      outboundWebhook: org.outboundWebhookConfig
        ? {
            targetUrl: org.outboundWebhookConfig.targetUrl,
            enabled: org.outboundWebhookConfig.enabled,
            eventTypes: org.outboundWebhookConfig.eventTypes,
            secretSet: Boolean(org.outboundWebhookConfig.secret),
          }
        : null,
    });
  } catch (e) {
    next(e);
  }
});

integrationsRoutes.put('/config/whatsapp', async (req: AuthRequest, res, next) => {
  try {
    const body = whatsappConfigSchema.parse(req.body);
    const token =
      body.whatsappWebhookToken === null
        ? null
        : body.whatsappWebhookToken?.trim() ||
          randomBytes(24).toString('hex');

    const org = await prisma.organization.update({
      where: { id: req.organizationId! },
      data: {
        whatsappBusinessAccountId: body.whatsappBusinessAccountId?.trim() || null,
        whatsappPhoneNumberId: body.whatsappPhoneNumberId?.trim() || null,
        whatsappWebhookToken: token,
        ...(body.whatsappSessionTimeoutMinutes
          ? { whatsappSessionTimeoutMinutes: body.whatsappSessionTimeoutMinutes }
          : {}),
      },
      select: {
        whatsappBusinessAccountId: true,
        whatsappPhoneNumberId: true,
        whatsappWebhookToken: true,
        whatsappSessionTimeoutMinutes: true,
      },
    });

    res.json({
      businessAccountId: org.whatsappBusinessAccountId,
      phoneNumberId: org.whatsappPhoneNumberId,
      webhookToken: org.whatsappWebhookToken,
      sessionTimeoutMinutes: org.whatsappSessionTimeoutMinutes,
    });
  } catch (e) {
    next(e);
  }
});

integrationsRoutes.put('/config/outbound-webhook', async (req: AuthRequest, res, next) => {
  try {
    const body = outboundWebhookSchema.parse(req.body);
    const existing = await prisma.outboundWebhookConfig.findUnique({
      where: { organizationId: req.organizationId! },
    });
    const secret = body.secret?.trim() || existing?.secret;
    if (!secret) {
      return res.status(400).json({ error: 'Secret webhook requis' });
    }

    const config = await prisma.outboundWebhookConfig.upsert({
      where: { organizationId: req.organizationId! },
      create: {
        organizationId: req.organizationId!,
        targetUrl: body.targetUrl,
        secret,
        enabled: body.enabled,
        eventTypes: body.eventTypes ?? [],
      },
      update: {
        targetUrl: body.targetUrl,
        secret,
        enabled: body.enabled,
        eventTypes: body.eventTypes ?? [],
      },
    });
    res.json({
      targetUrl: config.targetUrl,
      enabled: config.enabled,
      eventTypes: config.eventTypes,
    });
  } catch (e) {
    next(e);
  }
});

integrationsRoutes.put('/config/telephony', async (req: AuthRequest, res, next) => {
  try {
    const body = telephonyConfigSchema.parse(req.body);

    if (body.telephonyRecordingConsentMode === 'CLIENT_RESPONSIBLE' && !body.confirmClientResponsible) {
      return res.status(400).json({
        error: 'Confirmation requise : le client atteste gérer le consentement d’enregistrement.',
      });
    }

    const org = await prisma.organization.update({
      where: { id: req.organizationId! },
      data: {
        telephonyWebhookSecret: body.telephonyWebhookSecret?.trim() || null,
        telephonyRecordingConsentMode: body.telephonyRecordingConsentMode,
        telephonyConsentConfirmedAt:
          body.telephonyRecordingConsentMode === 'CLIENT_RESPONSIBLE' ? new Date() : null,
        telephonyConsentConfirmedBy:
          body.telephonyRecordingConsentMode === 'CLIENT_RESPONSIBLE' ? req.userId! : null,
      },
      select: {
        telephonyWebhookSecret: true,
        telephonyRecordingConsentMode: true,
        telephonyConsentConfirmedAt: true,
      },
    });

    res.json({
      webhookSecretSet: Boolean(org.telephonyWebhookSecret),
      consentMode: org.telephonyRecordingConsentMode,
      consentConfirmedAt: org.telephonyConsentConfirmedAt,
    });
  } catch (e) {
    next(e);
  }
});

integrationsRoutes.put('/config/zoom', async (req: AuthRequest, res, next) => {
  try {
    const body = zoomConfigSchema.parse(req.body);
    await prisma.organization.update({
      where: { id: req.organizationId! },
      data: { zoomOAuthToken: body.zoomOAuthToken?.trim() || null },
    });
    res.json({ configured: Boolean(body.zoomOAuthToken?.trim()) });
  } catch (e) {
    next(e);
  }
});

integrationsRoutes.post('/whatsapp/consent/:contactId', async (req: AuthRequest, res, next) => {
  try {
    const contact = await recordWhatsAppConsent(String(req.params.contactId), req.organizationId!);
    res.json({ contactId: contact.id, whatsappConsentAt: contact.whatsappConsentAt });
  } catch (e) {
    next(e);
  }
});

// ─── Webhooks publics (signature requise) ─────────────────

integrationsWebhookRoutes.get('/whatsapp/webhook/:orgId', async (req, res) => {
  const org = await prisma.organization.findUnique({
    where: { id: String(req.params.orgId) },
    select: { whatsappWebhookToken: true },
  });
  if (!org?.whatsappWebhookToken) return res.status(404).send('not_configured');

  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === org.whatsappWebhookToken && challenge) {
    return res.status(200).send(String(challenge));
  }
  return res.status(403).send('forbidden');
});

integrationsWebhookRoutes.post('/whatsapp/webhook/:orgId', async (req: RawBodyRequest, res) => {
  try {
    const orgId = String(req.params.orgId);
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: {
        whatsappPhoneNumberId: true,
        whatsappWebhookToken: true,
      },
    });
    if (!org?.whatsappPhoneNumberId) return res.status(404).json({ error: 'not_configured' });

    const appSecret = process.env.WHATSAPP_APP_SECRET || org.whatsappWebhookToken || '';
    const rawBody = req.rawBody || Buffer.from(JSON.stringify(req.body));
    const signature = req.headers['x-hub-signature-256'] as string | undefined;
    if (!appSecret || !verifyMetaWebhookSignature(appSecret, rawBody, signature || '')) {
      return res.status(401).json({ error: 'invalid_signature' });
    }

    const payload = req.body as {
      entry?: Array<{
        changes?: Array<{
          value?: {
            metadata?: { phone_number_id?: string };
            messages?: Array<{
              from?: string;
              type?: string;
              text?: { body?: string };
            }>;
          };
        }>;
      }>;
    };

    for (const entry of payload.entry || []) {
      for (const change of entry.changes || []) {
        const phoneNumberId = change.value?.metadata?.phone_number_id;
        if (phoneNumberId && phoneNumberId !== org.whatsappPhoneNumberId) continue;

        for (const msg of change.value?.messages || []) {
          if (msg.type !== 'text' || !msg.from || !msg.text?.body) continue;
          const { shouldClose } = await appendWhatsAppMessage({
            organizationId: orgId,
            whatsappId: msg.from,
            text: msg.text.body,
            direction: 'IN',
          });
          if (shouldClose) {
            void closeWhatsAppSession(orgId, msg.from).catch((err) => {
              console.warn('[whatsapp] auto-close failed', orgId, msg.from, err);
            });
          }
        }
      }
    }

    res.json({ ok: true });
  } catch (err) {
    console.warn('[whatsapp] webhook error', err);
    res.status(500).json({ error: 'processing_failed' });
  }
});

integrationsWebhookRoutes.post('/telephony/webhook/:orgId', async (req, res) => {
  try {
    const orgId = String(req.params.orgId);
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { telephonyWebhookSecret: true, telephonyRecordingConsentMode: true },
    });
    if (!org?.telephonyWebhookSecret) return res.status(404).json({ error: 'not_configured' });

    const secretHeader = req.headers['x-ciblix-telephony-secret'];
    if (secretHeader !== org.telephonyWebhookSecret) {
      return res.status(401).json({ error: 'invalid_secret' });
    }

    const bodySchema = z.object({
      callId: z.string().min(1),
      recordingUrl: z.string().url(),
      callerPhone: z.string().optional().nullable(),
      calleePhone: z.string().optional().nullable(),
      mimeType: z.string().optional(),
    });
    const body = bodySchema.parse(req.body);

    const result = await processTelephonyCallEnded({
      organizationId: orgId,
      callId: body.callId,
      recordingUrl: body.recordingUrl,
      callerPhone: body.callerPhone,
      calleePhone: body.calleePhone,
      mimeType: body.mimeType,
    });

    res.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'processing_failed';
    if (message === 'TELEPHONY_DISABLED') {
      return res.status(403).json({ error: message });
    }
    console.warn('[telephony] webhook error', err);
    res.status(500).json({ error: message });
  }
});

integrationsWebhookRoutes.post('/zoom/webhook/:orgId', async (req, res) => {
  try {
    const orgId = String(req.params.orgId);
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { telephonyRecordingConsentMode: true, zoomOAuthToken: true },
    });
    if (!org?.zoomOAuthToken) return res.status(404).json({ error: 'not_configured' });

    const zoomSecret = process.env.ZOOM_WEBHOOK_SECRET;
    if (zoomSecret) {
      const headerToken = req.headers['authorization'];
      if (headerToken !== zoomSecret) {
        return res.status(401).json({ error: 'invalid_secret' });
      }
    }

    const bodySchema = z.object({
      event: z.string().optional(),
      payload: z
        .object({
          object: z
            .object({
              uuid: z.string().optional(),
              id: z.union([z.string(), z.number()]).optional(),
              recording_files: z
                .array(
                  z.object({
                    download_url: z.string().url(),
                    file_type: z.string().optional(),
                  })
                )
                .optional(),
              participant: z
                .array(z.object({ user_email: z.string().email().optional() }))
                .optional(),
            })
            .optional(),
        })
        .optional(),
    });
    const body = bodySchema.parse(req.body);

    if (body.event === 'endpoint.url_validation' && req.body?.payload?.plainToken) {
      return res.json({
        plainToken: req.body.payload.plainToken,
        encryptedToken: req.body.payload.plainToken,
      });
    }

    const recording = body.payload?.object;
    const file = recording?.recording_files?.[0];
    if (!file?.download_url) return res.json({ ok: true, skipped: true });

    const recordingId = String(recording?.uuid || recording?.id || Date.now());
    const emails =
      recording?.participant?.map((p) => p.user_email).filter(Boolean) as string[] | undefined;

    const result = await processZoomRecording({
      organizationId: orgId,
      recordingId,
      downloadUrl: file.download_url,
      participantEmails: emails,
      mimeType: file.file_type === 'M4A' ? 'audio/mp4' : 'audio/mpeg',
    });

    res.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'processing_failed';
    if (message === 'TELEPHONY_DISABLED') {
      return res.status(403).json({ error: message });
    }
    console.warn('[zoom] webhook error', err);
    res.status(500).json({ error: message });
  }
});
