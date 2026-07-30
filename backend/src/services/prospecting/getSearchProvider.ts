import type { CompanySearchPort, ProspectingSearchProviderId } from './types.js';
import { MockCompanySearchProvider } from './providers/MockCompanySearchProvider.js';
import { ExternalSearchStub } from './providers/ExternalSearchStub.js';
import { GooglePlacesNewProvider } from './providers/GooglePlacesNewProvider.js';
import { OutscraperProvider } from './providers/OutscraperProvider.js';
import { BingSearchProvider } from './providers/BingSearchProvider.js';
import { GoogleCustomSearchProvider } from './providers/GoogleCustomSearchProvider.js';
import { allowMockProspecting } from './mockPolicy.js';

/**
 * Fournisseur de recherche :
 * - Actif : `google_places` / `outscraper` si clé API
 * - Mock UNIQUEMENT si PROSPECTING_ALLOW_MOCK=1 (sinon liste vide — jamais d’entreprises inventées en prod)
 */
export function resolveProspectingSearchProvider(): CompanySearchPort {
  const outscraperKey = process.env.OUTSCRAPER_API_KEY?.trim() || '';
  const placesKey =
    process.env.GOOGLE_PLACES_API_KEY?.trim() ||
    process.env.GOOGLE_MAPS_API_KEY?.trim() ||
    process.env.PLACES_API_KEY?.trim() ||
    '';

  const raw = (process.env.PROSPECTING_SEARCH_PROVIDER ||
    (outscraperKey ? 'outscraper' : 'google_places')
  ).toLowerCase() as ProspectingSearchProviderId;

  const mockOrEmpty = (): CompanySearchPort => {
    if (allowMockProspecting()) return new MockCompanySearchProvider();
    console.warn('[Prospecting] aucune clé API recherche — résultats vides (pas de mock).');
    return {
      id: 'mock',
      async searchCompanies() {
        return [];
      },
    };
  };

  switch (raw) {
    case 'outscraper':
      if (outscraperKey) {
        return new OutscraperProvider(outscraperKey);
      }
      console.warn('[Prospecting] outscraper sans OUTSCRAPER_API_KEY — repli Google Places.');
      if (placesKey) return new GooglePlacesNewProvider(placesKey);
      return mockOrEmpty();
    case 'bing_search':
      return new BingSearchProvider();
    case 'google_cse':
      return new GoogleCustomSearchProvider();
    case 'apollo':
      return new ExternalSearchStub('apollo');
    case 'hunter':
      return new ExternalSearchStub('hunter');
    case 'clearbit':
      return new ExternalSearchStub('clearbit');
    case 'google_places':
      if (placesKey) {
        return new GooglePlacesNewProvider(placesKey);
      }
      console.warn('[Prospecting] google_places sans GOOGLE_PLACES_API_KEY.');
      return mockOrEmpty();
    case 'mock':
      return mockOrEmpty();
    default:
      if (placesKey) return new GooglePlacesNewProvider(placesKey);
      return mockOrEmpty();
  }
}
