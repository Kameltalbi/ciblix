/**
 * Réveil Veilleur — si un signal Scout correspond à une fiche existante,
 * on y attache le signal et on crée une suggestion RELANCER (pas une nouvelle fiche).
 */

import { prisma } from '../../db/prisma.js';
import { persistVeilleurSignal } from '../company-fiche/ficheService.js';
import { createSuggestion } from '../suggestions/suggestionService.js';
import type { SignalExterne } from '../company-fiche/types.js';

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

export async function findDormantContactByCompany(
  organizationId: string,
  companyName: string
): Promise<{ id: string; companyName: string | null; name: string | null } | null> {
  const needle = normalizeCompany(companyName);
  if (needle.length < 3) return null;

  const candidates = await prisma.contact.findMany({
    where: {
      organizationId,
      erasedAt: null,
      OR: [{ ficheEtat: null }, { ficheEtat: { notIn: ['GAGNEE', 'PERDUE', 'ARCHIVEE'] } }],
    },
    select: { id: true, companyName: true, name: true },
    take: 300,
    orderBy: { updatedAt: 'desc' },
  });

  for (const c of candidates) {
    const label = normalizeCompany(c.companyName || c.name || '');
    if (!label) continue;
    if (label === needle || label.includes(needle) || needle.includes(label)) {
      return c;
    }
  }
  return null;
}

export type WakeResult = {
  woken: boolean;
  contactId: string | null;
};

/**
 * Attache le signal Scout à une fiche dormante existante + suggestion.
 * @returns woken=true si une fiche a été réveillée (alors pas besoin de créer une nouvelle piste Hunt).
 */
export async function wakeDormantFicheFromScout(opts: {
  organizationId: string;
  companyName: string;
  scoutOpportunityId: string;
  title: string;
  url: string;
  category?: string;
}): Promise<WakeResult> {
  const contact = await findDormantContactByCompany(opts.organizationId, opts.companyName);
  if (!contact) return { woken: false, contactId: null };

  const signal: SignalExterne = {
    at: new Date().toISOString(),
    titre: opts.title.slice(0, 240),
    source_url: opts.url,
    source_ref: `scout:${opts.scoutOpportunityId}`,
    destination: 'prospecteur',
  };

  await persistVeilleurSignal({
    organizationId: opts.organizationId,
    contactId: contact.id,
    signal,
  });

  const company = (contact.companyName || contact.name || opts.companyName).trim();
  await createSuggestion({
    organizationId: opts.organizationId,
    contactId: contact.id,
    type: 'RELANCER',
    message: `Signal Veilleur — ${company} : ${opts.title.slice(0, 160)}`,
    targetAgent: 'COPILOT',
  });

  return { woken: true, contactId: contact.id };
}
