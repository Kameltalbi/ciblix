/** Phase 5 — score presse & blogs via Google Custom Search. */
export async function scorePressChannel(
  brandName: string,
  sector: string | null,
): Promise<{ score: number; details: Record<string, unknown> }> {
  const apiKey = process.env.GOOGLE_CSE_API_KEY || process.env.GOOGLE_PLACES_API_KEY;
  const cseId = process.env.GOOGLE_CSE_ID;

  if (!apiKey || !cseId) {
    return {
      score: 45,
      details: {
        comingSoon: false,
        estimated: true,
        message: 'GOOGLE_CSE_API_KEY + GOOGLE_CSE_ID requis pour un score presse réel.',
      },
    };
  }

  const q = `"${brandName}"${sector ? ` ${sector}` : ''} actualité OR blog OR presse`;
  const params = new URLSearchParams({ key: apiKey, cx: cseId, q, num: '10', lr: 'lang_fr' });

  try {
    const res = await fetch(`https://www.googleapis.com/customsearch/v1?${params}`, {
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) {
      return { score: 40, details: { error: 'CSE indisponible', estimated: true } };
    }
    const json = (await res.json()) as {
      items?: Array<{ title: string; link: string; snippet: string }>;
      searchInformation?: { totalResults?: string };
    };
    const items = json.items || [];
    const total = Number(json.searchInformation?.totalResults || items.length);
    const hitScore = Math.min(60, items.length * 8);
    const volumeScore = Math.min(40, Math.floor(total / 50));
    const score = Math.min(100, hitScore + volumeScore);

    return {
      score,
      details: {
        comingSoon: false,
        mentionCount: items.length,
        totalResults: total,
        topHits: items.slice(0, 5).map((i) => ({ title: i.title, link: i.link })),
      },
    };
  } catch {
    return { score: 40, details: { estimated: true, message: 'Erreur recherche presse' } };
  }
}
