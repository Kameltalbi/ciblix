import type { AgentEvent } from '@prisma/client';
import { prisma } from '../../db/prisma.js';
import { findOrCreateContact } from './contactService.js';
import {
  MAX_RESOLUTION_ATTEMPTS,
  RESCAN_DEBOUNCE_MS,
  RESCAN_EVENT_LIMIT,
} from './constants.js';

const rescanTimers = new Map<string, ReturnType<typeof setTimeout>>();

function backoffMs(attempt: number): number {
  const hours = [1, 6, 24, 48, 72];
  return (hours[Math.min(attempt, hours.length - 1)] ?? 72) * 3_600_000;
}

type MatchHints = {
  phoneNormalized: string | null;
  emailNormalized: string | null;
  whatsappNormalized: string | null;
};

function extractHintsFromEvent(event: AgentEvent): MatchHints {
  // Phase 1 : matching via sourceRef metadata ou champs futurs.
  // Pour l'instant, pas de clés dans l'event sans contact — NEEDS_REVIEW jusqu'à rescan org.
  return { phoneNormalized: null, emailNormalized: null, whatsappNormalized: null };
}

async function tryMatchContact(
  organizationId: string,
  hints: MatchHints
): Promise<string | null> {
  if (hints.phoneNormalized) {
    const c = await prisma.contact.findFirst({
      where: { organizationId, phoneNormalized: hints.phoneNormalized, erasedAt: null },
      select: { id: true },
    });
    if (c) return c.id;
  }
  if (hints.emailNormalized) {
    const c = await prisma.contact.findFirst({
      where: { organizationId, emailNormalized: hints.emailNormalized, erasedAt: null },
      select: { id: true },
    });
    if (c) return c.id;
  }
  if (hints.whatsappNormalized) {
    const c = await prisma.contact.findFirst({
      where: { organizationId, whatsappNormalized: hints.whatsappNormalized, erasedAt: null },
      select: { id: true },
    });
    if (c) return c.id;
  }
  return null;
}

export async function resolveEventContact(eventId: string): Promise<void> {
  const event = await prisma.agentEvent.findUnique({ where: { id: eventId } });
  if (!event || event.contactId || event.resolutionStatus === 'RESOLVED') return;

  const now = new Date();
  if (event.resolutionNextRetryAt && event.resolutionNextRetryAt > now) return;

  const hints = extractHintsFromEvent(event);
  const contactId = await tryMatchContact(event.organizationId, hints);

  if (contactId) {
    await prisma.agentEvent.update({
      where: { id: eventId },
      data: {
        contactId,
        resolutionStatus: 'RESOLVED',
        resolutionLastAt: now,
        resolutionNextRetryAt: null,
      },
    });
    return;
  }

  const attempts = event.resolutionAttempts + 1;
  const status = attempts >= MAX_RESOLUTION_ATTEMPTS ? 'NEEDS_REVIEW' : 'PENDING';

  await prisma.agentEvent.update({
    where: { id: eventId },
    data: {
      resolutionAttempts: attempts,
      resolutionLastAt: now,
      resolutionStatus: status,
      resolutionNextRetryAt:
        status === 'PENDING' ? new Date(now.getTime() + backoffMs(attempts)) : null,
    },
  });
}

export async function rescanUnresolvedForOrg(organizationId: string): Promise<number> {
  const events = await prisma.agentEvent.findMany({
    where: {
      organizationId,
      contactId: null,
      resolutionStatus: { in: ['PENDING', 'NEEDS_REVIEW'] },
    },
    orderBy: { createdAt: 'desc' },
    take: RESCAN_EVENT_LIMIT,
  });

  for (const event of events) {
    await resolveEventContact(event.id);
  }

  return events.length;
}

/** Debounce rescan — max 1 rescan / org / 5 min. */
export function scheduleOrgRescan(organizationId: string): void {
  const existing = rescanTimers.get(organizationId);
  if (existing) clearTimeout(existing);

  rescanTimers.set(
    organizationId,
    setTimeout(() => {
      rescanTimers.delete(organizationId);
      void rescanUnresolvedForOrg(organizationId).catch((err) => {
        console.warn('[agent-memory] rescan failed', organizationId, err);
      });
    }, RESCAN_DEBOUNCE_MS)
  );
}

export async function processDueResolutions(limit = 50): Promise<void> {
  const now = new Date();
  const due = await prisma.agentEvent.findMany({
    where: {
      contactId: null,
      resolutionStatus: 'PENDING',
      OR: [{ resolutionNextRetryAt: null }, { resolutionNextRetryAt: { lte: now } }],
    },
    orderBy: { resolutionNextRetryAt: 'asc' },
    take: limit,
  });

  for (const event of due) {
    await resolveEventContact(event.id);
  }
}

export async function weeklyNeedsReviewRetry(): Promise<void> {
  const since = new Date(Date.now() - 90 * 86_400_000);
  const orgs = await prisma.agentEvent.findMany({
    where: {
      resolutionStatus: 'NEEDS_REVIEW',
      createdAt: { gte: since },
    },
    select: { organizationId: true },
    distinct: ['organizationId'],
  });

  for (const { organizationId } of orgs) {
    await rescanUnresolvedForOrg(organizationId);
  }
}

/** Utilitaire Phase 2+ : résolution via clés explicites sur l'event entrant */
export async function resolveEventWithKeys(
  eventId: string,
  keys: { phone?: string | null; email?: string | null; whatsappId?: string | null; name?: string | null },
  createdVia: Parameters<typeof findOrCreateContact>[0]['createdVia'],
  conflictSource: Parameters<typeof findOrCreateContact>[0]['conflictSource']
): Promise<void> {
  const event = await prisma.agentEvent.findUnique({ where: { id: eventId } });
  if (!event || event.contactId) return;

  const phone = keys.phone?.trim();
  const email = keys.email?.trim();
  const whatsapp = keys.whatsappId?.trim();
  if (!phone && !email && !whatsapp) return;

  const contact = await findOrCreateContact({
    organizationId: event.organizationId,
    createdVia,
    name: keys.name,
    phone,
    email,
    whatsappId: whatsapp,
    conflictSource,
    conflictSourceRef: event.sourceRef,
  });

  await prisma.agentEvent.update({
    where: { id: eventId },
    data: {
      contactId: contact.id,
      resolutionStatus: 'RESOLVED',
      resolutionNextRetryAt: null,
      resolutionLastAt: new Date(),
    },
  });

  scheduleOrgRescan(event.organizationId);
}
