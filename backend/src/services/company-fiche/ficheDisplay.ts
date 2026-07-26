/**
 * Affichage fiche — logique pure (partagée côté tests backend).
 * Miroir de frontend/src/components/fiche-entreprise/ficheDisplay.ts
 */

export type ObjectionTag =
  | 'budget'
  | 'timing'
  | 'concurrent'
  | 'besoin'
  | 'decideur_absent'
  | 'autre';

const OBJECTION_MAP: Array<{ tag: ObjectionTag; patterns: RegExp[] }> = [
  { tag: 'budget', patterns: [/budget/i, /prix/i, /co[uû]t/i, /cher/i] },
  {
    tag: 'timing',
    patterns: [/timing/i, /plus\s*tard/i, /septembre|rentr[eé]e|ramadan/i, /pas\s*maintenant/i],
  },
  { tag: 'concurrent', patterns: [/concurrent/i, /autre\s*solution/i] },
  { tag: 'besoin', patterns: [/pas\s*de\s*besoin/i, /inutile/i] },
  { tag: 'decideur_absent', patterns: [/d[eé]cideur/i, /absent/i] },
];

export function normalizeObjectionTags(raw: string[] | null | undefined): ObjectionTag[] {
  if (!raw?.length) return [];
  const out = new Set<ObjectionTag>();
  for (const r of raw) {
    const s = r.trim();
    if (!s) continue;
    let matched = false;
    for (const { tag, patterns } of OBJECTION_MAP) {
      if (patterns.some((p) => p.test(s))) {
        out.add(tag);
        matched = true;
        break;
      }
    }
    if (!matched) out.add('autre');
  }
  return [...out];
}

export function buildPourquoiMaintenant(input: {
  besoinDetecte?: string | null;
  raisonDuScore?: string | null;
  prochaineAction?: string | null;
  dateRelance?: string | null;
  lastInteractionResume?: string | null;
  lastSignalTitre?: string | null;
}): string | null {
  const parts: string[] = [];
  const trim = (s: string) => {
    const t = s.replace(/\s+/g, ' ').trim();
    return /[.!?…]$/.test(t) ? t : `${t}.`;
  };

  if (input.prochaineAction?.trim()) parts.push(trim(input.prochaineAction));
  else if (input.lastInteractionResume?.trim()) parts.push(trim(input.lastInteractionResume));

  if (input.lastSignalTitre?.trim()) parts.push(trim(input.lastSignalTitre));

  if (!parts.length) {
    const fb = input.besoinDetecte?.trim() || input.raisonDuScore?.trim();
    return fb ? trim(fb).slice(0, 220) : null;
  }
  return parts.slice(0, 2).join(' ').slice(0, 220);
}

export function freshnessLabel(
  scoreFraicheur: number | null | undefined,
  dateDerniereVerification: Date | string | null | undefined
): string | null {
  if (scoreFraicheur == null || scoreFraicheur >= 55) return null;
  if (!dateDerniereVerification) return 'Information à vérifier';
  const t = new Date(dateDerniereVerification).getTime();
  if (Number.isNaN(t)) return 'Information à vérifier';
  const months = Math.max(1, Math.round((Date.now() - t) / (30 * 24 * 3600_000)));
  return `Non vérifié depuis ${months} mois`;
}

export const FORBIDDEN_WHY_PATTERNS = [
  /forte\s+probabilit/i,
  /fort\s+potentiel/i,
  /prospect\s+[àa]\s+fort/i,
  /entreprise\s+dynamique/i,
];

export function isAppreciativeWhy(text: string): boolean {
  return FORBIDDEN_WHY_PATTERNS.some((p) => p.test(text));
}
