import type { CompanySearchHit, EmailFinderPort } from '../types.js';

/**
 * Hunter.io — domain search d’emails professionnels.
 * Env : HUNTER_API_KEY
 */
export class HunterEmailProvider implements EmailFinderPort {
  readonly id = 'hunter';

  constructor(private readonly apiKey: string | null = process.env.HUNTER_API_KEY || null) {}

  async findEmails(hit: CompanySearchHit): Promise<{ emails: string[]; hit: CompanySearchHit }> {
    if (!this.apiKey) return { emails: [], hit };

    const domain = domainFromWebsite(hit.website);
    if (!domain) return { emails: [], hit };

    try {
      const url = new URL('https://api.hunter.io/v2/domain-search');
      url.searchParams.set('domain', domain);
      url.searchParams.set('api_key', this.apiKey);
      url.searchParams.set('limit', '10');

      const res = await fetch(url.toString());
      if (!res.ok) {
        console.warn('[prospecting] hunter http', res.status);
        return { emails: [], hit };
      }

      const data = (await res.json()) as {
        data?: { emails?: Array<{ value?: string; type?: string }> };
      };
      const emails = (data.data?.emails || [])
        .map((e) => (e.value || '').toLowerCase().trim())
        .filter(Boolean)
        .slice(0, 10);

      const next: CompanySearchHit = { ...hit };
      if (!next.email && emails[0]) next.email = emails[0];
      return { emails, hit: next };
    } catch (err) {
      console.warn('[prospecting] hunter error', err);
      return { emails: [], hit };
    }
  }
}

function domainFromWebsite(website: string | null | undefined): string | null {
  if (!website?.trim()) return null;
  try {
    const withProto = /^https?:\/\//i.test(website) ? website : `https://${website}`;
    const host = new URL(withProto).hostname.replace(/^www\./i, '');
    return host.includes('.') ? host : null;
  } catch {
    return null;
  }
}

export function resolveEmailFinderPort(): EmailFinderPort {
  return new HunterEmailProvider();
}
