import { prisma } from '../../db/prisma.js';

/** Phase 2 — alertes automatiques (stub MVP : alerte contenu uniquement). */
export async function refreshBrandAlerts(organizationId: string): Promise<void> {
  const lastPublished = await prisma.brandArticle.findFirst({
    where: { organizationId, status: 'PUBLISHED' },
    orderBy: { publishedAt: 'desc' },
    select: { publishedAt: true },
  });

  const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
  const noRecentPublish = !lastPublished?.publishedAt || lastPublished.publishedAt < tenDaysAgo;

  const pendingCount = await prisma.brandArticle.count({
    where: { organizationId, status: 'PENDING_REVIEW' },
  });

  if (noRecentPublish) {
    const existing = await prisma.brandAlert.findFirst({
      where: { organizationId, type: 'NO_PUBLISH', read: false },
    });
    if (!existing) {
      await prisma.brandAlert.create({
        data: {
          organizationId,
          type: 'NO_PUBLISH',
          severity: 'WARNING',
          message: 'Aucun article publié depuis plus de 10 jours. Validez ou générez de nouveaux contenus.',
        },
      });
    }
  }

  if (pendingCount > 0) {
    const existing = await prisma.brandAlert.findFirst({
      where: { organizationId, type: 'PENDING_REVIEW', read: false },
    });
    if (!existing) {
      await prisma.brandAlert.create({
        data: {
          organizationId,
          type: 'PENDING_REVIEW',
          severity: 'INFO',
          message: `${pendingCount} article(s) en attente de validation.`,
        },
      });
    }
  }
}
