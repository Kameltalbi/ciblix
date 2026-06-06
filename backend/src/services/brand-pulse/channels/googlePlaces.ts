export function getGooglePlacesApiKey(): string | null {
  return (
    process.env.GOOGLE_PLACES_API_KEY?.trim() ||
    process.env.GOOGLE_MAPS_API_KEY?.trim() ||
    process.env.PLACES_API_KEY?.trim() ||
    null
  );
}

export async function searchPlaceByText(textQuery: string): Promise<{ placeId: string; name: string } | null> {
  const apiKey = getGooglePlacesApiKey();
  if (!apiKey) return null;

  const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': 'places.id,places.displayName',
    },
    body: JSON.stringify({ textQuery, maxResultCount: 1 }),
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) return null;
  const json = (await res.json()) as {
    places?: Array<{ id?: string; displayName?: { text?: string } }>;
  };
  const place = json.places?.[0];
  if (!place?.id) return null;
  return { placeId: place.id, name: place.displayName?.text || textQuery };
}

export async function fetchPlaceReviews(placeId: string): Promise<{
  rating: number | null;
  reviewCount: number;
  recentNegative: number;
} | null> {
  const apiKey = getGooglePlacesApiKey();
  if (!apiKey) return null;

  const res = await fetch(`https://places.googleapis.com/v1/places/${placeId}`, {
    headers: {
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': 'rating,userRatingCount,reviews',
    },
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) return null;
  const json = (await res.json()) as {
    rating?: number;
    userRatingCount?: number;
    reviews?: Array<{ rating?: number }>;
  };

  const recentNegative = (json.reviews || []).filter((r) => (r.rating ?? 5) <= 2).length;
  return {
    rating: json.rating ?? null,
    reviewCount: json.userRatingCount ?? 0,
    recentNegative,
  };
}

export function reviewsToScore(rating: number | null, reviewCount: number): number {
  if (rating == null) return 40;
  const ratingPart = (rating / 5) * 70;
  const volumePart = Math.min(reviewCount, 50) * 0.6;
  return Math.round(Math.min(100, ratingPart + volumePart));
}
