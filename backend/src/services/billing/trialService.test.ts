import { describe, expect, it } from 'vitest';
import { addDays, TRIAL_DAYS } from '../../config/billingTiers.js';
import { isAgentWriteBlocked } from './trialService.js';

describe('trial helpers', () => {
  it('adds trial days', () => {
    const start = new Date('2026-07-01T00:00:00.000Z');
    const end = addDays(start, TRIAL_DAYS);
    expect(end.toISOString()).toBe('2026-07-08T00:00:00.000Z');
  });

  it('blocks agent writes when trial expired', () => {
    expect(isAgentWriteBlocked('TRIAL_EXPIRED')).toBe(true);
    expect(isAgentWriteBlocked('TRIALING')).toBe(false);
    expect(isAgentWriteBlocked('ACTIVE')).toBe(false);
  });
});
