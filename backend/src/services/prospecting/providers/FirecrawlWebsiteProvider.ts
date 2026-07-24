import type { CompanyEnrichmentPort, CompanySearchHit, WebEnrichmentResult } from '../types.js';
import { enrichWebsiteFromUrl, emptyWebEnrichment } from '../websiteEnrichment.js';

/**
 * Enrichissement site via Firecrawl (si FIRECRAWL_API_KEY), sinon crawl natif HTML.
 * Port plugable — d’autres sources (Browse.ai, etc.) peuvent coexister.
 */
export class FirecrawlWebsiteProvider implements CompanyEnrichmentPort {
  readonly id = 'firecrawl';

  constructor(private readonly apiKey: string | null = process.env.FIRECRAWL_API_KEY || null) {}

  async enrichCompany(hit: CompanySearchHit): Promise<{ hit: CompanySearchHit; enrichment: WebEnrichmentResult }> {
    if (!hit.website?.trim()) {
      return { hit, enrichment: emptyWebEnrichment() };
    }

    if (this.apiKey) {
      try {
        const enrichment = await scrapeWithFirecrawl(hit.website, this.apiKey);
        if (!enrichment.fetchError) {
          return { hit: mergeHit(hit, enrichment), enrichment };
        }
        console.warn('[prospecting] firecrawl fallback native', enrichment.fetchError);
      } catch (err) {
        console.warn('[prospecting] firecrawl error', err);
      }
    }

    const enrichment = await enrichWebsiteFromUrl(hit.website);
    enrichment.enrichmentSource = 'native';
    return { hit: mergeHit(hit, enrichment), enrichment };
  }
}

function mergeHit(hit: CompanySearchHit, e: WebEnrichmentResult): CompanySearchHit {
  const out: CompanySearchHit = { ...hit };
  if (!out.email && e.detectedEmails[0]) out.email = e.detectedEmails[0];
  if (!out.phone && e.phoneFromPage) out.phone = e.phoneFromPage;
  if (!out.linkedin && e.linkedinUrlsFound[0]) out.linkedin = e.linkedinUrlsFound[0];
  return out;
}

function extractEmailsFromText(text: string): string[] {
  const re = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const found = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const e = m[0].toLowerCase();
    if (e.length < 120 && !/example\.|sentry\.|wixpress\./i.test(e)) found.add(e);
  }
  return [...found].slice(0, 12);
}

async function scrapeWithFirecrawl(rawUrl: string, apiKey: string): Promise<WebEnrichmentResult> {
  const url = /^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`;
  const res = await fetch('https://api.firecrawl.dev/v1/scrape', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      url,
      formats: ['markdown', 'links', 'html'],
      onlyMainContent: true,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    return {
      ...emptyWebEnrichment(),
      fetchError: `firecrawl_${res.status}:${body.slice(0, 120)}`,
      enrichmentSource: 'firecrawl',
    };
  }

  const data = (await res.json()) as {
    success?: boolean;
    data?: {
      markdown?: string;
      html?: string;
      metadata?: {
        title?: string;
        description?: string;
        sourceURL?: string;
      };
      links?: string[];
    };
  };

  const md = data.data?.markdown || '';
  const html = data.data?.html || '';
  const meta = data.data?.metadata || {};
  const links = (data.data?.links || []).slice(0, 40);
  const textBlob = `${md}\n${html}`;
  const emails = extractEmailsFromText(textBlob);
  const importantPages = links
    .filter((l) =>
      /about|service|produit|product|contact|offre|solution|pricing|tarif|equipe|team/i.test(l)
    )
    .slice(0, 12);

  const tech: string[] = [];
  const low = textBlob.toLowerCase();
  if (low.includes('wordpress') || low.includes('wp-content')) tech.push('WordPress');
  if (low.includes('shopify')) tech.push('Shopify');
  if (low.includes('hubspot')) tech.push('HubSpot');
  if (low.includes('react') || low.includes('next.js')) tech.push('React/Next');
  if (low.includes('google-analytics') || low.includes('gtag')) tech.push('Google Analytics');

  const hasSsl = (meta.sourceURL || url).startsWith('https://');
  const seoScore = Math.min(
    100,
    (meta.title ? 25 : 0) + (meta.description ? 25 : 0) + (emails.length ? 15 : 0) + (importantPages.length ? 15 : 0) + (hasSsl ? 20 : 0)
  );

  return {
    websiteTitle: meta.title || null,
    websiteDescription: meta.description || md.slice(0, 500) || null,
    detectedEmails: emails,
    phoneFromPage: null,
    facebookUrl: links.find((l) => /facebook\.com/i.test(l)) || null,
    instagramUrl: links.find((l) => /instagram\.com/i.test(l)) || null,
    linkedinUrlsFound: links.filter((l) => /linkedin\.com/i.test(l)).slice(0, 3),
    faviconUrl: null,
    hasResponsiveWebsite: true,
    hasSsl,
    seoScore,
    digitalPresenceLevel: seoScore >= 62 ? 'FORT' : seoScore >= 38 ? 'MOYEN' : 'FAIBLE',
    technologiesDetected: tech,
    fetchedUrl: meta.sourceURL || url,
    fetchError: null,
    importantPages,
    productsServices: [],
    sectorsFromSite: [],
    enrichmentSource: 'firecrawl',
  };
}

export function resolveWebsiteEnrichmentPort(): CompanyEnrichmentPort {
  return new FirecrawlWebsiteProvider();
}
