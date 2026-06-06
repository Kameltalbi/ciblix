import { Router } from 'express';
import { verifyBrandApiKey } from '../services/brand-pulse/apiKeys.js';
import { getPrimaryBrandProfile } from '../services/brand-pulse/brandProfile.js';
import { prisma } from '../db/prisma.js';

export const brandPulsePublicRoutes = Router();

brandPulsePublicRoutes.get('/dashboard', async (req, res) => {
  const rawKey = (req.headers['x-brand-pulse-key'] as string) || (req.query.key as string);
  if (!rawKey) {
    res.status(401).json({ error: 'Clé API requise (X-Brand-Pulse-Key)' });
    return;
  }

  const organizationId = await verifyBrandApiKey(rawKey);
  if (!organizationId) {
    res.status(401).json({ error: 'Clé API invalide' });
    return;
  }

  const profile = await getPrimaryBrandProfile(organizationId);
  const snapshots = profile
    ? await prisma.brandScoreSnapshot.findMany({
        where: { organizationId, brandProfileId: profile.id },
        orderBy: { computedAt: 'desc' },
        take: 20,
      })
    : [];

  const channelMap = new Map<string, (typeof snapshots)[0]>();
  for (const row of snapshots) {
    if (!channelMap.has(row.channel)) channelMap.set(row.channel, row);
  }

  res.json({
    brandName: profile?.brandName,
    channels: Array.from(channelMap.values()).map((r) => ({
      channel: r.channel,
      score: r.score,
      computedAt: r.computedAt,
    })),
  });
});
