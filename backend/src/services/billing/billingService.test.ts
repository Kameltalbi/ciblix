import { describe, expect, it } from 'vitest';
import { shouldDeliverEvent } from '../integrations/outboundWebhookService.js';
import { TIER_ACTION_LIMITS } from '../../config/billingTiers.js';

describe('billing tiers', () => {
  it('has increasing limits', () => {
    expect(TIER_ACTION_LIMITS.DECOUVERTE).toBeLessThan(TIER_ACTION_LIMITS.CROISSANCE);
    expect(TIER_ACTION_LIMITS.CROISSANCE).toBeLessThan(TIER_ACTION_LIMITS.PRO);
  });
});

describe('quota soft-cap policy', () => {
  it('webhook delivery independent of quota', () => {
    expect(shouldDeliverEvent(true, [], 'EMAIL')).toBe(true);
  });
});
