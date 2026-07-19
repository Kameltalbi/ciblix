import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';
import auth, { AuthRequest } from '../middleware/auth.js';
import { gmailService } from '../services/gmail.js';
import { encrypt } from '../lib/encryption.js';

export const gmailRoutes = Router();

// ─── OAuth2 : initier la connexion ─────────────────────────────
gmailRoutes.get('/auth', auth, (req: AuthRequest, res) => {
  try {
    const url = gmailService.getAuthUrl(req.userId!);
    res.json({ url });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Gmail OAuth non configuré';
    res.status(500).json({ error: message, code: 'GMAIL_OAUTH_NOT_CONFIGURED' });
  }
});

// ─── OAuth2 : callback (redirect navigateur — pas de Bearer) ───
gmailRoutes.get('/callback', async (req, res) => {
  const frontend = (process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/$/, '');
  try {
    const { code, state } = req.query;
    if (!code || !state) {
      return res.redirect(`${frontend}/settings?gmail=error&reason=missing_params`);
    }

    let userId: string;
    try {
      userId = gmailService.parseOAuthState(state);
    } catch {
      return res.redirect(`${frontend}/settings?gmail=error&reason=invalid_state`);
    }

    const tokens = await gmailService.exchangeCode(String(code));

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { organizationId: true },
    });

    if (!user) {
      return res.redirect(`${frontend}/settings?gmail=error&reason=user_not_found`);
    }

    const existing = await prisma.gmailToken.findUnique({ where: { userId } });
    const refreshTokenPlain = tokens.refresh_token
      || (existing ? undefined : null);

    if (!refreshTokenPlain && !existing) {
      return res.redirect(`${frontend}/settings?gmail=error&reason=no_refresh_token`);
    }

    await prisma.gmailToken.upsert({
      where: { userId },
      update: {
        organizationId: user.organizationId,
        accessToken: encrypt(tokens.access_token!),
        ...(tokens.refresh_token
          ? { refreshToken: encrypt(tokens.refresh_token) }
          : {}),
        expiresAt: new Date(tokens.expiry_date || Date.now() + 3600_000),
        scope: tokens.scope || existing?.scope || '',
      },
      create: {
        organizationId: user.organizationId,
        userId,
        accessToken: encrypt(tokens.access_token!),
        refreshToken: encrypt(tokens.refresh_token!),
        expiresAt: new Date(tokens.expiry_date || Date.now() + 3600_000),
        scope: tokens.scope || '',
      },
    });

    res.redirect(`${frontend}/agents/gmail-ai?gmail=connected`);
  } catch (e) {
    console.error('[gmail/callback]', e);
    res.redirect(`${frontend}/settings?gmail=error`);
  }
});

// ─── Statut connexion Gmail ────────────────────────────────────
gmailRoutes.get('/status', auth, async (req: AuthRequest, res, next) => {
  try {
    const token = await prisma.gmailToken.findUnique({
      where: { userId: req.userId! },
    });
    res.json({
      connected: !!token,
      email: token ? await gmailService.getEmail(token) : null,
      scope: token?.scope || null,
    });
  } catch (e) {
    next(e);
  }
});

// ─── Envoyer un email (avec PJ optionnelle) ────────────────────
gmailRoutes.post('/send', auth, async (req: AuthRequest, res, next) => {
  try {
    const schema = z.object({
      affaireId: z.string().optional(),
      to: z.string().email(),
      subject: z.string().min(1),
      body: z.string().min(1),
      htmlBody: z.string().optional(),
      attachPdfUrl: z.string().url().optional(),
      attachName: z.string().optional(),
    });
    const data = schema.parse(req.body);

    const token = await prisma.gmailToken.findUnique({
      where: { userId: req.userId! },
    });
    if (!token) return res.status(400).json({ error: 'Gmail non connecté' });

    if (data.affaireId) {
      const affaire = await prisma.affaire.findFirst({
        where: { id: data.affaireId, organizationId: req.organizationId, deletedAt: null },
        select: { id: true },
      });
      if (!affaire) return res.status(404).json({ error: 'Affaire introuvable' });
    }

    const sent = await gmailService.sendMail(token, {
      to: data.to,
      subject: data.subject,
      text: data.body,
      html: data.htmlBody,
      pdfUrl: data.attachPdfUrl,
      pdfName: data.attachName,
    });

    const emailLog = await prisma.email.create({
      data: {
        organizationId: req.organizationId!,
        affaireId: data.affaireId || null,
        messageId: sent.messageId,
        fromEmail: sent.from,
        toEmail: data.to,
        subject: data.subject,
        body: data.body,
        sent: true,
        sentAt: new Date(),
      },
    });

    if (data.affaireId) {
      await prisma.activite.create({
        data: {
          organizationId: req.organizationId!,
          affaireId: data.affaireId,
          type: 'EMAIL_ENVOYE',
          title: `Email envoyé à ${data.to}`,
          content: data.subject,
        },
      });
    }
    res.json(emailLog);
  } catch (e) {
    next(e);
  }
});
