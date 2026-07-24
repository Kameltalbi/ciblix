/** Critères de recherche entreprises (couche métier, indépendante du fournisseur). */
export interface CompanySearchCriteria {
  sector?: string;
  country?: string;
  city?: string;
  companySize?: string;
  keywords?: string;
}

/** Résultat enrichissement crawl site (champs persistés côté AiProspect). */
export interface WebEnrichmentResult {
  websiteTitle: string | null;
  websiteDescription: string | null;
  detectedEmails: string[];
  phoneFromPage: string | null;
  facebookUrl: string | null;
  instagramUrl: string | null;
  linkedinUrlsFound: string[];
  faviconUrl: string | null;
  hasResponsiveWebsite: boolean;
  hasSsl: boolean;
  seoScore: number;
  digitalPresenceLevel: 'FORT' | 'MOYEN' | 'FAIBLE';
  technologiesDetected: string[];
  fetchedUrl: string | null;
  fetchError?: string | null;
  /** Pages importantes (Firecrawl / crawl). */
  importantPages?: string[];
  /** Description / produits extraits du site. */
  productsServices?: string[];
  sectorsFromSite?: string[];
  /** Source d’enrichissement utilisée. */
  enrichmentSource?: 'firecrawl' | 'native' | 'none';
}

/** Résultat brut d’un fournisseur de recherche (Apollo, Hunter, Maps, Clearbit…). */
export interface CompanySearchHit {
  companyName: string;
  website?: string | null;
  linkedin?: string | null;
  phone?: string | null;
  email?: string | null;
  city?: string | null;
  country?: string | null;
  industry?: string | null;
  companySize?: string | null;
  /** Identifiant fournisseur pour corrélation / enrichissement futur */
  externalId?: string | null;
  address?: string | null;
  googleMapsUrl?: string | null;
  lat?: number | null;
  lng?: number | null;
  raw?: Record<string, unknown>;
}

export type ProspectingSearchProviderId =
  | 'mock'
  | 'apollo'
  | 'hunter'
  | 'google_places'
  | 'google_cse'
  | 'bing_search'
  | 'outscraper'
  | 'clearbit'
  | 'opencorporates'
  | 'tenders';

/** Port d’abstraction : implémentations par fournisseur. */
export interface CompanySearchPort {
  readonly id: ProspectingSearchProviderId;
  searchCompanies(criteria: CompanySearchCriteria): Promise<CompanySearchHit[]>;
}

/** Enrichissement entreprise (site, registres, etc.) — sources plugables. */
export interface CompanyEnrichmentPort {
  readonly id: string;
  enrichCompany(hit: CompanySearchHit): Promise<{ hit: CompanySearchHit; enrichment: WebEnrichmentResult }>;
}

/** Recherche d’emails professionnels — sources plugables (Hunter, Apollo…). */
export interface EmailFinderPort {
  readonly id: string;
  findEmails(hit: CompanySearchHit): Promise<{ emails: string[]; hit: CompanySearchHit }>;
}

export type PotentialLevel = 'TRES_FORT' | 'MOYEN' | 'FAIBLE';
export type ClienteleType = 'B2B' | 'B2C' | 'MIXTE' | 'INCONNU';

/** Profil commercial produit par OpenAI / heuristique. */
export interface CommercialProfile {
  productsServices: string[];
  targetSectors: string[];
  clienteleType: ClienteleType;
  companySizeEstimate: string;
  saleOpportunities: string[];
  importantPages: string[];
}

export interface LeadQualification {
  score: number;
  potentialLevel: PotentialLevel;
  scoreReason: string;
  commercialAngle: string;
  aiSummary: string;
  suggestedPitch: string;
  interestProbability: number;
  aiTags: string[];
  followUpPlan: Array<{ dayOffset: number; approach: string; tone: string }>;
  /** Problème métier probable (1 phrase) */
  probableBusinessProblem: string;
  /** Offre / levier CRM adapté (1 phrase) */
  suggestedOffer: string;
  commercialProfile: CommercialProfile;
}

export type OutreachMessageType =
  | 'FIRST_CONTACT'
  | 'FOLLOW_UP'
  | 'VALUE_PROPOSITION'
  | 'LINKEDIN'
  | 'WHATSAPP';
