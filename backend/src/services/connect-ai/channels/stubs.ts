import type { ConnectChannelSlug, ProspectProfile } from '../core/types.js';
import type { IChannel } from './IChannel.js';

function notImplemented(slug: ConnectChannelSlug, name: string): IChannel {
  return {
    slug,
    name,
    detect: () => {
      throw new Error(`${name} — canal non implémenté`);
    },
    normalizeProfile: (raw: Record<string, unknown>) => raw as unknown as ProspectProfile,
    displayHints: () => ({}),
  };
}

/** Canaux à venir — architecture prête, implémentation ultérieure. */
export const gmailChannel = notImplemented('GMAIL', 'Gmail');
export const outlookChannel = notImplemented('OUTLOOK', 'Outlook');
export const whatsappChannel = notImplemented('WHATSAPP', 'WhatsApp');
export const facebookChannel = notImplemented('FACEBOOK', 'Facebook');
export const instagramChannel = notImplemented('INSTAGRAM', 'Instagram');
export const twitterChannel = notImplemented('TWITTER', 'Twitter/X');
