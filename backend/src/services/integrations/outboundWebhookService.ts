import type { AgentEventType } from '@prisma/client';
import { prisma } from '../../db/prisma.js';
import { signHmacSha256 } from './webhookCrypto.js';

const RETRY_DELAYS_MS = [0, 1_000, 5_000, 30_000];
const MAX_ATTEMPTS = 3;

export type OutboundWebhookPayload = {
  contact: {
    id: string;
    name: string | null;
    companyName: string | null;
    email: string | null;
    phone: string | null;
    whatsappId: string | null;
    pipelineStatus: string;
    pipelineStatusScore: number | null;
  };
  event: {
    id: string;
    source: string;
    type: string;
    resume: string | null;
    score: number | null;
    actionsSuggerees: string[];
    createdAt: string;
    sourceRef: string | null;
  };
};

export function shouldDeliverEvent(
  enabled: boolean,
  configuredTypes: AgentEventType[],
  eventType: AgentEventType
): boolean {
  if (!enabled) return false;
  if (!configuredTypes.length) return true;
  return configuredTypes.includes(eventType);
}

export function buildOutboundPayload(
  contact: {
    id: string;
    name: string | null;
    companyName: string | null;
    email: string | null;
    phone: string | null;
    whatsappId: string | null;
    pipelineStatus: string;
    pipelineStatusScore: number | null;
  },
  event: {
    id: string;
    source: string;
    type: string;
    resume: string | null;
    score: number | null;
    actionsSuggerees: string[];
    createdAt: Date;
    sourceRef: string | null;
  }
): OutboundWebhookPayload {
  return {
    contact: {
      id: contact.id,
      name: contact.name,
      companyName: contact.companyName,
      email: contact.email,
      phone: contact.phone,
      whatsappId: contact.whatsappId,
      pipelineStatus: contact.pipelineStatus,
      pipelineStatusScore: contact.pipelineStatusScore,
    },
    event: {
      id: event.id,
      source: event.source,
      type: event.type,
      resume: event.resume,
      score: event.score,
      actionsSuggerees: event.actionsSuggerees,
      createdAt: event.createdAt.toISOString(),
      sourceRef: event.sourceRef,
    },
  };
}

async function loadEventWithContact(agentEventId: string) {
  return prisma.agentEvent.findUnique({
    where: { id: agentEventId },
    include: {
      contact: {
        select: {
          id: true,
          name: true,
          companyName: true,
          email: true,
          phone: true,
          whatsappId: true,
          pipelineStatus: true,
          pipelineStatusScore: true,
          erasedAt: true,
        },
      },
    },
  });
}

async function deliverOnce(
  targetUrl: string,
  secret: string,
  payload: OutboundWebhookPayload
): Promise<{ ok: boolean; httpStatus?: number; error?: string }> {
  const body = JSON.stringify(payload);
  const signature = signHmacSha256(secret, body);

  try {
    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Ciblix-Signature': signature,
        'X-Ciblix-Event-Id': payload.event.id,
      },
      body,
      signal: AbortSignal.timeout(15_000),
    });

    if (response.ok) {
      return { ok: true, httpStatus: response.status };
    }
    return { ok: false, httpStatus: response.status, error: await response.text().catch(() => 'http_error') };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'network_error' };
  }
}

async function logDelivery(opts: {
  organizationId: string;
  agentEventId: string;
  status: string;
  httpStatus?: number;
  attempts: number;
  errorMessage?: string;
}) {
  await prisma.webhookDeliveryLog.create({
    data: {
      organizationId: opts.organizationId,
      agentEventId: opts.agentEventId,
      status: opts.status,
      httpStatus: opts.httpStatus ?? null,
      attempts: opts.attempts,
      errorMessage: opts.errorMessage ?? null,
    },
  });
}

export async function deliverOutboundWebhook(agentEventId: string): Promise<void> {
  const event = await loadEventWithContact(agentEventId);
  if (!event?.contact || event.contact.erasedAt) return;

  const config = await prisma.outboundWebhookConfig.findUnique({
    where: { organizationId: event.organizationId },
  });
  if (!config || !shouldDeliverEvent(config.enabled, config.eventTypes, event.type)) return;

  const payload = buildOutboundPayload(event.contact, event);

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const delay = RETRY_DELAYS_MS[attempt - 1] ?? 30_000;
    if (delay > 0) await new Promise((r) => setTimeout(r, delay));

    const result = await deliverOnce(config.targetUrl, config.secret, payload);
    if (result.ok) {
      await logDelivery({
        organizationId: event.organizationId,
        agentEventId,
        status: 'delivered',
        httpStatus: result.httpStatus,
        attempts: attempt,
      });
      return;
    }

    if (attempt === MAX_ATTEMPTS) {
      await logDelivery({
        organizationId: event.organizationId,
        agentEventId,
        status: 'failed',
        httpStatus: result.httpStatus,
        attempts: attempt,
        errorMessage: result.error,
      });
    }
  }
}

/** Queue asynchrone — ne bloque jamais la création d'AgentEvent. */
export function enqueueOutboundWebhook(agentEventId: string): void {
  setImmediate(() => {
    void deliverOutboundWebhook(agentEventId).catch((err) => {
      console.warn('[outbound-webhook] delivery failed', agentEventId, err);
    });
  });
}
