import type {
  CompanySearchCriteria,
  CompanySearchHit,
  LeadQualification,
  PotentialLevel,
  WebEnrichmentResult,
} from './types.js';

function sectorFamily(sector: string, industry: string): string {
  const s = `${sector} ${industry}`.toLowerCase();
  if (/btp|bâtiment|construction|génie|structure|vrd|étude/i.test(s)) return 'BTP / études';
  if (/industr|manufact|usine|production|agro/i.test(s)) return 'Industrie / agro';
  if (/export|international|fret|logistique/i.test(s)) return 'Export / logistique';
  if (/tech|digital|saas|web|it|info/i.test(s)) return 'Tech / services';
  if (/commerce|distribution|retail|import/i.test(s)) return 'Commerce / distribution';
  return 'Services / généraliste';
}

function exportSignal(criteria: CompanySearchCriteria, industry: string): boolean {
  const t = `${criteria.keywords || ''} ${criteria.sector || ''} ${industry}`.toLowerCase();
  return /export|international|douane|fret|port|aérien|agro.*export|huile|datte|textile/i.test(t);
}

function carbonSignal(criteria: CompanySearchCriteria, industry: string): boolean {
  const t = `${criteria.keywords || ''} ${industry}`.toLowerCase();
  return /énergie|solaire|environnement|déchet|carbone|esg|iso\s*14001/i.test(t);
}

function b2bSignal(hit: CompanySearchHit, criteria: CompanySearchCriteria): boolean {
  const t = `${hit.companyName} ${criteria.sector || ''} ${hit.industry || ''}`.toLowerCase();
  return /sarl|sa |eurl|groupe|holding|industr|étude|bureau|services\s+b2b|entreprise/i.test(t);
}

function buildHeuristicSummary(
  hit: CompanySearchHit,
  criteria: CompanySearchCriteria,
  e: WebEnrichmentResult | null,
  family: string
): string {
  const city = hit.city || criteria.city || '';
  const country = hit.country || criteria.country || '';
  const loc = [city, country].filter(Boolean).join(', ');
  const web = hit.website ? 'site web actif' : 'pas de site identifié';
  const dig =
    e?.digitalPresenceLevel === 'FORT'
      ? 'bonne visibilité digitale'
      : e?.digitalPresenceLevel === 'MOYEN'
        ? 'présence digitale correcte'
        : 'présence digitale limitée';
  const li = hit.linkedin ? 'profil LinkedIn repéré' : 'peu ou pas de visibilité LinkedIn';
  return `${hit.companyName} — acteur ${family}${loc ? ` (${loc})` : ''}, ${web}, ${dig}. ${li.charAt(0).toUpperCase() + li.slice(1)}. Potentiel à valider sur le plan CRM / pilotage commercial.`.slice(
    0,
    900
  );
}

function buildScoreBullets(
  hit: CompanySearchHit,
  criteria: CompanySearchCriteria,
  e: WebEnrichmentResult | null
): string[] {
  const lines: string[] = [];
  if (hit.website) lines.push('✔ Site web actif');
  else lines.push('❌ Pas de site web');
  if (e?.hasSsl) lines.push('✔ HTTPS');
  else if (hit.website) lines.push('❄️ HTTPS à vérifier');
  if (e?.hasResponsiveWebsite) lines.push('✔ Site adapté mobile (viewport)');
  else if (hit.website) lines.push('❄️ UX mobile peu claire');
  if (e && e.seoScore >= 55) lines.push(`✔ SEO minimal solide (score ${e.seoScore}/100)`);
  else if (hit.website) lines.push(`❄️ SEO / contenu à renforcer (${e?.seoScore ?? 0}/100)`);
  if (hit.linkedin || (e?.linkedinUrlsFound?.length ?? 0) > 0) lines.push('✔ Présence LinkedIn');
  else lines.push('❌ Pas de LinkedIn détecté');
  if (e?.facebookUrl || e?.instagramUrl) lines.push('✔ Réseaux sociaux (FB/IG) détectés');
  lines.push(`✔ Secteur : ${sectorFamily(criteria.sector || '', hit.industry || '')}`);
  if (exportSignal(criteria, hit.industry || '')) lines.push('✔ Signaux export / international');
  if (carbonSignal(criteria, hit.industry || '')) lines.push('✔ Angle bilan carbone / RSE possible');
  if (b2bSignal(hit, criteria)) lines.push('✔ Profil plutôt B2B');
  return lines.slice(0, 10);
}

export function heuristicQualify(
  hit: CompanySearchHit,
  criteria: CompanySearchCriteria,
  enrichment: WebEnrichmentResult | null
): LeadQualification {
  const e = enrichment;
  let score = 32;
  if (hit.website) score += 14;
  if (hit.linkedin || (e?.linkedinUrlsFound?.length ?? 0) > 0) score += 14;
  if (hit.email || (e?.detectedEmails?.length ?? 0) > 0) score += 10;
  if (hit.phone || e?.phoneFromPage) score += 6;
  if (e?.hasSsl) score += 6;
  if (e?.hasResponsiveWebsite) score += 5;
  if (e) score += Math.round((e.seoScore || 0) * 0.12);
  if (e?.facebookUrl || e?.instagramUrl) score += 4;
  if (e?.technologiesDetected?.length) score += Math.min(6, e.technologiesDetected.length * 2);
  const ind = `${hit.industry || ''} ${criteria.sector || ''}`.toLowerCase();
  if (ind.includes('btp') || ind.includes('industr') || ind.includes('agro')) score += 8;
  if (exportSignal(criteria, hit.industry || '')) score += 5;
  if (b2bSignal(hit, criteria)) score += 4;
  if (carbonSignal(criteria, hit.industry || '')) score += 3;
  if (!hit.linkedin && !(e?.linkedinUrlsFound?.length ?? 0)) score -= 6;
  if (e?.digitalPresenceLevel === 'FAIBLE' && hit.website) score -= 4;
  score = Math.max(0, Math.min(100, Math.round(score)));

  let potentialLevel: PotentialLevel = 'MOYEN';
  if (score >= 72) potentialLevel = 'TRES_FORT';
  else if (score < 48) potentialLevel = 'FAIBLE';

  const family = sectorFamily(criteria.sector || '', hit.industry || '');
  const summary = buildHeuristicSummary(hit, criteria, e, family);
  const bullets = buildScoreBullets(hit, criteria, e);
  const scoreReason = bullets.join('\n');

  const angle =
    potentialLevel === 'TRES_FORT'
      ? 'Court diagnostic pipeline + 1 cas client secteur, puis proposition d’atelier CRM.'
      : potentialLevel === 'MOYEN'
        ? 'Entrer par une douleur concrète : suivi des relances, visibilité des opportunités, ou automatisation devis.'
        : 'Approche ultra-ciblée : une question ouverte sur la priorité du trimestre, sans démo longue.';

  const problem =
    e?.digitalPresenceLevel === 'FAIBLE' || !hit.website
      ? 'Visibilité commerciale et pilotage des relances probablement fragmentés.'
      : 'Optimisation du pipeline et de la productivité commerciale (moins d’outils dispersés).';

  const offer =
    carbonSignal(criteria, hit.industry || '')
      ? 'Accompagnement CRM + module suivi RSE / bilan carbone simplifié pour la relation client.'
      : exportSignal(criteria, hit.industry || '')
        ? 'CRM adapté aux équipes export : suivi clients multi-pays, relances et documents centralisés.'
        : 'CRM PME : pipeline clair, relances automatiques, devis/factures reliés au suivi client.';

  return {
    score,
    potentialLevel,
    scoreReason,
    commercialAngle: angle,
    aiSummary: summary,
    suggestedPitch: `Bonjour — nous accompagnons des ${family} en ${hit.country || criteria.country || 'Maghreb'} sur le pilotage commercial et le CRM. Seriez-vous ouvert à un échange de 15 minutes ?`,
    interestProbability: Math.max(12, Math.min(92, score - 4 + (hit.email || e?.detectedEmails?.[0] ? 6 : 0))),
    aiTags: [
      family,
      criteria.country || hit.country || 'zone',
      hit.companySize || 'taille',
      e?.digitalPresenceLevel || 'digital',
    ].filter(Boolean) as string[],
    followUpPlan: [
      { dayOffset: 3, approach: 'Relance courte : rappel valeur + question métier.', tone: 'doux' },
      { dayOffset: 7, approach: 'Élément concret : capture d’écran pipeline ou chiffre secteur.', tone: 'commercial' },
      { dayOffset: 15, approach: 'Dernière prise de contact : créneau 20 min ou clôture polie.', tone: 'ferme' },
    ],
    probableBusinessProblem: problem,
    suggestedOffer: offer,
  };
}

async function callOpenAiJson(userPrompt: string): Promise<Partial<LeadQualification> | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const system = `Tu es un copilote commercial senior pour PME en Tunisie et Afrique du Nord.
Réponds UNIQUEMENT en JSON valide avec les clés :
score (nombre 0-100),
potentialLevel ("TRES_FORT"|"MOYEN"|"FAIBLE"),
scoreReason (string, 5 à 8 lignes courtes, chaque ligne commence par ✔ ou ❌ ou ❄️ pour expliquer le score : site, HTTPS, mobile, SEO, LinkedIn, réseaux, secteur, B2B, export, bilan carbone si pertinent),
commercialAngle (1 phrase : comment aborder le prospect),
probableBusinessProblem (1 phrase : douleur métier probable),
suggestedOffer (1 phrase : offre CRM / digital / carbone adaptée),
aiSummary (2 phrases max, ton humain et professionnel, précis sur ville/secteur/presence digitale — jamais "présence en ligne identifiable"),
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
      max_tokens: 1100,
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

function enrichmentBlock(hit: CompanySearchHit, e: WebEnrichmentResult | null): string {
  if (!e || (!hit.website && !e.fetchedUrl)) return '';
  return `
Enrichissement site (crawl léger) :
- Titre page : ${e.websiteTitle || '—'}
- Meta description : ${(e.websiteDescription || '—').slice(0, 280)}
- Emails détectés : ${e.detectedEmails.slice(0, 5).join(', ') || '—'}
- Tél page : ${e.phoneFromPage || '—'}
- LinkedIn trouvés : ${e.linkedinUrlsFound.join(', ') || '—'}
- Facebook : ${e.facebookUrl || '—'} | Instagram : ${e.instagramUrl || '—'}
- HTTPS : ${e.hasSsl} | Mobile viewport : ${e.hasResponsiveWebsite}
- Score SEO heuristique : ${e.seoScore}/100 | Niveau présence digitale : ${e.digitalPresenceLevel}
- Technologies : ${e.technologiesDetected.join(', ') || '—'}
- Erreur crawl (si any) : ${e.fetchError || 'aucune'}
`.trim();
}

export async function qualifyCompanyHit(
  hit: CompanySearchHit,
  criteria: CompanySearchCriteria,
  enrichment: WebEnrichmentResult | null = null
): Promise<LeadQualification> {
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
- Mots-clés: ${criteria.keywords || '—'}

${enrichmentBlock(hit, enrichment)}`;

  if (!useOpenAiScoring) {
    return heuristicQualify(hit, criteria, enrichment);
  }

  const j = await callOpenAiJson(userPrompt);
  const fallback = heuristicQualify(hit, criteria, enrichment);
  if (j && typeof j.score === 'number' && j.aiSummary && j.scoreReason) {
    const score = Math.max(0, Math.min(100, Math.round(j.score)));
    const pl = j.potentialLevel;
    const potentialLevel: PotentialLevel =
      pl === 'TRES_FORT' || pl === 'MOYEN' || pl === 'FAIBLE' ? pl : 'MOYEN';
    return {
      score,
      potentialLevel,
      scoreReason: String(j.scoreReason),
      commercialAngle: String(j.commercialAngle || fallback.commercialAngle),
      probableBusinessProblem: String(j.probableBusinessProblem || fallback.probableBusinessProblem),
      suggestedOffer: String(j.suggestedOffer || fallback.suggestedOffer),
      aiSummary: String(j.aiSummary),
      suggestedPitch: String(j.suggestedPitch || fallback.suggestedPitch),
      interestProbability: Math.max(0, Math.min(100, Number(j.interestProbability ?? score))),
      aiTags: Array.isArray(j.aiTags) ? j.aiTags.map(String).slice(0, 12) : fallback.aiTags,
      followUpPlan: Array.isArray(j.followUpPlan) && j.followUpPlan.length
        ? (j.followUpPlan as LeadQualification['followUpPlan']).slice(0, 5)
        : fallback.followUpPlan,
    };
  }
  return fallback;
}
