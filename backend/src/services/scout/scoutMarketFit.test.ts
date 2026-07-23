import { describe, expect, it } from 'vitest';
import { fitsScoutMarket, inferMarketCode } from './scoutMarketFit.js';

describe('inferMarketCode', () => {
  it('detects France', () => {
    expect(inferMarketCode(['France', 'France entière'])).toBe('fr');
  });
  it('detects Tunisie', () => {
    expect(inferMarketCode(['Tunis', 'Tunisie'])).toBe('tn');
  });
});

describe('fitsScoutMarket', () => {
  it('rejects Tunisian sites for France', () => {
    expect(
      fitsScoutMarket({
        market: 'fr',
        url: 'https://www.marchespublics.gov.tn/foo',
        title: "Appel d'offres Société des Transports de Tunis",
        snippet: 'Tunisie',
      }),
    ).toBe(false);
  });

  it('rejects tunisie-formation for France', () => {
    expect(
      fitsScoutMarket({
        market: 'fr',
        url: 'https://tunisie-formation.com/bilan-carbone',
        title: 'Formation Bilan Carbone',
      }),
    ).toBe(false);
  });

  it('accepts BOAMP for France', () => {
    expect(
      fitsScoutMarket({
        market: 'fr',
        url: 'https://www.boamp.fr/avis/xxx',
        title: "Appel d'offres bilan carbone",
        snippet: 'Marché public France',
      }),
    ).toBe(true);
  });
});
