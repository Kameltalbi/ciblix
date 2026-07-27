import type { ProspectProfile } from '../core/types.js';
import { callConnectAiLlm, parseJson } from './llmClient.js';
import { matchProduct } from './productMatcher.js';

export type AiProductRecommendation = 'CARBOSCAN' | 'SOFTFACTURE' | 'BOTH' | 'NONE';

export async function recommendProductWithAi(profile: ProspectProfile): Promise<{
  product: AiProductRecommendation;
  reason: string;
}> {
  const system = `Tu es conseiller commercial Ciblix.
Produits:
- CARBOSCAN: bilan carbone, CSRD, ESG, industrie, export
- SOFTFACTURE: facturation, PME, cabinets comptables, gestion
- BOTH: les deux sont pertinents
- NONE: aucun produit clairement adapté

Réponds en JSON strict: {"product":"CARBOSCAN|SOFTFACTURE|BOTH|NONE","reason":"1 phrase"}`;

  const raw = await callConnectAiLlm(system, JSON.stringify(profile, null, 2), { json: true, maxTokens: 120 });
  const parsed = parseJson<{ product?: string; reason?: string }>(raw);

  const valid = ['CARBOSCAN', 'SOFTFACTURE', 'BOTH', 'NONE'] as const;
  if (parsed?.product && valid.includes(parsed.product as typeof valid[number])) {
    return { product: parsed.product as AiProductRecommendation, reason: parsed.reason || '' };
  }

  const fallback = matchProduct(profile);
  return {
    product: (fallback === 'CUSTOM' ? 'NONE' : fallback) as AiProductRecommendation,
    reason: 'Recommandation basée sur le profil',
  };
}
