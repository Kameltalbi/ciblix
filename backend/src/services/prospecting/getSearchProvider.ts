import type { CompanySearchPort, ProspectingSearchProviderId } from './types.js';
import { MockCompanySearchProvider } from './providers/MockCompanySearchProvider.js';
import { ExternalSearchStub } from './providers/ExternalSearchStub.js';
import { GooglePlacesTextSearchProvider } from './providers/GooglePlacesTextSearchProvider.js';
import { OutscraperProvider } from './providers/OutscraperProvider.js';

/**
 * Fournisseur de recherche :
 * - `PROSPECTING_SEARCH_PROVIDER` : `google_places` (défaut), `mock`, `apollo`, `hunter`, `clearbit`
 * - Google Places : clé dans `GOOGLE_PLACES_API_KEY` ou `GOOGLE_MAPS_API_KEY` (paramètre `key=` côté Google)
 * - Apollo / Hunter : stubs prêts pour branchement ultérieur
 */
export function resolveProspectingSearchProvider(): CompanySearchPort {
  const outscraperKey = process.env.OUTSCRAPER_API_KEY?.trim() || '';
  const placesKey =
    process.env.GOOGLE_PLACES_API_KEY?.trim() ||
    process.env.GOOGLE_MAPS_API_KEY?.trim() ||
    process.env.PLACES_API_KEY?.trim() ||
    '';

  // Auto-detect: Outscraper prioritaire si clé présente, sinon provider env
  const raw = (process.env.PROSPECTING_SEARCH_PROVIDER ||
    (outscraperKey ? 'outscraper' : 'google_places')
  ).toLowerCase() as ProspectingSearchProviderId;

  switch (raw) {
    case 'outscraper':
      if (outscraperKey) {
        return new OutscraperProvider(outscraperKey);
      }
      console.warn('[Prospecting] outscraper sans OUTSCRAPER_API_KEY — repli Google Places.');
      if (placesKey) return new GooglePlacesTextSearchProvider(placesKey);
      return new MockCompanySearchProvider();
    case 'apollo':
      return new ExternalSearchStub('apollo');
    case 'hunter':
      return new ExternalSearchStub('hunter');
    case 'clearbit':
      return new ExternalSearchStub('clearbit');
    case 'google_places':
      if (placesKey) {
        return new GooglePlacesTextSearchProvider(placesKey);
      }
      console.warn('[Prospecting] google_places sans GOOGLE_PLACES_API_KEY — repli mock.');
      return new MockCompanySearchProvider();
    case 'mock':
    default:
      return new MockCompanySearchProvider();
  }
}
