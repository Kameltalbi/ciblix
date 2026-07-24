import type { CompanySearchCriteria, CompanySearchHit, CompanySearchPort } from '../types.js';

/**
 * Bing Web Search API (Azure) — source web à brancher plus tard.
 *
 * Env :
 * - BING_SEARCH_API_KEY (Ocp-Apim-Subscription-Key)
 * - BING_SEARCH_ENDPOINT (défaut https://api.bing.microsoft.com/v7.0/search)
 *
 * Sans clé → [] (Places + OpenAI restent le chemin principal).
 */
export class BingSearchProvider implements CompanySearchPort {
  readonly id = 'bing_search' as const;

  constructor(
    private readonly apiKey: string | null = process.env.BING_SEARCH_API_KEY?.trim() || null,
    private readonly endpoint: string =
      process.env.BING_SEARCH_ENDPOINT?.trim() || 'https://api.bing.microsoft.com/v7.0/search'
  ) {}

  async searchCompanies(criteria: CompanySearchCriteria): Promise<CompanySearchHit[]> {
    if (!this.apiKey) {
      console.warn('[Prospecting] bing_search sans BING_SEARCH_API_KEY — ignoré.');
      return [];
    }

    const q = buildQuery(criteria);
    const url = new URL(this.endpoint);
    url.searchParams.set('q', q);
    url.searchParams.set('count', '20');
    url.searchParams.set('mkt', 'fr-FR');
    url.searchParams.set('responseFilter', 'Webpages');

    try {
      const res = await fetch(url.toString(), {
        headers: { 'Ocp-Apim-Subscription-Key': this.apiKey },
      });
      if (!res.ok) {
        console.warn('[Prospecting] bing_search http', res.status);
        return [];
      }

      const data = (await res.json()) as {
        webPages?: { value?: Array<{ name?: string; url?: string; snippet?: string; id?: string }> };
      };

      const hits: CompanySearchHit[] = [];
      for (const item of data.webPages?.value || []) {
        const name = item.name?.trim();
        if (!name) continue;
        hits.push({
          companyName: stripTitleNoise(name),
          website: item.url || null,
          industry: criteria.sector?.trim() || null,
          city: criteria.city?.trim() || null,
          country: criteria.country?.trim() || null,
          companySize: criteria.companySize?.trim() || null,
          externalId: item.id || item.url || null,
          raw: { snippet: item.snippet, source: 'bing_search' },
        });
      }
      return dedupeByWebsite(hits);
    } catch (err) {
      console.warn('[Prospecting] bing_search error', err);
      return [];
    }
  }
}

function buildQuery(criteria: CompanySearchCriteria): string {
  const parts = [
    criteria.sector?.trim(),
    criteria.keywords?.trim(),
    'entreprise',
    criteria.city?.trim(),
    criteria.country?.trim(),
  ].filter(Boolean);
  return parts.join(' ') || 'entreprise';
}

function stripTitleNoise(title: string): string {
  return title.split(/[|\-–—]/)[0]?.trim() || title;
}

function dedupeByWebsite(hits: CompanySearchHit[]): CompanySearchHit[] {
  const seen = new Set<string>();
  const out: CompanySearchHit[] = [];
  for (const h of hits) {
    const key = (h.website || h.companyName).toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(h);
  }
  return out;
}
