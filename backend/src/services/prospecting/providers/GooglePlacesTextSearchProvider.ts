import type { CompanySearchCriteria, CompanySearchHit, CompanySearchPort } from '../types.js';

/**
 * Google Places — API « classique » (recherche texte).
 * La clé est transmise en **query string** : `...?key=API_KEY` (comme documenté par Google).
 *
 * Variables d’environnement (la première définie est utilisée) :
 * - `GOOGLE_PLACES_API_KEY` (recommandé)
 * - `GOOGLE_MAPS_API_KEY`
 * - `PLACES_API_KEY` (alias pratique)
 *
 * Activer : `PROSPECTING_SEARCH_PROVIDER=google_places`
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

  async searchCompanies(criteria: CompanySearchCriteria): Promise<CompanySearchHit[]> {
    const query = this.buildQuery(criteria);
    const url = new URL('https://maps.googleapis.com/maps/api/place/textsearch/json');
    url.searchParams.set('query', query);
    url.searchParams.set('key', this.apiKey);
    url.searchParams.set('language', 'fr');

    const res = await fetch(url.toString());
    if (!res.ok) {
      console.warn('[GooglePlaces] HTTP', res.status);
      return [];
    }

    const data = (await res.json()) as {
      status?: string;
      error_message?: string;
      results?: Array<{
        name?: string;
        place_id?: string;
        formatted_address?: string;
        geometry?: { location?: { lat?: number; lng?: number } };
        types?: string[];
        formatted_phone_number?: string;
        international_phone_number?: string;
        website?: string;
      }>;
    };

    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      console.warn('[GooglePlaces]', data.status, data.error_message || '');
      return [];
    }

    const rawResults = data.results ?? [];
    const limited = rawResults.slice(0, 10);

    const hits: CompanySearchHit[] = [];
    for (const r of limited) {
      const name = r.name?.trim();
      if (!name || !r.place_id) continue;

      let website = r.website ?? null;
      let phone = r.international_phone_number ?? r.formatted_phone_number ?? null;

      if (!website || !phone) {
        const extra = await this.fetchDetails(r.place_id);
        website = website || extra.website || null;
        phone = phone || extra.phone || null;
      }

      const addr = r.formatted_address || '';
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
