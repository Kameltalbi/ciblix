import type { CompanySearchCriteria, CompanySearchHit, CompanySearchPort } from '../types.js';
import { countryToRegionCode, filterHitsBySearchLocation, hitMatchesSearchCity } from '../geoFilter.js';

/**
 * Outscraper Google Maps Scraper — retourne des centaines de résultats par recherche.
 * Variable : `OUTSCRAPER_API_KEY`
 * Pricing : 500 premiers résultats gratuits/mois, puis ~$2-3/1000 résultats.
 *
 * Options env :
 * - `OUTSCRAPER_LIMIT` (défaut **200**) : nombre max de résultats par requête.
 */
export class OutscraperProvider implements CompanySearchPort {
  readonly id = 'outscraper' as const;

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

  async searchCompanies(criteria: CompanySearchCriteria): Promise<CompanySearchHit[]> {
    const query = this.buildQuery(criteria);
    const limit = Math.min(500, Math.max(10, Number(process.env.OUTSCRAPER_LIMIT) || 200));
    const region = countryToRegionCode(criteria.country);

    console.log(`[Outscraper] Searching: "${query}" limit=${limit} region=${region || '—'}`);

    const url = new URL('https://api.app.outscraper.com/maps/search-v3');
    url.searchParams.set('query', query);
    url.searchParams.set('limit', String(limit));
    url.searchParams.set('language', 'fr');
    url.searchParams.set('async', 'false');
    if (region) url.searchParams.set('region', region);

    try {
      const res = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'X-API-KEY': this.apiKey,
          Accept: 'application/json',
        },
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        console.error(`[Outscraper] HTTP ${res.status}: ${errText}`);
        return [];
      }

      const json = (await res.json()) as {
        status?: string;
        data?: Array<
          Array<{
            name?: string;
            place_id?: string;
            full_address?: string;
            city?: string;
            country?: string;
            phone?: string;
            site?: string;
            type?: string;
            category?: string;
            subtypes?: string[];
            rating?: number;
            reviews?: number;
            working_hours?: Record<string, string>;
            linkedin?: string;
            email?: string;
            facebook?: string;
            instagram?: string;
          }>
        >;
      };

      const places = json.data?.[0] ?? [];
      console.log(`[Outscraper] Got ${places.length} results for "${query}"`);

      const seen = new Set<string>();
      const hits: CompanySearchHit[] = [];

      for (const p of places) {
        const name = p.name?.trim();
        if (!name) continue;

        const placeId = p.place_id?.trim() || '';
        if (placeId && seen.has(placeId)) continue;
        if (placeId) seen.add(placeId);

        hits.push({
          companyName: name,
          website: p.site || null,
          linkedin: p.linkedin || null,
          phone: p.phone || null,
          email: p.email || null,
          city: p.city || null,
          country: p.country || null,
          industry: p.category || p.type || criteria.sector?.trim() || null,
          companySize: criteria.companySize?.trim() || null,
          externalId: placeId || null,
          raw: {
            place_id: placeId,
            subtypes: p.subtypes,
            rating: p.rating,
            reviews: p.reviews,
            facebook: p.facebook,
            instagram: p.instagram,
            formattedAddress: p.full_address,
          },
        });
      }

      const byCountry = filterHitsBySearchLocation(hits, criteria);
      const filtered = byCountry.filter((h) =>
        hitMatchesSearchCity(
          {
            ...h,
            formattedAddress: typeof h.raw?.formattedAddress === 'string' ? h.raw.formattedAddress : null,
          },
          criteria
        )
      );
      console.log(`[Outscraper] Returning ${filtered.length}/${hits.length} after geo filter`);
      return filtered;
    } catch (err) {
      console.error('[Outscraper] Error:', err);
      return [];
    }
  }
}
