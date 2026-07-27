import { describe, expect, it } from 'vitest';
import { matchProduct } from './productMatcher.js';

describe('matchProduct', () => {
  it('recommande CarboScan pour profil industriel', () => {
    expect(
      matchProduct({ company: 'Usine Métal Industrie', jobTitle: 'Directeur production' })
    ).toBe('CARBOSCAN');
  });

  it('recommande SoftFacture pour cabinet comptable', () => {
    expect(matchProduct({ company: 'Cabinet comptable Dupont', sector: 'comptabilité' })).toBe(
      'SOFTFACTURE'
    );
  });

  it('recommande les deux pour architecte', () => {
    expect(matchProduct({ jobTitle: 'Architecte DPLG', company: 'BET Structure' })).toBe('BOTH');
  });

  it('respecte le choix forcé', () => {
    expect(matchProduct({ company: 'PME' }, undefined, 'CARBOSCAN')).toBe('CARBOSCAN');
  });
});
