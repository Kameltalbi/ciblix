import { describe, expect, it } from 'vitest';
import {
  extractLatestDateFromText,
  isPastDatedContent,
  isPastScoutOpportunity,
} from './scoutFreshness.js';

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

  it('parses du X au Y mois année', () => {
    expect(
      ymd(extractLatestDateFromText('Salon Carthage du 19 au 24 mai 2026 au Parc des Expositions')),
    ).toBe('2026-05-24');
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

  it('filters past training promo tagged as NEWS', () => {
    expect(
      isPastScoutOpportunity({
        category: 'NEWS',
        title: 'Bootcamp Décarbonation - Formation du 7 au 28 Février 2025',
        now,
      }),
    ).toBe(true);
  });
});

describe('isPastDatedContent', () => {
  const now = new Date(2026, 6, 25); // 25 juil. 2026

  it('hides past salon mentioned in agent resume', () => {
    expect(
      isPastDatedContent(
        'Le Salon International du Bâtiment Carthage 2026 se déroulera du 19 au 24 mai 2026',
        now,
      ),
    ).toBe(true);
  });

  it('keeps content without a date', () => {
    expect(isPastDatedContent('Score 85/100 — PRIORITY. Alignement fort.', now)).toBe(false);
  });

  it('keeps future events', () => {
    expect(isPastDatedContent('Forum RSE du 12 au 14 septembre 2026', now)).toBe(false);
  });
});
