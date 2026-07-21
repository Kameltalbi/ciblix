export type GmailAiPriority = 'HIGH' | 'MEDIUM' | 'LOW';

export interface GmailAiDraftResult {
  summary: string;
  actionRequested: string;
  analysis: string;
  priority: GmailAiPriority;
  reply: string;
}

async function callOpenAI(prompt: string, systemPrompt: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OpenAI API key not configured');

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt },
      ],
      max_tokens: 1400,
      temperature: 0.3,
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI API error: ${error}`);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return data.choices?.[0]?.message?.content?.trim() || '';
}

function normalizePriority(raw?: string): GmailAiPriority {
  const upper = (raw || '').toUpperCase();
  if (upper === 'HIGH' || upper === 'HAUTE') return 'HIGH';
  if (upper === 'LOW' || upper === 'BASSE') return 'LOW';
  return 'MEDIUM';
}

export async function generateSummaryAndReply(opts: {
  from: string;
  subject: string;
  body: string;
  language: string;
  tone: string;
  signature?: string | null;
}): Promise<GmailAiDraftResult> {
  const lang =
    opts.language === 'en' ? 'English' : opts.language === 'ar' ? 'Arabic' : 'French';

  const systemPrompt = `You are a professional email assistant for a B2B SaaS team.
Return ONLY valid JSON:
{
  "summary": "...",
  "actionRequested": "...",
  "analysis": "...",
  "priority": "HIGH|MEDIUM|LOW",
  "reply": "..."
}
Rules:
- summary: 2-4 short sentences (intent, asks, deadlines).
- actionRequested: what the sender wants the recipient to do.
- analysis: brief intent classification (quote, meeting, support, info, complaint, other).
- priority: HIGH if urgent/deadline/customer risk, MEDIUM otherwise, LOW if FYI/newsletter-like.
- reply: a complete, ready-to-send email reply in ${lang}, tone: ${opts.tone}. It must read as if the recipient wrote it themselves.
- The reply must start with an appropriate greeting and contain full sentences.
- IMPORTANT: do NOT include any closing salutation, signature, sender name, or placeholder such as "[Votre Nom]" / "[Your Name]" at the end of the reply. The signature is added automatically afterwards. End the reply on the last content sentence.
- Do not invent facts. Ask politely if info is missing.
- Never claim the email was already sent.`;

  const prompt = `From: ${opts.from}
Subject: ${opts.subject}

Email body:
${opts.body.slice(0, 8000)}`;

  const raw = await callOpenAI(prompt, systemPrompt);
  try {
    const parsed = JSON.parse(raw) as {
      summary?: string;
      actionRequested?: string;
      analysis?: string;
      priority?: string;
      reply?: string;
    };
    const summary = (parsed.summary || '').trim();
    const reply = (parsed.reply || '').trim();
    if (!summary || !reply) throw new Error('empty');
    return {
      summary,
      actionRequested: (parsed.actionRequested || '').trim() || 'Réponse / suivi',
      analysis: (parsed.analysis || '').trim() || 'Analyse non disponible',
      priority: normalizePriority(parsed.priority),
      reply,
    };
  } catch {
    return {
      summary: `Email de ${opts.from} — ${opts.subject}`,
      actionRequested: 'Répondre au message',
      analysis: 'Analyse indisponible',
      priority: 'MEDIUM',
      reply: raw || `Bonjour,\n\nMerci pour votre message. Je reviens vers vous rapidement.`,
    };
  }
}

/** Enlève une éventuelle signature/salutation finale laissée par le modèle. */
function stripTrailingSignature(reply: string): string {
  let text = reply.trim();
  const closings = /^(cordialement|bien à vous|sincèrement|respectueusement|best regards|regards|kind regards|sincerely|thanks|thank you|merci)\b/i;
  const placeholder = /\[(votre nom|your name|nom)\]/i;
  const lines = text.split('\n');
  while (lines.length) {
    const last = lines[lines.length - 1].trim();
    if (last === '' || placeholder.test(last) || closings.test(last)) {
      lines.pop();
      continue;
    }
    break;
  }
  text = lines.join('\n').trim();
  return text;
}

/**
 * Corps du brouillon = uniquement la réponse prête à envoyer + signature.
 * Le résumé/analyse IA reste dans Ciblix (jamais dans le mail envoyé).
 */
export function buildDraftBody(result: GmailAiDraftResult, signature?: string | null): string {
  const reply = stripTrailingSignature(result.reply);
  const sig = signature?.trim();
  return sig ? `${reply}\n\n${sig}` : reply;
}
