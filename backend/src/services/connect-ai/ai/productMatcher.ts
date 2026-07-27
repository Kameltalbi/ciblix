import type { ConnectProductChoice, ProspectProfile } from '../core/types.js';

const INDUSTRIAL_KEYWORDS = [
  'industrie',
  'industrial',
  'manufacturing',
  'usine',
  'production',
  'export',
  'carbone',
  'environnement',
  'iso',
  'energie',
];

const PME_KEYWORDS = [
  'pme',
  'tpe',
  'startup',
  'cabinet',
  'comptable',
  'facturation',
  'erp',
  'saas',
];

const ARCHITECT_KEYWORDS = ['architecte', 'architect', 'bureau d\'études', 'bet', 'ingénieur'];

function textBlob(profile: ProspectProfile, sector?: string): string {
  return [
    profile.company,
    profile.jobTitle,
    profile.headline,
    profile.description,
    profile.sector,
    sector,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function containsAny(text: string, keywords: string[]): boolean {
  return keywords.some((k) => text.includes(k));
}

/** Recommande CarboScan, SoftFacture ou les deux selon le profil. */
export function matchProduct(
  profile: ProspectProfile,
  sector?: string,
  forced?: ConnectProductChoice
): ConnectProductChoice {
  if (forced && forced !== 'CUSTOM') return forced;

  const blob = textBlob(profile, sector);
  const industrial = containsAny(blob, INDUSTRIAL_KEYWORDS);
  const pme = containsAny(blob, PME_KEYWORDS);
  const architect = containsAny(blob, ARCHITECT_KEYWORDS);

  if (architect) return 'BOTH';
  if (industrial && !pme) return 'CARBOSCAN';
  if (pme && !industrial) return 'SOFTFACTURE';
  if (industrial && pme) return 'BOTH';
  if (containsAny(blob, ['export', 'exportateur', 'exportation'])) return 'CARBOSCAN';
  if (containsAny(blob, ['comptab', 'fiscal', 'facture'])) return 'SOFTFACTURE';

  return 'SOFTFACTURE';
}

export const PRODUCT_LABELS: Record<ConnectProductChoice, string> = {
  CARBOSCAN: 'CarboScan — bilan carbone & conformité',
  SOFTFACTURE: 'SoftFacture — facturation & gestion PME',
  BOTH: 'CarboScan + SoftFacture',
  CUSTOM: 'Message libre',
  NONE: 'Aucun produit spécifique',
};
