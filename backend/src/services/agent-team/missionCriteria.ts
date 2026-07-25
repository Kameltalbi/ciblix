import type { OrgTargetingProfile } from '@prisma/client';
import type { CompanySearchCriteria } from '../prospecting/types.js';

type IdealClientProfile = {
  name?: string;
  description?: string;
  importance?: number;
  sector?: string;
  companySize?: string;
};

function joinUnique(parts: Array<string | null | undefined>, max = 8): string | undefined {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of parts) {
    const t = typeof p === 'string' ? p.trim() : '';
    if (!t) continue;
    const key = t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
    if (out.length >= max) break;
  }
  return out.length ? out.join(', ') : undefined;
}

/** Critères Places / recherche dérivés de la Mission IA (ICP prioritaire). */
export function criteriaFromTargeting(profile: OrgTargetingProfile): CompanySearchCriteria {
  const icps = (
    Array.isArray(profile.idealProfiles) ? profile.idealProfiles : []
  ) as IdealClientProfile[];
  const top = [...icps].sort((a, b) => (b.importance ?? 0) - (a.importance ?? 0))[0];

  return {
    sector: joinUnique([top?.sector, ...(profile.sectors || []), ...(profile.markets || [])], 3),
    country: joinUnique(profile.countries || [], 2),
    city: joinUnique(profile.cities || [], 2),
    companySize: top?.companySize?.trim() || undefined,
    keywords: joinUnique(
      [
        ...(profile.keywords || []),
        ...(profile.targetClients || []),
        ...icps.map((i) => i.name),
      ],
      8
    ),
  };
}

export function criteriaHasSearchableFields(c: CompanySearchCriteria): boolean {
  return Boolean(
    c.sector?.trim() ||
      c.keywords?.trim() ||
      c.country?.trim() ||
      c.city?.trim() ||
      c.companySize?.trim()
  );
}
