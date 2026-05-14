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
  raw?: Record<string, unknown>;
}

export type ProspectingSearchProviderId =
  | 'mock'
  | 'apollo'
  | 'hunter'
  | 'google_places'
  | 'outscraper'
  | 'clearbit';

/** Port d’abstraction : implémentations par fournisseur. */
export interface CompanySearchPort {
  readonly id: ProspectingSearchProviderId;
  searchCompanies(criteria: CompanySearchCriteria): Promise<CompanySearchHit[]>;
}

export interface CompanyEnrichmentPort {
  enrichCompany(hit: CompanySearchHit): Promise<CompanySearchHit>;
}

export interface EmailFinderPort {
  findEmails(hit: CompanySearchHit): Promise<CompanySearchHit>;
}

export type PotentialLevel = 'TRES_FORT' | 'MOYEN' | 'FAIBLE';

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
}

export type OutreachMessageType =
  | 'FIRST_CONTACT'
  | 'FOLLOW_UP'
  | 'VALUE_PROPOSITION'
  | 'LINKEDIN'
  | 'WHATSAPP';
