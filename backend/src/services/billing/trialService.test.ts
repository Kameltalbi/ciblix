import { describe, expect, it } from 'vitest';
import { addDays, FULL_SOLUTION_AGENTS, TIER_AGENTS, TRIAL_DAYS } from '../../config/billingTiers.js';
import {
  TRIAL_AGENTS,
  TRIAL_DURATION_DAYS,
  TRIAL_QUOTA,
  isTrialAgentSlug,
} from '../../config/trial.js';
import { isAgentWriteBlocked } from './trialService.js';

describe('trial helpers', () => {
  it('uses shared trial duration', () => {
    expect(TRIAL_DURATION_DAYS).toBe(7);
    expect(TRIAL_DAYS).toBe(TRIAL_DURATION_DAYS);
    const start = new Date('2026-07-01T00:00:00.000Z');
    const end = addDays(start, TRIAL_DURATION_DAYS);
    expect(end.toISOString()).toBe('2026-07-08T00:00:00.000Z');
  });

  it('gives the same full solution on every paid tier', () => {
    expect(TRIAL_QUOTA.agentActionsLimit).toBe(200);
    for (const tier of Object.keys(TIER_AGENTS) as Array<keyof typeof TIER_AGENTS>) {
      expect([...TIER_AGENTS[tier]].sort()).toEqual([...FULL_SOLUTION_AGENTS].sort());
    }
    expect(isTrialAgentSlug('hunt-ai')).toBe(true);
    expect(isTrialAgentSlug('analyste-ai')).toBe(true);
    expect([...TRIAL_AGENTS]).toContain('hunt-ai');
    expect([...TRIAL_AGENTS]).toContain('copilot-ia');
  });

  it('blocks agent writes when trial expired', () => {
    expect(isAgentWriteBlocked('TRIAL_EXPIRED')).toBe(true);
    expect(isAgentWriteBlocked('TRIALING')).toBe(false);
    expect(isAgentWriteBlocked('ACTIVE')).toBe(false);
  });
});
