import { prisma } from '../../db/prisma.js';
import { runSeoAudit } from './seoAudit.js';
import { seoScoreFromAudit } from './seoAudit.js';
import { publishArticleToCms } from './cms/publish.js';
import { refreshBrandAlerts } from './alerts.js';
import { createProposedTopicsForProfile } from './topicGeneration.js';

const TICK_MS = 15 * 60_000; // 15 min

async function tickScheduledPublish(): Promise<void> {
  const now = new Date();
  const due = await prisma.brandArticle.findMany({
    where: { status: 'SCHEDULED', scheduledAt: { lte: now } },
    take: 20,
  });

  for (const art of due) {
    if (!art.title || !art.contentMarkdown) continue;
    const connection = await prisma.brandCmsConnection.findFirst({
      where: { organizationId: art.organizationId, brandProfileId: art.brandProfileId, active: true },
      orderBy: { updatedAt: 'desc' },
    });
    if (!connection) continue;

    try {
      const published = await publishArticleToCms(connection, {
        title: art.title,
        contentMarkdown: art.contentMarkdown,
        slug: art.slug,
      });
      await prisma.brandArticle.update({
        where: { id: art.id },
        data: {
          status: 'PUBLISHED',
          publishedAt: new Date(),
          publishedUrl: published.url || null,
          cmsPlatform: published.platform,
        },
      });
      await refreshBrandAlerts(art.organizationId, art.brandProfileId);
    } catch (err) {
      console.warn('[brand-pulse-scheduler] publish planifié', art.id, err);
    }
  }
}

async function tickSeoImpact(): Promise<void> {
  const since = new Date(Date.now() - 48 * 3600_000);
  const until = new Date(Date.now() - 24 * 3600_000);

  const articles = await prisma.brandArticle.findMany({
    where: {
      status: 'PUBLISHED',
      publishedAt: { lte: until, gte: since },
      impactSeoDelta: null,
    },
    take: 30,
  });

  for (const art of articles) {
    try {
      const profile = await prisma.brandProfile.findFirst({
        where: { id: art.brandProfileId, organizationId: art.organizationId },
      });
      if (!profile || !art.publishedAt) continue;

      const audit = await runSeoAudit(profile.websiteUrl);
      const newScore = seoScoreFromAudit(audit);

      const prev = await prisma.brandScoreSnapshot.findFirst({
        where: {
          organizationId: art.organizationId,
          brandProfileId: art.brandProfileId,
          channel: 'SEO',
          computedAt: { lte: art.publishedAt },
        },
        orderBy: { computedAt: 'desc' },
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

/** Proposition auto de sujets si pipeline vide (cadence articlesPerWeek). */
async function tickAutoTopics(): Promise<void> {
  const profiles = await prisma.brandProfile.findMany({
    where: { onboardingDone: true },
    take: 50,
  });

  const weekAgo = new Date(Date.now() - 7 * 24 * 3600_000);

  for (const profile of profiles) {
    try {
      const proposed = await prisma.brandArticle.count({
        where: { brandProfileId: profile.id, status: 'PROPOSED' },
      });
      if (proposed > 0) continue;

      const recentArticles = await prisma.brandArticle.count({
        where: { brandProfileId: profile.id, createdAt: { gte: weekAgo } },
      });
      if (recentArticles >= Math.max(3, profile.articlesPerWeek)) continue;

      const result = await createProposedTopicsForProfile(profile.organizationId, profile);
      if (result.created.length > 0) {
        console.log(
          `[brand-pulse-scheduler] ${result.created.length} sujets auto pour ${profile.brandName}`,
        );
      }
    } catch (err) {
      console.warn('[brand-pulse-scheduler] auto-topics', profile.id, err);
    }
  }
}

async function tickOnce(): Promise<void> {
  if (process.env.BRAND_PULSE_SCHEDULER_DISABLED === '1') return;
  const { setRlsBypass, clearTenantRlsContext } = await import('../referentiel/tenantIsolation.js');
  try {
    await setRlsBypass(true);
    await tickScheduledPublish();
    await tickSeoImpact();
    await tickAutoTopics();
  } finally {
    await clearTenantRlsContext().catch(() => undefined);
  }
}

let intervalId: ReturnType<typeof setInterval> | null = null;

export function startBrandPulseScheduler(): void {
  if (intervalId) return;
  console.log('[brand-pulse-scheduler] actif (tick 15 min)');
  void tickOnce();
  intervalId = setInterval(() => void tickOnce(), TICK_MS);
}
