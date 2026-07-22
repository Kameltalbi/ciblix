import type { AgentEventSource, AgentEventType, ContactCreatedVia } from '@prisma/client';
import { prisma } from '../../db/prisma.js';
import { createAgentEvent } from './agentEventService.js';
import { findOrCreateContact } from './contactService.js';

type HuntProspectLike = {
  id: string;
  companyName: string;
  phone?: string | null;
  email?: string | null;
  score?: number | null;
  lastSearchQuery?: string | null;
  aiSummary?: string | null;
};

function hasExploitableIdentity(row: {
  phone?: string | null;
  email?: string | null;
  companyName?: string | null;
}): boolean {
  return Boolean(row.phone?.trim() || row.email?.trim() || row.companyName?.trim());
}

async function eventExists(source: AgentEventSource, organizationId: string, sourceRef: string) {
  const existing = await prisma.agentEvent.findFirst({
    where: { organizationId, source, sourceRef },
    select: { id: true },
  });
  return Boolean(existing);
}

export async function recordHuntProspectFound(opts: {
  organizationId: string;
  userId: string;
  prospect: HuntProspectLike;
  skipRescan?: boolean;
}) {
  const { prospect } = opts;
  if (!hasExploitableIdentity(prospect)) return null;

  const dedupeKey = `hunt:found:${prospect.id}`;
  if (await eventExists('HUNT', opts.organizationId, dedupeKey)) return null;

  let contactId: string | null = null;
  if (prospect.phone?.trim() || prospect.email?.trim()) {
    const contact = await findOrCreateContact({
      organizationId: opts.organizationId,
      createdVia: 'HUNT',
      phone: prospect.phone,
      email: prospect.email,
      companyName: prospect.companyName,
      conflictSource: 'HUNT',
      conflictSourceRef: prospect.id,
      skipRescan: opts.skipRescan,
    });
    contactId = contact.id;
  }

  const criteria = prospect.lastSearchQuery?.trim() || prospect.companyName;
  return createAgentEvent({
    organizationId: opts.organizationId,
    userId: opts.userId,
    contactId,
    source: 'HUNT',
    type: 'NOTE',
    resume: `Prospect identifié : ${criteria}`,
    score: prospect.score ?? null,
    sourceRef: dedupeKey,
  });
}

export async function recordHuntPriority(opts: {
  organizationId: string;
  userId: string;
  prospect: HuntProspectLike;
}) {
  const dedupeKey = `hunt:priority:${opts.prospect.id}`;
  if (await eventExists('HUNT', opts.organizationId, dedupeKey)) return null;
  if (!hasExploitableIdentity(opts.prospect)) return null;

  let contactId: string | null = null;
  if (opts.prospect.phone?.trim() || opts.prospect.email?.trim()) {
    const contact = await findOrCreateContact({
      organizationId: opts.organizationId,
      createdVia: 'HUNT',
      phone: opts.prospect.phone,
      email: opts.prospect.email,
      companyName: opts.prospect.companyName,
      conflictSource: 'HUNT',
      conflictSourceRef: opts.prospect.id,
    });
    contactId = contact.id;
  }

  return createAgentEvent({
    organizationId: opts.organizationId,
    userId: opts.userId,
    contactId,
    source: 'HUNT',
    type: 'NOTE',
    resume: 'Marqué comme prioritaire',
    score: opts.prospect.score ?? null,
    sourceRef: dedupeKey,
  });
}

export async function recordHuntOutreachDraft(opts: {
  organizationId: string;
  userId: string;
  prospect: HuntProspectLike;
  messageType: string;
  channel: 'EMAIL' | 'WHATSAPP' | 'NOTE';
  messageSummary: string;
}) {
  const dedupeKey = `hunt:outreach:${opts.prospect.id}:${opts.messageType}`;
  if (await eventExists('HUNT', opts.organizationId, dedupeKey)) return null;
  if (!hasExploitableIdentity(opts.prospect)) return null;

  let contactId: string | null = null;
  if (opts.prospect.phone?.trim() || opts.prospect.email?.trim()) {
    const contact = await findOrCreateContact({
      organizationId: opts.organizationId,
      createdVia: 'HUNT',
      phone: opts.prospect.phone,
      email: opts.prospect.email,
      companyName: opts.prospect.companyName,
      conflictSource: 'HUNT',
      conflictSourceRef: opts.prospect.id,
    });
    contactId = contact.id;
  }

  const type: AgentEventType =
    opts.channel === 'WHATSAPP' ? 'WHATSAPP' : opts.channel === 'EMAIL' ? 'EMAIL' : 'NOTE';

  return createAgentEvent({
    organizationId: opts.organizationId,
    userId: opts.userId,
    contactId,
    source: 'HUNT',
    type,
    resume: `Message préparé : ${opts.messageSummary.slice(0, 280)}`,
    sourceRef: dedupeKey,
  });
}

export async function recordHuntReply(opts: {
  organizationId: string;
  userId: string;
  prospect: HuntProspectLike;
  responseSummary: string;
  score?: number | null;
  responseId: string;
}) {
  const dedupeKey = `hunt:reply:${opts.responseId}`;
  if (await eventExists('HUNT', opts.organizationId, dedupeKey)) return null;
  if (!hasExploitableIdentity(opts.prospect)) return null;

  let contactId: string | null = null;
  if (opts.prospect.phone?.trim() || opts.prospect.email?.trim()) {
    const contact = await findOrCreateContact({
      organizationId: opts.organizationId,
      createdVia: 'HUNT',
      phone: opts.prospect.phone,
      email: opts.prospect.email,
      companyName: opts.prospect.companyName,
      conflictSource: 'HUNT',
      conflictSourceRef: opts.prospect.id,
    });
    contactId = contact.id;
  }

  return createAgentEvent({
    organizationId: opts.organizationId,
    userId: opts.userId,
    contactId,
    source: 'HUNT',
    type: 'EMAIL',
    resume: `Réponse reçue : ${opts.responseSummary.slice(0, 280)}`,
    score: opts.score ?? opts.prospect.score ?? null,
    sourceRef: dedupeKey,
  });
}

export async function recordGmailInboundEmail(opts: {
  organizationId: string;
  userId: string;
  fromEmail: string;
  summary: string;
  gmailMessageId: string;
  fromName?: string | null;
}) {
  if (!opts.fromEmail.trim()) return null;
  if (await eventExists('GMAIL', opts.organizationId, opts.gmailMessageId)) return null;

  const contact = await findOrCreateContact({
    organizationId: opts.organizationId,
    createdVia: 'GMAIL',
    email: opts.fromEmail,
    name: opts.fromName,
    conflictSource: 'GMAIL',
    conflictSourceRef: opts.gmailMessageId,
  });

  return createAgentEvent({
    organizationId: opts.organizationId,
    userId: opts.userId,
    contactId: contact.id,
    source: 'GMAIL',
    type: 'EMAIL',
    resume: opts.summary,
    sourceRef: opts.gmailMessageId,
  });
}

export type ScoutContactHints = {
  contactEmail?: string | null;
  contactPhone?: string | null;
  companyName?: string | null;
  highConfidence?: boolean;
};

export async function recordScoutOpportunity(opts: {
  organizationId: string;
  userId: string;
  opportunityId: string;
  title: string;
  description: string;
  hints: ScoutContactHints;
  createdVia?: ContactCreatedVia;
}) {
  const { hints } = opts;
  const hasStrict = Boolean(hints.contactEmail?.trim() || hints.contactPhone?.trim());
  const hasCompany = Boolean(hints.companyName?.trim() && hints.highConfidence);

  if (!hasStrict && !hasCompany) return null;
  if (await eventExists('SCOUT', opts.organizationId, opts.opportunityId)) return null;

  let contactId: string | null = null;
  if (hasStrict) {
    const contact = await findOrCreateContact({
      organizationId: opts.organizationId,
      createdVia: 'SCOUT',
      email: hints.contactEmail,
      phone: hints.contactPhone,
      companyName: hints.companyName,
      conflictSource: 'SCOUT',
      conflictSourceRef: opts.opportunityId,
    });
    contactId = contact.id;
  }

  return createAgentEvent({
    organizationId: opts.organizationId,
    userId: opts.userId,
    contactId,
    source: 'SCOUT',
    type: 'OPPORTUNITE',
    resume: `Opportunité détectée : ${opts.title} — ${opts.description}`.slice(0, 2000),
    sourceRef: opts.opportunityId,
  });
}
