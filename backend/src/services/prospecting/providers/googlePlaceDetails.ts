import type { CompanySearchHit } from '../types.js';

/**
 * Google Places API (New) — Place Details pour compléter téléphone / site / Maps.
 * Env : GOOGLE_PLACES_API_KEY | GOOGLE_MAPS_API_KEY | PLACES_API_KEY
 */
export async function fetchGooglePlaceDetails(placeId: string): Promise<Partial<CompanySearchHit> | null> {
  const apiKey =
    process.env.GOOGLE_PLACES_API_KEY ||
    process.env.GOOGLE_MAPS_API_KEY ||
    process.env.PLACES_API_KEY;
  if (!apiKey || !placeId) return null;

  const id = placeId.startsWith('places/') ? placeId.replace(/^places\//, '') : placeId;
  const url = `https://places.googleapis.com/v1/places/${encodeURIComponent(id)}`;

  try {
    const res = await fetch(url, {
      headers: {
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask':
          'id,displayName,formattedAddress,internationalPhoneNumber,nationalPhoneNumber,websiteUri,googleMapsUri,location,addressComponents',
      },
    });
    if (!res.ok) {
      console.warn('[prospecting] place details', res.status);
      return null;
    }

    const r = (await res.json()) as {
      id?: string;
      displayName?: { text?: string };
      formattedAddress?: string;
      internationalPhoneNumber?: string;
      nationalPhoneNumber?: string;
      websiteUri?: string;
      googleMapsUri?: string;
      location?: { latitude?: number; longitude?: number };
      addressComponents?: Array<{ longText?: string; types?: string[] }>;
    };

    const components = r.addressComponents || [];
    const city =
      components.find((c) => c.types?.includes('locality'))?.longText ||
      components.find((c) => c.types?.includes('postal_town'))?.longText ||
      null;
    const country = components.find((c) => c.types?.includes('country'))?.longText || null;

    return {
      companyName: r.displayName?.text || undefined,
      phone: r.internationalPhoneNumber || r.nationalPhoneNumber || null,
      website: r.websiteUri || null,
      address: r.formattedAddress || null,
      googleMapsUrl: r.googleMapsUri || null,
      city,
      country,
      lat: r.location?.latitude ?? null,
      lng: r.location?.longitude ?? null,
      externalId: r.id || id,
      raw: { placeDetails: true, formattedAddress: r.formattedAddress },
    };
  } catch (err) {
    console.warn('[prospecting] place details error', err);
    return null;
  }
}

/** Enrichit un hit avec Place Details si externalId présent. */
export async function enrichHitWithPlaceDetails(hit: CompanySearchHit): Promise<CompanySearchHit> {
  const enabled =
    process.env.PROSPECTING_PLACES_DETAILS !== '0' &&
    process.env.PROSPECTING_PLACES_DETAILS !== 'false';
  if (!enabled || !hit.externalId) return hit;

  const details = await fetchGooglePlaceDetails(hit.externalId);
  if (!details) return hit;

  return {
    ...hit,
    phone: hit.phone || details.phone || null,
    website: hit.website || details.website || null,
    address: hit.address || details.address || null,
    googleMapsUrl: hit.googleMapsUrl || details.googleMapsUrl || null,
    city: hit.city || details.city || null,
    country: hit.country || details.country || null,
    lat: hit.lat ?? details.lat ?? null,
    lng: hit.lng ?? details.lng ?? null,
    raw: { ...(hit.raw || {}), ...(details.raw || {}) },
  };
}
