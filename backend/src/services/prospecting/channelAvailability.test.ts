import { describe, expect, it } from 'vitest';
import {
  assertChannelAvailableForMessageType,
  getChannelAvailability,
} from './channelAvailability.js';

describe('channelAvailability', () => {
  it('disables LinkedIn without URL', () => {
    const a = getChannelAvailability({ email: 'a@b.com', phone: '+216', linkedin: null });
    expect(a.canLinkedIn).toBe(false);
    expect(a.canEmail).toBe(true);
    expect(a.canWhatsApp).toBe(true);
  });

  it('blocks API for LinkedIn without profile', () => {
    const check = assertChannelAvailableForMessageType(
      { email: 'a@b.com', phone: null, linkedin: null },
      'LINKEDIN'
    );
    expect(check.ok).toBe(false);
  });

  it('allows email when detectedEmails present', () => {
    const prospect = { email: null, detectedEmails: ['x@y.com'], phone: null, linkedin: null };
    expect(getChannelAvailability(prospect).canEmail).toBe(true);
    expect(assertChannelAvailableForMessageType(prospect, 'FIRST_CONTACT').ok).toBe(true);
  });
});
