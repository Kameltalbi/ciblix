import type { CompanySearchPort, ProspectingSearchProviderId } from './types.js';
import { MockCompanySearchProvider } from './providers/MockCompanySearchProvider.js';
import { ExternalSearchStub } from './providers/ExternalSearchStub.js';
import { GooglePlacesNewProvider } from './providers/GooglePlacesNewProvider.js';
import { OutscraperProvider } from './providers/OutscraperProvider.js';
import { BingSearchProvider } from './providers/BingSearchProvider.js';
import { GoogleCustomSearchProvider } from './providers/GoogleCustomSearchProvider.js';

/**
 * Fournisseur de recherche :
 * - Actif maintenant : `google_places` (défaut) + OpenAI au qualify
 * - Prêts pour plus tard : `bing_search`, `google_cse` (scraping site déjà dans le pipeline)
 * - Stubs : apollo, hunter (recherche), clearbit
 *
 * Env `PROSPECTING_SEARCH_PROVIDER` sélectionne le moteur de recherche.
 * Le scrape des sites trouvés est indépendant (Firecrawl | HTML natif) dans enrichmentPipeline.
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

  switch (raw) {
    case 'outscraper':
      if (outscraperKey) {
        return new OutscraperProvider(outscraperKey);
      }
      console.warn('[Prospecting] outscraper sans OUTSCRAPER_API_KEY — repli Google Places.');
      if (placesKey) return new GooglePlacesNewProvider(placesKey);
      return new MockCompanySearchProvider();
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
      console.warn('[Prospecting] google_places sans GOOGLE_PLACES_API_KEY — repli mock.');
      return new MockCompanySearchProvider();
    case 'mock':
    default:
      return new MockCompanySearchProvider();
  }
}
