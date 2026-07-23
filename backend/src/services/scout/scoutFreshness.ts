/**
 * Détecte si une opportunité Scout (événement / AO) est déjà passée
 * d'après deadline, titre, extrait ou résumé.
 */

const FR_MONTHS: Record<string, number> = {
  janvier: 1, jan: 1, january: 1,
  fevrier: 2, février: 2, feb: 2, february: 2,
  mars: 3, mar: 3, march: 3,
  avril: 4, apr: 4, april: 4,
  mai: 5, may: 5,
  juin: 6, jun: 6, june: 6,
  juillet: 7, jul: 7, july: 7,
  aout: 8, août: 8, aug: 8, august: 8,
  septembre: 9, sep: 9, sept: 9, september: 9,
  octobre: 10, oct: 10, october: 10,
  novembre: 11, nov: 11, november: 11,
  decembre: 12, décembre: 12, dec: 12, december: 12,
};

function startOfToday(now = new Date()): Date {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function parseYmd(y: number, m: number, d: number): Date | null {
  if (!y || m < 1 || m > 12 || d < 1 || d > 31) return null;
  const dt = new Date(y, m - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) return null;
  return dt;
}

/** Retourne la date la plus tardive trouvée dans le texte (fin d'événement / deadline). */
export function extractLatestDateFromText(text: string): Date | null {
  if (!text?.trim()) return null;
  const hay = text.normalize('NFD').replace(/\p{M}/gu, '');
  const daySpecific: Date[] = [];
  const monthOnly: Date[] = [];

  // ISO / YYYY-MM-DD
  for (const m of hay.matchAll(/\b(20\d{2})-(\d{1,2})-(\d{1,2})\b/g)) {
    const d = parseYmd(+m[1], +m[2], +m[3]);
    if (d) daySpecific.push(d);
  }

  // DD/MM/YYYY or DD-MM-YYYY
  for (const m of hay.matchAll(/\b(\d{1,2})[\/\-.](\d{1,2})[\/\-.](20\d{2})\b/g)) {
    const d = parseYmd(+m[3], +m[2], +m[1]);
    if (d) daySpecific.push(d);
  }

  // "26 & 27 juin 2025", "14-16 Juillet 2025", "27 juin 2025"
  const monthNames = Object.keys(FR_MONTHS).join('|');
  const reRange = new RegExp(
    `\\b(\\d{1,2})(?:\\s*(?:&|et|-|–|—)\\s*(\\d{1,2}))?\\s+(${monthNames})\\s+(20\\d{2})\\b`,
    'gi',
  );
  for (const m of hay.matchAll(reRange)) {
    const month = FR_MONTHS[m[3].toLowerCase()];
    const day = +(m[2] || m[1]);
    const d = parseYmd(+m[4], month, day);
    if (d) daySpecific.push(d);
  }

  // "juin 2025" / "juillet 2025" → fin du mois (seulement si pas de jour précis)
  const reMonthYear = new RegExp(`\\b(${monthNames})\\s+(20\\d{2})\\b`, 'gi');
  for (const m of hay.matchAll(reMonthYear)) {
    const month = FR_MONTHS[m[1].toLowerCase()];
    const year = +m[2];
    const lastDay = new Date(year, month, 0).getDate();
    const d = parseYmd(year, month, lastDay);
    if (d) monthOnly.push(d);
  }

  const pool = daySpecific.length > 0 ? daySpecific : monthOnly;
  if (pool.length === 0) return null;
  return pool.reduce((a, b) => (a > b ? a : b));
}

export function isPastScoutOpportunity(opts: {
  category: string;
  title?: string | null;
  snippet?: string | null;
  aiSummary?: string | null;
  deadline?: string | null;
  now?: Date;
}): boolean {
  const cat = opts.category;
  if (cat !== 'EVENT' && cat !== 'TENDER') return false;

  const blob = [opts.deadline, opts.title, opts.snippet, opts.aiSummary]
    .filter(Boolean)
    .join('\n');

  const latest = extractLatestDateFromText(blob);
  if (!latest) return false;

  return latest < startOfToday(opts.now);
}
