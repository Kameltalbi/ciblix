export const DETECT_SIGNAL_OPTIONS = [
  { id: 'tenders', labelFr: "Appels d'offres", labelEn: 'Tenders' },
  { id: 'new_companies', labelFr: 'Nouvelles entreprises', labelEn: 'New companies' },
  { id: 'new_projects', labelFr: 'Nouveaux projets', labelEn: 'New projects' },
  { id: 'investments', labelFr: 'Investissements', labelEn: 'Investments' },
  { id: 'hiring', labelFr: 'Recrutements', labelEn: 'Hiring' },
  { id: 'expansions', labelFr: 'Extensions', labelEn: 'Expansions' },
  { id: 'new_plants', labelFr: 'Nouvelles usines', labelEn: 'New plants' },
  { id: 'openings', labelFr: 'Ouvertures de sites', labelEn: 'Site openings' },
  { id: 'export', labelFr: 'Export', labelEn: 'Export' },
  { id: 'partnerships', labelFr: 'Partenariats', labelEn: 'Partnerships' },
  { id: 'leadership_changes', labelFr: 'Changements de direction', labelEn: 'Leadership changes' },
  { id: 'esg', labelFr: 'Rapports ESG', labelEn: 'ESG reports' },
  { id: 'news', labelFr: 'Actualités sectorielles', labelEn: 'Sector news' },
  { id: 'funding', labelFr: 'Levées de fonds', labelEn: 'Funding rounds' },
] as const;

export type IdealClientProfile = {
  id: string;
  name: string;
  description: string;
  importance: number;
  sector?: string;
  companySize?: string;
  constraints?: string;
};

export type ExtractedInsights = {
  sectors: string[];
  products: string[];
  services: string[];
  technologies: string[];
  needs: string[];
  synonyms: string[];
  categories: string[];
  keywords: string[];
  potentialExclusions: string[];
};

export function isMissionActive(profile: {
  missionStatus?: string | null;
  missionCompletedAt?: Date | null;
} | null | undefined): boolean {
  return Boolean(profile?.missionStatus === 'ACTIVE' && profile?.missionCompletedAt);
}
