import { describe, expect, it } from 'vitest';
import { addDays, TIER_AGENTS, TRIAL_DAYS } from '../../config/billingTiers.js';
import {
  DEFAULT_DISCOVERY_AGENT,
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

  it('keeps trial agents independent from every tier', () => {
    expect([...TRIAL_AGENTS]).toEqual(['hunt-ai', 'copilot-ia', 'offre-bot']);
    expect(TRIAL_QUOTA.agentActionsLimit).toBe(200);
    for (const tier of Object.keys(TIER_AGENTS) as Array<keyof typeof TIER_AGENTS>) {
      // TRIAL_AGENTS must never be derived from tier mapping
      expect(TRIAL_AGENTS).not.toEqual(TIER_AGENTS[tier]);
    }
    expect(TIER_AGENTS.DECOUVERTE).toEqual([]);
    expect(DEFAULT_DISCOVERY_AGENT).toBe('copilot-ia');
    expect(isTrialAgentSlug('hunt-ai')).toBe(true);
    expect(isTrialAgentSlug('gmail-ai')).toBe(false);
  });

  it('blocks agent writes when trial expired', () => {
    expect(isAgentWriteBlocked('TRIAL_EXPIRED')).toBe(true);
    expect(isAgentWriteBlocked('TRIALING')).toBe(false);
    expect(isAgentWriteBlocked('ACTIVE')).toBe(false);
  });
});
