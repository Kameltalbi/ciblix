import { describe, expect, it } from 'vitest';
import { AgentEventType } from '@prisma/client';
import { shouldDeliverEvent } from './outboundWebhookService.js';
import { signHmacSha256, verifyHmacSha256 } from './webhookCrypto.js';

describe('shouldDeliverEvent', () => {
  it('blocks when disabled', () => {
    expect(shouldDeliverEvent(false, [], 'EMAIL')).toBe(false);
  });

  it('delivers all types when filter empty', () => {
    expect(shouldDeliverEvent(true, [], 'WHATSAPP')).toBe(true);
  });

  it('filters by configured types', () => {
    const types: AgentEventType[] = ['EMAIL', 'WHATSAPP'];
    expect(shouldDeliverEvent(true, types, 'WHATSAPP')).toBe(true);
    expect(shouldDeliverEvent(true, types, 'APPEL')).toBe(false);
  });
});

describe('webhookCrypto', () => {
  it('signs and verifies payload', () => {
    const body = JSON.stringify({ hello: 'world' });
    const sig = signHmacSha256('secret-key', body);
    expect(verifyHmacSha256('secret-key', body, sig)).toBe(true);
    expect(verifyHmacSha256('wrong', body, sig)).toBe(false);
  });
});
