import type { CompanySearchCriteria, CompanySearchHit, CompanySearchPort } from '../types.js';

function slug(s: string, max = 32) {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, max);
}

/** Données de démo déterministes pour PME sans clé API fournisseur (~36 lignes pour tester l’import massif). */
export class MockCompanySearchProvider implements CompanySearchPort {
  readonly id = 'mock' as const;

  async searchCompanies(criteria: CompanySearchCriteria): Promise<CompanySearchHit[]> {
    const country = criteria.country?.trim() || 'Tunisie';
    const city = criteria.city?.trim() || 'Tunis';
    const sector = criteria.sector?.trim() || 'Services';
    const kw = criteria.keywords?.trim() || 'entreprise';
    const size = criteria.companySize?.trim() || '11-50';

    const base = slug(`${kw}-${city}`, 24);
    const hits: CompanySearchHit[] = [];

    for (let i = 0; i < 36; i++) {
      const companyName = `${sector} ${kw} — ${city} #${i + 1}`.slice(0, 80);
      hits.push({
        companyName,
        website: `https://www.${base || 'demo'}-${i + 1}.example.com`,
        linkedin: `https://www.linkedin.com/company/${base || 'demo'}-${i + 1}`,
        phone: `+216 ${70 + (i % 9)} ${100 + i * 3} ${200 + i}`,
        email: i % 3 === 0 ? `contact@${(base || 'demo').replace(/-/g, '')}${i + 1}.example.com` : null,
        city,
        country,
        industry: sector,
        companySize: size,
        externalId: `mock:${base}:${i}`,
      });
    }

    return hits;
  }
}
