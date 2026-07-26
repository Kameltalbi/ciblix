import { describe, expect, it } from 'vitest';

function normalizeCompany(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\b(sarl|sa|sas|suarl|llc|ltd|inc)\b/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function matches(a: string, b: string): boolean {
  const na = normalizeCompany(a);
  const nb = normalizeCompany(b);
  if (!na || !nb) return false;
  return na === nb || na.includes(nb) || nb.includes(na);
}

describe('wakeFromScout — matching entreprise', () => {
  it('ignore suffixes juridiques', () => {
    expect(matches('Textile Sfax SARL', 'Textile Sfax')).toBe(true);
  });

  it('match partiel raisonnable', () => {
    expect(matches('Industrie Médina', 'Industrie Medina SA')).toBe(true);
  });

  it('refuse les noms trop différents', () => {
    expect(matches('Textile Sfax', 'Agro Delta')).toBe(false);
  });
});
