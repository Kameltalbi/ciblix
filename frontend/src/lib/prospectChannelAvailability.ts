/** Disponibilité des canaux de contact pour un prospect Hunt. */

export type ProspectChannelFields = {
  email?: string | null;
  phone?: string | null;
  linkedin?: string | null;
  /** Alias éventuel (non présent en schéma actuel) */
  linkedinUrl?: string | null;
  whatsappNumber?: string | null;
  detectedEmails?: unknown;
};

export type ChannelAvailability = {
  canCall: boolean;
  canEmail: boolean;
  canLinkedIn: boolean;
  canWhatsApp: boolean;
  hasAnyChannel: boolean;
};

function hasText(value?: string | null): boolean {
  return Boolean(value && String(value).trim());
}

function parseDetectedEmails(raw: unknown): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map(String).filter((e) => e.trim());
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.map(String).filter((e) => e.trim());
    } catch {
      return raw.split(/[,;\s]+/).filter(Boolean);
    }
  }
  return [];
}

export function getProspectEmails(prospect: ProspectChannelFields): string[] {
  const list = [prospect.email, ...parseDetectedEmails(prospect.detectedEmails)]
    .map((e) => (e || '').trim())
    .filter(Boolean);
  return [...new Set(list)];
}

export function getChannelAvailability(prospect: ProspectChannelFields): ChannelAvailability {
  const canEmail = getProspectEmails(prospect).length > 0;
  const canCall = hasText(prospect.phone);
  const canLinkedIn = hasText(prospect.linkedin) || hasText(prospect.linkedinUrl);
  const canWhatsApp = hasText(prospect.whatsappNumber) || hasText(prospect.phone);

  return {
    canCall,
    canEmail,
    canLinkedIn,
    canWhatsApp,
    hasAnyChannel: canCall || canEmail || canLinkedIn || canWhatsApp,
  };
}

export const CHANNEL_UNAVAILABLE_HINTS = {
  call: 'Aucun numéro de téléphone détecté pour ce prospect',
  email: 'Aucune adresse email détectée pour ce prospect',
  linkedin: 'Aucun profil LinkedIn détecté pour ce prospect',
  whatsapp: 'Aucun numéro WhatsApp / téléphone détecté pour ce prospect',
  none: 'Aucune coordonnée de contact identifiée pour ce prospect. Recherche manuelle recommandée avant prise de contact.',
} as const;
