import type { CompanySearchCriteria, CompanySearchHit, CompanySearchPort } from '../types.js';

/** Coordonnées GPS de villes courantes pour Nearby Search. */
const CITY_COORDS: Record<string, { lat: number; lng: number }> = {
  tunis:        { lat: 36.8065, lng: 10.1815 },
  sfax:         { lat: 34.7406, lng: 10.7603 },
  sousse:       { lat: 35.8288, lng: 10.6405 },
  kairouan:     { lat: 35.6781, lng: 10.0963 },
  bizerte:      { lat: 37.2744, lng: 9.8739 },
  gabes:        { lat: 33.8815, lng: 10.0982 },
  ariana:       { lat: 36.8625, lng: 10.1956 },
  gafsa:        { lat: 34.425,  lng: 8.7842 },
  monastir:     { lat: 35.7643, lng: 10.8113 },
  'ben arous':  { lat: 36.7533, lng: 10.2281 },
  manouba:      { lat: 36.8101, lng: 10.0956 },
  nabeul:       { lat: 36.4561, lng: 10.7376 },
  medenine:     { lat: 33.3549, lng: 10.5055 },
  kasserine:    { lat: 35.1672, lng: 8.8365 },
  alger:        { lat: 36.7538, lng: 3.0588 },
  casablanca:   { lat: 33.5731, lng: -7.5898 },
  paris:        { lat: 48.8566, lng: 2.3522 },
};

function getCityCoords(city: string): { lat: number; lng: number } | null {
  const key = city.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  return CITY_COORDS[key] || null;
}

/**
 * Google Places — API « classique » (recherche texte) avec pagination `next_page_token`.
 * Variables : `GOOGLE_PLACES_API_KEY` | `GOOGLE_MAPS_API_KEY` | `PLACES_API_KEY`
 *
 * Options env :
 * - `PROSPECTING_GOOGLE_MAX_PAGES` (défaut **3**) : pages Text Search (≈ 20 résultats / page, max ~60).
 * - `PROSPECTING_PLACES_DETAILS_IN_SEARCH=1` : appeler Place Details par établissement pendant la recherche
 *   (plus lent, plus d’appels API). Par défaut **désactivé** : tél / site viennent du résultat Text Search ou
 *   de l’étape d’enrichissement / qualification ultérieure.
 */
export class GooglePlacesTextSearchProvider implements CompanySearchPort {
  readonly id = 'google_places' as const;

  constructor(private readonly apiKey: string) {}

  private buildQuery(criteria: CompanySearchCriteria): string {
    const parts = [
      criteria.keywords?.trim(),
      criteria.sector?.trim(),
      criteria.city?.trim(),
      criteria.country?.trim(),
    ].filter(Boolean);
    return parts.length > 0 ? parts.join(' ') : 'entreprise';
  }

  /**
   * Génère plusieurs variantes de requête pour maximiser les résultats Google Places.
   * Ex: "avocat Tunis" → ["avocat Tunis", "cabinet avocat Tunis", "bureau avocat Tunis", ...]
   */
  private buildQueryVariants(criteria: CompanySearchCriteria): string[] {
    const base = this.buildQuery(criteria);
    const sector = criteria.sector?.trim() || criteria.keywords?.trim() || '';
    const city = criteria.city?.trim() || '';
    const country = criteria.country?.trim() || '';
    const location = [city, country].filter(Boolean).join(' ');

    const variants = new Set<string>();
    variants.add(base);

    if (sector && location) {
      variants.add(`${sector} ${location}`);
      variants.add(`cabinet ${sector} ${location}`);
      variants.add(`bureau ${sector} ${location}`);
      variants.add(`société ${sector} ${location}`);
      variants.add(`entreprise ${sector} ${location}`);
    }
    if (sector && city) {
      variants.add(`${sector} à ${city}`);
      variants.add(`${sector} près de ${city}`);
    }

    const maxVariants = Math.min(6, Math.max(2, Number(process.env.PROSPECTING_QUERY_VARIANTS) || 5));
    return Array.from(variants).slice(0, maxVariants);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
  }

  private async fetchDetails(placeId: string): Promise<{ website?: string; phone?: string }> {
    const url = new URL('https://maps.googleapis.com/maps/api/place/details/json');
    url.searchParams.set('place_id', placeId);
    url.searchParams.set('fields', 'website,international_phone_number');
    url.searchParams.set('key', this.apiKey);

    try {
      const res = await fetch(url.toString());
      if (!res.ok) return {};
      const data = (await res.json()) as {
        status?: string;
        result?: { website?: string; international_phone_number?: string };
      };
      if (data.status !== 'OK' || !data.result) return {};
      return {
        website: data.result.website,
        phone: data.result.international_phone_number,
      };
    } catch {
      return {};
    }
  }

  private async fetchTextSearchPage(query: string, pagetoken?: string): Promise<{
    results: Array<{
      name?: string;
      place_id?: string;
      formatted_address?: string;
      geometry?: { location?: { lat?: number; lng?: number } };
      types?: string[];
      formatted_phone_number?: string;
      international_phone_number?: string;
      website?: string;
    }>;
    status?: string;
    error_message?: string;
    next_page_token?: string;
  }> {
    const url = new URL('https://maps.googleapis.com/maps/api/place/textsearch/json');
    url.searchParams.set('key', this.apiKey);
    if (pagetoken) {
      url.searchParams.set('pagetoken', pagetoken);
    } else {
      url.searchParams.set('query', query);
      url.searchParams.set('language', 'fr');
    }

    const res = await fetch(url.toString());
    if (!res.ok) {
      console.warn('[GooglePlaces] HTTP', res.status);
      return { results: [], status: 'HTTP_ERROR' };
    }

    return (await res.json()) as {
      results: Array<{
        name?: string;
        place_id?: string;
        formatted_address?: string;
        geometry?: { location?: { lat?: number; lng?: number } };
        types?: string[];
        formatted_phone_number?: string;
        international_phone_number?: string;
        website?: string;
      }>;
      status?: string;
      error_message?: string;
      next_page_token?: string;
    };
  }

  /** Pagine une requête unique et renvoie tous les résultats bruts. */
  private async fetchAllPagesForQuery(query: string, maxPages: number): Promise<Array<{
    name?: string;
    place_id?: string;
    formatted_address?: string;
    geometry?: { location?: { lat?: number; lng?: number } };
    types?: string[];
    formatted_phone_number?: string;
    international_phone_number?: string;
    website?: string;
  }>> {
    const results: Array<{
      name?: string;
      place_id?: string;
      formatted_address?: string;
      geometry?: { location?: { lat?: number; lng?: number } };
      types?: string[];
      formatted_phone_number?: string;
      international_phone_number?: string;
      website?: string;
    }> = [];

    let pagetoken: string | undefined;
    for (let page = 0; page < maxPages; page++) {
      if (page > 0) {
        await this.sleep(2100);
      }

      const data = await this.fetchTextSearchPage(query, pagetoken);

      if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
        if (page === 0) {
          console.warn('[GooglePlaces]', data.status, data.error_message || '', '| query:', query);
        }
        break;
      }

      const batch = data.results ?? [];
      results.push(...batch);
      pagetoken = data.next_page_token;
      if (!pagetoken || batch.length === 0) break;
    }

    return results;
  }

  /**
   * Nearby Search — cherche par coordonnées GPS + rayon + mot-clé.
   * Renvoie des résultats différents de Text Search.
   */
  private async fetchNearbySearch(
    keyword: string,
    lat: number,
    lng: number,
    radius: number,
    maxPages: number
  ): Promise<Array<{
    name?: string;
    place_id?: string;
    formatted_address?: string;
    vicinity?: string;
    geometry?: { location?: { lat?: number; lng?: number } };
    types?: string[];
    international_phone_number?: string;
    website?: string;
  }>> {
    const results: Array<{
      name?: string;
      place_id?: string;
      formatted_address?: string;
      vicinity?: string;
      geometry?: { location?: { lat?: number; lng?: number } };
      types?: string[];
      international_phone_number?: string;
      website?: string;
    }> = [];

    let pagetoken: string | undefined;
    for (let page = 0; page < maxPages; page++) {
      if (page > 0) await this.sleep(2100);

      const url = new URL('https://maps.googleapis.com/maps/api/place/nearbysearch/json');
      url.searchParams.set('key', this.apiKey);
      if (pagetoken) {
        url.searchParams.set('pagetoken', pagetoken);
      } else {
        url.searchParams.set('keyword', keyword);
        url.searchParams.set('location', `${lat},${lng}`);
        url.searchParams.set('radius', String(radius));
        url.searchParams.set('language', 'fr');
      }

      try {
        const res = await fetch(url.toString());
        if (!res.ok) break;
        const data = (await res.json()) as {
          results?: Array<{
            name?: string;
            place_id?: string;
            formatted_address?: string;
            vicinity?: string;
            geometry?: { location?: { lat?: number; lng?: number } };
            types?: string[];
            international_phone_number?: string;
            website?: string;
          }>;
          status?: string;
          next_page_token?: string;
        };
        if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') break;
        const batch = data.results ?? [];
        results.push(...batch);
        pagetoken = data.next_page_token;
        if (!pagetoken || batch.length === 0) break;
      } catch {
        break;
      }
    }

    return results;
  }

  async searchCompanies(criteria: CompanySearchCriteria): Promise<CompanySearchHit[]> {
    const queryVariants = this.buildQueryVariants(criteria);
    const maxPages = Math.min(5, Math.max(1, Number(process.env.PROSPECTING_GOOGLE_MAX_PAGES) || 3));
    const detailsInSearch =
      process.env.PROSPECTING_PLACES_DETAILS_IN_SEARCH === '1' ||
      process.env.PROSPECTING_PLACES_DETAILS_IN_SEARCH === 'true';

    type PlaceResult = {
      name?: string;
      place_id?: string;
      formatted_address?: string;
      vicinity?: string;
      geometry?: { location?: { lat?: number; lng?: number } };
      types?: string[];
      formatted_phone_number?: string;
      international_phone_number?: string;
      website?: string;
    };

    const merged: PlaceResult[] = [];

    // 1) Text Search avec variantes de requête
    console.log(`[GooglePlaces] Running ${queryVariants.length} text search variants:`, queryVariants);
    for (const query of queryVariants) {
      const batch = await this.fetchAllPagesForQuery(query, maxPages);
      console.log(`[GooglePlaces] TextSearch "${query}" → ${batch.length} résultats`);
      merged.push(...batch);
    }

    // 2) Nearby Search si on a des coordonnées pour la ville
    const city = criteria.city?.trim() || '';
    const coords = city ? getCityCoords(city) : null;
    const keyword = criteria.sector?.trim() || criteria.keywords?.trim() || '';
    if (coords && keyword) {
      const radii = [5000, 15000, 30000];
      console.log(`[GooglePlaces] Running Nearby Search for "${keyword}" near ${city} (${radii.length} radii)`);
      for (const radius of radii) {
        const batch = await this.fetchNearbySearch(keyword, coords.lat, coords.lng, radius, maxPages);
        console.log(`[GooglePlaces] Nearby r=${radius}m → ${batch.length} résultats`);
        merged.push(...batch);
      }
    }

    const seen = new Set<string>();
    const unique = merged.filter((r) => {
      const id = r.place_id?.trim();
      if (!id) return false;
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });

    console.log(`[GooglePlaces] Total brut: ${merged.length}, dédupliqués: ${unique.length}`);

    const hits: CompanySearchHit[] = [];
    for (const r of unique) {
      const name = r.name?.trim();
      if (!name || !r.place_id) continue;

      let website = r.website ?? null;
      let phone = r.international_phone_number ?? r.formatted_phone_number ?? null;

      if (detailsInSearch && r.place_id && (!website || !phone)) {
        const extra = await this.fetchDetails(r.place_id);
        website = website || extra.website || null;
        phone = phone || extra.phone || null;
      }

      const addr = r.formatted_address || (r as PlaceResult).vicinity || '';
      const parts = addr.split(',').map((s) => s.trim());
      const cityGuess = parts.length >= 2 ? parts[parts.length - 2] : parts[0] || null;
      const countryGuess = parts.length >= 1 ? parts[parts.length - 1] : null;

      hits.push({
        companyName: name,
        website,
        linkedin: null,
        phone,
        email: null,
        city: cityGuess || criteria.city?.trim() || null,
        country: countryGuess || criteria.country?.trim() || null,
        industry: criteria.sector?.trim() || null,
        companySize: criteria.companySize?.trim() || null,
        externalId: r.place_id,
        raw: { types: r.types, place_id: r.place_id },
      });
    }

    return hits;
  }
}
