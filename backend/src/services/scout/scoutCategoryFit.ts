/**
 * Vérifie qu'un résultat web correspond bien à la catégorie Scout demandée.
 * Évite p.ex. des « formations » classées en appels d'offres.
 */

const TENDER_SIGNAL =
  /appel[s]?\s+d['']offre|march[eé]s?\s+public|consultation\s+publique|avis\s+de\s+march[eé]|cahier\s+des\s+charges|\bao\b|tender|rfp|soumission|bon\s+de\s+commande|procurement|boamp|marchespublics/i;

const TRAINING_SIGNAL =
  /formation|bootcamp|atelier\b|cours\s+certifi|session\s+de\s+formation|inscription\s+.*formation|programme\s+de\s+formation|certificat\s+de\s+formation/i;

const EVENT_SIGNAL =
  /salon\b|conf[eé]rence|forum\b|colloque|summit|webinar|webinaire|journ[eé]e\s+professionnelle|meetup/i;

/** Mots-clés qui polluent les recherches d'appels d'offres. */
const TENDER_POISON_KW =
  /formation|bootcamp|cours|atelier|conf[eé]rence|salon|webinar|webinaire|colloque/i;

export function keywordsForCategory(keywords: string[], category: string): string[] {
  if (category !== 'TENDER') return keywords;
  const cleaned = keywords.map((k) => k.trim()).filter((k) => k && !TENDER_POISON_KW.test(k));
  if (cleaned.length > 0) return cleaned;
  // Dernier recours : retirer le mot « formation » dans le tag
  return keywords
    .map((k) => k.replace(TENDER_POISON_KW, ' ').replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

export function fitsScoutCategory(
  category: string,
  title: string,
  snippet?: string | null,
  aiSummary?: string | null,
): boolean {
  const text = [title, snippet, aiSummary].filter(Boolean).join('\n');
  if (!text.trim()) return false;

  const hasTender = TENDER_SIGNAL.test(text);
  const hasTraining = TRAINING_SIGNAL.test(text);
  const hasEvent = EVENT_SIGNAL.test(text);

  switch (category) {
    case 'TENDER':
      // Formation / salon sans signal AO → hors sujet
      if ((hasTraining || hasEvent) && !hasTender) return false;
      return true;
    case 'EVENT':
      // AO purs ne sont pas des événements ; pure actu sans signal event OK si pas AO-only
      if (hasTender && !hasEvent && !hasTraining) return false;
      return true;
    case 'NEWS':
      // Les pubs de formation datées seront filtrées côté fraîcheur ; ici on laisse passer
      return true;
    default:
      return true;
  }
}

/** Actualité qui n'est en fait qu'une annonce d'événement / formation datée. */
export function isDatedPromoNews(title: string, snippet?: string | null, aiSummary?: string | null): boolean {
  const text = [title, snippet, aiSummary].filter(Boolean).join('\n');
  return TRAINING_SIGNAL.test(text) || EVENT_SIGNAL.test(text);
}
