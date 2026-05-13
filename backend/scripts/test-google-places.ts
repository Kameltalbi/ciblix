/**
 * Test local Google Places (Text Search + key=) sans lancer l’API Express.
 * Usage : depuis `backend/` → `npm run test:places`
 * Ne loggue jamais la clé API.
 */
import { loadEnvFromFile } from '../src/lib/loadEnv.js';
import { GooglePlacesTextSearchProvider } from '../src/services/prospecting/providers/GooglePlacesTextSearchProvider.js';

loadEnvFromFile();

const key =
  process.env.GOOGLE_PLACES_API_KEY?.trim() ||
  process.env.GOOGLE_MAPS_API_KEY?.trim() ||
  process.env.PLACES_API_KEY?.trim();

if (!key) {
  console.error(
    'Aucune clé : définissez GOOGLE_PLACES_API_KEY, GOOGLE_MAPS_API_KEY ou PLACES_API_KEY dans backend/.env'
  );
  process.exit(1);
}

const provider = new GooglePlacesTextSearchProvider(key);
void provider.searchCompanies({
  keywords: 'restaurant',
  city: 'Tunis',
  country: 'Tunisie',
}).then((hits) => {
  console.log('OK — résultats:', hits.length);
  if (hits[0]) {
    console.log(
      'Exemple:',
      hits[0].companyName,
      '| tel:',
      hits[0].phone ? 'oui' : 'non',
      '| web:',
      hits[0].website ? 'oui' : 'non'
    );
  }
});
