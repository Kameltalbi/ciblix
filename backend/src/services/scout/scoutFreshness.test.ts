import { describe, expect, it } from 'vitest';
import { extractLatestDateFromText, isPastScoutOpportunity } from './scoutFreshness.js';

function ymd(d: Date | null): string | null {
  if (!d) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

describe('extractLatestDateFromText', () => {
  it('parses French event ranges', () => {
    expect(ymd(extractLatestDateFromText('Formation Bilan Carbone à Tunis - 26 & 27 juin 2025'))).toBe('2025-06-27');
  });

  it('parses July range', () => {
    expect(ymd(extractLatestDateFromText('Formation 14-16 Juillet 2025'))).toBe('2025-07-16');
  });

  it('parses ISO deadline', () => {
    expect(ymd(extractLatestDateFromText('2025-06-27'))).toBe('2025-06-27');
  });
});

describe('isPastScoutOpportunity', () => {
  const now = new Date(2026, 6, 23); // 23 juil. 2026

  it('flags past EVENT from title', () => {
    expect(
      isPastScoutOpportunity({
        category: 'EVENT',
        title: 'Formation Bilan Carbone - 26 & 27 juin 2025',
        now,
      }),
    ).toBe(true);
  });

  it('keeps future EVENT', () => {
    expect(
      isPastScoutOpportunity({
        category: 'EVENT',
        title: 'Salon RSE 12 septembre 2026',
        now,
      }),
    ).toBe(false);
  });

  it('flags past TENDER deadline', () => {
    expect(
      isPastScoutOpportunity({
        category: 'TENDER',
        title: 'AO environnement',
        deadline: '15/03/2026',
        now,
      }),
    ).toBe(true);
  });

  it('does not filter NEWS', () => {
    expect(
      isPastScoutOpportunity({
        category: 'NEWS',
        title: 'Article juin 2025',
        now,
      }),
    ).toBe(false);
  });
});
