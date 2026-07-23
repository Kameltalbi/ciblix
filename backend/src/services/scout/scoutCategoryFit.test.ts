import { describe, expect, it } from 'vitest';
import { fitsScoutCategory, keywordsForCategory, isDatedPromoNews } from './scoutCategoryFit.js';

describe('fitsScoutCategory', () => {
  it('rejects formation for TENDER', () => {
    expect(
      fitsScoutCategory(
        'TENDER',
        'Formation Bilan Carbone à Tunis - 26 & 27 juin 2025',
        'Formation certifiée Archibat',
      ),
    ).toBe(false);
  });

  it('accepts real tender', () => {
    expect(
      fitsScoutCategory(
        'TENDER',
        "Appel d'offres — audit bilan carbone",
        'Marché public Tunisie consultation',
      ),
    ).toBe(true);
  });

  it('rejects salon without tender signal for TENDER', () => {
    expect(fitsScoutCategory('TENDER', 'Salon RSE Tunis 2026', 'Conférence professionnelle')).toBe(false);
  });
});

describe('keywordsForCategory', () => {
  it('strips formation from tender keywords', () => {
    expect(keywordsForCategory(['bilan carbone', 'formation professionnelle'], 'TENDER')).toEqual([
      'bilan carbone',
    ]);
  });
});

describe('isDatedPromoNews', () => {
  it('detects training promo', () => {
    expect(isDatedPromoNews('Bootcamp Décarbonation - Formation du 7 au 28 Février 2025')).toBe(true);
  });
});
