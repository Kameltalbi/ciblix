import type { Prisma } from '@prisma/client';
import { prisma } from '../../db/prisma.js';
import { upsertEntrepriseReferentiel } from './upsert.js';
import type { ReferentielUpsertInput } from './types.js';

export type ReferentielQueryCriteria = {
  sectors?: string[];
  zones?: string[];
  countries?: string[];
  keywords?: string[];
  excludeCompanyNames?: string[];
  minFraicheur?: number;
  take?: number;
};

/**
 * Interroge le référentiel pour un tenant (hors entreprises déjà en fiche / rejetées).
 */
export async function queryReferentielForTenant(
  organizationId: string,
  criteria: ReferentielQueryCriteria
): Promise<
  Array<{
    id: string;
    nomLegal: string;
    secteur: string | null;
    zoneGeographique: string | null;
    siteWeb: string | null;
    scoreFraicheur: number;
    telephoneStandard: string | null;
    emailGenerique: string | null;
  }>
> {
  // Sécurité : le référentiel a été pollué par des Hunt multi-tenant.
  // Ne plus auto-servir ces entrées à d’autres orgs (fuite de recherches).
  if (process.env.REFERENTIEL_CROSS_TENANT_SEED !== '1') {
    return [];
  }

  const take = Math.min(60, criteria.take || 40);
  const [linked, targeting] = await Promise.all([
    prisma.contact.findMany({
      where: {
        organizationId,
        erasedAt: null,
        entrepriseReferentielId: { not: null },
      },
      select: { entrepriseReferentielId: true },
    }),
    prisma.orgTargetingProfile.findUnique({
      where: { organizationId },
      select: { onboardingEvents: true, excludeCompanies: true },
    }),
  ]);
  const linkedIds = linked
    .map((c) => c.entrepriseReferentielId)
    .filter((id): id is string => Boolean(id));

  // Feedback « pas pour moi » / rejets onboarding → ne pas reproposer
  const rejectedNames = new Set<string>();
  for (const n of [
    ...(criteria.excludeCompanyNames || []),
    ...(targeting?.excludeCompanies || []),
  ]) {
    if (n.trim()) rejectedNames.add(n.trim().toLowerCase());
  }
  const events = Array.isArray(targeting?.onboardingEvents)
    ? (targeting!.onboardingEvents as Array<{ event?: string; companyName?: string | null }>)
    : [];
  for (const e of events) {
    if (e.event === 'prospect_reject' && e.companyName?.trim()) {
      rejectedNames.add(e.companyName.trim().toLowerCase());
    }
  }

  const orFilters: Prisma.EntrepriseReferentielWhereInput[] = [];
  for (const s of criteria.sectors || []) {
    if (s.trim()) orFilters.push({ secteur: { contains: s.trim(), mode: 'insensitive' } });
  }
  for (const z of [...(criteria.zones || []), ...(criteria.countries || [])]) {
    if (z.trim()) {
      orFilters.push({ zoneGeographique: { contains: z.trim(), mode: 'insensitive' } });
      orFilters.push({ paysImmatriculation: { contains: z.trim(), mode: 'insensitive' } });
    }
  }
  for (const k of criteria.keywords || []) {
    if (k.trim()) {
      orFilters.push({ nomLegal: { contains: k.trim(), mode: 'insensitive' } });
      orFilters.push({ secteur: { contains: k.trim(), mode: 'insensitive' } });
    }
  }

  const rows = await prisma.entrepriseReferentiel.findMany({
    where: {
      statutActivite: { in: ['ACTIVE', 'INCONNUE'] },
      scoreFraicheur: { gte: criteria.minFraicheur ?? 20 },
      ...(linkedIds.length ? { id: { notIn: linkedIds } } : {}),
      ...(orFilters.length ? { OR: orFilters } : {}),
    },
    orderBy: [{ scoreFraicheur: 'desc' }, { scoreConfianceGlobal: 'desc' }, { updatedAt: 'desc' }],
    take: take * 2,
    select: {
      id: true,
      nomLegal: true,
      secteur: true,
      zoneGeographique: true,
      siteWeb: true,
      scoreFraicheur: true,
      telephoneStandard: true,
      emailGenerique: true,
    },
  });

  return rows
    .filter((r) => {
      const name = r.nomLegal.toLowerCase();
      for (const e of rejectedNames) {
        if (e && name.includes(e)) return false;
      }
      return true;
    })
    .slice(0, take);
}

/**
 * Crée / rattache une fiche Contact (couche 2) à une entrée référentiel (couche 1).
 * Par défaut : identité + lien seulement — JAMAIS de téléphone/email du référentiel
 * (données souvent issues d’un Hunt d’un autre tenant).
 */
export async function linkReferentielToTenantFiche(opts: {
  organizationId: string;
  entrepriseId: string;
  createdVia?: 'HUNT' | 'SCOUT' | 'MANUAL_IMPORT';
  /** @deprecated dangereux cross-tenant — rester à false */
  copyCoordinates?: boolean;
}): Promise<{ contactId: string; created: boolean }> {
  const ent = await prisma.entrepriseReferentiel.findUniqueOrThrow({
    where: { id: opts.entrepriseId },
  });

  const existing = await prisma.contact.findFirst({
    where: {
      organizationId: opts.organizationId,
      erasedAt: null,
      OR: [
        { entrepriseReferentielId: ent.id },
        { companyName: { equals: ent.nomLegal, mode: 'insensitive' } },
      ],
    },
  });
  if (existing) {
    if (!existing.entrepriseReferentielId) {
      await prisma.contact.update({
        where: { id: existing.id },
        data: { entrepriseReferentielId: ent.id },
      });
    }
    return { contactId: existing.id, created: false };
  }

  const copyCoords = opts.copyCoordinates === true;

  const created = await prisma.contact.create({
    data: {
      organizationId: opts.organizationId,
      name: ent.nomLegal,
      companyName: ent.nomLegal,
      email: copyCoords ? ent.emailGenerique : null,
      phone: copyCoords ? ent.telephoneStandard : null,
      createdVia: opts.createdVia || 'HUNT',
      entrepriseReferentielId: ent.id,
      ficheEtat: 'DECOUVERTE',
      ficheEtatAt: new Date(),
      ficheData: {
        identite_entreprise: { nom_legal: ent.nomLegal },
        source_decouverte: {
          source: 'referentiel',
          url: ent.siteWeb,
          at: new Date().toISOString(),
        },
        secteur_declare: ent.secteur,
        zone_geographique: ent.zoneGeographique,
        critere_de_match: 'referentiel_icp',
      } as object,
    },
  });
  return { contactId: created.id, created: true };
}

export async function ingestPublicCompanyFromHunt(hit: {
  companyName: string;
  website?: string | null;
  city?: string | null;
  country?: string | null;
  industry?: string | null;
  phone?: string | null;
  email?: string | null;
  companySize?: string | null;
}): Promise<string> {
  const input: ReferentielUpsertInput = {
    nomLegal: hit.companyName,
    siteWeb: hit.website,
    zoneGeographique: [hit.city, hit.country].filter(Boolean).join(', ') || null,
    paysImmatriculation: hit.country || null,
    secteur: hit.industry || null,
    // Isolation tenant : jamais de coords Hunt dans le pool partagé
    telephoneStandard: null,
    emailGenerique: null,
    tailleEstimee: hit.companySize || null,
    source: {
      type_source: 'annuaire',
      url: hit.website || null,
      date_collecte: new Date().toISOString(),
    },
  };
  const r = await upsertEntrepriseReferentiel(input);
  return r.id;
}
