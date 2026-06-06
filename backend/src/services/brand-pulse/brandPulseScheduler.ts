import { prisma } from '../../db/prisma.js';
import { runSeoAudit } from './seoAudit.js';
import { seoScoreFromAudit } from './seoAudit.js';

const TICK_MS = 3600_000; // 1h

/** Phase 3 — recalcul impact SEO 24-48h post-publication. */
async function tickSeoImpact(): Promise<void> {
  if (process.env.BRAND_PULSE_SCHEDULER_DISABLED === '1') return;

  const since = new Date(Date.now() - 48 * 3600_000);
  const until = new Date(Date.now() - 24 * 3600_000);

  const articles = await prisma.brandArticle.findMany({
    where: {
      status: 'PUBLISHED',
      publishedAt: { lte: until, gte: since },
      impactSeoDelta: null,
      publishedUrl: { not: null },
    },
    take: 30,
  });

  for (const art of articles) {
    try {
      const profile = await prisma.brandProfile.findFirst({
        where: { organizationId: art.organizationId, isPrimary: true },
      });
      if (!profile) continue;

      const audit = await runSeoAudit(profile.websiteUrl);
      const newScore = seoScoreFromAudit(audit);

      const prev = await prisma.brandScoreSnapshot.findFirst({
        where: { organizationId: art.organizationId, channel: 'SEO' },
        orderBy: { computedAt: 'asc' },
        select: { score: true },
      });

      const delta = prev ? newScore - prev.score : 0;
      await prisma.brandArticle.update({
        where: { id: art.id },
        data: { impactSeoDelta: delta },
      });
    } catch (err) {
      console.warn('[brand-pulse-scheduler] impact SEO', art.id, err);
    }
  }
}

let intervalId: ReturnType<typeof setInterval> | null = null;

export function startBrandPulseScheduler(): void {
  if (intervalId) return;
  console.log('[brand-pulse-scheduler] actif (tick 1h)');
  void tickSeoImpact();
  intervalId = setInterval(() => void tickSeoImpact(), TICK_MS);
}
