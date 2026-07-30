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
 * Isolation absolue : le référentiel mutualisé ne sert PLUS de source de prospects.
 */
export async function queryReferentielForTenant(
  _organizationId: string,
  _criteria: ReferentielQueryCriteria
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
  return [];
}

/**
 * @deprecated Pont référentiel → fiche désactivé (isolation absolue).
 */
export async function linkReferentielToTenantFiche(_opts: {
  organizationId: string;
  entrepriseId: string;
  createdVia?: 'HUNT' | 'SCOUT' | 'MANUAL_IMPORT';
  copyCoordinates?: boolean;
}): Promise<{ contactId: string; created: boolean }> {
  throw new Error('REFERENTIEL_TENANT_LINK_DISABLED');
}

/**
 * @deprecated Hunt n’écrit plus dans le catalogue partagé.
 */
export async function ingestPublicCompanyFromHunt(_hit: {
  companyName: string;
  website?: string | null;
  city?: string | null;
  country?: string | null;
  industry?: string | null;
  phone?: string | null;
  email?: string | null;
  companySize?: string | null;
}): Promise<string> {
  throw new Error('REFERENTIEL_HUNT_INGEST_DISABLED');
}

/** Réservé admin / imports officiels sous bypass RLS — pas Hunt. */
export async function adminUpsertReferentielPublic(input: {
  nomLegal: string;
  siteWeb?: string | null;
  zoneGeographique?: string | null;
  paysImmatriculation?: string | null;
  secteur?: string | null;
  tailleEstimee?: string | null;
}): Promise<string> {
  const { upsertEntrepriseReferentiel } = await import('./upsert.js');
  const r = await upsertEntrepriseReferentiel({
    nomLegal: input.nomLegal,
    siteWeb: input.siteWeb,
    zoneGeographique: input.zoneGeographique,
    paysImmatriculation: input.paysImmatriculation,
    secteur: input.secteur,
    telephoneStandard: null,
    emailGenerique: null,
    tailleEstimee: input.tailleEstimee,
    source: {
      type_source: 'annuaire',
      url: input.siteWeb || null,
      date_collecte: new Date().toISOString(),
    },
  });
  return r.id;
}
