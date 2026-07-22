/** Disponibilité des canaux de contact pour un prospect Hunt (backend). */

export type ProspectChannelFields = {
  email?: string | null;
  phone?: string | null;
  linkedin?: string | null;
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
      const parsed = JSON.parse(raw) as unknown;
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
  const canLinkedIn = hasText(prospect.linkedin);
  const canWhatsApp = hasText(prospect.phone);

  return {
    canCall,
    canEmail,
    canLinkedIn,
    canWhatsApp,
    hasAnyChannel: canCall || canEmail || canLinkedIn || canWhatsApp,
  };
}

/** Map messageType API → canal à vérifier. */
export function assertChannelAvailableForMessageType(
  prospect: ProspectChannelFields,
  messageType: string
): { ok: true } | { ok: false; error: string } {
  const a = getChannelAvailability(prospect);
  if (messageType === 'LINKEDIN') {
    if (!a.canLinkedIn) return { ok: false, error: 'Aucun profil LinkedIn disponible pour ce prospect' };
    return { ok: true };
  }
  if (messageType === 'WHATSAPP') {
    if (!a.canWhatsApp) return { ok: false, error: 'Aucun numéro WhatsApp disponible pour ce prospect' };
    return { ok: true };
  }
  // FIRST_CONTACT | FOLLOW_UP | VALUE_PROPOSITION → email
  if (!a.canEmail) return { ok: false, error: 'Aucune adresse email disponible pour ce prospect' };
  return { ok: true };
}
