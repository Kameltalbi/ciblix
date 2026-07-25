import { describe, expect, it } from 'vitest';
import { looksLikeCompanyName, resolveCompanyNameForContact } from './companyNameGuard.js';

describe('looksLikeCompanyName', () => {
  it('accepte des entreprises / organismes', () => {
    expect(looksLikeCompanyName("Greenov'i")).toBe(true);
    expect(looksLikeCompanyName('Expertise France')).toBe(true);
    expect(looksLikeCompanyName('Bourse de Tunis')).toBe(true);
    expect(looksLikeCompanyName('Be MIT')).toBe(true);
    expect(looksLikeCompanyName('CarboScan SAS')).toBe(true);
    expect(looksLikeCompanyName('TotalEnergies')).toBe(true);
  });

  it('refuse titres d’articles et sujets', () => {
    expect(looksLikeCompanyName('La décarbonation en Tunisie')).toBe(false);
    expect(looksLikeCompanyName('ESG en Tunisie')).toBe(false);
    expect(looksLikeCompanyName('Tunisie')).toBe(false);
    expect(looksLikeCompanyName("Appel à projets innovation climat 2026")).toBe(false);
    expect(looksLikeCompanyName('Actualité : transition énergétique')).toBe(false);
    expect(looksLikeCompanyName('Comment réussir sa décarbonation en Afrique')).toBe(false);
  });
});

describe('resolveCompanyNameForContact', () => {
  it('ne retombe jamais sur le titre', () => {
    expect(
      resolveCompanyNameForContact({
        extractedCompanyName: null,
        signalTitle: 'La décarbonation en Tunisie',
      })
    ).toBeNull();
  });

  it('refuse un companyName égal au titre', () => {
    expect(
      resolveCompanyNameForContact({
        extractedCompanyName: 'ESG en Tunisie',
        signalTitle: 'ESG en Tunisie',
      })
    ).toBeNull();
  });

  it('préfère Places si valide', () => {
    expect(
      resolveCompanyNameForContact({
        extractedCompanyName: 'ESG en Tunisie',
        placesCompanyName: 'Expertise France',
        signalTitle: 'ESG en Tunisie',
      })
    ).toBe('Expertise France');
  });

  it('accepte une org extraite distincte du titre', () => {
    expect(
      resolveCompanyNameForContact({
        extractedCompanyName: 'Greenov’i',
        signalTitle: 'Greenov’i lance un projet ESG en Tunisie',
      })
    ).toBe('Greenov’i');
  });
});
