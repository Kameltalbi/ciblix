import type { ConnectKnowledgeSourceType } from '@prisma/client';
import { prisma } from '../../../db/prisma.js';

export async function listKnowledgeSources(organizationId: string) {
  return prisma.connectKnowledgeSource.findMany({
    where: { organizationId },
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true,
      name: true,
      type: true,
      sourceUrl: true,
      mimeType: true,
      status: true,
      error: true,
      chunkCount: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

export async function getKnowledgeSource(organizationId: string, sourceId: string) {
  return prisma.connectKnowledgeSource.findFirst({
    where: { id: sourceId, organizationId },
  });
}

export async function createKnowledgeSource(params: {
  organizationId: string;
  createdById?: string;
  name: string;
  type: ConnectKnowledgeSourceType;
  sourceUrl?: string;
  storageRef?: string;
  mimeType?: string;
}) {
  return prisma.connectKnowledgeSource.create({
    data: {
      organizationId: params.organizationId,
      createdById: params.createdById,
      name: params.name,
      type: params.type,
      sourceUrl: params.sourceUrl,
      storageRef: params.storageRef,
      mimeType: params.mimeType,
      status: 'PENDING',
    },
  });
}

export async function markSourceFailed(sourceId: string, error: string) {
  return prisma.connectKnowledgeSource.update({
    where: { id: sourceId },
    data: { status: 'FAILED', error },
  });
}

export async function replaceSourceChunks(params: {
  organizationId: string;
  sourceId: string;
  extractedText: string;
  chunks: Array<{ position: number; title?: string; content: string }>;
}) {
  await prisma.$transaction(async (tx) => {
    await tx.connectKnowledgeChunk.deleteMany({ where: { sourceId: params.sourceId } });
    if (params.chunks.length) {
      await tx.connectKnowledgeChunk.createMany({
        data: params.chunks.map((c) => ({
          organizationId: params.organizationId,
          sourceId: params.sourceId,
          position: c.position,
          title: c.title,
          content: c.content,
        })),
      });
    }
    await tx.connectKnowledgeSource.update({
      where: { id: params.sourceId },
      data: {
        status: 'READY',
        error: null,
        extractedText: params.extractedText.slice(0, 200_000),
        chunkCount: params.chunks.length,
      },
    });
  });
}

export async function deleteKnowledgeSource(organizationId: string, sourceId: string) {
  const existing = await prisma.connectKnowledgeSource.findFirst({
    where: { id: sourceId, organizationId },
  });
  if (!existing) return null;
  await prisma.connectKnowledgeSource.delete({ where: { id: sourceId } });
  return existing;
}

export interface RetrievedChunk {
  id: string;
  sourceId: string;
  sourceName: string;
  sourceType: ConnectKnowledgeSourceType;
  title: string | null;
  content: string;
  rank: number;
}

/** Full-text retrieval scoped to organization. Falls back to recency if FTS yields nothing. */
export async function searchKnowledgeChunks(
  organizationId: string,
  query: string,
  limit = 5
): Promise<RetrievedChunk[]> {
  const cleaned = query
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2)
    .slice(0, 12)
    .join(' & ');

  if (cleaned) {
    const rows = await prisma.$queryRaw<
      Array<{
        id: string;
        sourceId: string;
        sourceName: string;
        sourceType: ConnectKnowledgeSourceType;
        title: string | null;
        content: string;
        rank: number;
      }>
    >`
      SELECT c.id, c."sourceId", s.name AS "sourceName", s.type AS "sourceType",
             c.title, c.content,
             ts_rank(to_tsvector('simple', coalesce(c.title, '') || ' ' || c.content),
                     to_tsquery('simple', ${cleaned})) AS rank
      FROM connect_knowledge_chunks c
      JOIN connect_knowledge_sources s ON s.id = c."sourceId"
      WHERE c."organizationId" = ${organizationId}
        AND s.status = 'READY'
        AND to_tsvector('simple', coalesce(c.title, '') || ' ' || c.content)
            @@ to_tsquery('simple', ${cleaned})
      ORDER BY rank DESC
      LIMIT ${limit}
    `;
    if (rows.length) return rows;
  }

  // Fallback: latest chunks from ready sources
  const fallback = await prisma.connectKnowledgeChunk.findMany({
    where: {
      organizationId,
      source: { status: 'READY' },
    },
    include: { source: { select: { name: true, type: true } } },
    orderBy: { updatedAt: 'desc' },
    take: limit,
  });

  return fallback.map((c, i) => ({
    id: c.id,
    sourceId: c.sourceId,
    sourceName: c.source.name,
    sourceType: c.source.type,
    title: c.title,
    content: c.content,
    rank: 0.01 * (limit - i),
  }));
}

export function formatKnowledgeForPrompt(chunks: RetrievedChunk[], maxChars = 2800): string {
  if (!chunks.length) return '';
  const parts: string[] = [];
  let used = 0;
  for (const c of chunks) {
    const label = c.title || c.sourceName;
    const block = `[source: ${label}]\n${c.content.trim()}`;
    if (used + block.length > maxChars) break;
    parts.push(block);
    used += block.length;
  }
  if (!parts.length) return '';
  return `Connaissances entreprise vérifiées :
${parts.join('\n\n')}

Utilise ces informations seulement si elles sont pertinentes.
Ne fabrique ni prix, ni conditions, ni fonctionnalités non présentes dans ces sources.`;
}
