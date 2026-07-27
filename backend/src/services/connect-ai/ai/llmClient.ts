export async function callConnectAiLlm(
  system: string,
  user: string,
  opts?: { temperature?: number; maxTokens?: number; json?: boolean }
): Promise<string | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const body: Record<string, unknown> = {
    model: process.env.CONNECT_AI_MODEL || 'gpt-4o-mini',
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    temperature: opts?.temperature ?? 0.35,
    max_tokens: opts?.maxTokens ?? 800,
  };
  if (opts?.json) body.response_format = { type: 'json_object' };

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return data.choices?.[0]?.message?.content?.trim() || null;
}

export function parseJson<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    const m = raw.match(/\{[\s\S]*\}/);
    return JSON.parse(m ? m[0] : raw) as T;
  } catch {
    return null;
  }
}
