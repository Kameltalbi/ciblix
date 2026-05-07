import { prisma } from '../db/prisma.js';

/** Identifies calendar rows auto-synced from an affaire « prochaine action » */
export const SYNTH_AFFAIRE_NEXT_ACTION = 'SYNTH_AFF_NEXT_ACTION';

function dayUtcSlot(d: Date): { startDate: Date; endDate: Date } {
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  const day = d.getUTCDate();
  return {
    startDate: new Date(Date.UTC(y, m, day, 9, 0, 0)),
    endDate: new Date(Date.UTC(y, m, day, 10, 0, 0)),
  };
}

async function findNextActionEvent(
  organizationId: string,
  affaireId: string
): Promise<{ id: string } | null> {
  return prisma.calendarEvent.findFirst({
    where: {
      organizationId,
      relatedAffaireId: affaireId,
      deletedAt: null,
      description: { contains: SYNTH_AFFAIRE_NEXT_ACTION },
    },
    select: { id: true },
  });
}

/**
 * Mirrors `Affaire.dateProchaineAction` / `prochaineAction` to a dedicated calendar row
 * so the événement apparaît sur la page Calendrier.
 */
export async function syncAffaireNextActionCalendar(params: {
  organizationId: string;
  createdById: string | null | undefined;
  affaireId: string;
  clientName?: string | null;
  affaireTitle: string;
  prochaineAction?: string | null;
  dateProchaineAction: Date | string | null | undefined;
}): Promise<void> {
  const {
    organizationId,
    createdById,
    affaireId,
    clientName,
    affaireTitle,
    prochaineAction,
    dateProchaineAction,
  } = params;

  const parsed =
    dateProchaineAction instanceof Date
      ? dateProchaineAction
      : dateProchaineAction
        ? new Date(dateProchaineAction)
        : null;

  const hasValidDate = !!(parsed && !Number.isNaN(parsed.getTime()));
  const txt = prochaineAction?.trim() || '';

  const existing = await findNextActionEvent(organizationId, affaireId);

  if (!hasValidDate) {
    if (existing) {
      await prisma.calendarEvent.update({
        where: { id: existing.id },
        data: { deletedAt: new Date() },
      });
    }
    return;
  }

  const { startDate, endDate } = dayUtcSlot(parsed);
  const titleBase =
    txt.length > 0 ? txt.slice(0, 200) : `Prochaine action · ${(affaireTitle || 'Opportunité').slice(0, 120)}`;
  const title = `${titleBase}${clientName ? ` · ${String(clientName).slice(0, 80)}` : ''}`;
  const description = `${SYNTH_AFFAIRE_NEXT_ACTION}\nAffaire : ${affaireTitle}`;

  if (existing) {
    await prisma.calendarEvent.update({
      where: { id: existing.id },
      data: {
        title,
        description,
        startDate,
        endDate,
        eventType: 'MEETING',
        relatedAffaireId: affaireId,
        deletedAt: null,
        status: 'SCHEDULED',
      },
    });
    return;
  }

  await prisma.calendarEvent.create({
    data: {
      organizationId,
      createdById: createdById || null,
      title,
      description,
      startDate,
      endDate,
      allDay: false,
      eventType: 'MEETING',
      relatedAffaireId: affaireId,
      status: 'SCHEDULED',
    },
  });
}

export async function removeAffaireNextActionCalendarEvents(params: {
  organizationId: string;
  affaireId: string;
}): Promise<void> {
  const { organizationId, affaireId } = params;
  const existing = await findNextActionEvent(organizationId, affaireId);
  if (existing) {
    await prisma.calendarEvent.update({
      where: { id: existing.id },
      data: { deletedAt: new Date() },
    });
  }
}
