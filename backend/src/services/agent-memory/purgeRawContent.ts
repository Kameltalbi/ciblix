import { prisma } from '../../db/prisma.js';
import { deleteRawContent } from './s3RawContent.js';

/** Purge les blobs S3 expirés et vide les références en base. */
export async function purgeExpiredRawContent(limit = 100): Promise<number> {
  const now = new Date();
  const due = await prisma.agentEvent.findMany({
    where: {
      contenuBrutRef: { not: null },
      contenuBrutExpiresAt: { lte: now },
    },
    take: limit,
    select: { id: true, contenuBrutRef: true },
  });

  for (const row of due) {
    if (row.contenuBrutRef) {
      await deleteRawContent(row.contenuBrutRef);
    }
    await prisma.agentEvent.update({
      where: { id: row.id },
      data: { contenuBrutRef: null, contenuBrutExpiresAt: null },
    });
  }

  if (due.length > 0) {
    console.info(`[agent-memory] purged ${due.length} expired raw content refs`);
  }

  return due.length;
}
