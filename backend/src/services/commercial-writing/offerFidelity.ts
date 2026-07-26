/** Garde-fous locaux offre / identité (sans LLM). */

export type OfferSenderSlice = {
  organizationName: string;
  organizationSector?: string | null;
  organizationBrief?: string | null;
  productsServices?: string[];
  commercialPriorities?: string | null;
};

const GENERIC_TOKENS = new Set([
  'comptable',
  'cabinet',
  'entreprise',
  'societe',
  'bureau',
  'sarl',
  'sa',
  'sas',
  'ltd',
  'llc',
  'the',
  'and',
  'et',
  'de',
  'du',
  'des',
  'la',
  'le',
  'les',
]);

const HALLUCINATED_OFFER_PATTERNS: Array<{ re: RegExp; label: string }> = [
  {
    re: /solutions?\s+événement|événementiel(?:les)?|organis(?:ation|ons|er)\s+(?:des\s+)?événements?|team[\s-]?building|salon\s+(?:pro|professionnel)/i,
    label: 'events',
  },
  {
    re: /agence\s+(?:de\s+)?communication|branding\s+stratégique|campagne\s+publicitaire\s+360/i,
    label: 'agency_comms',
  },
  {
    re: /construction\s+de\s+bâtiments|génie\s+civil|maître\s+d['']œuvre/i,
    label: 'construction',
  },
  {
    re: /développement\s+(?:complet\s+)?(?:et\s+)?mise\s+en\s+place\s+de\s+la\s+solution\s+saas|développement\s+sur[\s-]?mesure|prestation\s+de\s+développement\s+logiciel|création\s+d['']une\s+plateforme\s+saas\s+complète/i,
    label: 'custom_saas_dev',
  },
];

function significantNameTokens(name: string): string[] {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 4 && !GENERIC_TOKENS.has(t));
}

function normalizeOfferText(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export function ourOfferTokens(sender: OfferSenderSlice): string[] {
  const blob = [
    ...(sender.productsServices || []),
    sender.organizationBrief || '',
    sender.organizationSector || '',
    sender.commercialPriorities || '',
  ].join(' ');
  return significantNameTokens(blob).filter((t) => t.length >= 5).slice(0, 24);
}

export function validateGeneratedMessage(
  message: string,
  prospectName: string,
  organizationName: string
): { ok: boolean; reason?: string } {
  const text = message.trim();
  if (!text) return { ok: false, reason: 'empty' };

  const prospectLower = prospectName.trim().toLowerCase();
  const orgLower = organizationName.trim().toLowerCase();
  if (!prospectLower) return { ok: true };

  const tokens = significantNameTokens(prospectName);
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const lastLine = (lines[lines.length - 1] || '').toLowerCase();
  const closingBlock = lines.slice(-3).join('\n').toLowerCase();

  if (lastLine.includes(prospectLower) || closingBlock.includes(prospectLower)) {
    return { ok: false, reason: 'signed_as_prospect' };
  }
  for (const token of tokens) {
    if (lastLine === token || lastLine.startsWith(token + ' ') || lastLine.endsWith(' ' + token)) {
      return { ok: false, reason: 'signed_as_prospect_token' };
    }
  }

  const identitySteal = /(je\s+suis|je\s+m['']appelle|mon\s+nom\s+est)\s+([^\n.,!]{2,60})/gi;
  let m: RegExpExecArray | null;
  while ((m = identitySteal.exec(text)) !== null) {
    const claimed = (m[2] || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (claimed.includes(prospectLower) || tokens.some((t) => claimed.includes(t))) {
      return { ok: false, reason: 'presents_as_prospect' };
    }
  }

  if (
    orgLower &&
    !text.toLowerCase().includes(orgLower) &&
    /je\s+suis\s+/i.test(text) &&
    tokens.some((t) => lastLine.includes(t))
  ) {
    return { ok: false, reason: 'likely_wrong_identity' };
  }

  return { ok: true };
}

export function validateOfferFidelity(
  message: string,
  sender: OfferSenderSlice
): { ok: boolean; reason?: string } {
  const offerBlob = normalizeOfferText(
    [
      ...(sender.productsServices || []),
      sender.organizationBrief || '',
      sender.organizationSector || '',
      sender.commercialPriorities || '',
    ].join(' ')
  );
  if (!offerBlob.trim()) {
    for (const h of HALLUCINATED_OFFER_PATTERNS) {
      if (h.re.test(message)) return { ok: false, reason: `hallucinated_${h.label}` };
    }
    return { ok: true };
  }

  for (const h of HALLUCINATED_OFFER_PATTERNS) {
    if (h.re.test(message) && !h.re.test(offerBlob)) {
      return { ok: false, reason: `hallucinated_${h.label}` };
    }
  }

  const tokens = ourOfferTokens(sender);
  if (tokens.length >= 2) {
    const msg = normalizeOfferText(message);
    const hit = tokens.some((t) => msg.includes(t));
    if (!hit) return { ok: false, reason: 'missing_real_offer' };
  }

  return { ok: true };
}
