import { prisma } from '../../db/prisma.js';
import { pushBrandPulseNotification } from './pushNotifications.js';

async function ensureAlert(
  organizationId: string,
  brandProfileId: string,
  type: string,
  severity: string,
  message: string,
  notify = true,
): Promise<void> {
  const existing = await prisma.brandAlert.findFirst({
    where: { organizationId, brandProfileId, type, read: false },
  });
  if (existing) return;

  await prisma.brandAlert.create({
    data: { organizationId, brandProfileId, type, severity, message },
  });

  if (notify) {
    await pushBrandPulseNotification(organizationId, 'BrandPulse AI', message);
  }
}

/** Alertes automatiques — contenu, scores, avis (par marque active). */
export async function refreshBrandAlerts(organizationId: string, brandProfileId: string): Promise<void> {
  const scope = { organizationId, brandProfileId };

  const lastPublished = await prisma.brandArticle.findFirst({
    where: { ...scope, status: 'PUBLISHED' },
    orderBy: { publishedAt: 'desc' },
    select: { publishedAt: true },
  });

  const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
  const noRecentPublish = !lastPublished?.publishedAt || lastPublished.publishedAt < tenDaysAgo;

  const pendingCount = await prisma.brandArticle.count({
    where: { ...scope, status: 'PENDING_REVIEW' },
  });

  if (noRecentPublish) {
    await ensureAlert(
      organizationId,
      brandProfileId,
      'NO_PUBLISH',
      'WARNING',
      'Aucun article publié depuis plus de 10 jours. Validez ou générez de nouveaux contenus.',
    );
  }

  if (pendingCount > 0) {
    await ensureAlert(
      organizationId,
      brandProfileId,
      'PENDING_REVIEW',
      'INFO',
      `${pendingCount} article(s) en attente de validation.`,
      false,
    );
  }

  const seoSnapshots = await prisma.brandScoreSnapshot.findMany({
    where: { ...scope, channel: 'SEO' },
    orderBy: { computedAt: 'desc' },
    take: 2,
    select: { score: true },
  });

  if (seoSnapshots.length === 2) {
    const drop = seoSnapshots[1].score - seoSnapshots[0].score;
    if (drop >= 10) {
      await ensureAlert(
        organizationId,
        brandProfileId,
        'SEO_DROP',
        'WARNING',
        `Score SEO en baisse de ${drop} points depuis le dernier audit.`,
      );
    }
  }

  const reviewsConn = await prisma.brandChannelConnection.findUnique({
    where: { brandProfileId_channel: { brandProfileId, channel: 'REVIEWS' } },
  });
  const meta = reviewsConn?.metadata as { rating?: number; recentNegative?: number } | null;
  if (meta?.rating != null && meta.rating < 3.5) {
    await ensureAlert(
      organizationId,
      brandProfileId,
      'NEGATIVE_REVIEW',
      'CRITICAL',
      `Note Google faible (${meta.rating}/5). Répondez aux avis récents.`,
    );
  }
  if ((meta?.recentNegative ?? 0) >= 2) {
    await ensureAlert(
      organizationId,
      brandProfileId,
      'NEGATIVE_REVIEW',
      'WARNING',
      `${meta?.recentNegative} avis négatif(s) récent(s) détecté(s).`,
    );
  }
}
