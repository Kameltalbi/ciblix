import { describe, expect, it } from 'vitest';
import { isRelanceDue, todayIso } from './relanceDates.js';

describe('isRelanceDue', () => {
  it('due si date ≤ aujourd’hui', () => {
    expect(isRelanceDue('2026-07-26', '2026-07-26')).toBe(true);
    expect(isRelanceDue('2026-07-01', '2026-07-26')).toBe(true);
  });

  it('pas due si date dans le futur', () => {
    expect(isRelanceDue('2026-09-01', '2026-07-26')).toBe(false);
  });

  it('null / invalide → false', () => {
    expect(isRelanceDue(null)).toBe(false);
    expect(isRelanceDue('bientôt')).toBe(false);
  });

  it('todayIso format YYYY-MM-DD', () => {
    expect(todayIso(new Date('2026-07-26T15:00:00Z'))).toBe('2026-07-26');
  });
});
