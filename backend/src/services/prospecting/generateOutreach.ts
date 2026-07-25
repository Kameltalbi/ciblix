import type { CompanySearchHit, OutreachMessageType } from './types.js';

export type OutreachTone = 'doux' | 'commercial' | 'ferme';

export type OutreachSenderContext = {
  organizationName: string;
  /** Secteur / activité réelle (Mission). */
  organizationSector?: string | null;
  /** Description libre entreprise (companyBrief / activity). */
  organizationBrief?: string | null;
  /** Produits & services réels — ne jamais inventer hors de cette liste. */
  productsServices?: string[];
  /** Priorités commerciales Mission (optionnel). */
  commercialPriorities?: string | null;
  senderName?: string | null;
};

export type OutreachProspectContext = CompanySearchHit & {
  probableBusinessProblem?: string | null;
  commercialAngle?: string | null;
  suggestedPitch?: string | null;
  aiSummary?: string | null;
};

function channelLabel(type: OutreachMessageType): string {
  const map: Record<OutreachMessageType, string> = {
    FIRST_CONTACT: 'email (premier contact)',
    FOLLOW_UP: 'email (relance)',
    VALUE_PROPOSITION: 'email (proposition de valeur)',
    LINKEDIN: 'message LinkedIn court',
    WHATSAPP: 'message WhatsApp court et naturel',
  };
  return map[type];
}

function signerName(sender: OutreachSenderContext): string {
  return (sender.senderName || sender.organizationName || 'Notre équipe').trim();
}

function offerSummary(sender: OutreachSenderContext): string {
  const products = (sender.productsServices || []).map((p) => p.trim()).filter(Boolean);
  if (products.length) return products.slice(0, 8).join(', ');
  const brief = sender.organizationBrief?.trim();
  if (brief) return brief.slice(0, 280);
  const sector = sender.organizationSector?.trim();
  if (sector) return sector;
  return '';
}

const GENERIC_PROSPECT_TOKENS = new Set([
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

/** Verticales souvent inventées à tort — à rejeter si absentes de notre offre. */
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
];

function significantNameTokens(name: string): string[] {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 4 && !GENERIC_PROSPECT_TOKENS.has(t));
}

function normalizeOfferText(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/** Tokens significatifs de notre offre réelle (produits + brief). */
export function ourOfferTokens(sender: OutreachSenderContext): string[] {
  const blob = [
    ...(sender.productsServices || []),
    sender.organizationBrief || '',
    sender.organizationSector || '',
    sender.commercialPriorities || '',
  ].join(' ');
  return significantNameTokens(blob).filter((t) => t.length >= 5).slice(0, 24);
}

/**
 * Garde-fou : détecte une signature / présentation qui usurpe le nom du prospect.
 */
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

/**
 * Rejette les messages qui inventent une offre absente de la Mission / produits.
 */
export function validateOfferFidelity(
  message: string,
  sender: OutreachSenderContext
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
    // Sans Mission : on refuse les verticales événementielles génériques inventées
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

function templateMessage(
  hit: OutreachProspectContext,
  type: OutreachMessageType,
  tone: OutreachTone,
  sender: OutreachSenderContext
): string {
  const prospect = hit.companyName;
  const sector = hit.industry || 'votre secteur';
  const org = sender.organizationName;
  const sign = signerName(sender);
  const offer = offerSummary(sender) || 'nos solutions digitales pour PME';

  const opening =
    tone === 'doux'
      ? `Bonjour,\n\nJe me permets de vous écrire de la part de ${org}, après avoir découvert ${prospect}.`
      : tone === 'ferme'
        ? `Bonjour,\n\nJe vous contacte de la part de ${org} au sujet de ${prospect}, avec une proposition très cadrée.`
        : `Bonjour,\n\nJe vous contacte de la part de ${org} : votre positionnement sur ${sector} m’a paru pertinent au regard de ce que nous proposons.`;

  const offerLine = `\n\nChez ${org}, nous proposons : ${offer}.`;

  const body =
    type === 'FIRST_CONTACT'
      ? `${opening}${offerLine}\n\nSeriez-vous ouvert à un échange de 15 minutes pour voir si cela peut vous être utile ?`
      : type === 'FOLLOW_UP'
        ? `${opening}\n\nJe souhaitais simplement remonter mon message au sujet de ${offer}. Avez-vous un créneau court ?`
        : type === 'VALUE_PROPOSITION'
          ? `${opening}${offerLine}\n\nUn cas concret auprès de PME du ${sector} pourrait vous parler — intéressé pour en discuter ?`
          : type === 'LINKEDIN'
            ? `Bonjour — ${prospect} m’a interpellé. Chez ${org} : ${offer}. OK pour échanger en MP ?`
            : /* WHATSAPP */ `Bonjour, ${org} — ${offer}. Concernant ${prospect}, avez-vous 2 min cette semaine ?`;

  const closing = tone === 'ferme' ? `\n\nCordialement,\n${sign}\n${org}` : `\n\nBien cordialement,\n${sign}\n${org}`;
  return body + closing;
}

async function openAiOutreach(
  hit: OutreachProspectContext,
  type: OutreachMessageType,
  tone: OutreachTone,
  sender: OutreachSenderContext
): Promise<string | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const sign = signerName(sender);
  const offer = offerSummary(sender);
  const productsList = (sender.productsServices || []).filter(Boolean);
  const brief = sender.organizationBrief?.trim() || '—';
  const orgSector = sender.organizationSector?.trim() || '—';
  const priorities = sender.commercialPriorities?.trim() || '—';

  const systemPrompt = `Tu rédiges un message de prospection commerciale en français.

RÈGLES ABSOLUES :
1) Tu écris AU NOM DE L'EXPÉDITEUR, à destination du PROSPECT.
2) Ne te présente JAMAIS comme le prospect ; ne signe JAMAIS avec le nom du prospect.
3) OFFRE PRODUIT — CRITIQUE :
   - Tu ne peux parler QUE des produits/services RÉELS listés pour l'expéditeur.
   - INTERDIT d'inventer une offre (ex. événementiel, agence comm, BTP…) si elle n'est pas dans la liste.
   - Ne confonds JAMAIS l'activité du prospect avec l'offre de l'expéditeur.
   - Si l'expéditeur fait de la facturation / SaaS / logiciel, ne propose PAS d'organiser des événements.
4) Ton sobre, humain, B2B PME. Pas de liste à puces. Pas de « Cher partenaire ».`;

  const userPrompt = `--- EXPÉDITEUR (qui écrit — c'est TOI) ---
Entreprise : ${sender.organizationName}
Secteur / activité : ${orgSector}
Brief Mission : ${brief}
Produits & services RÉELS (seule offre autorisée) : ${productsList.length ? productsList.join(' · ') : offer || 'non renseigné — reste très général, ne invente rien'}
Priorités commerciales : ${priorities}
Signataire : ${sign}

--- DESTINATAIRE (prospect — personnalisation uniquement, PAS ton offre) ---
Entreprise : ${hit.companyName}
Secteur prospect : ${hit.industry || '—'}
Site : ${hit.website || '—'}
Ville / pays : ${hit.city || '—'}, ${hit.country || '—'}
Contexte prospect (ne pas transformer en ton offre) : ${hit.probableBusinessProblem || '—'} / ${hit.commercialAngle || '—'}
Résumé : ${hit.aiSummary || '—'}

--- RÉDACTION ---
Canal : ${channelLabel(type)}
Ton : ${tone}
- Présente clairement ${sender.organizationName} et CE QU'ELLE VEND vraiment.
- Relie brièvement au contexte du prospect SANS inventer un métier pour ${sender.organizationName}.
- Signature : ${sign} + ${sender.organizationName} uniquement.
- Une question ouverte à la fin.

Rédige uniquement le corps du message.`;

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.35,
      max_tokens: 500,
    }),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return data.choices?.[0]?.message?.content?.trim() || null;
}

export async function generateOutreachMessage(
  hit: OutreachProspectContext,
  type: OutreachMessageType,
  tone: OutreachTone = 'commercial',
  sender?: OutreachSenderContext
): Promise<{ body: string; source: 'openai' | 'template'; signatureWarning: boolean }> {
  const senderCtx: OutreachSenderContext = {
    organizationName: sender?.organizationName?.trim() || 'Notre entreprise',
    organizationSector: sender?.organizationSector ?? null,
    organizationBrief: sender?.organizationBrief ?? null,
    productsServices: sender?.productsServices ?? [],
    commercialPriorities: sender?.commercialPriorities ?? null,
    senderName: sender?.senderName?.trim() || null,
  };

  const runValidate = (body: string) => {
    const idCheck = validateGeneratedMessage(body, hit.companyName, senderCtx.organizationName);
    if (!idCheck.ok) return idCheck;
    return validateOfferFidelity(body, senderCtx);
  };

  let ai = await openAiOutreach(hit, type, tone, senderCtx);
  if (ai) {
    let check = runValidate(ai);
    if (!check.ok) {
      console.warn('[outreach] message suspect, retry', check.reason, hit.companyName);
      const retry = await openAiOutreach(hit, type, tone, senderCtx);
      if (retry) {
        ai = retry;
        check = runValidate(ai);
      }
    }
    if (check.ok) {
      return { body: ai, source: 'openai', signatureWarning: false };
    }
    // Offre inventée → template fidèle plutôt qu'un faux pitch
    if (check.reason?.startsWith('hallucinated_') || check.reason === 'missing_real_offer') {
      const fallback = templateMessage(hit, type, tone, senderCtx);
      return { body: fallback, source: 'template', signatureWarning: false };
    }
    return { body: ai, source: 'openai', signatureWarning: true };
  }

  const fallback = templateMessage(hit, type, tone, senderCtx);
  const check = runValidate(fallback);
  return { body: fallback, source: 'template', signatureWarning: !check.ok };
}
