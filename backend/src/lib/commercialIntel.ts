/**
 * Heuristiques « intelligence commerciale » (scoring / alertes) — déterministes.
 * À garder aligné avec `frontend/src/lib/commercialIntel.ts` si vous exposez les mêmes labels côté client.
 */

export type IaScoreLabel = 'TRES_CHAUD' | 'CHAUD' | 'MOYEN' | 'FAIBLE' | 'RISQUE_PERTE';

export type IaHeatLevel = 'TRES_CHAUD' | 'CHAUD' | 'TIEDE' | 'FROID' | 'GELE';

export interface CommercialInsightInput {
  statut: string;
  probabilite: number;
  score: number;
  montantHT: number;
  createdAt: Date;
  updatedAt: Date;
  lastActivityAt: Date | null;
  dateProchaineAction: Date | null;
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

function daysBetween(from: Date, to: Date): number {
  const ms = to.getTime() - from.getTime();
  return Math.max(0, Math.floor(ms / (24 * 60 * 60 * 1000)));
}

export function computeCommercialInsight(input: CommercialInsightInput, now = new Date()): CommercialInsight {
  const lastTouch = input.lastActivityAt
    ? new Date(Math.max(input.lastActivityAt.getTime(), input.updatedAt.getTime()))
    : input.updatedAt;
  const daysSinceLastTouch = daysBetween(lastTouch, now);

  let daysOverdueNextAction: number | null = null;
  if (input.dateProchaineAction) {
    const d = new Date(input.dateProchaineAction);
    if (d.getTime() < now.getTime()) {
      daysOverdueNextAction = daysBetween(d, now);
    }
  }

  const inPipeline = OPEN.has(input.statut);
  const staleQuoteNoReply =
    inPipeline &&
    (input.statut === 'PROPOSITION' || input.statut === 'NEGOCIATION') &&
    daysSinceLastTouch >= 7;

  const negotiationBlocked =
    input.statut === 'NEGOCIATION' && daysSinceLastTouch >= 14 && input.probabilite < 85;

  // Score 0–100 : probabilité, score CRM, récence, étape, montant
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

export function buildFollowUpTemplates(opts: {
  clientName: string;
  companyHint?: string;
  montantHT: number;
  statut: string;
  tone: 'soft' | 'commercial' | 'firm';
  channel: 'email' | 'whatsapp';
  length: 'short' | 'long';
}): { subject: string; body: string } {
  const { clientName, montantHT, statut, tone, channel, length } = opts;
  const amount = `${Math.round(montantHT).toLocaleString('fr-FR')} DT HT`;
  const isShort = length === 'short';

  const opening =
    tone === 'soft'
      ? `Bonjour ${clientName},\n\nJ'espère que vous allez bien.`
      : tone === 'firm'
        ? `Bonjour ${clientName},\n\nJe me permets de revenir vers vous concernant notre proposition.`
        : `Bonjour ${clientName},\n\nJe reviens vers vous pour faire un point rapide sur notre échange.`;

  const core =
    tone === 'soft'
      ? `Souhaitez-vous qu'on planifie un court appel cette semaine pour avancer sereinement sur le dossier (${statut}, ${amount}) ?`
      : tone === 'firm'
        ? `Pour avancer, j'ai besoin d'un retour de votre part sous 48h : pouvez-vous me confirmer la suite que vous souhaitez donner à cette opportunité (${amount}) ?`
        : `Côté équipe, nous restons mobilisés pour finaliser : préférez-vous un créneau téléphonique ou une réponse écrite concernant la proposition (${amount}) ?`;

  const closing =
    tone === 'soft'
      ? `\n\nBien cordialement`
      : tone === 'firm'
        ? `\n\nCordialement`
        : `\n\nMerci et bonne journée`;

  const extra =
    !isShort
      ? `\n\nJe reste disponible pour toute précision utile et peux adapter le périmètre si besoin.`
      : '';

  const body = `${opening}\n\n${core}${extra}${closing}`;
  const subject =
    tone === 'firm'
      ? `Suite — opportunité (${amount})`
      : tone === 'commercial'
        ? `Point rapide sur votre dossier`
        : `Petit message de suivi`;

  if (channel === 'whatsapp') {
    return {
      subject: '',
      body: body.replace(/\n\n/g, '\n').trim(),
    };
  }
  return { subject, body };
}
