import type { ContactPipelineStatus } from '@prisma/client';

export type PipelineThresholds = {
  chaudScore: number;
  chaudJours: number;
  relanceJours: number;
  tiedeScore: number;
  archiveJours: number;
};

export const DEFAULT_PIPELINE_THRESHOLDS: PipelineThresholds = {
  chaudScore: 70,
  chaudJours: 7,
  relanceJours: 30,
  tiedeScore: 40,
  archiveJours: 90,
};

export type PipelineEventInput = {
  score: number | null;
  createdAt: Date;
};

export function parsePipelineThresholds(raw: unknown): PipelineThresholds {
  if (!raw || typeof raw !== 'object') return DEFAULT_PIPELINE_THRESHOLDS;
  const o = raw as Partial<PipelineThresholds>;
  return {
    chaudScore: numOr(o.chaudScore, DEFAULT_PIPELINE_THRESHOLDS.chaudScore),
    chaudJours: numOr(o.chaudJours, DEFAULT_PIPELINE_THRESHOLDS.chaudJours),
    relanceJours: numOr(o.relanceJours, DEFAULT_PIPELINE_THRESHOLDS.relanceJours),
    tiedeScore: numOr(o.tiedeScore, DEFAULT_PIPELINE_THRESHOLDS.tiedeScore),
    archiveJours: numOr(o.archiveJours, DEFAULT_PIPELINE_THRESHOLDS.archiveJours),
  };
}

function numOr(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

export function weightedRecentScore(events: PipelineEventInput[], maxN = 5): number | null {
  const scored = events.filter((e) => e.score != null && Number.isFinite(e.score));
  if (scored.length === 0) return null;

  const slice = [...scored]
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, maxN);

  let totalWeight = 0;
  let sum = 0;
  slice.forEach((e, i) => {
    const weight = maxN - i;
    sum += (e.score as number) * weight;
    totalWeight += weight;
  });
  return totalWeight > 0 ? Math.round((sum / totalWeight) * 10) / 10 : null;
}

export function daysSince(date: Date, now: Date): number {
  return (now.getTime() - date.getTime()) / 86_400_000;
}

/**
 * Fonction pure — statut de pipeline inféré depuis les AgentEvent.
 */
export function computePipelineStatus(
  events: PipelineEventInput[],
  now: Date = new Date(),
  thresholds: PipelineThresholds = DEFAULT_PIPELINE_THRESHOLDS
): { status: ContactPipelineStatus; score: number | null; lastEventAt: Date | null } {
  if (events.length === 0) {
    return { status: 'NOUVEAU', score: null, lastEventAt: null };
  }

  const sorted = [...events].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  const lastEventAt = sorted[0].createdAt;
  const days = daysSince(lastEventAt, now);
  const recentScore = weightedRecentScore(sorted);

  if (days > thresholds.archiveJours) {
    return { status: 'ARCHIVE', score: recentScore, lastEventAt };
  }

  if (recentScore != null && recentScore >= thresholds.chaudScore && days <= thresholds.chaudJours) {
    return { status: 'CHAUD', score: recentScore, lastEventAt };
  }
  if (recentScore != null && recentScore >= thresholds.chaudScore && days <= thresholds.relanceJours) {
    return { status: 'A_RELANCER', score: recentScore, lastEventAt };
  }
  if (recentScore != null && recentScore >= thresholds.tiedeScore && days <= thresholds.relanceJours) {
    return { status: 'TIEDE', score: recentScore, lastEventAt };
  }

  if (recentScore == null && days <= thresholds.relanceJours) {
    return { status: 'TIEDE', score: null, lastEventAt };
  }

  return { status: 'FROID', score: recentScore, lastEventAt };
}

export function explainPipelineStatus(
  status: ContactPipelineStatus,
  score: number | null,
  lastEventAt: Date | null,
  now: Date = new Date()
): string {
  if (status === 'NOUVEAU') return 'Aucun événement enregistré pour ce contact.';
  const days = lastEventAt ? Math.floor(daysSince(lastEventAt, now)) : null;
  const scoreTxt = score != null ? `score ${Math.round(score)}/100` : 'pas de score récent';
  const daysTxt = days != null ? `dernier échange il y a ${days} jour(s)` : 'date inconnue';
  return `${daysTxt}, ${scoreTxt} — statut inféré automatiquement.`;
}
