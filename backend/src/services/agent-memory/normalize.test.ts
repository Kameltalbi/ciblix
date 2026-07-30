import { describe, expect, it } from 'vitest';
import { isFixedLinePhone, normalizeWhatsapp } from './normalize.js';

describe('isFixedLinePhone / normalizeWhatsapp', () => {
  it('détecte les fixes TN qui commencent par 7', () => {
    expect(isFixedLinePhone('+21671234567')).toBe(true);
    expect(isFixedLinePhone('216 71 234 567')).toBe(true);
    expect(isFixedLinePhone('71 234 567')).toBe(true);
    expect(isFixedLinePhone('071234567')).toBe(true);
  });

  it('laisse passer les mobiles (2/4/5/9)', () => {
    expect(isFixedLinePhone('+21698123456')).toBe(false);
    expect(isFixedLinePhone('22 123 456')).toBe(false);
    expect(isFixedLinePhone('+21654123456')).toBe(false);
  });

  it('n’enregistre pas WhatsApp pour un fixe 7x', () => {
    expect(normalizeWhatsapp('+21671234567')).toBeNull();
    expect(normalizeWhatsapp('+21698123456')).toBe('+21698123456');
  });
});
