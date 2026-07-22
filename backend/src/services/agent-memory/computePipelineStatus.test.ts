import { describe, expect, it } from 'vitest';
import {
  computePipelineStatus,
  DEFAULT_PIPELINE_THRESHOLDS,
  type PipelineEventInput,
} from './computePipelineStatus.js';

const now = new Date('2026-07-22T12:00:00Z');
const daysAgo = (n: number) => new Date(now.getTime() - n * 86_400_000);

function ev(score: number | null, days: number): PipelineEventInput {
  return { score, createdAt: daysAgo(days) };
}

describe('computePipelineStatus', () => {
  it('aucun event → NOUVEAU', () => {
    expect(computePipelineStatus([], now).status).toBe('NOUVEAU');
  });

  it('score élevé récent → CHAUD', () => {
    const r = computePipelineStatus([ev(80, 2), ev(75, 5)], now);
    expect(r.status).toBe('CHAUD');
    expect(r.score).toBeGreaterThanOrEqual(70);
  });

  it('score élevé mais silence 15j → A_RELANCER', () => {
    const r = computePipelineStatus([ev(85, 15)], now);
    expect(r.status).toBe('A_RELANCER');
  });

  it('score moyen récent → TIEDE', () => {
    const r = computePipelineStatus([ev(50, 10)], now);
    expect(r.status).toBe('TIEDE');
  });

  it('score faible → FROID', () => {
    const r = computePipelineStatus([ev(20, 10)], now);
    expect(r.status).toBe('FROID');
  });

  it('silence > archiveJours → ARCHIVE', () => {
    const r = computePipelineStatus([ev(90, 100)], now, {
      ...DEFAULT_PIPELINE_THRESHOLDS,
      archiveJours: 90,
    });
    expect(r.status).toBe('ARCHIVE');
  });

  it('ignore les events sans score pour la moyenne', () => {
    const r = computePipelineStatus([ev(null, 1), ev(80, 3)], now);
    expect(r.score).toBe(80);
    expect(r.status).toBe('CHAUD');
  });
});
