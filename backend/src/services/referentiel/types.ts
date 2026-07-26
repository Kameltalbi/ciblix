/**
 * Couche 1 — référentiel mutualisé.
 * INTERDIT d’y écrire : personnes physiques, emails nominatifs, scores/historique tenant.
 */

export const REFERENTIEL_ALLOWED_FIELDS = [
  'identifiantNational',
  'paysImmatriculation',
  'nomLegal',
  'nomsAlternatifs',
  'secteur',
  'codeActivite',
  'adresseSiege',
  'zoneGeographique',
  'siteWeb',
  'siteWebDomain',
  'presenceDigitale',
  'telephoneStandard',
  'emailGenerique',
  'tailleEstimee',
  'anneeCreation',
  'statutActivite',
  'sources',
  'fieldProvenance',
  'dateDerniereVerification',
  'scoreFraicheur',
  'scoreConfianceGlobal',
  'nomNormalise',
] as const;

/** Champs qui ne doivent JAMAIS exister sur entreprises_referentiel. */
export const REFERENTIEL_FORBIDDEN_FIELDS = [
  'decideur',
  'decideur_contacte',
  'nom_dirigeant',
  'email_nominatif',
  'prenom',
  'telephone_mobile',
  'telephone_personnel',
  'whatsapp',
  'score_fit',
  'besoin_detecte',
  'historique_interactions',
  'statut_deal',
  'prochaine_action',
  'objections_detectees',
  'montant_potentiel',
  'notes_libres',
  'receptivite',
  'solvabilite',
] as const;

export type ReferentielSourceType =
  | 'registre_officiel'
  | 'site_officiel'
  | 'appel_offres'
  | 'annuaire'
  | 'reseau_social'
  | 'signalement_tenant';

export type ReferentielSource = {
  url?: string | null;
  type_source: ReferentielSourceType;
  date_collecte: string;
};

export type FieldProvenanceEntry = {
  valeur: unknown;
  source: ReferentielSource;
  confiance: number;
};

export type ReferentielUpsertInput = {
  identifiantNational?: string | null;
  paysImmatriculation?: string | null;
  nomLegal: string;
  nomsAlternatifs?: string[];
  secteur?: string | null;
  codeActivite?: string | null;
  adresseSiege?: string | null;
  zoneGeographique?: string | null;
  siteWeb?: string | null;
  presenceDigitale?: unknown;
  telephoneStandard?: string | null;
  emailGenerique?: string | null;
  tailleEstimee?: string | null;
  anneeCreation?: number | null;
  statutActivite?: 'ACTIVE' | 'CESSEE' | 'EN_LIQUIDATION' | 'INCONNUE';
  source: ReferentielSource;
};

export class ForbiddenReferentielFieldError extends Error {
  constructor(public readonly fields: string[]) {
    super(`Champs interdits dans le référentiel mutualisé : ${fields.join(', ')}`);
    this.name = 'ForbiddenReferentielFieldError';
  }
}

export function assertNoForbiddenReferentielFields(payload: Record<string, unknown>): void {
  const forbidden = Object.keys(payload).filter((k) =>
    (REFERENTIEL_FORBIDDEN_FIELDS as readonly string[]).includes(k)
  );
  if (forbidden.length) throw new ForbiddenReferentielFieldError(forbidden);
}

/** Email générique uniquement (contact@, info@, …) — sinon null. */
export function onlyGenericEmail(email: string | null | undefined): string | null {
  if (!email?.trim()) return null;
  const e = email.trim().toLowerCase();
  const local = e.split('@')[0] || '';
  const allowed = /^(contact|info|hello|accueil|admin|office|commercial|sales|support)$/i;
  if (!allowed.test(local)) return null;
  return e;
}

/** Téléphone standard — rejette si clairement un mobile perso (heuristique légère). */
export function onlyStandardPhone(phone: string | null | undefined): string | null {
  if (!phone?.trim()) return null;
  return phone.trim().slice(0, 40);
}
