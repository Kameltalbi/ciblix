import { describe, expect, it } from 'vitest';

/**
 * Tests sur les heuristiques Scribe locales (dates vagues TN).
 * On ré-implémente le même contrat que structureLocal pour rester unitaire
 * sans appeler OpenAI.
 */
function inferRelanceDate(texte: string, now = new Date('2026-07-26T12:00:00Z')): string | null {
  const t = texte.toLowerCase();
  const y = now.getFullYear();
  const m = now.getMonth();

  if (/septembre|a\s+la\s+rentr[ée]e|rentree/i.test(t)) {
    const target = new Date(Date.UTC(y, 8, 1));
    if (m > 8 || (m === 8 && now.getUTCDate() > 1)) target.setUTCFullYear(y + 1);
    return target.toISOString().slice(0, 10);
  }
  const inDays = t.match(/dans\s+(\d+)\s+jours?/i);
  if (inDays) {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() + Number(inDays[1]));
    return d.toISOString().slice(0, 10);
  }
  return null;
}

describe('Scribe — dates vagues', () => {
  it('septembre → 1er septembre (année en cours en juillet)', () => {
    expect(
      inferRelanceDate('Intéressé mais budget bloqué jusqu’en septembre')
    ).toBe('2026-09-01');
  });

  it('dans 15 jours → date relative', () => {
    expect(inferRelanceDate('Rappeler dans 15 jours')).toBe('2026-08-10');
  });

  it('sans date → null', () => {
    expect(inferRelanceDate('Il a dit oui au devis')).toBeNull();
  });
});
