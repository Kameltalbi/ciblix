import { describe, expect, it } from 'vitest';
import { buildPlacesSearchBody } from './GooglePlacesNewProvider.js';
import {
  pickIncludedTypeForSector,
  resolveGoogleTypesForSector,
} from './sectorGoogleTypes.js';

describe('sector → Google Places includedType', () => {
  it('secteur connu → types mappés + includedType dans le body', () => {
    const types = resolveGoogleTypesForSector('textile');
    expect(types).toContain('clothing_store');

    const body = buildPlacesSearchBody({
      textQuery: 'textile Tunis Tunisie',
      sector: 'textile',
      country: 'Tunisie',
      city: 'Tunis',
    });
    expect(body).toHaveProperty('includedType');
    expect(typeof body.includedType).toBe('string');
    expect(body.strictTypeFiltering).toBe(false);
  });

  it('secteur inconnu → pas de includedType (Places reste ouvert)', () => {
    expect(resolveGoogleTypesForSector('conseil_strategique')).toBeNull();
    expect(pickIncludedTypeForSector('conseil_strategique')).toBeNull();

    const body = buildPlacesSearchBody({
      textQuery: 'conseil Tunis',
      sector: 'conseil_strategique',
      country: 'Tunisie',
      city: 'Tunis',
    });
    expect(body).not.toHaveProperty('includedType');
  });

  it('variantes font tourner les types Table A', () => {
    const t0 = pickIncludedTypeForSector('transport', 0);
    const t1 = pickIncludedTypeForSector('transport', 1);
    expect(t0).toBeTruthy();
    expect(t1).toBeTruthy();
    expect(t0).not.toBe(t1);
  });

  it('match partiel FR (Industrie agroalimentaire)', () => {
    const types = resolveGoogleTypesForSector('Industrie agroalimentaire');
    expect(types).toEqual(expect.arrayContaining(['food_store', 'wholesaler']));
  });
});
