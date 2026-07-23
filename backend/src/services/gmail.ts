import { google, gmail_v1 } from 'googleapis';
import { OAuth2Client, Credentials } from 'google-auth-library';
import type { GmailToken } from '@prisma/client';
import jwt from 'jsonwebtoken';
import { randomBytes } from 'crypto';
import { decrypt, encrypt } from '../lib/encryption.js';
import { prisma } from '../db/prisma.js';

/** Lecture + brouillons + labels. Pas d’envoi auto (draft.create uniquement côté Gmail IA). */
export const GMAIL_SCOPES = [
  'openid',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.modify',
];

const SCOPES = GMAIL_SCOPES;

class GmailService {
  private assertOAuthConfigured(): { clientId: string; clientSecret: string; redirectUri: string } {
    const clientId = process.env.GOOGLE_CLIENT_ID?.trim() || '';
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim() || '';
    const redirectUri = process.env.GOOGLE_REDIRECT_URI?.trim() || '';
    if (!clientId || !clientSecret || !redirectUri) {
      throw new Error(
        'Gmail OAuth non configuré : renseigne GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET et GOOGLE_REDIRECT_URI dans .env'
      );
    }
    return { clientId, clientSecret, redirectUri };
  }

  private createOAuthClient(): OAuth2Client {
    const { clientId, clientSecret, redirectUri } = this.assertOAuthConfigured();
    return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
  }

  mintOAuthState(userId: string): string {
    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error('JWT_SECRET manquant');
    return jwt.sign(
      {
        p: 'gmail_connect',
        userId,
        rnd: randomBytes(16).toString('hex'),
      },
      secret,
      { expiresIn: '15m' }
    );
  }

  parseOAuthState(state: unknown): string {
    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error('JWT_SECRET manquant');
    const token = typeof state === 'string' ? state : '';
    if (!token) throw new Error('state_missing');
    const decoded = jwt.verify(token, secret) as { p?: string; userId?: string };
    if (decoded.p !== 'gmail_connect' || !decoded.userId) {
      throw new Error('state_invalid');
    }
    return decoded.userId;
  }

  getAuthUrl(userId: string): string {
    const oauth2 = this.createOAuthClient();
    return oauth2.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: SCOPES,
      state: this.mintOAuthState(userId),
      include_granted_scopes: true,
    });
  }

  async exchangeCode(code: string) {
    const oauth2 = this.createOAuthClient();
    const { tokens } = await oauth2.getToken(code);
    return tokens;
  }

  private async persistRefreshedTokens(
    userId: string,
    tokens: Credentials,
    fallbackRefreshEncrypted: string
  ): Promise<void> {
    if (!tokens.access_token && !tokens.refresh_token) return;

    const existing = await prisma.gmailToken.findUnique({ where: { userId } });
    if (!existing) return;

    const refreshPlain = tokens.refresh_token
      ? tokens.refresh_token
      : decrypt(fallbackRefreshEncrypted);

    await prisma.gmailToken.update({
      where: { userId },
      data: {
        accessToken: encrypt(tokens.access_token || decrypt(existing.accessToken)),
        refreshToken: encrypt(refreshPlain),
        expiresAt: tokens.expiry_date
          ? new Date(tokens.expiry_date)
          : existing.expiresAt,
        scope: tokens.scope || existing.scope,
        lastRefreshAt: new Date(),
      },
    });
  }

  private async getClient(token: GmailToken): Promise<OAuth2Client> {
    const oauth2 = this.createOAuthClient();
    oauth2.setCredentials({
      access_token: decrypt(token.accessToken),
      refresh_token: decrypt(token.refreshToken),
      expiry_date: token.expiresAt.getTime(),
    });

    oauth2.on('tokens', (tokens) => {
      void this.persistRefreshedTokens(token.userId, tokens, token.refreshToken).catch((err) => {
        console.warn('[gmail] persist refresh tokens failed', err);
      });
    });

    return oauth2;
  }

  async getGmailClient(token: GmailToken): Promise<gmail_v1.Gmail> {
    const auth = await this.getClient(token);
    return google.gmail({ version: 'v1', auth });
  }

  async getEmail(token: GmailToken): Promise<string | null> {
    try {
      const auth = await this.getClient(token);
      const oauth2api = google.oauth2({ version: 'v2', auth });
      const { data } = await oauth2api.userinfo.get();
      return data.email || null;
    } catch {
      return null;
    }
  }

  async getProfileHistoryId(token: GmailToken): Promise<string | null> {
    const gmail = await this.getGmailClient(token);
    const { data } = await gmail.users.getProfile({ userId: 'me' });
    return data.historyId ? String(data.historyId) : null;
  }

  async ensureLabel(token: GmailToken, name: string): Promise<string> {
    const gmail = await this.getGmailClient(token);
    const listed = await gmail.users.labels.list({ userId: 'me' });
    const existing = (listed.data.labels || []).find(
      (l) => (l.name || '').toLowerCase() === name.toLowerCase()
    );
    if (existing?.id) return existing.id;

    const created = await gmail.users.labels.create({
      userId: 'me',
      requestBody: {
        name,
        labelListVisibility: 'labelShow',
        messageListVisibility: 'show',
      },
    });
    if (!created.data.id) throw new Error('Impossible de créer le libellé Gmail');
    return created.data.id;
  }

  async listHistoryMessageIds(
    token: GmailToken,
    startHistoryId: string
  ): Promise<{ messageIds: string[]; newHistoryId: string | null }> {
    const gmail = await this.getGmailClient(token);
    const messageIds = new Set<string>();
    let pageToken: string | undefined;
    let newHistoryId: string | null = null;

    do {
      const { data } = await gmail.users.history.list({
        userId: 'me',
        startHistoryId,
        historyTypes: ['messageAdded'],
        pageToken,
      });
      newHistoryId = data.historyId ? String(data.historyId) : newHistoryId;
      for (const h of data.history || []) {
        for (const added of h.messagesAdded || []) {
          if (added.message?.id) messageIds.add(added.message.id);
        }
      }
      pageToken = data.nextPageToken || undefined;
    } while (pageToken);

    return { messageIds: [...messageIds], newHistoryId };
  }

  async getMessage(token: GmailToken, messageId: string): Promise<gmail_v1.Schema$Message> {
    const gmail = await this.getGmailClient(token);
    const { data } = await gmail.users.messages.get({
      userId: 'me',
      id: messageId,
      format: 'full',
    });
    return data;
  }

  async createReplyDraft(
    token: GmailToken,
    opts: {
      threadId: string;
      to: string;
      subject: string;
      body: string;
      inReplyTo?: string;
      references?: string;
      labelIds?: string[];
    }
  ): Promise<string> {
    const gmail = await this.getGmailClient(token);
    const fromEmail = (await this.getEmail(token)) || 'me';
    const lines = [
      `From: ${fromEmail}`,
      `To: ${opts.to}`,
      `Subject: =?UTF-8?B?${Buffer.from(opts.subject).toString('base64')}?=`,
      'MIME-Version: 1.0',
      'Content-Type: text/plain; charset="UTF-8"',
    ];
    if (opts.inReplyTo) lines.push(`In-Reply-To: ${opts.inReplyTo}`);
    if (opts.references) lines.push(`References: ${opts.references}`);

    const raw = Buffer.from(`${lines.join('\r\n')}\r\n\r\n${opts.body}`)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    // Gmail refuse labelIds sur drafts.create ("Cannot set labels on drafts").
    // Le label « Réponse à valider » est appliqué sur le message entrant côté sync.
    const { data } = await gmail.users.drafts.create({
      userId: 'me',
      requestBody: {
        message: {
          raw,
          threadId: opts.threadId,
        },
      },
    });

    return data.id || '';
  }

  async addLabelsToMessage(
    token: GmailToken,
    messageId: string,
    labelIds: string[]
  ): Promise<void> {
    if (!labelIds.length) return;
    const gmail = await this.getGmailClient(token);
    await gmail.users.messages.modify({
      userId: 'me',
      id: messageId,
      requestBody: { addLabelIds: labelIds },
    });
  }

  /**
   * Retire des labels (ex. INBOX pour archiver hors boîte principale).
   * Le brouillon de réponse reste visible sous le libellé « Réponse à valider ».
   */
  async removeLabelsFromMessage(
    token: GmailToken,
    messageId: string,
    labelIds: string[]
  ): Promise<void> {
    if (!labelIds.length) return;
    const gmail = await this.getGmailClient(token);
    await gmail.users.messages.modify({
      userId: 'me',
      id: messageId,
      requestBody: { removeLabelIds: labelIds },
    });
  }

  async sendMail(
    token: GmailToken,
    opts: {
      to: string;
      subject: string;
      text: string;
      html?: string;
      pdfUrl?: string;
      pdfName?: string;
    }
  ) {
    const auth = await this.getClient(token);
    const gmail = google.gmail({ version: 'v1', auth });

    const fromEmail = (await this.getEmail(token)) || 'me';

    const boundary = `boundary_${Date.now()}`;
    const lines: string[] = [
      `From: ${fromEmail}`,
      `To: ${opts.to}`,
      `Subject: =?UTF-8?B?${Buffer.from(opts.subject).toString('base64')}?=`,
      'MIME-Version: 1.0',
    ];

    let bodyMime: string;
    if (opts.pdfUrl) {
      const pdfRes = await fetch(opts.pdfUrl);
      const pdfBuffer = Buffer.from(await pdfRes.arrayBuffer());
      const pdfBase64 = pdfBuffer.toString('base64');

      lines.push(`Content-Type: multipart/mixed; boundary="${boundary}"`);
      bodyMime = [
        '',
        `--${boundary}`,
        'Content-Type: text/plain; charset="UTF-8"',
        'Content-Transfer-Encoding: 7bit',
        '',
        opts.text,
        '',
        `--${boundary}`,
        'Content-Type: application/pdf',
        'Content-Transfer-Encoding: base64',
        `Content-Disposition: attachment; filename="${opts.pdfName || 'document.pdf'}"`,
        '',
        pdfBase64,
        `--${boundary}--`,
      ].join('\r\n');
    } else {
      lines.push('Content-Type: text/plain; charset="UTF-8"');
      bodyMime = `\r\n${opts.text}`;
    }

    const raw = Buffer.from(lines.join('\r\n') + bodyMime)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    const { data } = await gmail.users.messages.send({
      userId: 'me',
      requestBody: { raw },
    });

    return { messageId: data.id || '', from: fromEmail };
  }
}

export const gmailService = new GmailService();
