import { getCopilotOrgConfig } from './orgConfig.js';

export type ConversationAnalysis = {
  resume: string;
  score: number;
  scoreDetail: Record<string, string | number>;
  actionsSuggerees: string[];
  signauxAchat: string[];
};

function parseAnalysisJson(raw: string): ConversationAnalysis {
  const parsed = JSON.parse(raw) as Partial<ConversationAnalysis>;
  const resume = (parsed.resume || '').trim();
  const score = Math.max(0, Math.min(100, Number(parsed.score) || 0));
  const actionsSuggerees = Array.isArray(parsed.actionsSuggerees)
    ? parsed.actionsSuggerees.map(String).filter(Boolean)
    : [];
  const signauxAchat = Array.isArray(parsed.signauxAchat)
    ? parsed.signauxAchat.map(String).filter(Boolean)
    : [];
  const scoreDetail =
    parsed.scoreDetail && typeof parsed.scoreDetail === 'object'
      ? (parsed.scoreDetail as Record<string, string | number>)
      : {};

  if (!resume) throw new Error('empty_resume');
  return { resume, score, scoreDetail, actionsSuggerees, signauxAchat };
}

async function callOpenAIJson(prompt: string, systemPrompt: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY not configured');

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
    throw new Error(`OpenAI error: ${await response.text()}`);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error('empty_llm_response');
  return content;
}

export async function analyzeConversation(
  organizationId: string,
  transcription: string
): Promise<ConversationAnalysis> {
  const cfg = await getCopilotOrgConfig(organizationId);
  const gridText = cfg.scoringGrid
    .map((c) => `- ${c.label} (poids ${c.weight}%)`)
    .join('\n');

  const systemPrompt = `Tu es un assistant qui analyse une conversation commerciale pour ${cfg.orgName}, secteur ${cfg.sector}.

Contexte métier : ${cfg.businessLexicon}
Grille de scoring :
${gridText}

Réponds UNIQUEMENT en JSON valide :
{
  "resume": "résumé en 3-4 phrases",
  "score": <nombre 0-100>,
  "scoreDetail": { "<critère>": "<observation>" },
  "actionsSuggerees": ["action 1"],
  "signauxAchat": ["signal si présent"]
}`;

  const prompt = `Transcription :\n${transcription.slice(0, 12_000)}`;

  let lastErr: unknown;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const raw = await callOpenAIJson(prompt, systemPrompt);
      return parseAnalysisJson(raw);
    } catch (err) {
      lastErr = err;
    }
  }

  // Fallback minimal si JSON invalide
  const fallbackRaw = await callOpenAIJson(
    `${prompt}\n\nIMPORTANT: retourne uniquement le JSON demandé, sans markdown.`,
    systemPrompt
  );
  try {
    return parseAnalysisJson(fallbackRaw);
  } catch {
    return {
      resume: transcription.slice(0, 500),
      score: 50,
      scoreDetail: { fallback: 'analyse_partielle' },
      actionsSuggerees: ['Relire la transcription et planifier un suivi'],
      signauxAchat: [],
    };
  }
}
