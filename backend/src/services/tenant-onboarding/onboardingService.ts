import type { Prisma } from '@prisma/client';
import { prisma } from '../../db/prisma.js';
import { getOrCreateMissionProfile } from '../agent-team/missionService.js';
import { extractTenantProfile } from './extractTenantProfile.js';
import { buildInverseIcp } from './inverseIcp.js';
import { buildOfferSheetDraft, isOfferSheetValidated } from './offerSheet.js';
import type {
  ExtractedTenantProfile,
  IdentitySourceType,
  InverseIcp,
  LearnedPrefs,
  OfferSheet,
  ProspectFeedbackMotif,
} from './types.js';
import { GEO_ZONE_PRESETS } from './types.js';

function asEvents(raw: unknown): Array<Record<string, unknown>> {
  return Array.isArray(raw) ? (raw as Array<Record<string, unknown>>) : [];
}

async function pushEvent(organizationId: string, event: string, meta?: Record<string, unknown>) {
  const profile = await getOrCreateMissionProfile(organizationId);
  const events = [
    ...asEvents(profile.onboardingEvents),
    { event, at: new Date().toISOString(), ...meta },
  ].slice(-80);
  await prisma.orgTargetingProfile.update({
    where: { organizationId },
    data: { onboardingEvents: events as Prisma.InputJsonValue },
  });
}

export { GEO_ZONE_PRESETS, isOfferSheetValidated };

/**
 * Étape 1→2 : 3 champs → extraction + ICP inversé + brouillon offre.
 */
export async function runOnboardingBootstrap(
  organizationId: string,
  input: {
    sourceType: IdentitySourceType;
    sourceUrl?: string | null;
    sourceLabel?: string | null;
    freeText?: string | null;
    referenceClients: string[];
    geoZonePresets: string[];
    customGeo?: string[];
  }
) {
  await pushEvent(organizationId, 'step1_submitted');

  const { profile: extracted, progress } = await extractTenantProfile({
    sourceType: input.sourceType,
    sourceUrl: input.sourceUrl,
    sourceLabel: input.sourceLabel,
    freeText: input.freeText,
  });
  await pushEvent(organizationId, 'extraction_done', {
    services: extracted.services_et_produits.value?.length || 0,
  });

  const geo = [
    ...input.geoZonePresets.filter((g) => g !== 'Personnalisé'),
    ...(input.customGeo || []),
  ].filter(Boolean);

  const icp = await buildInverseIcp({
    referenceClients: input.referenceClients,
    geoZones: geo.length ? geo : ['Tunisie'],
    extracted,
  });
  await pushEvent(organizationId, 'icp_ready', { confiance: icp.confiance });

  const offerDraft = buildOfferSheetDraft(extracted);
  const briefParts = [
    extracted.nom_legal.value,
    extracted.proposition_de_valeur.value,
    (extracted.services_et_produits.value || []).join(', '),
    input.freeText,
  ]
    .filter(Boolean)
    .join('\n')
    .slice(0, 4000);

  const countries = geo.includes('Tunisie') || geo.some((g) => /tunis/i.test(g))
    ? ['Tunisie']
    : geo.slice(0, 5);
  const idealProfiles = (icp.fonde_sur.length ? icp.fonde_sur : input.referenceClients.slice(0, 3)).map(
    (name, i) => ({
      id: `icp_${i}`,
      name,
      description: icp.texte_naturel,
      importance: 4,
      sector: icp.secteurs_cibles[0] || undefined,
      companySize:
        icp.taille_min && icp.taille_max ? `${icp.taille_min}-${icp.taille_max}` : undefined,
    })
  );

  const updated = await prisma.orgTargetingProfile.update({
    where: { organizationId },
    data: {
      missionStatus: 'DRAFT',
      missionStep: 3,
      identitySourceType: input.sourceType,
      identitySourceUrl: input.sourceUrl || null,
      identitySourceLabel: input.sourceLabel || null,
      referenceClients: input.referenceClients.filter(Boolean).slice(0, 8),
      geoZonePresets: input.geoZonePresets,
      extractedTenantProfile: extracted as unknown as Prisma.InputJsonValue,
      inverseIcp: icp as unknown as Prisma.InputJsonValue,
      inverseIcpText: icp.texte_naturel,
      offerSheet: offerDraft as unknown as Prisma.InputJsonValue,
      companyBrief: briefParts || input.freeText || 'Mission en cours',
      countries: countries.length ? countries : ['Tunisie'],
      cities: [],
      regions: geo.filter((g) => !countries.includes(g)),
      markets: geo,
      sectors: icp.secteurs_cibles,
      targetClients: input.referenceClients,
      idealProfiles: idealProfiles as unknown as Prisma.InputJsonValue,
      productsServices: extracted.services_et_produits.value || [],
      keywords: [
        ...(extracted.services_et_produits.value || []),
        ...icp.secteurs_cibles,
        ...icp.signaux_positifs,
      ].slice(0, 20),
      detectSignals:
        icp.signaux_positifs.length > 0
          ? ['hiring', 'new_projects', 'investments', 'tenders'].slice(0, 4)
          : ['tenders', 'hiring', 'new_projects', 'investments'],
      commercialPriorities: icp.texte_naturel.slice(0, 500),
      ttfrlStartedAt: new Date(),
      activity: extracted.proposition_de_valeur.value || briefParts.slice(0, 500),
    },
  });

  return { profile: updated, extracted, icp, offerDraft, progress };
}

export async function confirmInverseIcp(
  organizationId: string,
  patch: Partial<InverseIcp> & { accepted: boolean }
) {
  const current = await getOrCreateMissionProfile(organizationId);
  const prev = (current.inverseIcp || {}) as InverseIcp;
  const next: InverseIcp = {
    ...prev,
    ...patch,
    texte_naturel: patch.texte_naturel || prev.texte_naturel,
  };
  await pushEvent(organizationId, patch.accepted ? 'icp_accepted' : 'icp_adjusted');

  return prisma.orgTargetingProfile.update({
    where: { organizationId },
    data: {
      inverseIcp: next as unknown as Prisma.InputJsonValue,
      inverseIcpText: next.texte_naturel,
      sectors: next.secteurs_cibles,
      markets: next.zones,
      countries: next.zones.filter((z) => /tunisie|france|maroc|alger|senegal|cote/i.test(z)).length
        ? next.zones.filter((z) => /tunisie|france|maroc|alger|senegal|cote/i.test(z))
        : current.countries,
      missionStep: 4,
    },
  });
}

export async function validateOfferSheet(
  organizationId: string,
  userId: string,
  sheet: OfferSheet
) {
  const services = (sheet.services_valides || []).filter((s) => s.valide_par_tenant && s.libelle.trim());
  if (!services.length) {
    throw new Error('OFFER_SHEET_EMPTY');
  }
  const validated: OfferSheet = {
    services_valides: services,
    proposition_de_valeur: sheet.proposition_de_valeur || '',
    validee_le: new Date().toISOString(),
    validee_par: userId,
  };
  await pushEvent(organizationId, 'offer_validated', { n: services.length });

  return prisma.orgTargetingProfile.update({
    where: { organizationId },
    data: {
      offerSheet: validated as unknown as Prisma.InputJsonValue,
      offerValidatedAt: new Date(),
      offerValidatedBy: userId,
      productsServices: services.map((s) => s.libelle),
      activity: validated.proposition_de_valeur || undefined,
      missionStep: Math.max(4, (await getOrCreateMissionProfile(organizationId)).missionStep),
    },
  });
}

export async function recordProspectFeedback(opts: {
  organizationId: string;
  pertinent: boolean;
  motif?: ProspectFeedbackMotif | null;
  companyName?: string | null;
}) {
  const profile = await getOrCreateMissionProfile(opts.organizationId);
  const prefs = (profile.learnedPrefs || {}) as LearnedPrefs;
  const exclusions = [...(prefs.criteres_exclusion || [])];
  let rejets = prefs.rejets_count || 0;

  if (!opts.pertinent && opts.motif) {
    rejets += 1;
    const map: Record<ProspectFeedbackMotif, string> = {
      trop_petite: 'entreprises trop petites',
      trop_grande: 'entreprises trop grandes',
      mauvais_secteur: 'mauvais secteur',
      mauvaise_zone: 'mauvaise zone',
      deja_client: 'déjà client',
      concurrent: 'concurrent',
      autre: 'autre',
    };
    const label = map[opts.motif];
    const countSame = asEvents(profile.onboardingEvents).filter(
      (e) => e.event === 'prospect_reject' && e.motif === opts.motif
    ).length;
    // Après 3 rejets convergents → proposer règle (stockée, confirmation UI)
    if (countSame + 1 >= 3 && !exclusions.includes(label)) {
      exclusions.push(label);
    }
  }

  const events = [
    ...asEvents(profile.onboardingEvents),
    {
      event: opts.pertinent ? 'prospect_relevant' : 'prospect_reject',
      at: new Date().toISOString(),
      motif: opts.motif || null,
      companyName: opts.companyName || null,
    },
  ].slice(-80);

  const learned: LearnedPrefs = {
    ...prefs,
    criteres_exclusion: exclusions,
    rejets_count: rejets,
  };

  await prisma.orgTargetingProfile.update({
    where: { organizationId: opts.organizationId },
    data: {
      learnedPrefs: learned as unknown as Prisma.InputJsonValue,
      onboardingEvents: events as Prisma.InputJsonValue,
      excludeSectors:
        opts.motif === 'mauvais_secteur' && opts.companyName
          ? [...new Set([...profile.excludeSectors, 'à affiner'])]
          : profile.excludeSectors,
    },
  });

  return {
    learned,
    proposeExclusionRule: !opts.pertinent && exclusions.length > (prefs.criteres_exclusion || []).length,
    exclusionProposed: exclusions[exclusions.length - 1] || null,
  };
}

export async function markTtfrlFirstLead(organizationId: string) {
  const profile = await prisma.orgTargetingProfile.findUnique({ where: { organizationId } });
  if (!profile || profile.ttfrlFirstLeadAt) return;
  await prisma.orgTargetingProfile.update({
    where: { organizationId },
    data: { ttfrlFirstLeadAt: new Date() },
  });
  await pushEvent(organizationId, 'ttfrl_first_lead', {
    ms:
      profile.ttfrlStartedAt != null
        ? Date.now() - new Date(profile.ttfrlStartedAt).getTime()
        : null,
  });
}

export function parseExtracted(raw: unknown): ExtractedTenantProfile | null {
  if (!raw || typeof raw !== 'object') return null;
  return raw as ExtractedTenantProfile;
}

export function parseOfferSheet(raw: unknown): OfferSheet | null {
  if (!raw || typeof raw !== 'object') return null;
  return raw as OfferSheet;
}
