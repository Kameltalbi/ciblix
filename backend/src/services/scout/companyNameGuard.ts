/**
 * Distingue un nom d’organisation d’un titre d’article / AO / sujet.
 * Les fiches Contact ne doivent jamais être créées à partir d’un titre.
 */

const LEGAL_FORM =
  /\b(sarl|sa|sas|sasu|eurl|sci|snc|scs|sca|ltd|llc|inc|corp|gmbh|ag|bv|nv|plc|spa|srl|oy|ab|pty|kk|co\.?|company|groupe|group|holding)\b/i;

const ARTICLE_OR_SIGNAL =
  /\b(appel[s]?\s+[àa]\s+(projets?|manifestations?|candidatures?)|appel[s]?\s+d['’]offres?|ao\b|rfp\b|rfq\b|marché\s+public|actualité|actu\b|news\b|article|blog|dossier|tribune|éditorial|interview|reportage|conférence|salon|webinar|webinaire|formation|atelier|comment\b|pourquoi\b|quand\b|vers\s+une|face\s+[àa]|enjeux?\b|tendance|guide\b|livre\s+blanc)\b/i;

const TOPIC_IN_GEO =
  /\b(décarbonation|decarbonation|esg|rse|climat|énergie|energie|investissement|innovation|digital|transition)\b.{0,40}\b(en|au|aux|à|a)\s+[A-Za-zÀ-ÿ]{3,}/i;

const GEO_ONLY =
  /^(tunisie|france|maroc|algérie|algerie|sénégal|senegal|côte\s+d['’]ivoire|afrique|europe|monde|international)$/i;

/** Titres du type « X en Tunisie », « Y : le guide », trop génériques. */
function looksLikeHeadline(name: string): boolean {
  const t = name.trim();
  if (t.length > 90) return true;
  const words = t.split(/\s+/).filter(Boolean);
  if (words.length >= 8 && !LEGAL_FORM.test(t)) return true;
  if (/^[«"']/.test(t) || /[?!…]$/.test(t)) return true;
  if (/^[A-ZÀ-Ÿ][^A-Z]*\s+(en|au|aux|à)\s+[A-ZÀ-Ÿ]/.test(t) && words.length >= 3 && !LEGAL_FORM.test(t)) {
    return true;
  }
  if (TOPIC_IN_GEO.test(t)) return true;
  if (ARTICLE_OR_SIGNAL.test(t)) return true;
  if (GEO_ONLY.test(t)) return true;
  // Trop proche d’un titre d’opportunité collé tel quel
  if (/\s[-–—:|]\s/.test(t) && words.length >= 4 && !LEGAL_FORM.test(t)) return true;
  return false;
}

/**
 * true si la chaîne ressemble à une entreprise / organisme, pas à un article.
 */
export function looksLikeCompanyName(raw: string | null | undefined): boolean {
  if (!raw) return false;
  const name = raw.trim().replace(/\s+/g, ' ');
  if (name.length < 2 || name.length > 120) return false;
  if (looksLikeHeadline(name)) return false;

  const words = name.split(/\s+/).filter(Boolean);
  if (words.length === 0) return false;

  // Forme juridique = fort signal org
  if (LEGAL_FORM.test(name)) return true;

  // 1–6 tokens, pas de ponctuation de titre, pas de motif article
  if (words.length <= 6 && !/[?!…]/.test(name) && !ARTICLE_OR_SIGNAL.test(name)) {
    // Évite les sujets tout en minuscules type "décarbonation"
    const hasCapital = /[A-ZÀ-Ÿ]/.test(name) || /[A-Za-zÀ-ÿ]{2,}/.test(name);
    if (!hasCapital) return false;
    // Un seul mot très générique
    if (words.length === 1 && GEO_ONLY.test(name)) return false;
    return true;
  }

  return false;
}

/**
 * Choisit un nom d’entreprise utilisable pour une fiche Contact.
 * Ne retombe jamais sur le titre du signal / article.
 */
export function resolveCompanyNameForContact(opts: {
  extractedCompanyName?: string | null;
  placesCompanyName?: string | null;
  signalTitle?: string | null;
}): string | null {
  const places = opts.placesCompanyName?.trim() || null;
  if (places && looksLikeCompanyName(places)) return places;

  const extracted = opts.extractedCompanyName?.trim() || null;
  if (extracted && looksLikeCompanyName(extracted)) {
    // Si l’IA a recopié le titre, on refuse
    const title = opts.signalTitle?.trim();
    if (title && extracted.toLowerCase() === title.toLowerCase()) return null;
    if (title && looksLikeHeadline(extracted)) return null;
    return extracted;
  }

  return null;
}
