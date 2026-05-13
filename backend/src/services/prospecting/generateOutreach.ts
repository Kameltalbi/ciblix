import type { CompanySearchHit, OutreachMessageType } from './types.js';

function templateMessage(
  hit: CompanySearchHit,
  type: OutreachMessageType,
  tone: 'doux' | 'commercial' | 'ferme'
): string {
  const name = hit.companyName;
  const sector = hit.industry || 'votre secteur';
  const opening =
    tone === 'doux'
      ? `Bonjour,\n\nJe me permets de vous écrire après avoir découvert ${name}.`
      : tone === 'ferme'
        ? `Bonjour,\n\nJe reviens vers ${name} avec une proposition très cadrée.`
        : `Bonjour,\n\nJe contacte ${name} car votre positionnement sur ${sector} correspond à des accompagnements que nous menons avec d’autres structures.`;

  const body =
    type === 'FIRST_CONTACT'
      ? `${opening}\n\nSeriez-vous ouvert à un échange de 15 minutes cette semaine pour voir si un sujet (organisation commerciale, suivi client) mérite d’être creusé ?`
      : type === 'FOLLOW_UP'
        ? `${opening}\n\nJe souhaitais simplement remonter mon message : avez-vous un créneau court à me proposer ?`
        : type === 'VALUE_PROPOSITION'
          ? `${opening}\n\nNous aidons des PME à structurer la prospection et le suivi des opportunités (sans complexité « ERP »). Un cas concret du ${sector} pourrait vous parler — intéressé pour en discuter ?`
          : type === 'LINKEDIN'
            ? `Bonjour — votre activité ${sector} m’a interpellé. Je travaille avec des PME sur la conversion prospection → pipeline. OK pour échanger en MP ?`
            : /* WHATSAPP */ `Bonjour, je vous contacte au sujet de ${name} (${sector}). Avez-vous 2 min cette semaine pour un point téléphonique ?`;

  const closing = tone === 'ferme' ? '\n\nCordialement' : '\n\nBien cordialement';
  return body + closing;
}

async function openAiOutreach(
  hit: CompanySearchHit,
  type: OutreachMessageType,
  tone: 'doux' | 'commercial' | 'ferme'
): Promise<string | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const typeFr: Record<OutreachMessageType, string> = {
    FIRST_CONTACT: 'premier contact email',
    FOLLOW_UP: 'relance email',
    VALUE_PROPOSITION: 'email proposition de valeur',
    LINKEDIN: 'message LinkedIn court',
    WHATSAPP: 'message WhatsApp court et naturel',
  };

  const prompt = `Entreprise: ${hit.companyName}
Secteur: ${hit.industry || '—'}
Site: ${hit.website || '—'}
Ville: ${hit.city || '—'}, ${hit.country || '—'}

Génère un ${typeFr[type]}, ton ${tone}.
Règles: personnalisé, non générique, pas de promesse irréaliste, pas de spam, une seule question ouverte à la fin si pertinent.
Pas d’objet « marketing » agressif.`;

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content:
            'Tu rédiges des messages B2B PME en français, sobres et humains. Pas de liste à puces. Pas de « Cher partenaire ».',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.55,
      max_tokens: 500,
    }),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return data.choices?.[0]?.message?.content?.trim() || null;
}

export async function generateOutreachMessage(
  hit: CompanySearchHit,
  type: OutreachMessageType,
  tone: 'doux' | 'commercial' | 'ferme' = 'commercial'
): Promise<{ body: string; source: 'openai' | 'template' }> {
  const ai = await openAiOutreach(hit, type, tone);
  if (ai) return { body: ai, source: 'openai' };
  return { body: templateMessage(hit, type, tone), source: 'template' };
}
