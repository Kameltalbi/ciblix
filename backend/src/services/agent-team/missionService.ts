import type { OrgTargetingProfile, Prisma } from '@prisma/client';
import { prisma } from '../../db/prisma.js';
import {
  DETECT_SIGNAL_OPTIONS,
  isMissionActive,
  type ExtractedInsights,
  type IdealClientProfile,
} from './missionConstants.js';
import { enqueueAgentTask } from './agentTaskService.js';

export { isMissionActive, DETECT_SIGNAL_OPTIONS };

async function callOpenAiJson(system: string, user: string): Promise<Record<string, unknown> | null> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        temperature: 0.2,
        max_tokens: 1200,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const raw = data.choices?.[0]?.message?.content?.trim() || '';
    const cleaned = raw.replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
    return JSON.parse(cleaned) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function heuristicExtract(brief: string): ExtractedInsights {
  const words = brief
    .toLowerCase()
    .split(/[^a-zàâäéèêëïîôùûüç0-9+]+/i)
    .filter((w) => w.length > 3);
  const uniq = [...new Set(words)].slice(0, 16);
  return {
    sectors: uniq.slice(0, 4),
    products: uniq.slice(0, 3),
    services: uniq.slice(3, 6),
    technologies: [],
    needs: [],
    synonyms: uniq.slice(6, 10),
    categories: [],
    keywords: uniq,
    potentialExclusions: [],
  };
}

export async function extractInsightsFromBrief(brief: string): Promise<ExtractedInsights> {
  const system = `Tu es l'analyste Mission IA de Ciblix. Extrais un profil de prospection depuis une description d'entreprise.
Réponds UNIQUEMENT en JSON :
{"sectors":[],"products":[],"services":[],"technologies":[],"needs":[],"synonyms":[],"categories":[],"keywords":[],"potentialExclusions":[]}
Langue : français. Listes courtes (max 12 éléments).`;
  const parsed = await callOpenAiJson(system, brief);
  if (!parsed) return heuristicExtract(brief);
  const arr = (k: string) =>
    Array.isArray(parsed[k]) ? (parsed[k] as unknown[]).map(String).filter(Boolean).slice(0, 12) : [];
  return {
    sectors: arr('sectors'),
    products: arr('products'),
    services: arr('services'),
    technologies: arr('technologies'),
    needs: arr('needs'),
    synonyms: arr('synonyms'),
    categories: arr('categories'),
    keywords: arr('keywords'),
    potentialExclusions: arr('potentialExclusions'),
  };
}

export async function buildMissionSummary(profile: OrgTargetingProfile): Promise<string> {
  const signals = profile.detectSignals
    .map((id) => DETECT_SIGNAL_OPTIONS.find((s) => s.id === id)?.labelFr || id)
    .filter(Boolean);
  const profiles = (Array.isArray(profile.idealProfiles)
    ? profile.idealProfiles
    : []) as IdealClientProfile[];
  const geos = [...profile.countries, ...profile.regions, ...profile.cities].filter(Boolean);

  const system = `Tu résumes une Mission IA Ciblix pour un dirigeant.
Style clair, puces avec le caractère •, français professionnel.
INTERDIT : markdown (**gras**, *italique*, # titres, backticks). Texte brut uniquement.`;
  const user = JSON.stringify({
    brief: profile.companyBrief,
    geos,
    idealProfiles: profiles.map((p) => ({ name: p.name, importance: p.importance })),
    signals,
    priorities: profile.commercialPriorities,
    exclusions: {
      companies: profile.excludeCompanies,
      clients: profile.excludeClients,
      competitors: profile.excludeCompetitors,
    },
  });
  const parsed = await callOpenAiJson(
    system + ` JSON: {"summary":"texte multi-lignes avec puces •, sans markdown"}`,
    user
  );
  if (parsed?.summary && typeof parsed.summary === 'string') {
    return stripAiMarkdown(parsed.summary);
  }

  const lines = [
    'Votre équipe IA recherchera principalement :',
    ...geos.slice(0, 5).map((g) => `• des opportunités en ${g}`),
    ...profiles.slice(0, 4).map((p) => `• ${p.name}${p.importance >= 4 ? ' (prioritaire)' : ''}`),
    '',
    'Les agents surveilleront :',
    ...signals.slice(0, 8).map((s) => `• ${s}`),
  ];
  if (profile.commercialPriorities?.trim()) {
    lines.push('', `Priorité : ${profile.commercialPriorities.trim()}`);
  }
  return lines.join('\n');
}

/** Retire le markdown « gadget » (**gras**, *italique*, titres) des textes LLM. */
export function stripAiMarkdown(text: string): string {
  return text
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/\*([^*\n]+)\*/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/`([^`]+)`/g, '$1')
    .trim();
}

export async function getOrCreateMissionProfile(organizationId: string): Promise<OrgTargetingProfile> {
  return prisma.orgTargetingProfile.upsert({
    where: { organizationId },
    create: {
      organizationId,
      missionStatus: 'NONE',
      missionStep: 1,
      orchestratorEnabled: false,
    },
    update: {},
  });
}

export type MissionDraftPatch = {
  missionStep?: number;
  companyBrief?: string | null;
  extractedInsights?: ExtractedInsights | null;
  countries?: string[];
  regions?: string[];
  cities?: string[];
  markets?: string[];
  idealProfiles?: IdealClientProfile[];
  detectSignals?: string[];
  commercialPriorities?: string | null;
  excludeCompanies?: string[];
  excludeClients?: string[];
  excludeCompetitors?: string[];
  excludePartners?: string[];
  excludeSectors?: string[];
  excludeCountries?: string[];
  activity?: string | null;
  productsServices?: string[];
  sectors?: string[];
  keywords?: string[];
  targetClients?: string[];
};

export async function saveMissionDraft(
  organizationId: string,
  patch: MissionDraftPatch
): Promise<OrgTargetingProfile> {
  const current = await getOrCreateMissionProfile(organizationId);
  if (current.missionStatus === 'ACTIVE') {
    // Édition d’une mission active = reste ACTIVE, sync agents
  }

  const data: Prisma.OrgTargetingProfileUpdateInput = {
    missionStatus: current.missionStatus === 'ACTIVE' ? 'ACTIVE' : 'DRAFT',
  };

  if (patch.missionStep != null) data.missionStep = Math.min(7, Math.max(1, patch.missionStep));
  if (patch.companyBrief !== undefined) data.companyBrief = patch.companyBrief;
  if (patch.extractedInsights !== undefined) {
    data.extractedInsights = patch.extractedInsights as Prisma.InputJsonValue;
  }
  if (patch.countries) data.countries = patch.countries;
  if (patch.regions) data.regions = patch.regions;
  if (patch.cities) data.cities = patch.cities;
  if (patch.markets) data.markets = patch.markets;
  if (patch.idealProfiles) data.idealProfiles = patch.idealProfiles as unknown as Prisma.InputJsonValue;
  if (patch.detectSignals) data.detectSignals = patch.detectSignals;
  if (patch.commercialPriorities !== undefined) data.commercialPriorities = patch.commercialPriorities;
  if (patch.excludeCompanies) data.excludeCompanies = patch.excludeCompanies;
  if (patch.excludeClients) data.excludeClients = patch.excludeClients;
  if (patch.excludeCompetitors) data.excludeCompetitors = patch.excludeCompetitors;
  if (patch.excludePartners) data.excludePartners = patch.excludePartners;
  if (patch.excludeSectors) data.excludeSectors = patch.excludeSectors;
  if (patch.excludeCountries) data.excludeCountries = patch.excludeCountries;
  if (patch.activity !== undefined) data.activity = patch.activity;
  if (patch.productsServices) data.productsServices = patch.productsServices;
  if (patch.sectors) data.sectors = patch.sectors;
  if (patch.keywords) data.keywords = patch.keywords;
  if (patch.targetClients) data.targetClients = patch.targetClients;

  return prisma.orgTargetingProfile.update({
    where: { organizationId },
    data,
  });
}

async function syncScoutFromMission(profile: OrgTargetingProfile): Promise<void> {
  const insights = (profile.extractedInsights || {}) as Partial<ExtractedInsights>;
  const keywords = [
    ...profile.keywords,
    ...(insights.keywords || []),
    ...(insights.synonyms || []),
  ].filter(Boolean);
  const uniqKw = [...new Set(keywords)].slice(0, 20);
  const sectors = [...new Set([...profile.sectors, ...(insights.sectors || [])])].slice(0, 12);
  const geoZones = [
    ...profile.countries,
    ...profile.regions,
    ...profile.cities,
    ...profile.markets,
  ].filter(Boolean);

  const signals = new Set(profile.detectSignals);
  const scoutData = {
    keywords: uniqKw.length ? uniqKw : ['opportunité'],
    sectors,
    geoZones: geoZones.length ? geoZones : ['Tunisie'],
    tenderEnabled: signals.has('tenders'),
    eventEnabled: signals.has('new_projects') || signals.has('partnerships') || signals.has('openings'),
    newsEnabled:
      signals.has('news') ||
      signals.has('investments') ||
      signals.has('hiring') ||
      signals.has('esg') ||
      signals.size === 0,
    autoScanEnabled: profile.missionStatus === 'ACTIVE',
    scanIntervalH: Math.max(6, profile.orchestratorIntervalH),
  };

  await prisma.scoutProfile.upsert({
    where: { organizationId: profile.organizationId },
    create: {
      organizationId: profile.organizationId,
      ...scoutData,
      keywords: scoutData.keywords as object,
      sectors: scoutData.sectors as object,
      geoZones: scoutData.geoZones as object,
    },
    update: {
      keywords: scoutData.keywords as object,
      sectors: scoutData.sectors as object,
      geoZones: scoutData.geoZones as object,
      tenderEnabled: scoutData.tenderEnabled,
      eventEnabled: scoutData.eventEnabled,
      newsEnabled: scoutData.newsEnabled,
      autoScanEnabled: scoutData.autoScanEnabled,
      scanIntervalH: scoutData.scanIntervalH,
    },
  });
}

export async function activateMission(organizationId: string): Promise<OrgTargetingProfile> {
  const profile = await getOrCreateMissionProfile(organizationId);
  if (!profile.companyBrief?.trim() || profile.companyBrief.trim().length < 20) {
    throw new Error('MISSION_BRIEF_REQUIRED');
  }
  if (!profile.countries.length && !profile.cities.length && !profile.regions.length) {
    throw new Error('MISSION_MARKETS_REQUIRED');
  }
  const ideal = (Array.isArray(profile.idealProfiles) ? profile.idealProfiles : []) as IdealClientProfile[];
  if (!ideal.some((p) => p.name?.trim())) {
    throw new Error('MISSION_PROFILES_REQUIRED');
  }
  if (!profile.detectSignals.length) {
    throw new Error('MISSION_SIGNALS_REQUIRED');
  }

  const insights = (profile.extractedInsights || {}) as Partial<ExtractedInsights>;
  const products = insights.products || profile.productsServices;
  const keywords = [...new Set([...(insights.keywords || []), ...profile.keywords])];
  const sectors = [...new Set([...(insights.sectors || []), ...profile.sectors])];
  const targetClients = ideal.map((p) => p.name).filter(Boolean);
  const excludes = [
    ...profile.excludeCompanies,
    ...(insights.potentialExclusions || []),
  ];

  let summary = profile.missionSummary;
  const withSync = await prisma.orgTargetingProfile.update({
    where: { organizationId },
    data: {
      activity: profile.companyBrief,
      productsServices: products.length ? products : profile.productsServices,
      keywords: keywords.length ? keywords : profile.keywords,
      sectors: sectors.length ? sectors : profile.sectors,
      targetClients: targetClients.length ? targetClients : profile.targetClients,
      excludeCompanies: [...new Set(excludes)],
      markets: profile.markets.length ? profile.markets : profile.countries,
    },
  });

  summary = await buildMissionSummary(withSync);

  const activated = await prisma.orgTargetingProfile.update({
    where: { organizationId },
    data: {
      missionStatus: 'ACTIVE',
      missionStep: 7,
      missionCompletedAt: new Date(),
      missionSummary: summary,
      orchestratorEnabled: true,
      lastOrchestratorAt: null,
    },
  });

  await syncScoutFromMission(activated);

  await enqueueAgentTask({
    organizationId,
    assignee: 'SCOUT',
    kind: 'WATCH_SIGNALS',
    priority: 95,
    dedupeKey: `watch:mission:${organizationId}:${Date.now()}`,
    payload: { triggeredBy: 'mission_activate' },
  });

  void import('./orchestrator.js').then(({ runOrchestratorTickNow }) => runOrchestratorTickNow());

  return activated;
}

/** Après édition d’une mission ACTIVE — resync sans forcément relancer un scan immédiat. */
export async function applyMissionUpdate(organizationId: string): Promise<OrgTargetingProfile> {
  const profile = await getOrCreateMissionProfile(organizationId);
  if (!isMissionActive(profile)) return profile;

  const summary = await buildMissionSummary(profile);
  const updated = await prisma.orgTargetingProfile.update({
    where: { organizationId },
    data: {
      missionSummary: summary,
      activity: profile.companyBrief || profile.activity,
      lastOrchestratorAt: null,
      orchestratorEnabled: true,
    },
  });
  await syncScoutFromMission(updated);
  return updated;
}

export async function getMissionStatus(organizationId: string) {
  const profile = await prisma.orgTargetingProfile.findUnique({
    where: { organizationId },
  });
  return {
    configured: isMissionActive(profile),
    status: profile?.missionStatus || 'NONE',
    step: profile?.missionStep || 1,
    completedAt: profile?.missionCompletedAt?.toISOString() || null,
    summary: profile?.missionSummary || null,
    orchestratorEnabled: profile?.orchestratorEnabled ?? false,
  };
}
