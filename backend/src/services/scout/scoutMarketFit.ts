/**
 * Filtre géographique Scout — un résultat Tunisie ne doit pas
 * apparaître quand le marché choisi est la France (et inversement).
 */

export type ScoutMarketCode = 'tn' | 'fr' | 'dz' | 'ma' | 'be' | 'ca' | 'sn' | 'ci' | '';

const MARKET_FROM_ZONE: Array<{ re: RegExp; code: ScoutMarketCode }> = [
  { re: /tunisie|tunis|sfax|sousse|nabeul|hammamet|monastir|bizerte|gabès|gabes|kairouan/i, code: 'tn' },
  { re: /france|paris|lyon|marseille|lille|toulouse|bordeaux|nantes|nice|strasbourg|île-de-france|ile-de-france/i, code: 'fr' },
  { re: /algérie|algerie|alger|oran|constantine/i, code: 'dz' },
  { re: /maroc|casablanca|rabat|marrakech/i, code: 'ma' },
  { re: /belgique|bruxelles|anvers/i, code: 'be' },
  { re: /canada|montréal|montreal|toronto|québec|quebec/i, code: 'ca' },
  { re: /sénégal|senegal|dakar/i, code: 'sn' },
  { re: /côte d['']ivoire|cote d['']ivoire|abidjan/i, code: 'ci' },
];

/** Déduit le marché depuis les zones du profil (le 1er match « pays » prime). */
export function inferMarketCode(geoZones: string[]): ScoutMarketCode {
  const hay = geoZones.join(' ');
  // Priorité aux libellés pays entiers
  if (/tunisie\s*entière|tunisie(?!\s)/i.test(hay) || /\btunisie\b/i.test(hay)) return 'tn';
  if (/france\s*entière|\bfrance\b/i.test(hay)) return 'fr';
  if (/\balgérie\b|\balgerie\b/i.test(hay)) return 'dz';
  if (/\bmaroc\b/i.test(hay)) return 'ma';
  if (/\bbelgique\b/i.test(hay)) return 'be';
  if (/\bcanada\b/i.test(hay)) return 'ca';
  if (/\bsénégal\b|\bsenegal\b/i.test(hay)) return 'sn';
  if (/côte d|cote d/i.test(hay)) return 'ci';
  if (/\binternational\b|\bmonde\b|\beurope\b/i.test(hay)) return '';
  for (const { re, code } of MARKET_FROM_ZONE) {
    if (re.test(hay)) return code;
  }
  return '';
}

export function marketLabel(code: ScoutMarketCode): string {
  const map: Record<string, string> = {
    tn: 'Tunisie', fr: 'France', dz: 'Algérie', ma: 'Maroc',
    be: 'Belgique', ca: 'Canada', sn: 'Sénégal', ci: "Côte d'Ivoire",
  };
  return map[code] || 'marché ciblé';
}

/** Signaux forts d'un autre pays — à rejeter pour le marché courant. */
const FOREIGN_FOR: Record<string, RegExp> = {
  fr: /\.tn\b|marchespublics\.gov\.tn|tunisie-formation|tunisie|\btunis\b|sousse|sfax|nabeul|hammamet|monastir|steg\.com\.tn|tunisair/i,
  tn: /\bboamp\.fr\b|marches-publics\.gouv\.fr|\bfrance entière\b|préfecture|collectivité territoriale française/i,
  dz: /\.tn\b|marchespublics\.gov\.tn|\bboamp\.fr\b/i,
  ma: /\.tn\b|marchespublics\.gov\.tn|\bboamp\.fr\b/i,
  be: /\.tn\b|marchespublics\.gov\.tn/i,
  ca: /\.tn\b|marchespublics\.gov\.tn/i,
  sn: /\.tn\b|marchespublics\.gov\.tn|\bboamp\.fr\b/i,
  ci: /\.tn\b|marchespublics\.gov\.tn|\bboamp\.fr\b/i,
};

/** Domaines / motifs typiques du bon marché (bonus — pas obligatoire). */
const HOME_HINT: Record<string, RegExp> = {
  fr: /\.fr\b|boamp|marches-publics\.gouv|klekoon|achatpublic|aws\.e-marchespublics/i,
  tn: /\.tn\b|marchespublics\.gov\.tn|tunisie/i,
};

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return '';
  }
}

export function fitsScoutMarket(opts: {
  market: ScoutMarketCode;
  url: string;
  title?: string | null;
  snippet?: string | null;
  aiSummary?: string | null;
  location?: string | null;
  source?: string | null;
}): boolean {
  if (!opts.market) return true;

  const host = hostOf(opts.url) || (opts.source || '').toLowerCase();
  const blob = [opts.title, opts.snippet, opts.aiSummary, opts.location, host, opts.url]
    .filter(Boolean)
    .join('\n');

  const foreign = FOREIGN_FOR[opts.market];
  if (foreign && foreign.test(blob)) return false;

  // TLD .tn hors marché Tunisie
  if (opts.market !== 'tn' && (/\.tn\b/i.test(host) || /\.tn\//i.test(opts.url))) return false;
  // Site officiel AO Tunisie hors TN
  if (opts.market !== 'tn' && /marchespublics\.gov\.tn/i.test(opts.url)) return false;

  return true;
}
