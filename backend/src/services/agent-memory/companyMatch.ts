import type { Contact } from '@prisma/client';
import { prisma } from '../../db/prisma.js';

const LEGAL_SUFFIXES = [
  ' sarl',
  ' s.a.r.l',
  ' s.a.r.l.',
  ' sa',
  ' s.a',
  ' s.a.',
  ' ltd',
  ' llc',
  ' gmbh',
  ' eurl',
];

/** Normalisation légère pour matching entreprise (pas une clé unique stricte). */
export function normalizeCompanyName(raw?: string | null): string | null {
  if (!raw?.trim()) return null;
  let s = raw.trim().toLowerCase().replace(/\s+/g, ' ');
  for (const suffix of LEGAL_SUFFIXES) {
    if (s.endsWith(suffix)) {
      s = s.slice(0, -suffix.length).trim();
      break;
    }
  }
  return s || null;
}

/**
 * Matching approximatif entreprise — résolution uniquement, pas de merge silencieux agressif.
 * Retourne un match seulement si la normalisation est identique (confiance forte).
 */
export async function findApproximateMatchByCompany(
  organizationId: string,
  companyName?: string | null
): Promise<{ contact: Contact; exact: boolean } | null> {
  const target = normalizeCompanyName(companyName);
  if (!target) return null;

  const candidates = await prisma.contact.findMany({
    where: {
      organizationId,
      erasedAt: null,
      companyName: { not: null },
    },
    select: {
      id: true,
      name: true,
      companyName: true,
      phone: true,
      email: true,
      whatsappId: true,
      phoneNormalized: true,
      emailNormalized: true,
      whatsappNormalized: true,
      aliases: true,
      createdVia: true,
      erasedAt: true,
      organizationId: true,
      createdAt: true,
      updatedAt: true,
    },
    take: 200,
  });

  for (const row of candidates) {
    if (normalizeCompanyName(row.companyName) === target) {
      return { contact: row as Contact, exact: true };
    }
  }

  return null;
}
