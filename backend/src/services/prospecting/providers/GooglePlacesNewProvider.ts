import type { CompanySearchCriteria, CompanySearchHit, CompanySearchPort } from '../types.js';
import {
  countryToRegionCode,
  filterHitsBySearchLocation,
  getCityCoords,
  hitMatchesSearchCity,
} from '../geoFilter.js';

/**
 * Google Places API (New) — endpoint moderne avec pagination améliorée.
 * Variable : `GOOGLE_PLACES_API_KEY` ou `GOOGLE_MAPS_API_KEY`
 *
 * Options env :
 * - `PROSPECTING_GOOGLE_MAX_PAGES` (défaut **10**) : pages (jusqu'à 20 résultats/page = ~200 max par variante)
 * - `PROSPECTING_QUERY_VARIANTS` (défaut **8**) : variantes de requête pour maximiser les résultats
 * - `PROSPECTING_LOCATION_RADIUS_M` (défaut **45000**) : rayon du locationBias autour de la ville
 */
export class GooglePlacesNewProvider implements CompanySearchPort {
  readonly id = 'google_places' as const;

  constructor(private readonly apiKey: string) {}

  private buildQuery(criteria: CompanySearchCriteria): string {
    const parts = [
      criteria.sector?.trim(),
      criteria.keywords?.trim(),
      criteria.city?.trim(),
      criteria.country?.trim(),
    ].filter(Boolean);
    return parts.length > 0 ? parts.join(' ') : 'entreprise';
  }

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
      variants.add(`entreprise ${sector} ${location}`);
      if (country) {
        variants.add(`${sector} ${city} ${country}`.replace(/\s+/g, ' ').trim());
      }
    }
    // Toujours garder le pays dans les variantes « à / près de »
    if (sector && city && country) {
      variants.add(`${sector} à ${city} ${country}`);
      variants.add(`${sector} près de ${city} ${country}`);
    } else if (sector && city) {
      variants.add(`${sector} à ${city}`);
    }

    const maxVariants = Math.min(10, Math.max(2, Number(process.env.PROSPECTING_QUERY_VARIANTS) || 8));
    return Array.from(variants).slice(0, maxVariants);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
  }

  private async searchPage(
    textQuery: string,
    criteria: CompanySearchCriteria,
    pageToken?: string,
    maxResults: number = 20
  ): Promise<{ places: Array<any>; nextPageToken?: string }> {
    const url = 'https://places.googleapis.com/v1/places:searchText';

    const body: Record<string, unknown> = {
      textQuery,
      maxResultCount: maxResults,
      languageCode: 'fr',
    };

    const regionCode = countryToRegionCode(criteria.country);
    if (regionCode) {
      body.regionCode = regionCode;
    }

    const coords = getCityCoords(criteria.city);
    const radius = Math.min(
      50000,
      Math.max(5000, Number(process.env.PROSPECTING_LOCATION_RADIUS_M) || 45000)
    );
    if (coords) {
      // Bias fort autour de la ville demandée (ex. Nabeul) pour éviter Paris/FR
      body.locationBias = {
        circle: {
          center: { latitude: coords.lat, longitude: coords.lng },
          radius,
        },
      };
    }

    if (pageToken) {
      body.pageToken = pageToken;
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': this.apiKey,
      'X-Goog-FieldMask':
        'places.id,places.displayName,places.formattedAddress,places.location,places.types,places.internationalPhoneNumber,places.websiteUri,places.nationalPhoneNumber',
    };

    console.log(
      `[GooglePlaces New] "${textQuery}" region=${regionCode || '—'} bias=${coords ? `${coords.lat},${coords.lng} r=${radius}` : '—'}`
    );

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        console.error(`[GooglePlaces New] HTTP ${res.status}: ${errText}`);
        return { places: [] };
      }

      const json = (await res.json()) as {
        places?: Array<{
          id?: string;
          displayName?: { text?: string };
          formattedAddress?: string;
          location?: { lat?: number; lng?: number };
          types?: string[];
          internationalPhoneNumber?: string;
          nationalPhoneNumber?: string;
          websiteUri?: string;
        }>;
        nextPageToken?: string;
      };

      return {
        places: json.places ?? [],
        nextPageToken: json.nextPageToken,
      };
    } catch (err) {
      console.error('[GooglePlaces New] Error:', err);
      return { places: [] };
    }
  }

  private async fetchAllPages(query: string, criteria: CompanySearchCriteria, maxPages: number): Promise<Array<any>> {
    const results: Array<any> = [];
    let pageToken: string | undefined;

    for (let page = 0; page < maxPages; page++) {
      if (page > 0) {
        await this.sleep(2100);
      }

      const { places, nextPageToken } = await this.searchPage(query, criteria, pageToken);
      console.log(`[GooglePlaces New] "${query}" page ${page + 1} → ${places.length} résultats`);
      results.push(...places);

      pageToken = nextPageToken;
      if (!pageToken || places.length === 0) break;
    }

    return results;
  }

  async searchCompanies(criteria: CompanySearchCriteria): Promise<CompanySearchHit[]> {
    const queryVariants = this.buildQueryVariants(criteria);
    const maxPages = Math.min(10, Math.max(1, Number(process.env.PROSPECTING_GOOGLE_MAX_PAGES) || 10));

    const merged: Array<any> = [];

    console.log(`[GooglePlaces New] Running ${queryVariants.length} query variants:`, queryVariants);

    for (const query of queryVariants) {
      const batch = await this.fetchAllPages(query, criteria, maxPages);
      merged.push(...batch);
    }

    const seen = new Set<string>();
    const unique = merged.filter((r) => {
      const id = r.id?.trim();
      if (!id) return false;
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });

    console.log(`[GooglePlaces New] Total brut: ${merged.length}, dédupliqués: ${unique.length}`);

    const hits: CompanySearchHit[] = [];

    for (const r of unique) {
      const name = r.displayName?.text?.trim();
      if (!name || !r.id) continue;

      const addr = r.formattedAddress || '';
      const parts = addr.split(',').map((s: string) => s.trim()).filter(Boolean);
      const countryGuess = parts.length >= 1 ? parts[parts.length - 1] : null;
      const cityGuess = parts.length >= 2 ? parts[parts.length - 2] : parts[0] || null;

      hits.push({
        companyName: name,
        website: r.websiteUri || null,
        linkedin: null,
        phone: r.internationalPhoneNumber || r.nationalPhoneNumber || null,
        email: null,
        // Ne pas réécrire Nabeul/Tunisie sur une adresse française
        city: cityGuess || null,
        country: countryGuess || null,
        industry: criteria.sector?.trim() || null,
        companySize: criteria.companySize?.trim() || null,
        externalId: r.id,
        raw: {
          types: r.types,
          location: r.location,
          formattedAddress: addr,
        },
      });
    }

    const byCountry = filterHitsBySearchLocation(hits, criteria);
    const byCity = byCountry.filter((h) =>
      hitMatchesSearchCity(
        { ...h, formattedAddress: typeof h.raw?.formattedAddress === 'string' ? h.raw.formattedAddress : null },
        criteria
      )
    );

    console.log(
      `[GooglePlaces New] Après filtre geo: ${byCity.length}/${hits.length} (pays+ville)`
    );

    return byCity;
  }
}
