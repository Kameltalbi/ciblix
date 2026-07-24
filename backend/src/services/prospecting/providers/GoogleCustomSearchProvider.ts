import type { CompanySearchCriteria, CompanySearchHit, CompanySearchPort } from '../types.js';

/**
 * Google Custom Search JSON API — source web à brancher plus tard.
 *
 * Env :
 * - GOOGLE_CSE_API_KEY
 * - GOOGLE_CSE_CX (Search Engine ID)
 *
 * Sans clés → [] (Places + OpenAI restent le chemin principal).
 * Doc : https://developers.google.com/custom-search/v1/overview
 */
export class GoogleCustomSearchProvider implements CompanySearchPort {
  readonly id = 'google_cse' as const;

  constructor(
    private readonly apiKey: string | null = process.env.GOOGLE_CSE_API_KEY?.trim() || null,
    private readonly cx: string | null = process.env.GOOGLE_CSE_CX?.trim() || null
  ) {}

  async searchCompanies(criteria: CompanySearchCriteria): Promise<CompanySearchHit[]> {
    if (!this.apiKey || !this.cx) {
      console.warn('[Prospecting] google_cse sans GOOGLE_CSE_API_KEY / GOOGLE_CSE_CX — ignoré.');
      return [];
    }

    const q = buildQuery(criteria);
    const url = new URL('https://www.googleapis.com/customsearch/v1');
    url.searchParams.set('key', this.apiKey);
    url.searchParams.set('cx', this.cx);
    url.searchParams.set('q', q);
    url.searchParams.set('num', '10');
    url.searchParams.set('hl', 'fr');

    try {
      const res = await fetch(url.toString());
      if (!res.ok) {
        console.warn('[Prospecting] google_cse http', res.status);
        return [];
      }

      const data = (await res.json()) as {
        items?: Array<{ title?: string; link?: string; snippet?: string; cacheId?: string }>;
      };

      const hits: CompanySearchHit[] = [];
      for (const item of data.items || []) {
        const name = item.title?.trim();
        if (!name) continue;
        hits.push({
          companyName: stripTitleNoise(name),
          website: item.link || null,
          industry: criteria.sector?.trim() || null,
          city: criteria.city?.trim() || null,
          country: criteria.country?.trim() || null,
          companySize: criteria.companySize?.trim() || null,
          externalId: item.cacheId || item.link || null,
          raw: { snippet: item.snippet, source: 'google_cse' },
        });
      }
      return dedupeByWebsite(hits);
    } catch (err) {
      console.warn('[Prospecting] google_cse error', err);
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
