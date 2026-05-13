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

/** Données de démo déterministes pour PME sans clé API fournisseur. */
export class MockCompanySearchProvider implements CompanySearchPort {
  readonly id = 'mock' as const;

  async searchCompanies(criteria: CompanySearchCriteria): Promise<CompanySearchHit[]> {
    const country = criteria.country?.trim() || 'Tunisie';
    const city = criteria.city?.trim() || 'Tunis';
    const sector = criteria.sector?.trim() || 'Services';
    const kw = criteria.keywords?.trim() || 'entreprise';
    const size = criteria.companySize?.trim() || '11-50';

    const base = slug(`${kw}-${city}`, 24);
    const names = [
      `${sector} ${city} — ${kw}`.slice(0, 72),
      `Groupe ${kw} ${country}`.slice(0, 72),
      `${city} ${sector} Solutions`.slice(0, 72),
      `Atelier ${kw} & Co`.slice(0, 72),
      `${sector} Pro ${city}`.slice(0, 72),
      `Hub ${kw} ${country}`.slice(0, 72),
    ];

    return names.map((companyName, i) => ({
      companyName,
      website: `https://www.${base || 'demo'}-${i + 1}.example.com`,
      linkedin: `https://www.linkedin.com/company/${base || 'demo'}-${i + 1}`,
      phone: `+216 ${70 + i} ${100 + i * 7} ${200 + i}`,
      email: i % 2 === 0 ? `contact@${base || 'demo'}${i + 1}.example.com` : null,
      city,
      country,
      industry: sector,
      companySize: size,
      externalId: `mock:${base}:${i}`,
    }));
  }
}
