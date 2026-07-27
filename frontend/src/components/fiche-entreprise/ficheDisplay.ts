/**
 * Affichage fiche entreprise — logique pure (lecture seule).
 * score_fit : jamais exposé à l’UI.
 */

export type ObjectionTag =
  | 'budget'
  | 'timing'
  | 'concurrent'
  | 'besoin'
  | 'decideur_absent'
  | 'autre';

export const OBJECTION_LABELS: Record<ObjectionTag, string> = {
  budget: 'Budget',
  timing: 'Timing',
  concurrent: 'Concurrent',
  besoin: 'Besoin',
  decideur_absent: 'Décideur absent',
  autre: 'Autre',
};

const OBJECTION_MAP: Array<{ tag: ObjectionTag; patterns: RegExp[] }> = [
  { tag: 'budget', patterns: [/budget/i, /prix/i, /co[uû]t/i, /cher/i, /trop\s*cher/i] },
  { tag: 'timing', patterns: [/timing/i, /plus\s*tard/i, /septembre|octobre|rentr[eé]e|ramadan|apr[eè]s\s*l['’]?[eé]t[eé]/i, /pas\s*maintenant/i, /relance/i] },
  { tag: 'concurrent', patterns: [/concurrent/i, /autre\s*solution/i, /d[eé]j[aà]\s*(chez|avec)/i] },
  { tag: 'besoin', patterns: [/pas\s*de\s*besoin/i, /inutile/i, /pas\s*int[eé]ress/i] },
  { tag: 'decideur_absent', patterns: [/d[eé]cideur/i, /absent/i, /pas\s*dispo/i, /responsable\s*pas/i] },
];

/** Liste fermée — normalise texte libre → étiquettes. */
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

export type FicheDisplayInput = {
  besoinDetecte?: string | null;
  raisonDuScore?: string | null;
  prochaineAction?: string | null;
  dateRelance?: string | null;
  lastInteractionResume?: string | null;
  lastSignalTitre?: string | null;
  lastSignalAt?: string | null;
};

/**
 * Bloc « Pourquoi maintenant » — fusion signal Veilleur + engagement Scribe.
 * Factuel uniquement ; pas d’appréciation (« fort potentiel »).
 */
export function buildPourquoiMaintenant(input: FicheDisplayInput): string | null {
  const parts: string[] = [];

  if (input.prochaineAction?.trim()) {
    parts.push(trimSentence(input.prochaineAction));
  } else if (input.dateRelance) {
    const d = formatShortDate(input.dateRelance);
    if (d) parts.push(`Relance prévue le ${d}.`);
  } else if (input.lastInteractionResume?.trim()) {
    // Engagement / contexte dernier échange (Scribe)
    parts.push(trimSentence(input.lastInteractionResume));
  }

  if (input.lastSignalTitre?.trim()) {
    parts.push(trimSentence(input.lastSignalTitre));
  }

  if (parts.length === 0) {
    const fallback = input.besoinDetecte?.trim() || input.raisonDuScore?.trim();
    if (fallback) return trimSentence(fallback).slice(0, 220);
    return null;
  }

  return parts.slice(0, 2).join(' ').slice(0, 220);
}

/** Bandeau réveil dormante : passé + présent. */
export function buildResurgenceBanner(opts: {
  lastContactAt?: string | null;
  lastObjectionOrResume?: string | null;
  signalTitre?: string | null;
}): string | null {
  if (!opts.signalTitre?.trim()) return null;
  const when = opts.lastContactAt ? formatMonthYear(opts.lastContactAt) : null;
  const past = opts.lastObjectionOrResume?.trim()
    ? trimSentence(opts.lastObjectionOrResume)
    : 'ils avaient reporté.';
  const head = when ? `Contactés en ${when}` : 'Déjà contactés';
  return `${head} — ${past} ${trimSentence(opts.signalTitre)}`.slice(0, 280);
}

export function freshnessLabel(
  scoreFraicheur: number | null | undefined,
  dateDerniereVerification: string | Date | null | undefined
): string | null {
  if (scoreFraicheur == null) return null;
  if (scoreFraicheur >= 55) return null;
  if (!dateDerniereVerification) return 'Information à vérifier';
  const t = new Date(dateDerniereVerification).getTime();
  if (Number.isNaN(t)) return 'Information à vérifier';
  const months = Math.max(1, Math.round((Date.now() - t) / (30 * 24 * 3600_000)));
  return `Non vérifié depuis ${months} mois`;
}

export function initialsFromName(name: string | null | undefined): string {
  if (!name?.trim()) return '?';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ''}${parts[parts.length - 1]![0] ?? ''}`.toUpperCase();
}

function trimSentence(s: string): string {
  const t = s.replace(/\s+/g, ' ').trim();
  if (!t) return '';
  return /[.!?…]$/.test(t) ? t : `${t}.`;
}

function formatShortDate(iso: string): string | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

function formatMonthYear(iso: string): string | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
}

/** Phrases interdites sur la carte / pourquoi (appréciation). */
export const FORBIDDEN_WHY_PATTERNS = [
  /forte\s+probabilit/i,
  /fort\s+potentiel/i,
  /prospect\s+[àa]\s+fort/i,
  /entreprise\s+dynamique/i,
  /en\s+croissance/i,
];

export function isAppreciativeWhy(text: string): boolean {
  return FORBIDDEN_WHY_PATTERNS.some((p) => p.test(text));
}

/** Corrige les \\n littéraux parfois stockés dans message_brouillon. */
export function normalizeMessageDraft(text?: string | null): string | null {
  if (text == null) return null;
  let t = text.trim();
  if (!t) return null;
  if (/\\[nrt]/.test(t)) {
    t = t
      .replace(/\\r\\n/g, '\n')
      .replace(/\\n/g, '\n')
      .replace(/\\r/g, '\n')
      .replace(/\\t/g, '\t');
  }
  return t.replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}
