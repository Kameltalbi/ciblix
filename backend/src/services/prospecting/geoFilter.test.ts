import { describe, expect, it } from 'vitest';
import {
  countryToRegionCode,
  filterHitsBySearchLocation,
  getCityCoords,
  hitMatchesSearchCountry,
} from './geoFilter.js';

describe('geoFilter', () => {
  it('maps Tunisie to TN and resolves Nabeul coords', () => {
    expect(countryToRegionCode('Tunisie')).toBe('TN');
    expect(getCityCoords('Nabeul')).toEqual({ lat: 36.4561, lng: 10.7376 });
  });

  it('rejects Paris/France hits when searching Tunisie', () => {
    const criteria = { country: 'Tunisie', city: 'Nabeul' };
    expect(
      hitMatchesSearchCountry(
        {
          country: 'France',
          city: '75008 Paris',
          phone: '+33 1 42 00 00 00',
          formattedAddress: '75008 Paris, France',
        },
        criteria
      )
    ).toBe(false);

    expect(
      hitMatchesSearchCountry(
        {
          country: 'France',
          city: '93130 Noisy-le-Sec',
          formattedAddress: '93130 Noisy-le-Sec, France',
        },
        criteria
      )
    ).toBe(false);
  });

  it('keeps Tunisian hits', () => {
    const criteria = { country: 'Tunisie', city: 'Nabeul' };
    expect(
      hitMatchesSearchCountry(
        {
          country: 'Tunisie',
          city: 'Nabeul',
          phone: '+216 72 000 000',
          formattedAddress: 'Nabeul, Tunisie',
        },
        criteria
      )
    ).toBe(true);
  });

  it('filters a mixed list', () => {
    const filtered = filterHitsBySearchLocation(
      [
        { companyName: 'OK', country: 'Tunisie', city: 'Nabeul' },
        { companyName: 'Paris', country: 'France', city: 'Paris' },
      ],
      { country: 'Tunisie', city: 'Nabeul' }
    );
    expect(filtered.map((h) => h.companyName)).toEqual(['OK']);
  });
});
