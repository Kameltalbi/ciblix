import { describe, expect, it } from 'vitest';
import {
  formatSessionTranscript,
  MAX_SESSION_MESSAGES,
  shouldCloseSession,
  type BufferedMessage,
} from './whatsappSessionUtils.js';

describe('shouldCloseSession', () => {
  it('closes when idle exceeds timeout', () => {
    const last = new Date('2026-01-01T10:00:00Z');
    const now = new Date('2026-01-01T10:31:00Z');
    expect(shouldCloseSession(last, 3, 30, now)).toBe(true);
  });

  it('stays open within timeout', () => {
    const last = new Date('2026-01-01T10:00:00Z');
    const now = new Date('2026-01-01T10:15:00Z');
    expect(shouldCloseSession(last, 3, 30, now)).toBe(false);
  });

  it('closes when message cap reached', () => {
    const last = new Date();
    expect(shouldCloseSession(last, MAX_SESSION_MESSAGES, 30)).toBe(true);
  });
});

describe('formatSessionTranscript', () => {
  it('formats directions', () => {
    const messages: BufferedMessage[] = [
      { direction: 'IN', text: 'Bonjour', at: '2026-01-01T10:00:00Z' },
      { direction: 'OUT', text: 'Bonjour, comment puis-je vous aider ?', at: '2026-01-01T10:01:00Z' },
    ];
    const text = formatSessionTranscript(messages);
    expect(text).toContain('[Contact] Bonjour');
    expect(text).toContain('[Équipe] Bonjour');
  });
});
