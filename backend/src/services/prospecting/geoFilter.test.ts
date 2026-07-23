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

  it('keeps Tunisian hits with explicit country', () => {
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

  it('keeps local TN address without the word Tunisie (Places often omits country)', () => {
    const criteria = { country: 'Tunisie', city: 'Nabeul' };
    expect(
      hitMatchesSearchCountry(
        {
          country: 'Nabeul',
          city: 'Avenue Habib Bourguiba',
          phone: '72 286 000',
          formattedAddress: 'Avenue Habib Bourguiba, Nabeul',
        },
        criteria
      )
    ).toBe(true);

    expect(
      hitMatchesSearchCountry(
        {
          country: '8000',
          city: 'Nabeul',
          formattedAddress: '8000 Nabeul',
        },
        criteria
      )
    ).toBe(true);
  });

  it('keeps national TN phone without +216', () => {
    const criteria = { country: 'Tunisie', city: 'Nabeul' };
    expect(
      hitMatchesSearchCountry(
        {
          country: null,
          city: null,
          phone: '98 123 456',
          formattedAddress: null,
        },
        criteria
      )
    ).toBe(true);
  });

  it('filters a mixed list', () => {
    const filtered = filterHitsBySearchLocation(
      [
        { companyName: 'OK', country: 'Tunisie', city: 'Nabeul' },
        { companyName: 'Local', country: 'Nabeul', city: 'Korba', formattedAddress: 'Korba, Nabeul' } as never,
        { companyName: 'Paris', country: 'France', city: 'Paris' },
      ],
      { country: 'Tunisie', city: 'Nabeul' }
    );
    expect(filtered.map((h) => h.companyName)).toEqual(['OK', 'Local']);
  });
});
