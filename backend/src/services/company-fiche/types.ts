/**
 * Contrat de propriété des champs — Fiche Entreprise Ciblix.
 *
 * Règle n°1 : les agents ne se parlent PAS.
 * Chaque agent LIT librement, ÉCRIT uniquement dans ses champs exclusifs.
 * L’orchestrateur réagit aux changements d’état — ce n’est pas un agent LLM.
 */

export type FicheAgent =
  | 'prospecteur'
  | 'analyste'
  | 'redacteur'
  | 'scribe'
  | 'veilleur'
  | 'humain';

export type FicheEtat =
  | 'decouverte'
  | 'qualifiee'
  | 'contactee'
  | 'en_discussion'
  | 'gagnee'
  | 'perdue'
  | 'archivee'
  | 'bloquee_humain';

/** Champs exclusifs du Prospecteur — trouver des entreprises. */
export const PROSPECTEUR_FIELDS = [
  'identite_entreprise',
  'source_decouverte',
  'secteur_declare',
  'taille_estimee',
  'zone_geographique',
  'critere_de_match',
] as const;

/** Champs exclusifs de l’Analyste — qualifier. */
export const ANALYSTE_FIELDS = [
  'decideur',
  'besoin_detecte',
  'score_fit',
  'raison_du_score',
  'signaux_retenus',
] as const;

/** Champs exclusifs du Rédacteur — préparer le contact. */
export const REDACTEUR_FIELDS = [
  'message_brouillon',
  'message_canal',
  'message_langue',
  'validation_separation',
  'validation_qualite',
] as const;

/** Champs exclusifs du Scribe — supprimer la saisie CRM. */
export const SCRIBE_FIELDS = [
  'historique_interactions',
  'statut_deal',
  'prochaine_action',
  'date_relance',
  'objections_detectees',
  'montant_potentiel',
] as const;

/** Couche transverse Veilleur — signaux uniquement. */
export const VEILLEUR_FIELDS = ['signaux_externes'] as const;

export type ProspecteurField = (typeof PROSPECTEUR_FIELDS)[number];
export type AnalysteField = (typeof ANALYSTE_FIELDS)[number];
export type RedacteurField = (typeof REDACTEUR_FIELDS)[number];
export type ScribeField = (typeof SCRIBE_FIELDS)[number];
export type VeilleurField = (typeof VEILLEUR_FIELDS)[number];

export type FicheOwnedField =
  | ProspecteurField
  | AnalysteField
  | RedacteurField
  | ScribeField
  | VeilleurField;

export const FIELD_OWNER: Record<FicheOwnedField, Exclude<FicheAgent, 'humain'>> = {
  identite_entreprise: 'prospecteur',
  source_decouverte: 'prospecteur',
  secteur_declare: 'prospecteur',
  taille_estimee: 'prospecteur',
  zone_geographique: 'prospecteur',
  critere_de_match: 'prospecteur',

  decideur: 'analyste',
  besoin_detecte: 'analyste',
  score_fit: 'analyste',
  raison_du_score: 'analyste',
  signaux_retenus: 'analyste',

  message_brouillon: 'redacteur',
  message_canal: 'redacteur',
  message_langue: 'redacteur',
  validation_separation: 'redacteur',
  validation_qualite: 'redacteur',

  historique_interactions: 'scribe',
  statut_deal: 'scribe',
  prochaine_action: 'scribe',
  date_relance: 'scribe',
  objections_detectees: 'scribe',
  montant_potentiel: 'scribe',

  signaux_externes: 'veilleur',
};

export const AGENT_OWNED_FIELDS: Record<
  Exclude<FicheAgent, 'humain'>,
  readonly FicheOwnedField[]
> = {
  prospecteur: PROSPECTEUR_FIELDS,
  analyste: ANALYSTE_FIELDS,
  redacteur: REDACTEUR_FIELDS,
  scribe: SCRIBE_FIELDS,
  veilleur: VEILLEUR_FIELDS,
};

export type IdentiteEntreprise = {
  nom_legal: string;
  identifiant_national?: string | null;
};

export type DecideurInfo = {
  nom?: string | null;
  fonction?: string | null;
  canal_prefere?: 'email' | 'whatsapp' | 'linkedin' | 'telephone' | null;
  /** Preuve / source — obligatoire si nom renseigné. */
  source?: string | null;
};

export type ValidationSeparation = {
  erreur_detectee: boolean;
  type_erreur?: string;
  phrase_problematique?: string;
  details?: string;
};

export type ValidationQualite = {
  conforme: boolean;
  problemes: string[];
  suggestion_correction?: string;
};

export type InteractionEntry = {
  at: string;
  canal: 'whatsapp' | 'email' | 'appel' | 'note' | 'vocal';
  resume: string;
  uncertain?: boolean;
};

export type SignalExterne = {
  at: string;
  titre: string;
  source_url?: string | null;
  source_ref: string;
  destination?: 'prospecteur' | 'analyste' | 'scribe';
};

export type FicheEntrepriseData = {
  // Prospecteur
  identite_entreprise?: IdentiteEntreprise | null;
  source_decouverte?: { source: string; url?: string | null; at: string } | null;
  secteur_declare?: string | null;
  taille_estimee?: string | null;
  zone_geographique?: string | null;
  critere_de_match?: string | null;

  // Analyste
  decideur?: DecideurInfo | null;
  besoin_detecte?: string | null;
  score_fit?: number | null;
  raison_du_score?: string | null;
  signaux_retenus?: string[] | null;

  // Rédacteur
  message_brouillon?: string | null;
  message_canal?: 'email' | 'whatsapp' | 'linkedin' | null;
  message_langue?: string | null;
  validation_separation?: ValidationSeparation | null;
  validation_qualite?: ValidationQualite | null;

  // Scribe
  historique_interactions?: InteractionEntry[] | null;
  statut_deal?: string | null;
  prochaine_action?: string | null;
  date_relance?: string | null;
  objections_detectees?: string[] | null;
  montant_potentiel?: number | null;

  // Veilleur
  signaux_externes?: SignalExterne[] | null;

  /** Motif bloquée_humain / archivée */
  block_reason?: string | null;
  archive_reason?: string | null;
};

export type FicheTransitionLog = {
  fiche_id: string;
  tenant_id: string;
  etat_precedent: FicheEtat | null;
  etat_nouveau: FicheEtat;
  agent_emetteur: FicheAgent;
  champs_ecrits: FicheOwnedField[];
  condition_sortie_remplie: boolean;
  raison: string;
  prochain_agent: FicheAgent | null;
  horodatage: string;
};

export class FieldOwnershipError extends Error {
  readonly agent: FicheAgent;
  readonly forbiddenFields: string[];

  constructor(agent: FicheAgent, forbiddenFields: string[]) {
    super(
      `Agent « ${agent} » ne peut pas écrire les champs : ${forbiddenFields.join(', ')}`
    );
    this.name = 'FieldOwnershipError';
    this.agent = agent;
    this.forbiddenFields = forbiddenFields;
  }
}
