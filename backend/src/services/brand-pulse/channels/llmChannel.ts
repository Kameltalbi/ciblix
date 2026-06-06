import { callLlm } from '../llmProvider.js';

/** Phase 5 — visibilité marque dans les LLMs (sondage prompt). */
export async function scoreLlmChannel(
  brandName: string,
  sector: string | null,
  keywords: string[],
): Promise<{ score: number; details: Record<string, unknown> }> {
  const provider = process.env.BRAND_PULSE_LLM_PROVIDER === 'claude' ? 'claude' : 'openai';

  try {
    const raw = await callLlm({
      provider,
      systemPrompt:
        'Tu évalues la notoriété en ligne des marques. Réponds UNIQUEMENT en JSON : {"score":0-100,"awareness":"low|medium|high","summary":"..."}',
      userPrompt: `Marque: ${brandName}. Secteur: ${sector || 'non précisé'}. Mots-clés: ${keywords.join(', ') || 'aucun'}.
Estime la probabilité qu'un utilisateur obtienne des informations fiables sur cette marque via les assistants IA publics.`,
      maxTokens: 400,
      temperature: 0.2,
    });

    const parsed = JSON.parse(raw.replace(/^```json\s*/i, '').replace(/```$/i, '').trim()) as {
      score?: number;
      awareness?: string;
      summary?: string;
    };

    const score = Math.min(100, Math.max(0, Math.round(parsed.score ?? 50)));
    return {
      score,
      details: {
        comingSoon: false,
        provider,
        awareness: parsed.awareness,
        summary: parsed.summary,
      },
    };
  } catch (err) {
    return {
      score: 50,
      details: {
        estimated: true,
        message: err instanceof Error ? err.message : 'LLM indisponible',
      },
    };
  }
}
