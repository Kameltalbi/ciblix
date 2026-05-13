import type { CompanySearchCriteria, CompanySearchHit, LeadQualification, PotentialLevel } from './types.js';

export function heuristicQualify(hit: CompanySearchHit, criteria: CompanySearchCriteria): LeadQualification {
  let score = 38;
  if (hit.website) score += 18;
  if (hit.linkedin) score += 12;
  if (hit.email) score += 10;
  if (hit.phone) score += 6;
  const ind = `${hit.industry || ''} ${criteria.sector || ''}`.toLowerCase();
  if (ind.includes('btp') || ind.includes('indust') || ind.includes('agro')) score += 8;
  if (hit.companyName.length > 12) score += 4;
  score = Math.max(0, Math.min(100, Math.round(score)));

  let potentialLevel: PotentialLevel = 'MOYEN';
  if (score >= 72) potentialLevel = 'TRES_FORT';
  else if (score < 48) potentialLevel = 'FAIBLE';

  const hasWeb = Boolean(hit.website);
  const summary = hasWeb
    ? `${hit.companyName} — présence en ligne identifiable (${hit.industry || 'secteur à préciser'}). À valider par un contact humain avant toute sollicitation.`
    : `${hit.companyName} — signal web limité : intérêt possible sur la transformation digitale ou l’organisation commerciale.`;

  const angle =
    potentialLevel === 'TRES_FORT'
      ? 'Proposer un court diagnostic + cas clients du même secteur.'
      : potentialLevel === 'MOYEN'
        ? 'Entrer en contact par une problématique métier concrète (charge admin, suivi client, visibilité).'
        : 'Approche très ciblée, une seule question ouverte sur leur priorité du trimestre.';

  return {
    score,
    potentialLevel,
    scoreReason:
      potentialLevel === 'FAIBLE'
        ? 'Signaux web / contact partiels — qualification prudente.'
        : 'Secteur et signaux de présence cohérents avec une approche commerciale raisonnable.',
    commercialAngle: angle,
    aiSummary: summary,
    suggestedPitch: `Bonjour, nous accompagnons des structures ${criteria.country || ''} sur ${criteria.sector || 'leur développement'} — seriez-vous ouvert à un échange de 15 minutes ?`,
    interestProbability: Math.max(15, Math.min(92, score - 5 + (hit.email ? 5 : 0))),
    aiTags: [criteria.sector || 'secteur', criteria.country || 'pays', hit.companySize || 'taille'].filter(Boolean),
    followUpPlan: [
      { dayOffset: 3, approach: 'Relance courte : rappel de valeur sans pression.', tone: 'doux' },
      { dayOffset: 7, approach: 'Apporter un élément concret (étude de cas, chiffre secteur).', tone: 'commercial' },
      { dayOffset: 15, approach: 'Dernière prise de contact : proposer créneau ou clôturer poliment.', tone: 'ferme' },
    ],
  };
}

async function callOpenAiJson(userPrompt: string): Promise<Partial<LeadQualification> | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const system = `Tu es un expert prospection B2B PME. Analyse l'entreprise comme prospect potentiel.
Réponds UNIQUEMENT en JSON valide avec les clés :
score (nombre 0-100),
potentialLevel ("TRES_FORT"|"MOYEN"|"FAIBLE"),
scoreReason (string courte),
commercialAngle (string),
aiSummary (2 phrases max, ton humain, pas de jargon IA),
suggestedPitch (une phrase d'accroche email),
interestProbability (0-100),
aiTags (tableau de strings courts),
followUpPlan (tableau de { dayOffset: 3|7|15, approach: string, tone: "doux"|"commercial"|"ferme" }).

Pas de markdown, pas de texte hors JSON.`;

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.35,
      max_tokens: 900,
      response_format: { type: 'json_object' },
    }),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const text = data.choices?.[0]?.message?.content;
  if (!text) return null;
  try {
    return JSON.parse(text) as Partial<LeadQualification>;
  } catch {
    return null;
  }
}

export async function qualifyCompanyHit(
  hit: CompanySearchHit,
  criteria: CompanySearchCriteria
): Promise<LeadQualification> {
  /** Par défaut : scoring simple (heuristique). Activer `PROSPECTING_OPENAI_SCORING=true` pour JSON OpenAI. */
  const useOpenAiScoring =
    process.env.PROSPECTING_OPENAI_SCORING === 'true' || process.env.PROSPECTING_OPENAI_SCORING === '1';

  const userPrompt = `Entreprise: ${hit.companyName}
Site: ${hit.website || 'non renseigné'}
LinkedIn: ${hit.linkedin || 'non renseigné'}
Email: ${hit.email || 'non renseigné'}
Téléphone: ${hit.phone || 'non renseigné'}
Ville/Pays: ${hit.city || ''} / ${hit.country || ''}
Secteur détecté: ${hit.industry || ''}
Taille: ${hit.companySize || ''}

Contexte recherche utilisateur:
- Secteur visé: ${criteria.sector || '—'}
- Mots-clés: ${criteria.keywords || '—'}`;

  if (!useOpenAiScoring) {
    return heuristicQualify(hit, criteria);
  }

  const j = await callOpenAiJson(userPrompt);
  if (j && typeof j.score === 'number' && j.aiSummary && j.scoreReason) {
    const score = Math.max(0, Math.min(100, Math.round(j.score)));
    const pl = j.potentialLevel;
    const potentialLevel: PotentialLevel =
      pl === 'TRES_FORT' || pl === 'MOYEN' || pl === 'FAIBLE' ? pl : 'MOYEN';
    return {
      score,
      potentialLevel,
      scoreReason: String(j.scoreReason),
      commercialAngle: String(j.commercialAngle || ''),
      aiSummary: String(j.aiSummary),
      suggestedPitch: String(j.suggestedPitch || ''),
      interestProbability: Math.max(0, Math.min(100, Number(j.interestProbability ?? score))),
      aiTags: Array.isArray(j.aiTags) ? j.aiTags.map(String).slice(0, 12) : [],
      followUpPlan: Array.isArray(j.followUpPlan) && j.followUpPlan.length
        ? (j.followUpPlan as LeadQualification['followUpPlan']).slice(0, 5)
        : heuristicQualify(hit, criteria).followUpPlan,
    };
  }
  return heuristicQualify(hit, criteria);
}
