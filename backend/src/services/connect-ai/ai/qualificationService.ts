import type { ConnectChannelSlug, ProspectProfile, ProspectQualification, ScoreFactor } from '../core/types.js';
import { callConnectAiLlm, parseJson } from './llmClient.js';
import { getChannel } from '../channels/channelRegistry.js';
import { formatProductsForPrompt, listCommercialProducts } from '../repositories/productCatalogRepository.js';
import { formatUserMemoryForPrompt, getUserMemory } from '../repositories/userMemoryRepository.js';
import { retrieveOrgKnowledge } from '../knowledge/retrievalService.js';

function scoreLabel(score: number): string {
  if (score >= 85) return 'Prospect très pertinent';
  if (score >= 70) return 'Bon potentiel';
  if (score >= 50) return 'À qualifier';
  return 'Priorité basse';
}

function starsFromScore(score: number): number {
  if (score >= 90) return 5;
  if (score >= 75) return 4;
  if (score >= 60) return 3;
  if (score >= 45) return 2;
  return 1;
}

function fallbackFactors(profile: ProspectProfile): ScoreFactor[] {
  const f: ScoreFactor[] = [];
  if (profile.jobTitle?.match(/directeur|ceo|fondateur|head|vp|président|rse/i)) {
    f.push({ label: 'Décideur identifié', impact: 20, polarity: 'positive' });
  }
  if (profile.recentActivity?.length) {
    f.push({ label: 'Activité récente détectée', impact: 10, polarity: 'positive' });
  }
  if (!profile.description) {
    f.push({ label: 'Profil peu détaillé', impact: 8, polarity: 'negative' });
  }
  return f;
}

const QUALIFICATION_SCHEMA = `{
  "score": 0-100,
  "scoreLabel": "string",
  "stars": 1-5,
  "scoreFactors": [{"label":"string","impact":number,"polarity":"positive|negative"}],
  "isDecisionMaker": true|false,
  "probableBudget": "low|medium|high|unknown",
  "esgMaturity": "low|medium|high|unknown",
  "responseProbability": 0-100,
  "meetingProbability": 0-100,
  "sector": "string",
  "companySize": "string",
  "decisionLevel": "string",
  "language": "fr|en|ar",
  "summary": "2-3 phrases sur le prospect",
  "contextualInsight": "Insight contextuel basé sur TOUTE la page (ex: recrutement RSE récent, posts digitalisation…)",
  "timingSignal": "Pourquoi maintenant est un bon moment (ou pas)",
  "bestAngles": ["angle1","angle2","angle3"],
  "avoidTopics": ["sujet à éviter1","sujet2"],
  "recommendedSubject": "Sujet d'approche recommandé (ex: Retour sur investissement)",
  "recommendedProductSlug": "slug du catalogue",
  "recommendedProductName": "nom produit",
  "productReason": "1-2 phrases",
  "risks": "risques identifiés",
  "opportunitiesBullets": ["opportunité1","opportunité2"]
}`;

export async function qualifyProspect(
  organizationId: string,
  userId: string,
  channelSlug: ConnectChannelSlug,
  rawProfile: Record<string, unknown>
): Promise<ProspectQualification> {
  const channel = getChannel(channelSlug);
  const profile = channel ? channel.normalizeProfile(rawProfile) : (rawProfile as ProspectProfile);

  const [products, userMemory, knowledge] = await Promise.all([
    listCommercialProducts(organizationId),
    getUserMemory(userId),
    retrieveOrgKnowledge({
      organizationId,
      queryParts: [
        profile.company,
        profile.jobTitle,
        profile.sector,
        profile.headline,
        profile.description?.slice(0, 400),
      ],
    }),
  ]);

  const system = `Tu es un copilote commercial senior pour Ciblix.
Tu analyses un profil LinkedIn COMPLET (poste, entreprise, résumé, expérience, activité récente, publications, compétences, taille entreprise).
Tu dois expliquer ton raisonnement comme un expert commercial — pas un simple score.

Catalogue produits disponibles:
${formatProductsForPrompt(products)}

Préférences utilisateur:
${formatUserMemoryForPrompt(userMemory)}

${knowledge.promptBlock}

Réponds UNIQUEMENT en JSON strict:
${QUALIFICATION_SCHEMA}

Règles:
- contextualInsight: analyse intelligente ("Cette entreprise vient de recruter un RSE → bon moment pour CarboScan")
- bestAngles: 2-4 angles commerciaux concrets
- avoidTopics: ce qu'il ne faut PAS dire (ex: "parler technique", "parler ISO")
- recommendedProductSlug: choisir dans le catalogue selon le profil
- responseProbability et meetingProbability: estimations réalistes 0-100
- Si des connaissances entreprise sont fournies, appuie-toi dessus pour les angles et le produit`;

  const user = JSON.stringify(profile, null, 2);
  const raw = await callConnectAiLlm(system, user, { json: true, maxTokens: 1200 });
  const parsed = parseJson<ProspectQualification & { recommendedProductSlug?: string }>(raw);

  const defaultProduct = products[0];

  if (parsed && typeof parsed.score === 'number') {
    const slug = parsed.recommendedProductSlug || defaultProduct?.slug || 'carboscan';
    const product = products.find((p) => p.slug === slug) || defaultProduct;
    return {
      ...parsed,
      score: Math.min(100, Math.max(0, Math.round(parsed.score))),
      scoreLabel: parsed.scoreLabel || scoreLabel(parsed.score),
      stars: parsed.stars || starsFromScore(parsed.score),
      scoreFactors: parsed.scoreFactors?.length ? parsed.scoreFactors : fallbackFactors(profile),
      responseProbability: Math.min(100, Math.max(0, Math.round(parsed.responseProbability ?? 50))),
      meetingProbability: Math.min(100, Math.max(0, Math.round(parsed.meetingProbability ?? 30))),
      isDecisionMaker: parsed.isDecisionMaker ?? Boolean(profile.jobTitle?.match(/directeur|ceo|fondateur|head|vp|président/i)),
      probableBudget: parsed.probableBudget ?? 'unknown',
      esgMaturity: parsed.esgMaturity ?? 'unknown',
      bestAngles: parsed.bestAngles ?? [],
      avoidTopics: parsed.avoidTopics ?? [],
      recommendedSubject: parsed.recommendedSubject ?? 'Valeur métier',
      recommendedProductSlug: slug,
      recommendedProductName: product?.name ?? parsed.recommendedProductName ?? 'CarboScan',
      productReason: parsed.productReason ?? '',
      contextualInsight: parsed.contextualInsight ?? parsed.summary,
      risks: parsed.risks ?? '',
    };
  }

  const factors = fallbackFactors(profile);
  const score = Math.min(100, Math.max(0, 45 + factors.reduce((s, f) => s + (f.polarity === 'positive' ? f.impact : -f.impact), 0)));
  return {
    score,
    scoreLabel: scoreLabel(score),
    stars: starsFromScore(score),
    scoreFactors: factors,
    isDecisionMaker: Boolean(profile.jobTitle?.match(/directeur|ceo|fondateur/i)),
    probableBudget: 'unknown',
    esgMaturity: 'unknown',
    responseProbability: Math.round(score * 0.7),
    meetingProbability: Math.round(score * 0.4),
    summary: `${profile.fullName || 'Contact'} — ${profile.jobTitle || ''} @ ${profile.company || ''}`,
    contextualInsight: 'Données limitées — enrichir le profil pour une analyse plus précise.',
    bestAngles: ['Valeur métier', 'Gain de temps'],
    avoidTopics: ['Jargon technique non contextualisé'],
    recommendedSubject: 'Proposition de valeur',
    recommendedProductSlug: defaultProduct?.slug ?? 'carboscan',
    recommendedProductName: defaultProduct?.name ?? 'CarboScan',
    productReason: 'Recommandation par défaut',
    risks: 'Contexte insuffisant',
  };
}

/** Alias rétrocompat */
export const analyzeProspect = qualifyProspect;
