/**
 * Profils séparés pour toute rédaction commerciale.
 * tenant = ce que NOUS vendons (fiche validée, jamais inventée par l’IA).
 * target = contexte prospect uniquement.
 */

export type CommercialChannel = 'email' | 'whatsapp' | 'linkedin';
export type CommercialLanguage = 'français' | 'anglais' | 'arabe';
export type BrandTone = 'formel' | 'direct' | 'chaleureux';
export type MessageObjective = 'premier_contact' | 'relance' | 'proposition_rdv' | 'proposition_valeur';

/** Fiche tenant validée (Mission / catalogue) — source de vérité offre. */
export type TenantProfile = {
  nom_entreprise: string;
  secteur_activite: string;
  /** Toujours rempli depuis Mission productsServices + Product catalogue — jamais halluciné. */
  services_offerts: string[];
  value_proposition: string;
  ton_de_marque: BrandTone;
  signature: string;
};

/** Contexte prospect — jamais à présenter comme « nos services ». */
export type TargetProfile = {
  nom_entreprise: string;
  secteur_activite: string;
  besoin_detecte: string;
  decideur: string;
  contexte_derniere_interaction: string;
};

export type CommercialMessageParams = {
  canal: CommercialChannel;
  langue: CommercialLanguage;
  objectif: MessageObjective;
};

export type RoleSeparationAudit = {
  erreur_detectee: boolean;
  type_erreur: 'confusion_services' | 'confusion_secteur' | 'inversion_sens' | 'aucune';
  phrase_problematique: string;
  details: string;
};

export type QualityAudit = {
  conforme: boolean;
  problemes: string[];
  suggestion_correction: string;
};

export type CommercialDraftResult = {
  body: string;
  source: 'openai' | 'template';
  /** true si confusion rôles ou qualité non corrigée après retry → relecture humaine. */
  needsHumanReview: boolean;
  roleAudit: RoleSeparationAudit;
  qualityAudit: QualityAudit | null;
  retried: boolean;
};
