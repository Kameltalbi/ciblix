import type { CompanySearchCriteria, CompanySearchHit, CompanySearchPort } from '../types.js';

/**
 * Google Places API (New) — endpoint moderne avec pagination améliorée.
 * Variable : `GOOGLE_PLACES_API_KEY` ou `GOOGLE_MAPS_API_KEY`
 *
 * Options env :
 * - `PROSPECTING_GOOGLE_MAX_PAGES` (défaut **10**) : pages (jusqu'à 20 résultats/page = ~200 max par variante)
 * - `PROSPECTING_QUERY_VARIANTS` (défaut **8**) : variantes de requête pour maximiser les résultats
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
      variants.add(`cabinet ${sector} ${location}`);
      variants.add(`bureau ${sector} ${location}`);
      variants.add(`société ${sector} ${location}`);
    }
    if (sector && city) {
      variants.add(`${sector} à ${city}`);
      variants.add(`${sector} près de ${city}`);
    }

    const maxVariants = Math.min(10, Math.max(2, Number(process.env.PROSPECTING_QUERY_VARIANTS) || 8));
    return Array.from(variants).slice(0, maxVariants);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
  }

  private async searchPage(
    textQuery: string,
    pageToken?: string,
    maxResults: number = 20
  ): Promise<{ places: Array<any>; nextPageToken?: string }> {
    const url = 'https://places.googleapis.com/v1/places:searchText';

    const body: Record<string, unknown> = {
      textQuery,
      maxResultCount: maxResults,
      languageCode: 'fr',
    };

    if (pageToken) {
      body.pageToken = pageToken;
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': this.apiKey,
      'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location,places.types,places.internationalPhoneNumber,places.websiteUri,places.nationalPhoneNumber',
    };

    console.log(`[GooglePlaces New] Requesting "${textQuery}" with token: ${pageToken ? 'yes' : 'no'}`);

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

  private async fetchAllPages(query: string, maxPages: number): Promise<Array<any>> {
    const results: Array<any> = [];
    let pageToken: string | undefined;

    for (let page = 0; page < maxPages; page++) {
      if (page > 0) {
        await this.sleep(2100);
      }

      const { places, nextPageToken } = await this.searchPage(query, pageToken);
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
      const batch = await this.fetchAllPages(query, maxPages);
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
      const parts = addr.split(',').map((s: string) => s.trim());
      const cityGuess = parts.length >= 2 ? parts[parts.length - 2] : parts[0] || null;
      const countryGuess = parts.length >= 1 ? parts[parts.length - 1] : null;

      hits.push({
        companyName: name,
        website: r.websiteUri || null,
        linkedin: null,
        phone: r.internationalPhoneNumber || r.nationalPhoneNumber || null,
        email: null,
        city: cityGuess || criteria.city?.trim() || null,
        country: countryGuess || criteria.country?.trim() || null,
        industry: criteria.sector?.trim() || null,
        companySize: criteria.companySize?.trim() || null,
        externalId: r.id,
        raw: {
          types: r.types,
          location: r.location,
        },
      });
    }

    return hits;
  }
}
