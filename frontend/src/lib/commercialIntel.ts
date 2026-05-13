/**
 * Même logique que `backend/src/lib/commercialIntel.ts` — à maintenir en parallèle si les règles évoluent.
 */

export type IaScoreLabel = 'TRES_CHAUD' | 'CHAUD' | 'MOYEN' | 'FAIBLE' | 'RISQUE_PERTE';
export type IaHeatLevel = 'TRES_CHAUD' | 'CHAUD' | 'TIEDE' | 'FROID' | 'GELE';

export interface CommercialInsightInput {
  statut: string;
  probabilite: number;
  score: number;
  montantHT: number;
  createdAt: string | Date;
  updatedAt: string | Date;
  lastActivityAt: string | Date | null;
  dateProchaineAction: string | Date | null;
  hasDevis: boolean;
}

export interface CommercialInsight {
  iaScoreLabel: IaScoreLabel;
  iaScoreNumeric: number;
  heatLevel: IaHeatLevel;
  daysSinceLastTouch: number;
  daysOverdueNextAction: number | null;
  staleQuoteNoReply: boolean;
  negotiationBlocked: boolean;
  signatureProbabilityPct: number;
}

const OPEN = new Set(['PROSPECT', 'QUALIFIE', 'PROPOSITION', 'NEGOCIATION']);

function toDate(v: string | Date): Date {
  return v instanceof Date ? v : new Date(v);
}

function daysBetween(from: Date, to: Date): number {
  const ms = to.getTime() - from.getTime();
  return Math.max(0, Math.floor(ms / (24 * 60 * 60 * 1000)));
}

export function computeCommercialInsight(input: CommercialInsightInput, now = new Date()): CommercialInsight {
  const updatedAt = toDate(input.updatedAt);
  const lastActivityAt = input.lastActivityAt ? toDate(input.lastActivityAt) : null;
  const dateProchaineAction = input.dateProchaineAction ? toDate(input.dateProchaineAction) : null;

  const lastTouch = lastActivityAt
    ? new Date(Math.max(lastActivityAt.getTime(), updatedAt.getTime()))
    : updatedAt;
  const daysSinceLastTouch = daysBetween(lastTouch, now);

  let daysOverdueNextAction: number | null = null;
  if (dateProchaineAction) {
    if (dateProchaineAction.getTime() < now.getTime()) {
      daysOverdueNextAction = daysBetween(dateProchaineAction, now);
    }
  }

  const inPipeline = OPEN.has(input.statut);
  const staleQuoteNoReply =
    inPipeline &&
    (input.statut === 'PROPOSITION' || input.statut === 'NEGOCIATION') &&
    daysSinceLastTouch >= 7;

  const negotiationBlocked =
    input.statut === 'NEGOCIATION' && daysSinceLastTouch >= 14 && input.probabilite < 85;

  let numeric =
    input.probabilite * 0.38 +
    Math.min(100, input.score) * 0.18 +
    Math.max(0, 30 - Math.min(30, daysSinceLastTouch)) * 0.85 +
    (input.statut === 'NEGOCIATION' ? 8 : input.statut === 'PROPOSITION' ? 5 : input.statut === 'QUALIFIE' ? 3 : 0) +
    (input.hasDevis ? 6 : 0) +
    Math.min(12, Math.log10(Math.max(500, input.montantHT) / 500) * 4);

  if (daysOverdueNextAction !== null) {
    numeric += Math.min(15, daysOverdueNextAction * 0.8);
  }
  if (negotiationBlocked) {
    numeric -= 12;
  }
  if (staleQuoteNoReply) {
    numeric -= 8;
  }

  numeric = Math.round(Math.max(0, Math.min(100, numeric)));

  let iaScoreLabel: IaScoreLabel;
  if (!inPipeline) {
    iaScoreLabel = 'FAIBLE';
  } else if (numeric >= 82 && input.probabilite >= 70) {
    iaScoreLabel = 'TRES_CHAUD';
  } else if (numeric >= 68 && input.probabilite >= 50) {
    iaScoreLabel = 'CHAUD';
  } else if (numeric >= 48) {
    iaScoreLabel = 'MOYEN';
  } else if (negotiationBlocked || staleQuoteNoReply || (daysOverdueNextAction ?? 0) > 10) {
    iaScoreLabel = 'RISQUE_PERTE';
  } else {
    iaScoreLabel = 'FAIBLE';
  }

  let heatLevel: IaHeatLevel;
  if (iaScoreLabel === 'TRES_CHAUD') heatLevel = 'TRES_CHAUD';
  else if (iaScoreLabel === 'CHAUD' || (input.probabilite >= 75 && inPipeline)) heatLevel = 'CHAUD';
  else if (input.probabilite >= 45 && inPipeline) heatLevel = 'TIEDE';
  else if (inPipeline) heatLevel = 'FROID';
  else heatLevel = 'GELE';

  const signatureProbabilityPct = Math.max(
    0,
    Math.min(100, Math.round(input.probabilite + (numeric / 100 - 0.5) * 12))
  );

  return {
    iaScoreLabel,
    iaScoreNumeric: numeric,
    heatLevel,
    daysSinceLastTouch,
    daysOverdueNextAction,
    staleQuoteNoReply,
    negotiationBlocked,
    signatureProbabilityPct,
  };
}

export function labelToFrench(label: IaScoreLabel): string {
  const m: Record<IaScoreLabel, string> = {
    TRES_CHAUD: 'Très chaud',
    CHAUD: 'Chaud',
    MOYEN: 'Moyen',
    FAIBLE: 'Faible',
    RISQUE_PERTE: 'Risque de perte',
  };
  return m[label];
}

export function heatToFrench(h: IaHeatLevel): string {
  const m: Record<IaHeatLevel, string> = {
    TRES_CHAUD: 'Très chaud',
    CHAUD: 'Chaud',
    TIEDE: 'Tiède',
    FROID: 'Froid',
    GELE: '—',
  };
  return m[h];
}
