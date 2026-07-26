/**
 * Types onboarding tenant — ICP inversé + fiche offre validée.
 * Règle : aucun champ extrait sans source + confiance.
 */

export const GEO_ZONE_PRESETS = [
  'Tunisie',
  'Maghreb',
  'Afrique de l’Ouest',
  'Afrique Centrale',
  'Europe',
  'Personnalisé',
] as const;

export type GeoZonePreset = (typeof GEO_ZONE_PRESETS)[number];

export type IdentitySourceType =
  | 'website'
  | 'facebook'
  | 'linkedin'
  | 'pdf'
  | 'name_brief';

export type SourcedField<T = string> = {
  value: T | null;
  source: string | null;
  confidence: number; // 0–1
  /** true si non extractible — JAMAIS rempli par inférence */
  empty: boolean;
};

export type ExtractedTenantProfile = {
  nom_legal: SourcedField;
  noms_commerciaux: SourcedField<string[]>;
  secteur_activite: SourcedField;
  services_et_produits: SourcedField<string[]>;
  proposition_de_valeur: SourcedField;
  zone_actuelle_d_activite: SourcedField;
  langues_utilisees: SourcedField<string[]>;
  ton_editorial_apparent: SourcedField<'formel' | 'direct' | 'chaleureux' | string>;
  email_public: SourcedField;
  telephone_public: SourcedField;
  adresse_publique: SourcedField;
  canaux_presents: SourcedField<string[]>;
  raw_text_chars?: number;
  extracted_at: string;
};

export type InverseIcp = {
  secteurs_cibles: string[];
  taille_min: number | null;
  taille_max: number | null;
  zones: string[];
  type_acheteur: 'prive' | 'public' | 'mixte' | 'informel' | string;
  signaux_positifs: string[];
  confiance: number;
  fonde_sur: string[];
  clients_atypiques_exclus: string[];
  texte_naturel: string;
  fallback_from_offer: boolean;
};

export type OfferServiceItem = {
  libelle: string;
  description_courte: string;
  cible_typique: string;
  valide_par_tenant: boolean;
  source_extraction: string | null;
};

export type OfferSheet = {
  services_valides: OfferServiceItem[];
  proposition_de_valeur: string;
  validee_le: string | null;
  validee_par: string | null;
};

export type LearnedPrefs = {
  ton_de_marque?: 'formel' | 'direct' | 'chaleureux';
  criteres_exclusion?: string[];
  canal_prefere?: 'whatsapp' | 'email' | 'linkedin';
  seuil_score_fit?: number;
  langue_par_defaut?: string;
  corrections_ton?: number;
  rejets_count?: number;
};

export type ProspectFeedbackMotif =
  | 'trop_petite'
  | 'trop_grande'
  | 'mauvais_secteur'
  | 'mauvaise_zone'
  | 'deja_client'
  | 'concurrent'
  | 'autre';

export function emptySourced<T = string>(source: string | null = null): SourcedField<T> {
  return { value: null, source, confidence: 0, empty: true };
}

export function sourced<T>(
  value: T | null | undefined,
  source: string | null,
  confidence: number
): SourcedField<T> {
  if (value == null || value === '' || (Array.isArray(value) && value.length === 0)) {
    return { value: null, source, confidence: 0, empty: true };
  }
  return {
    value: value as T,
    source,
    confidence: Math.max(0, Math.min(1, confidence)),
    empty: false,
  };
}
