const LEGAL_FORMS =
  /\b(sarl|sa|suarl|sas|sasu|ste|ste\.|sté|societe|société|society|company|co|ets|etablissement|établissement|ltd|llc|gmbh|spa|eurl|inc|plc)\b/gi;

export function stripAccents(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/** Normalisation nom pour dédup niveau 3. */
export function normalizeCompanyName(name: string): string {
  return stripAccents(name)
    .toLowerCase()
    .replace(LEGAL_FORMS, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function extractDomain(website: string | null | undefined): string | null {
  if (!website?.trim()) return null;
  try {
    const raw = /^https?:\/\//i.test(website) ? website : `https://${website}`;
    const host = new URL(raw).hostname.toLowerCase().replace(/^www\./, '');
    if (!host || host === 'localhost') return null;
    return host;
  } catch {
    return null;
  }
}

function tokenSoftMatch(a: string, b: string): boolean {
  if (a === b) return true;
  const shorter = a.length <= b.length ? a : b;
  const longer = a.length <= b.length ? b : a;
  // industrie / industries, etoile / etoiles
  if (longer.startsWith(shorter) && longer.length - shorter.length <= 2) return true;
  return false;
}

/** Similarité Jaccard sur tokens + soft-match pluriel/suffixe (0–1). */
export function nameSimilarity(a: string, b: string): number {
  const ta = normalizeCompanyName(a).split(' ').filter((t) => t.length > 1);
  const tb = normalizeCompanyName(b).split(' ').filter((t) => t.length > 1);
  if (!ta.length || !tb.length) return 0;
  let inter = 0;
  const used = new Set<number>();
  for (const t of ta) {
    const idx = tb.findIndex((u, i) => !used.has(i) && tokenSoftMatch(t, u));
    if (idx >= 0) {
      used.add(idx);
      inter++;
    }
  }
  return inter / (ta.length + tb.length - inter);
}

export const SOURCE_TRUST: Record<string, number> = {
  registre_officiel: 1,
  site_officiel: 0.85,
  appel_offres: 0.75,
  annuaire: 0.6,
  reseau_social: 0.45,
  signalement_tenant: 0.35,
};
