/**
 * Fiche entreprise enrichie (company_enricher + champs RNE + signaux agents).
 */
export type CompanySourceConfiance = 'rne' | 'site_officiel' | 'recherche_web' | 'non_trouve';

export type CompanyEmailType = 'generique' | 'nominatif';

export type CompanySignalKind =
  | 'ao'
  | 'recrute'
  | 'nouvelle_creation'
  | 'investissement'
  | 'autre';

export type CompanyReseauxSociaux = {
  linkedin?: string | null;
  facebook?: string | null;
  instagram?: string | null;
};

export type CompanyResult = {
  id: string;
  entreprise: string;
  url_site?: string | null;
  email_contact?: string | null;
  type_email?: CompanyEmailType | null;
  telephone?: string | null;
  adresse?: string | null;
  ville?: string | null;
  gouvernorat?: string | null;
  reseaux_sociaux?: CompanyReseauxSociaux | null;
  resume_activite?: string | null;
  secteur_probable?: string | null;
  source_confiance?: CompanySourceConfiance | null;
  date_extraction?: string | null;

  /** Champs RNE / registre */
  forme_juridique?: string | null;
  activite_nat?: string | null;
  /** Code NAT + libellé éventuellement concaténés ou séparés */
  code_nat?: string | null;
  date_creation?: string | null;
  dirigeant?: string | null;
  capital?: string | null;

  /** Signal agent (pourquoi maintenant) */
  signal?: {
    kind?: CompanySignalKind | null;
    label: string;
    detectedAt?: string | null;
  } | null;

  /** Message Assistant pré-rédigé */
  message_recommande?: string | null;
  canal_recommande?: 'whatsapp' | 'email' | 'linkedin' | null;
};

export type CompanyResultsProps = {
  companies: CompanyResult[];
  /** Id sélectionné contrôlé (optionnel) */
  selectedId?: string | null;
  onSelect?: (company: CompanyResult | null) => void;
  onSendMessage?: (company: CompanyResult, message: string, channel: string) => void;
  onRegenerateMessage?: (company: CompanyResult) => void | Promise<void>;
  className?: string;
  emptyLabel?: string;
  loading?: boolean;
};
