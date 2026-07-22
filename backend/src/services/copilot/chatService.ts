import { prisma } from '../../db/prisma.js';
import { getCopilotOrgConfig } from './orgConfig.js';
import { listRecentEventsForOrganization } from '../agent-memory/agentEventService.js';

const WELCOME =
  "Bonjour ! Je suis votre copilote commercial IA. Analysez une conversation ou posez vos questions — l'historique est conservé.";

export async function listCopilotMessages(opts: {
  organizationId: string;
  userId: string;
  contactId?: string;
  agentEventId?: string;
  take?: number;
}) {
  const take = Math.min(opts.take ?? 80, 200);
  const rows = await prisma.copilotMessage.findMany({
    where: {
      organizationId: opts.organizationId,
      userId: opts.userId,
      ...(opts.contactId ? { contactId: opts.contactId } : {}),
      ...(opts.agentEventId ? { agentEventId: opts.agentEventId } : {}),
    },
    orderBy: { createdAt: 'asc' },
    take,
  });

  if (rows.length === 0) {
    return [{ role: 'assistant' as const, content: WELCOME, id: 'welcome' }];
  }

  return rows.map((r) => ({
    id: r.id,
    role: r.role as 'user' | 'assistant',
    content: r.content,
    createdAt: r.createdAt.toISOString(),
  }));
}

async function buildChatContext(organizationId: string) {
  const since = new Date(Date.now() - 48 * 3_600_000);
  const [cfg, events] = await Promise.all([
    getCopilotOrgConfig(organizationId),
    listRecentEventsForOrganization(organizationId, since, { take: 15 }),
  ]);

  const eventsBlock = events
    .filter((e) => e.resume)
    .slice(0, 8)
    .map(
      (e) =>
        `- [${e.createdAt.toISOString().slice(0, 10)}] score ${e.score ?? '—'} : ${(e.resume || '').slice(0, 200)}`
    )
    .join('\n');

  return `Organisation : ${cfg.orgName}, secteur ${cfg.sector}.
Conversations récentes analysées :
${eventsBlock || '(aucune pour le moment)'}`;
}

async function callChatLLM(
  systemPrompt: string,
  history: Array<{ role: string; content: string }>,
  userMessage: string
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY not configured');

  const messages = [
    { role: 'system', content: systemPrompt },
    ...history.slice(-12),
    { role: 'user', content: userMessage },
  ];

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages,
      max_tokens: 900,
      temperature: 0.5,
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI error: ${await response.text()}`);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error('empty_llm_response');
  return content;
}

export async function sendCopilotChat(opts: {
  organizationId: string;
  userId: string;
  message: string;
  contactId?: string;
  agentEventId?: string;
}) {
  const text = opts.message.trim();
  if (!text) throw new Error('Message vide');

  const prior = await prisma.copilotMessage.findMany({
    where: {
      organizationId: opts.organizationId,
      userId: opts.userId,
      ...(opts.agentEventId ? { agentEventId: opts.agentEventId } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: 12,
  });

  const history = prior.reverse().map((m) => ({ role: m.role, content: m.content }));
  const context = await buildChatContext(opts.organizationId);
  const systemPrompt = `Tu es le copilote commercial IA de Ciblix. Réponds en français, de façon concise et actionnable.
${context}`;

  const assistantContent = await callChatLLM(systemPrompt, history, text);

  const [userRow, assistantRow] = await prisma.$transaction([
    prisma.copilotMessage.create({
      data: {
        organizationId: opts.organizationId,
        userId: opts.userId,
        contactId: opts.contactId || null,
        agentEventId: opts.agentEventId || null,
        role: 'user',
        content: text,
      },
    }),
    prisma.copilotMessage.create({
      data: {
        organizationId: opts.organizationId,
        userId: opts.userId,
        contactId: opts.contactId || null,
        agentEventId: opts.agentEventId || null,
        role: 'assistant',
        content: assistantContent,
      },
    }),
  ]);

  return {
    userMessage: userRow,
    assistantMessage: assistantRow,
    reply: assistantContent,
  };
}
