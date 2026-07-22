import type {
  AgentEvent,
  Contact,
  ContactPipelineStatus,
  Suggestion,
  SuggestionStatus,
  SuggestionType,
} from '@prisma/client';
import { prisma } from '../../db/prisma.js';
import {
  SUGGESTION_RULES,
  coolingDownSuggestionMessage,
  type SuggestionRuleResult,
} from './rules.js';

export type CreateSuggestionInput = {
  organizationId: string;
  contactId: string;
  triggeredByEventId?: string | null;
  type: SuggestionType;
  message: string;
  targetAgent?: string | null;
  /** Destinataire notification — défaut : userId de l'event déclencheur ou OWNER org */
  notifyUserId?: string | null;
};

export function redirectPathForSuggestion(opts: {
  targetAgent: string | null | undefined;
  contactId: string;
}): string {
  const { targetAgent, contactId } = opts;
  switch (targetAgent) {
    case 'HUNT':
      return `/prospection-ia?contactId=${contactId}`;
    case 'OFFREBOT':
      return `/agents/offre-bot?contactId=${contactId}`;
    case 'FACTCHECK':
      return `/agents/factcheck-ai?contactId=${contactId}`;
    case 'COPILOT':
      return `/ai-assistant?contactId=${contactId}`;
    case 'GMAIL':
      return `/agents/gmail-ai?contactId=${contactId}`;
    default:
      return `/contacts/${contactId}`;
  }
}

export async function createSuggestion(data: CreateSuggestionInput): Promise<Suggestion> {
  const existing = await prisma.suggestion.findFirst({
    where: {
      contactId: data.contactId,
      type: data.type,
      status: 'PENDING',
    },
  });
  if (existing) return existing;

  const suggestion = await prisma.suggestion.create({
    data: {
      organizationId: data.organizationId,
      contactId: data.contactId,
      triggeredByEventId: data.triggeredByEventId ?? null,
      type: data.type,
      message: data.message,
      targetAgent: data.targetAgent ?? null,
      status: 'PENDING',
    },
  });

  void notifyNewSuggestion(suggestion, data.notifyUserId).catch((err) =>
    console.warn('[suggestions] notify failed', suggestion.id, err)
  );

  return suggestion;
}

async function resolveNotifyUserId(
  organizationId: string,
  preferredUserId?: string | null
): Promise<string | null> {
  if (preferredUserId) {
    const u = await prisma.user.findFirst({
      where: { id: preferredUserId, organizationId },
      select: { id: true },
    });
    if (u) return u.id;
  }
  const owner = await prisma.user.findFirst({
    where: { organizationId, role: 'OWNER' },
    select: { id: true },
    orderBy: { createdAt: 'asc' },
  });
  return owner?.id ?? null;
}

async function notifyNewSuggestion(
  suggestion: Suggestion,
  preferredUserId?: string | null
): Promise<void> {
  const userId = await resolveNotifyUserId(suggestion.organizationId, preferredUserId);
  if (!userId) return;

  await prisma.notification.create({
    data: {
      organizationId: suggestion.organizationId,
      userId,
      type: 'RAPPEL',
      title: 'Suggestion d’action',
      content: suggestion.message,
      link: `/contacts/${suggestion.contactId}`,
    },
  });
}

export async function evaluateSuggestionsForEvent(event: AgentEvent): Promise<Suggestion[]> {
  if (!event.contactId) return [];

  const contact = await prisma.contact.findFirst({
    where: { id: event.contactId, organizationId: event.organizationId, erasedAt: null },
  });
  if (!contact) return [];

  const previousEvents = await prisma.agentEvent.findMany({
    where: {
      organizationId: event.organizationId,
      contactId: contact.id,
      id: { not: event.id },
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
    select: {
      id: true,
      source: true,
      type: true,
      score: true,
      resume: true,
      actionsSuggerees: true,
    },
  });

  const context = { event, contact, previousEvents };
  const created: Suggestion[] = [];

  for (const rule of SUGGESTION_RULES) {
    const result = rule(context);
    if (!result) continue;
    const suggestion = await createSuggestion({
      organizationId: event.organizationId,
      contactId: contact.id,
      triggeredByEventId: event.id,
      type: result.type,
      message: result.message,
      targetAgent: result.targetAgent,
      notifyUserId: event.userId,
    });
    created.push(suggestion);
  }

  return created;
}

export async function checkCoolingDown(
  contact: Contact,
  previousStatus: ContactPipelineStatus,
  newStatus: ContactPipelineStatus
): Promise<Suggestion | null> {
  const wasHot = previousStatus === 'CHAUD';
  const isNowCooling = newStatus === 'A_RELANCER' || newStatus === 'TIEDE';
  if (!wasHot || !isNowCooling) return null;

  const result: SuggestionRuleResult = coolingDownSuggestionMessage(contact);
  return createSuggestion({
    organizationId: contact.organizationId,
    contactId: contact.id,
    triggeredByEventId: null,
    type: result.type,
    message: result.message,
    targetAgent: result.targetAgent,
  });
}

export async function expireOldSuggestions(days = 14): Promise<number> {
  const cutoff = new Date(Date.now() - days * 86_400_000);
  const result = await prisma.suggestion.updateMany({
    where: {
      status: 'PENDING',
      createdAt: { lt: cutoff },
    },
    data: { status: 'EXPIRED' },
  });
  return result.count;
}

export async function listSuggestionsForContact(
  organizationId: string,
  contactId: string,
  status?: SuggestionStatus
) {
  return prisma.suggestion.findMany({
    where: {
      organizationId,
      contactId,
      ...(status ? { status } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
}

export async function acceptSuggestion(
  organizationId: string,
  suggestionId: string
): Promise<{ suggestion: Suggestion; redirectTo: string } | null> {
  const suggestion = await prisma.suggestion.findFirst({
    where: { id: suggestionId, organizationId },
  });
  if (!suggestion) return null;
  if (suggestion.status !== 'PENDING') {
    return {
      suggestion,
      redirectTo: redirectPathForSuggestion({
        targetAgent: suggestion.targetAgent,
        contactId: suggestion.contactId,
      }),
    };
  }

  const updated = await prisma.suggestion.update({
    where: { id: suggestion.id },
    data: { status: 'ACCEPTED', respondedAt: new Date() },
  });

  return {
    suggestion: updated,
    redirectTo: redirectPathForSuggestion({
      targetAgent: updated.targetAgent,
      contactId: updated.contactId,
    }),
  };
}

export async function dismissSuggestion(
  organizationId: string,
  suggestionId: string
): Promise<Suggestion | null> {
  const suggestion = await prisma.suggestion.findFirst({
    where: { id: suggestionId, organizationId, status: 'PENDING' },
  });
  if (!suggestion) return null;

  return prisma.suggestion.update({
    where: { id: suggestion.id },
    data: { status: 'DISMISSED', respondedAt: new Date() },
  });
}
