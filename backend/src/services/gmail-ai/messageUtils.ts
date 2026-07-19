import type { gmail_v1 } from 'googleapis';

export const REVIEW_LABEL_NAME = 'Réponse à valider';

export function getHeader(
  message: gmail_v1.Schema$Message,
  name: string
): string | undefined {
  const headers = message.payload?.headers || [];
  const found = headers.find((h) => (h.name || '').toLowerCase() === name.toLowerCase());
  return found?.value || undefined;
}

function decodeBodyData(data?: string | null): string {
  if (!data) return '';
  const normalized = data.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(normalized, 'base64').toString('utf8');
}

function collectParts(part?: gmail_v1.Schema$MessagePart | null): string {
  if (!part) return '';
  if (part.mimeType === 'text/plain' && part.body?.data) {
    return decodeBodyData(part.body.data);
  }
  if (part.parts?.length) {
    for (const child of part.parts) {
      const text = collectParts(child);
      if (text.trim()) return text;
    }
  }
  if (part.mimeType === 'text/html' && part.body?.data) {
    return decodeBodyData(part.body.data)
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
  return '';
}

export function extractPlainText(message: gmail_v1.Schema$Message): string {
  const fromParts = collectParts(message.payload);
  if (fromParts.trim()) return fromParts.trim().slice(0, 12_000);
  return (message.snippet || '').trim();
}

export function extractEmailAddress(fromHeader?: string): string {
  if (!fromHeader) return '';
  const match = fromHeader.match(/<([^>]+)>/);
  return (match?.[1] || fromHeader).trim().toLowerCase();
}

export function isInboundMessage(
  message: gmail_v1.Schema$Message,
  myEmail: string | null
): boolean {
  const labels = new Set(message.labelIds || []);
  if (labels.has('SENT') || labels.has('DRAFT') || labels.has('TRASH') || labels.has('SPAM')) {
    return false;
  }
  const from = extractEmailAddress(getHeader(message, 'From'));
  if (myEmail && from && from === myEmail.toLowerCase()) return false;
  return labels.has('INBOX') || labels.has('UNREAD') || !!from;
}

/** Ignore CATEGORY_* Gmail system labels selon préférences utilisateur. */
export function shouldSkipByCategory(
  message: gmail_v1.Schema$Message,
  opts: { ignoreNewsletters: boolean; ignorePromotions: boolean; ignoreSocial: boolean }
): boolean {
  const labels = new Set(message.labelIds || []);
  if (opts.ignorePromotions && labels.has('CATEGORY_PROMOTIONS')) return true;
  if (opts.ignoreSocial && labels.has('CATEGORY_SOCIAL')) return true;
  if (opts.ignoreNewsletters && labels.has('CATEGORY_UPDATES') && !labels.has('IMPORTANT')) {
    return true;
  }
  return false;
}

export function replySubject(originalSubject?: string): string {
  const subject = (originalSubject || '').trim() || '(sans objet)';
  return /^re:/i.test(subject) ? subject : `Re: ${subject}`;
}
