import bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { prisma } from '../../db/prisma.js';

/** Phase 7 — clés API publiques BrandPulse. */
export async function createBrandApiKey(
  organizationId: string,
  label?: string,
): Promise<{ key: string; prefix: string; id: string }> {
  const raw = `bp_${randomBytes(24).toString('hex')}`;
  const prefix = raw.slice(0, 12);
  const keyHash = await bcrypt.hash(raw, 10);

  const row = await prisma.brandApiKey.create({
    data: { organizationId, label, keyHash, keyPrefix: prefix },
  });

  return { key: raw, prefix, id: row.id };
}

export async function verifyBrandApiKey(rawKey: string): Promise<string | null> {
  if (!rawKey.startsWith('bp_')) return null;
  const prefix = rawKey.slice(0, 12);
  const candidates = await prisma.brandApiKey.findMany({
    where: { keyPrefix: prefix, active: true },
    take: 5,
  });

  for (const row of candidates) {
    if (await bcrypt.compare(rawKey, row.keyHash)) {
      await prisma.brandApiKey.update({
        where: { id: row.id },
        data: { lastUsedAt: new Date() },
      });
      return row.organizationId;
    }
  }
  return null;
}
