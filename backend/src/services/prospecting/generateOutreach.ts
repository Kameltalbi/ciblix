import type { CompanySearchHit, OutreachMessageType } from './types.js';

export type OutreachTone = 'doux' | 'commercial' | 'ferme';

export type OutreachSenderContext = {
  organizationName: string;
  organizationSector?: string | null;
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

function significantNameTokens(name: string): string[] {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 4 && !GENERIC_PROSPECT_TOKENS.has(t));
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

  // Signature = dernières lignes contenant le nom complet ou un token significatif du prospect
  if (lastLine.includes(prospectLower) || closingBlock.includes(prospectLower)) {
    return { ok: false, reason: 'signed_as_prospect' };
  }
  for (const token of tokens) {
    if (lastLine === token || lastLine.startsWith(token + ' ') || lastLine.endsWith(' ' + token)) {
      return { ok: false, reason: 'signed_as_prospect_token' };
    }
  }

  // "Je suis {prenom/nom du prospect}"
  const identitySteal = /(je\s+suis|je\s+m['']appelle|mon\s+nom\s+est)\s+([^\n.,!]{2,60})/gi;
  let m: RegExpExecArray | null;
  while ((m = identitySteal.exec(text)) !== null) {
    const claimed = (m[2] || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (claimed.includes(prospectLower) || tokens.some((t) => claimed.includes(t))) {
      return { ok: false, reason: 'presents_as_prospect' };
    }
  }

  // Si le message se présente clairement et ne mentionne jamais l'org alors que le prospect est dans la zone signature
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
  const angle = hit.commercialAngle || hit.probableBusinessProblem || null;

  const opening =
    tone === 'doux'
      ? `Bonjour,\n\nJe me permets de vous écrire de la part de ${org}, après avoir découvert ${prospect}.`
      : tone === 'ferme'
        ? `Bonjour,\n\nJe vous contacte de la part de ${org} au sujet de ${prospect}, avec une proposition très cadrée.`
        : `Bonjour,\n\nJe vous contacte de la part de ${org} : votre positionnement sur ${sector} correspond à des accompagnements que nous menons avec d’autres structures.`;

  const angleLine = angle ? `\n\nNous avons noté notamment : ${angle}` : '';

  const body =
    type === 'FIRST_CONTACT'
      ? `${opening}${angleLine}\n\nSeriez-vous ouvert à un échange de 15 minutes cette semaine pour voir si un sujet (organisation commerciale, suivi client) mérite d’être creusé ?`
      : type === 'FOLLOW_UP'
        ? `${opening}\n\nJe souhaitais simplement remonter mon message : avez-vous un créneau court à me proposer ?`
        : type === 'VALUE_PROPOSITION'
          ? `${opening}${angleLine}\n\nChez ${org}, nous aidons des PME à structurer la prospection et le suivi des opportunités. Un cas concret du ${sector} pourrait vous parler — intéressé pour en discuter ?`
          : type === 'LINKEDIN'
            ? `Bonjour — votre activité ${sector} m’a interpellé. Je travaille chez ${org} avec des PME sur la conversion prospection → pipeline. OK pour échanger en MP ?`
            : /* WHATSAPP */ `Bonjour, je vous contacte de la part de ${org} au sujet de ${prospect} (${sector}). Avez-vous 2 min cette semaine pour un point téléphonique ?`;

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
  const orgSector = sender.organizationSector?.trim() || 'non précisé';

  const systemPrompt = `Tu rédiges un message de prospection commerciale en français.

RÈGLE ABSOLUE : tu écris CE MESSAGE AU NOM DE L'EXPÉDITEUR, à destination du PROSPECT (destinataire).
- Ne te présente JAMAIS comme si tu étais le prospect.
- Ne signe JAMAIS le message avec le nom du prospect.
- N'écris JAMAIS « Je suis {nom du prospect} » ni « Je travaille dans [secteur du prospect] » en te faisant passer pour lui.
- Le message doit se terminer par une signature au nom de l'EXPÉDITEUR uniquement.
- Ton sobre, humain, B2B PME. Pas de liste à puces. Pas de « Cher partenaire ».`;

  const userPrompt = `--- EXPÉDITEUR (qui écrit ce message — c'est TOI dans le message) ---
Nom de l'entreprise : ${sender.organizationName}
Secteur d'activité de l'expéditeur : ${orgSector}
Signataire : ${sign}

--- DESTINATAIRE (à qui ce message est envoyé — NE PAS utiliser ces infos pour te présenter ou signer) ---
Nom du prospect / entreprise : ${hit.companyName}
Secteur du prospect : ${hit.industry || '—'}
Site : ${hit.website || '—'}
Ville / pays : ${hit.city || '—'}, ${hit.country || '—'}
Problème probable détecté : ${hit.probableBusinessProblem || '—'}
Angle d'approche suggéré : ${hit.commercialAngle || '—'}
Résumé IA : ${hit.aiSummary || '—'}

--- CONSIGNES DE RÉDACTION ---
Canal : ${channelLabel(type)}
Ton : ${tone}
- Utilise les informations du destinataire uniquement pour personnaliser (mentionner son secteur, son contexte).
- Présente-toi / ton entreprise (${sender.organizationName}) comme expéditeur.
- Termine par une signature : ${sign} (et éventuellement ${sender.organizationName}), jamais le nom du prospect.
- Personnalisé, non générique, pas de promesse irréaliste, pas de spam.
- Une seule question ouverte à la fin si pertinent.

Rédige maintenant uniquement le corps du message (pas d'objet email sauf si indispensable en une ligne courte).`;

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.45,
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
    senderName: sender?.senderName?.trim() || null,
  };

  const runValidate = (body: string) =>
    validateGeneratedMessage(body, hit.companyName, senderCtx.organizationName);

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
    // Toujours renvoyer le texte mais avec avertissement (l'UI relit avant envoi)
    return { body: ai, source: 'openai', signatureWarning: true };
  }

  const fallback = templateMessage(hit, type, tone, senderCtx);
  const check = runValidate(fallback);
  return { body: fallback, source: 'template', signatureWarning: !check.ok };
}
