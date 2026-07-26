/**
 * Résurgence par date_relance (Scribe) → Aujourd’hui.
 * Les fiches dont date_relance ≤ aujourd’hui remontent dans le flux actif.
 */

import { Prisma } from '@prisma/client';
import { prisma } from '../../db/prisma.js';
import { parseFicheData } from './ficheService.js';
import { createSuggestion } from '../suggestions/suggestionService.js';
import { formatRelanceFr, isRelanceDue, todayIso } from './relanceDates.js';

export { isRelanceDue, todayIso } from './relanceDates.js';

const TERMINAL = new Set(['GAGNEE', 'PERDUE', 'ARCHIVEE']);

export type TodayItem = {
  contactId: string;
  companyName: string;
  dateRelance: string;
  prochaineAction: string | null;
  pourquoi: string;
  messageBrouillon: string | null;
  messageCanal: string | null;
  ficheEtat: string | null;
};

/**
 * Liste « Aujourd’hui » pour un tenant — max 5 fiches dues.
 */
export async function listTodayContacts(
  organizationId: string,
  limit = 5
): Promise<{ items: TodayItem[]; asOf: string }> {
  const asOf = todayIso();
  const rows = await prisma.contact.findMany({
    where: {
      organizationId,
      erasedAt: null,
      ficheData: { not: Prisma.DbNull },
      OR: [{ ficheEtat: null }, { ficheEtat: { notIn: ['GAGNEE', 'PERDUE', 'ARCHIVEE'] } }],
    },
    select: {
      id: true,
      companyName: true,
      name: true,
      ficheEtat: true,
      ficheData: true,
    },
    take: 400,
    orderBy: { updatedAt: 'desc' },
  });

  const items: TodayItem[] = [];
  for (const c of rows) {
    const fiche = parseFicheData(c.ficheData);
    const dr = fiche.date_relance?.slice(0, 10) ?? null;
    const dueByDate = isRelanceDue(dr, asOf) && Boolean(dr);

    const signals = Array.isArray(fiche.signaux_externes) ? fiche.signaux_externes : [];
    const recentSignal = [...signals]
      .filter((s) => s?.at && s.at.slice(0, 10) >= fourteenDaysAgo(asOf))
      .sort((a, b) => (b.at || '').localeCompare(a.at || ''))[0];
    const dueBySignal = Boolean(recentSignal);

    if (!dueByDate && !dueBySignal) continue;

    const company = (c.companyName || c.name || 'Entreprise').trim();
    const action = fiche.prochaine_action?.trim() || null;
    let pourquoi: string;
    if (dueBySignal && recentSignal) {
      pourquoi = `Signal marché : ${recentSignal.titre}`;
    } else if (action && dr) {
      pourquoi = `Relance prévue le ${formatRelanceFr(dr)} — ${action}`;
    } else if (dr) {
      pourquoi = `Relance prévue le ${formatRelanceFr(dr)}. Vous les aviez mis de côté ; c’est le moment.`;
    } else {
      pourquoi = 'À reprendre.';
    }

    items.push({
      contactId: c.id,
      companyName: company,
      dateRelance: dr || recentSignal?.at?.slice(0, 10) || asOf,
      prochaineAction: action,
      pourquoi,
      messageBrouillon: fiche.message_brouillon?.trim() || null,
      messageCanal: fiche.message_canal?.trim() || null,
      ficheEtat: c.ficheEtat,
    });
  }

  items.sort((a, b) => a.dateRelance.localeCompare(b.dateRelance));
  return { items: items.slice(0, limit), asOf };
}

function fourteenDaysAgo(asOf: string): string {
  const d = new Date(`${asOf}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 14);
  return d.toISOString().slice(0, 10);
}

/**
 * Job quotidien : crée une Suggestion RELANCER pour chaque fiche due
 * (dédup PENDING déjà gérée par createSuggestion).
 */
export async function resurfaceDueRelances(batchSize = 200): Promise<{ scanned: number; created: number }> {
  const asOf = todayIso();
  const rows = await prisma.contact.findMany({
    where: {
      erasedAt: null,
      ficheData: { not: Prisma.DbNull },
      OR: [{ ficheEtat: null }, { ficheEtat: { notIn: ['GAGNEE', 'PERDUE', 'ARCHIVEE'] } }],
    },
    select: {
      id: true,
      organizationId: true,
      companyName: true,
      name: true,
      ficheEtat: true,
      ficheData: true,
    },
    take: batchSize,
    orderBy: { updatedAt: 'desc' },
  });

  let created = 0;
  for (const c of rows) {
    if (c.ficheEtat && TERMINAL.has(c.ficheEtat)) continue;
    const fiche = parseFicheData(c.ficheData);
    const dr = fiche.date_relance?.slice(0, 10) ?? null;
    if (!isRelanceDue(dr, asOf) || !dr) continue;

    const company = (c.companyName || c.name || 'Entreprise').trim();
    const action = fiche.prochaine_action?.trim();
    const message = action
      ? `Relance due (${formatRelanceFr(dr)}) — ${company} : ${action}`
      : `Relance due (${formatRelanceFr(dr)}) — ${company}`;

    const before = await prisma.suggestion.findFirst({
      where: { contactId: c.id, type: 'RELANCER', status: 'PENDING' },
      select: { id: true },
    });

    await createSuggestion({
      organizationId: c.organizationId,
      contactId: c.id,
      type: 'RELANCER',
      message,
      targetAgent: 'COPILOT',
    });

    if (!before) created += 1;
  }

  return { scanned: rows.length, created };
}
