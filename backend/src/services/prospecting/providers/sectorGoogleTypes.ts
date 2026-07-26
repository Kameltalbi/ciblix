/**
 * Mapping secteur métier → types Google Places (Table A).
 * Text Search (New) n’accepte qu’un seul `includedType` (singulier) —
 * on expose une liste pour tourner entre variantes / prioriser le type principal.
 *
 * Types invalides ou Table B (ex. general_contractor) exclus volontairement.
 * Si aucun match : ne pas envoyer de filtre (mieux que d’exclure des résultats valides).
 */
export const SECTOR_TO_GOOGLE_TYPES: Record<string, string[]> = {
  textile: ['clothing_store', 'wholesaler', 'manufacturer'],
  confection: ['clothing_store', 'wholesaler', 'manufacturer'],
  agroalimentaire: ['food_store', 'restaurant', 'wholesaler', 'manufacturer'],
  btp: ['roofing_contractor', 'plumber', 'painter', 'electrician'],
  construction: ['roofing_contractor', 'plumber', 'painter'],
  transport: ['moving_company', 'courier_service', 'shipping_service'],
  logistique: ['moving_company', 'courier_service', 'shipping_service', 'storage'],
  it: ['corporate_office', 'telecommunications_service_provider', 'consultant'],
  informatique: ['corporate_office', 'telecommunications_service_provider', 'consultant'],
  sante: ['hospital', 'medical_lab', 'pharmacy', 'doctor'],
  santé: ['hospital', 'medical_lab', 'pharmacy', 'doctor'],
  education: ['school', 'university'],
  éducation: ['school', 'university'],
  formation: ['school', 'university', 'sports_coaching'],
  industrie: ['manufacturer', 'wholesaler', 'supplier'],
  commerce: ['department_store', 'shopping_mall', 'wholesaler'],
  immobilier: ['real_estate_agency'],
  finance: ['accounting', 'bank', 'insurance_agency'],
  juridique: ['lawyer'],
  hotel: ['hotel', 'lodging', 'resort_hotel'],
  hôtel: ['hotel', 'lodging', 'resort_hotel'],
  restauration: ['restaurant', 'cafe', 'catering_service'],
};

/** Normalise et résout la liste de types pour un secteur libre (FR / clés partielles). */
export function resolveGoogleTypesForSector(sector: string | null | undefined): string[] | null {
  const normalized = sector?.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').trim() ?? '';
  if (!normalized) return null;

  const direct = SECTOR_TO_GOOGLE_TYPES[normalized];
  if (direct?.length) return [...direct];

  const hit = Object.entries(SECTOR_TO_GOOGLE_TYPES).find(([key]) => {
    const keyNorm = key.normalize('NFD').replace(/\p{M}/gu, '');
    return normalized.includes(keyNorm) || keyNorm.includes(normalized);
  });

  return hit?.[1]?.length ? [...hit[1]] : null;
}

/**
 * Type unique pour Places Text Search (`includedType`).
 * `variantIndex` permet de faire tourner les types sur les variantes de requête.
 */
export function pickIncludedTypeForSector(
  sector: string | null | undefined,
  variantIndex = 0
): string | null {
  const types = resolveGoogleTypesForSector(sector);
  if (!types?.length) return null;
  return types[variantIndex % types.length] ?? types[0] ?? null;
}
