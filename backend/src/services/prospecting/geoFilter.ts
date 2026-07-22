import type { CompanySearchCriteria, CompanySearchHit } from './types.js';

/** Coordonnées GPS de villes courantes pour bias / nearby Places. */
export const CITY_COORDS: Record<string, { lat: number; lng: number }> = {
  tunis: { lat: 36.8065, lng: 10.1815 },
  sfax: { lat: 34.7406, lng: 10.7603 },
  sousse: { lat: 35.8288, lng: 10.6405 },
  kairouan: { lat: 35.6781, lng: 10.0963 },
  bizerte: { lat: 37.2744, lng: 9.8739 },
  gabes: { lat: 33.8815, lng: 10.0982 },
  ariana: { lat: 36.8625, lng: 10.1956 },
  gafsa: { lat: 34.425, lng: 8.7842 },
  monastir: { lat: 35.7643, lng: 10.8113 },
  'ben arous': { lat: 36.7533, lng: 10.2281 },
  manouba: { lat: 36.8101, lng: 10.0956 },
  nabeul: { lat: 36.4561, lng: 10.7376 },
  hammamet: { lat: 36.4, lng: 10.6167 },
  medenine: { lat: 33.3549, lng: 10.5055 },
  kasserine: { lat: 35.1672, lng: 8.8365 },
  alger: { lat: 36.7538, lng: 3.0588 },
  oran: { lat: 35.6969, lng: -0.6331 },
  casablanca: { lat: 33.5731, lng: -7.5898 },
  rabat: { lat: 34.0209, lng: -6.8416 },
  paris: { lat: 48.8566, lng: 2.3522 },
};

export function normalizeGeoText(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function getCityCoords(city: string | undefined | null): { lat: number; lng: number } | null {
  if (!city?.trim()) return null;
  const key = normalizeGeoText(city);
  return CITY_COORDS[key] || null;
}

/** ISO 3166-1 alpha-2 for Places `regionCode`. */
export function countryToRegionCode(country: string | undefined | null): string | null {
  if (!country?.trim()) return null;
  const n = normalizeGeoText(country);
  const map: Record<string, string> = {
    tunisie: 'TN',
    tunisia: 'TN',
    tn: 'TN',
    france: 'FR',
    fr: 'FR',
    algerie: 'DZ',
    algeria: 'DZ',
    dz: 'DZ',
    maroc: 'MA',
    morocco: 'MA',
    ma: 'MA',
    belgique: 'BE',
    belgium: 'BE',
    be: 'BE',
    canada: 'CA',
    ca: 'CA',
  };
  return map[n] || (n.length === 2 ? n.toUpperCase() : null);
}

const COUNTRY_ALIASES: Record<string, string[]> = {
  TN: ['tunisie', 'tunisia', 'tn', 'tunisienne', 'tunisien'],
  FR: ['france', 'fr', 'french', 'francais'],
  DZ: ['algerie', 'algeria', 'dz'],
  MA: ['maroc', 'morocco', 'ma'],
};

function countryAliases(regionOrName: string): string[] {
  const code = countryToRegionCode(regionOrName) || normalizeGeoText(regionOrName).toUpperCase();
  const fromCode = COUNTRY_ALIASES[code];
  if (fromCode) return fromCode;
  return [normalizeGeoText(regionOrName)];
}

/** True if address/country/phone look like the requested country. */
export function hitMatchesSearchCountry(
  hit: Pick<CompanySearchHit, 'country' | 'city' | 'phone' | 'raw'> & { formattedAddress?: string | null },
  criteria: CompanySearchCriteria
): boolean {
  const wanted = criteria.country?.trim();
  if (!wanted) return true;

  const region = countryToRegionCode(wanted);
  const aliases = countryAliases(wanted);
  const haystack = normalizeGeoText(
    [hit.country, hit.city, hit.formattedAddress, typeof hit.raw?.formattedAddress === 'string' ? hit.raw.formattedAddress : '']
      .filter(Boolean)
      .join(' ')
  );

  if (aliases.some((a) => haystack.includes(a))) return true;

  // Phone country hint
  const phone = (hit.phone || '').replace(/\s/g, '');
  if (region === 'TN' && (phone.startsWith('+216') || phone.startsWith('00216'))) return true;
  if (region === 'FR' && (phone.startsWith('+33') || phone.startsWith('0033'))) return true;
  if (region === 'DZ' && (phone.startsWith('+213') || phone.startsWith('00213'))) return true;
  if (region === 'MA' && (phone.startsWith('+212') || phone.startsWith('00212'))) return true;

  // Explicit foreign country in address → reject
  const foreignSignals =
    region === 'TN'
      ? ['france', 'paris', 'lyon', 'marseille', 'noisy le sec', 'belgium', 'belgique', 'canada']
      : [];
  if (foreignSignals.some((f) => haystack.includes(f))) return false;

  // No country signal at all: keep only if we have a location bias and no clear foreign mark
  if (!hit.country?.trim() && !haystack) return true;
  if (!hit.country?.trim()) return false;

  return false;
}

export function filterHitsBySearchLocation(
  hits: CompanySearchHit[],
  criteria: CompanySearchCriteria
): CompanySearchHit[] {
  if (!criteria.country?.trim()) return hits;
  const kept = hits.filter((h) => hitMatchesSearchCountry(h, criteria));
  const dropped = hits.length - kept.length;
  if (dropped > 0) {
    console.log(
      `[prospecting:geo] Filtre pays "${criteria.country}": ${kept.length} gardés, ${dropped} exclus (hors zone)`
    );
  }
  return kept;
}

/** Soft city check when address clearly mentions another known city abroad. */
export function hitMatchesSearchCity(
  hit: Pick<CompanySearchHit, 'city' | 'country'> & { formattedAddress?: string | null },
  criteria: CompanySearchCriteria
): boolean {
  const wantedCity = criteria.city?.trim();
  if (!wantedCity) return true;
  const wanted = normalizeGeoText(wantedCity);
  const haystack = normalizeGeoText([hit.city, hit.formattedAddress].filter(Boolean).join(' '));
  if (!haystack) return true;
  if (haystack.includes(wanted)) return true;

  // If address cites another city from our list (and not the wanted one), drop
  for (const known of Object.keys(CITY_COORDS)) {
    if (known === wanted) continue;
    if (haystack.includes(known) && !haystack.includes(wanted)) {
      // Only drop when that known city is far (different country bias) — e.g. paris vs nabeul
      if (known === 'paris' || known === 'casablanca' || known === 'alger') return false;
    }
  }
  return true;
}
