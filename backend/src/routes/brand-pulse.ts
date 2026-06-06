import { Router, type NextFunction, type Response } from 'express';
import { z } from 'zod';
import auth, { AuthRequest, requirePaymentApproved } from '../middleware/auth.js';
import { checkAgentAccess } from '../middleware/planRestrictions.js';
import { prisma } from '../db/prisma.js';
import { tryConsumeAgentQuota } from '../services/agentUsage.js';
import { runSeoAudit } from '../services/brand-pulse/seoAudit.js';
import { buildChannelScores } from '../services/brand-pulse/scoring.js';
import { generateTopics } from '../services/brand-pulse/topicPrioritizer.js';
import { generateArticle } from '../services/brand-pulse/articleGenerator.js';
import { buildRecommendations } from '../services/brand-pulse/recommendations.js';
import { refreshBrandAlerts } from '../services/brand-pulse/alerts.js';
import { getPrimaryBrandProfile, upsertPrimaryBrandProfile } from '../services/brand-pulse/brandProfile.js';
import { syncAllChannels } from '../services/brand-pulse/channelSync.js';
import {
  connectReviewsChannel,
  getReviewsChannelStatus,
} from '../services/brand-pulse/channels/reviews.js';
import {
  connectSocialFromWebsite,
  connectSocialManual,
  getSocialChannelStatus,
} from '../services/brand-pulse/channels/social.js';
import { BRAND_PULSE_ROADMAP } from '../services/brand-pulse/roadmap.js';
import { testWordPressConnection } from '../services/brand-pulse/cms/wordpress.js';
import { testGhostConnection } from '../services/brand-pulse/cms/ghost.js';
import { publishArticleToCms } from '../services/brand-pulse/cms/publish.js';
import { auditExistingArticles } from '../services/brand-pulse/articleAudit.js';
import { runCompetitorBenchmark } from '../services/brand-pulse/competitorBenchmark.js';
import { buildMonthlyReportHtml } from '../services/brand-pulse/monthlyReport.js';
import { createBrandApiKey } from '../services/brand-pulse/apiKeys.js';
import { encryptJson, decryptJson } from '../lib/encryption.js';
import type { ArticleFormat } from '../services/brand-pulse/types.js';

export const brandPulseRoutes = Router();

brandPulseRoutes.get('/ping', (_req, res) => {
  res.status(200).json({ ok: true, module: 'brand-pulse-ai', at: new Date().toISOString() });
});

brandPulseRoutes.use(auth);
brandPulseRoutes.use(requirePaymentApproved);
brandPulseRoutes.use(checkAgentAccess('brand-pulse-ai'));

const profileSchema = z.object({
  brandName: z.string().min(1).max(200),
  websiteUrl: z.string().min(1).max(500),
  sector: z.string().max(200).optional().nullable(),
  competitorName: z.string().max(200).optional().nullable(),
  competitorUrl: z.string().max(500).optional().nullable(),
  brandKeywords: z.array(z.string()).optional().default([]),
  editorialTone: z.string().max(100).optional().default('professionnel'),
  articlesPerWeek: z.number().int().min(1).max(7).optional().default(2),
  onboardingDone: z.boolean().optional(),
});

const reviewSchema = z.object({
  action: z.enum(['approve', 'reject', 'edit']),
  title: z.string().optional(),
  metaTitle: z.string().optional(),
  metaDescription: z.string().optional(),
  contentMarkdown: z.string().optional(),
});

const cmsConnectionSchema = z.object({
  platform: z.enum(['WORDPRESS', 'GHOST', 'WEBFLOW', 'SHOPIFY', 'WIX']),
  label: z.string().optional(),
  config: z.record(z.unknown()),
  blogId: z.string().optional(),
  defaultStatus: z.enum(['draft', 'publish']).optional(),
});

async function getProfileOrThrow(organizationId: string) {
  const profile = await getPrimaryBrandProfile(organizationId);
  if (!profile) {
    throw Object.assign(new Error('Profil marque non configuré'), { statusCode: 404 });
  }
  return profile;
}

async function persistScores(organizationId: string, channels: ReturnType<typeof buildChannelScores>) {
  await prisma.brandScoreSnapshot.createMany({
    data: channels.map((c) => ({
      organizationId,
      channel: c.channel,
      score: c.score,
      weight: c.weight,
      details: c.details as object,
    })),
  });
}

function buildCompetitorRadar(
  brandChannels: Array<{ channel: string; score: number }>,
  latestCompetitor: { channels: unknown; competitorName: string; globalScore: number } | null,
) {
  if (!latestCompetitor) return [];
  const compChannels = (latestCompetitor.channels as Array<{ channel: string; score: number }>) || [];
  const keys = ['SEO', 'SOCIAL', 'REVIEWS', 'PRESS', 'LLM', 'WEBSITE'] as const;
  return keys.map((ch) => {
    const brand = brandChannels.find((c) => c.channel === ch)?.score ?? null;
    const comp = compChannels.find((c) => c.channel === ch)?.score ?? null;
    return { channel: ch, brand, competitor: comp, delta: brand != null && comp != null ? brand - comp : null };
  });
}

async function persistRecommendations(organizationId: string, items: ReturnType<typeof buildRecommendations>) {
  await prisma.brandRecommendation.updateMany({
    where: { organizationId, active: true },
    data: { active: false },
  });
  if (items.length > 0) {
    await prisma.brandRecommendation.createMany({
      data: items.map((r) => ({
        organizationId,
        channel: r.channel,
        action: r.action,
        estimatedImpact: r.estimatedImpact,
        difficulty: r.difficulty,
        timeline: r.timeline,
      })),
    });
  }
}

brandPulseRoutes.get('/profile', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const profile = await getPrimaryBrandProfile(req.organizationId!);
    res.json({ profile });
  } catch (err) {
    next(err);
  }
});

brandPulseRoutes.get('/brands', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const brands = await prisma.brandProfile.findMany({
      where: { organizationId: req.organizationId! },
      orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
    });
    res.json({ brands });
  } catch (err) {
    next(err);
  }
});

brandPulseRoutes.post('/brands', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const data = profileSchema.parse(req.body);
    const slug = (req.body.slug as string | undefined)?.trim() || `brand-${Date.now()}`;
    const count = await prisma.brandProfile.count({ where: { organizationId: req.organizationId! } });
    if (count >= 5) {
      res.status(403).json({ error: 'Limite multi-marques atteinte (5)' });
      return;
    }
    const brand = await prisma.brandProfile.create({
      data: {
        organizationId: req.organizationId!,
        slug,
        isPrimary: false,
        brandName: data.brandName,
        websiteUrl: data.websiteUrl,
        sector: data.sector ?? null,
        competitorName: data.competitorName ?? null,
        competitorUrl: data.competitorUrl ?? null,
        brandKeywords: data.brandKeywords,
        editorialTone: data.editorialTone,
        articlesPerWeek: data.articlesPerWeek,
      },
    });
    res.status(201).json({ brand });
  } catch (err) {
    next(err);
  }
});

brandPulseRoutes.put('/profile', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const data = profileSchema.parse(req.body);
    const profile = await upsertPrimaryBrandProfile(req.organizationId!, {
      brandName: data.brandName,
      websiteUrl: data.websiteUrl,
      sector: data.sector ?? null,
      competitorName: data.competitorName ?? null,
      competitorUrl: data.competitorUrl ?? null,
      brandKeywords: data.brandKeywords,
      editorialTone: data.editorialTone,
      articlesPerWeek: data.articlesPerWeek,
      onboardingDone: data.onboardingDone,
    });
    res.json({ profile });
  } catch (err) {
    next(err);
  }
});

brandPulseRoutes.post('/audit', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.organizationId!;
    const profile = await getProfileOrThrow(orgId);

    const audit = await runSeoAudit(profile.websiteUrl);
    const synced = await syncAllChannels(profile);
    const channels = buildChannelScores(audit, synced);
    await persistScores(orgId, channels);

    const recommendations = buildRecommendations(channels, profile.brandName);
    await persistRecommendations(orgId, recommendations);
    await refreshBrandAlerts(orgId);

    await prisma.brandProfile.update({
      where: { id: profile.id },
      data: { lastAuditAt: new Date(), onboardingDone: true },
    });

    res.json({ audit, channels, recommendations });
  } catch (err) {
    next(err);
  }
});

brandPulseRoutes.get('/dashboard', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.organizationId!;
    const profile = await getPrimaryBrandProfile(orgId);

    const latestByChannel = await prisma.brandScoreSnapshot.findMany({
      where: { organizationId: orgId },
      orderBy: { computedAt: 'desc' },
      take: 50,
    });

    const channelMap = new Map<string, (typeof latestByChannel)[0]>();
    for (const row of latestByChannel) {
      if (!channelMap.has(row.channel)) channelMap.set(row.channel, row);
    }
    const channels = Array.from(channelMap.values()).map((r) => ({
      channel: r.channel,
      score: r.score,
      weight: r.weight,
      details: r.details,
      computedAt: r.computedAt,
    }));

    const global = channels.find((c) => c.channel === 'GLOBAL');

    const [articles, recommendations, alerts] = await Promise.all([
      prisma.brandArticle.findMany({
        where: { organizationId: orgId },
        orderBy: { updatedAt: 'desc' },
        take: 20,
      }),
      prisma.brandRecommendation.findMany({
        where: { organizationId: orgId, active: true },
        orderBy: { estimatedImpact: 'desc' },
        take: 6,
      }),
      prisma.brandAlert.findMany({
        where: { organizationId: orgId, read: false },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
    ]);

    const pipeline = {
      proposed: articles.filter((a) => a.status === 'PROPOSED').length,
      pendingReview: articles.filter((a) => a.status === 'PENDING_REVIEW').length,
      published: articles.filter((a) => a.status === 'PUBLISHED').length,
    };

    const [socialStatus, reviewsStatus, connections, competitorHistory] = await Promise.all([
      getSocialChannelStatus(orgId),
      getReviewsChannelStatus(orgId),
      prisma.brandCmsConnection.findMany({
        where: { organizationId: orgId },
        select: { id: true, platform: true, label: true, active: true, lastTestedAt: true },
      }),
      prisma.brandCompetitorSnapshot.findMany({
        where: { organizationId: orgId },
        orderBy: { computedAt: 'desc' },
        take: 6,
        select: { globalScore: true, competitorName: true, computedAt: true, channels: true },
      }),
    ]);

    const latestCompetitor = competitorHistory[0] ?? null;

    res.json({
      profile,
      globalScore: global?.score ?? null,
      channels,
      pipeline,
      articles,
      recommendations,
      alerts,
      channelStatus: { social: socialStatus, reviews: reviewsStatus },
      cmsConnections: connections,
      competitorHistory,
      latestCompetitor,
      competitorRadar: buildCompetitorRadar(channels, latestCompetitor),
    });
  } catch (err) {
    next(err);
  }
});

brandPulseRoutes.post('/topics/generate', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!(await tryConsumeAgentQuota(req.organizationId!, 'brand-pulse-ai', res))) return;

    const orgId = req.organizationId!;
    const profile = await getProfileOrThrow(orgId);

    const snapshots = await prisma.brandScoreSnapshot.findMany({
      where: { organizationId: orgId },
      orderBy: { computedAt: 'desc' },
      take: 20,
    });
    const channelMap = new Map<string, (typeof snapshots)[0]>();
    for (const s of snapshots) {
      if (!channelMap.has(s.channel)) channelMap.set(s.channel, s);
    }

    let channels = buildChannelScores(null);
    if (channelMap.has('SEO')) {
      channels = Array.from(channelMap.values()).map((r) => ({
        channel: r.channel,
        score: r.score,
        weight: r.weight,
        details: (r.details || {}) as Record<string, unknown>,
      })) as ReturnType<typeof buildChannelScores>;
    } else {
      const audit = await runSeoAudit(profile.websiteUrl);
      channels = buildChannelScores(audit);
      await persistScores(orgId, channels);
    }

    const topics = await generateTopics({
      brandName: profile.brandName,
      sector: profile.sector,
      competitorName: profile.competitorName,
      brandKeywords: (profile.brandKeywords as string[]) || [],
      channels,
    });

    const created = await Promise.all(
      topics.map((t) =>
        prisma.brandArticle.create({
          data: {
            organizationId: orgId,
            status: 'PROPOSED',
            format: t.format,
            title: t.title,
            targetKeywords: t.targetKeywords,
            topicReason: { reason: t.reason, priority: t.priority },
            estimatedImpact: t.estimatedImpact,
          },
        }),
      ),
    );

    res.json({ topics: created });
  } catch (err) {
    next(err);
  }
});

brandPulseRoutes.get('/articles', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const articles = await prisma.brandArticle.findMany({
      where: { organizationId: req.organizationId! },
      orderBy: { updatedAt: 'desc' },
    });
    res.json({ articles });
  } catch (err) {
    next(err);
  }
});

brandPulseRoutes.post('/articles/:id/generate', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!(await tryConsumeAgentQuota(req.organizationId!, 'brand-pulse-ai', res))) return;

    const orgId = req.organizationId!;
    const id = req.params.id as string;
    const profile = await getProfileOrThrow(orgId);

    const article = await prisma.brandArticle.findFirst({
      where: { id, organizationId: orgId },
    });
    if (!article) {
      res.status(404).json({ error: 'Article introuvable' });
      return;
    }

    await prisma.brandArticle.update({
      where: { id },
      data: { status: 'DRAFTING' },
    });

    const generated = await generateArticle({
      brandName: profile.brandName,
      sector: profile.sector,
      editorialTone: profile.editorialTone,
      format: article.format as ArticleFormat,
      topicTitle: article.title || 'Article marque',
      targetKeywords: (article.targetKeywords as string[]) || [],
      websiteUrl: profile.websiteUrl,
    });

    const updated = await prisma.brandArticle.update({
      where: { id },
      data: {
        status: 'PENDING_REVIEW',
        title: generated.title,
        slug: generated.slug,
        metaTitle: generated.metaTitle,
        metaDescription: generated.metaDescription,
        contentMarkdown: generated.contentMarkdown,
        estimatedSeoScore: generated.estimatedSeoScore,
      },
    });

    res.json({ article: updated });
  } catch (err) {
    next(err);
  }
});

brandPulseRoutes.patch('/articles/:id/review', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.organizationId!;
    const id = req.params.id as string;
    const body = reviewSchema.parse(req.body);

    const article = await prisma.brandArticle.findFirst({
      where: { id, organizationId: orgId },
    });
    if (!article) {
      res.status(404).json({ error: 'Article introuvable' });
      return;
    }

    if (body.action === 'reject') {
      const updated = await prisma.brandArticle.update({
        where: { id },
        data: { status: 'REJECTED' },
      });
      res.json({ article: updated });
      return;
    }

    if (body.action === 'edit') {
      const updated = await prisma.brandArticle.update({
        where: { id },
        data: {
          title: body.title ?? article.title,
          metaTitle: body.metaTitle ?? article.metaTitle,
          metaDescription: body.metaDescription ?? article.metaDescription,
          contentMarkdown: body.contentMarkdown ?? article.contentMarkdown,
          status: 'PENDING_REVIEW',
        },
      });
      res.json({ article: updated });
      return;
    }

    const updated = await prisma.brandArticle.update({
      where: { id },
      data: {
        status: 'APPROVED',
        title: body.title ?? article.title,
        metaTitle: body.metaTitle ?? article.metaTitle,
        metaDescription: body.metaDescription ?? article.metaDescription,
        contentMarkdown: body.contentMarkdown ?? article.contentMarkdown,
      },
    });
    res.json({ article: updated, message: 'Article approuvé. Publiez ou planifiez depuis le pipeline.' });
  } catch (err) {
    next(err);
  }
});

brandPulseRoutes.post('/articles/:id/publish', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.organizationId!;
    const id = req.params.id as string;
    const connectionId = (req.body as { connectionId?: string }).connectionId;

    const article = await prisma.brandArticle.findFirst({
      where: { id, organizationId: orgId, status: { in: ['APPROVED', 'SCHEDULED'] } },
    });
    if (!article?.contentMarkdown || !article.title) {
      res.status(400).json({ error: 'Article non approuvé ou contenu manquant' });
      return;
    }

    const connection = connectionId
      ? await prisma.brandCmsConnection.findFirst({ where: { id: connectionId, organizationId: orgId, active: true } })
      : await prisma.brandCmsConnection.findFirst({ where: { organizationId: orgId, active: true }, orderBy: { updatedAt: 'desc' } });

    if (!connection) {
      res.status(400).json({ error: 'Aucune connexion CMS active. Configurez WordPress ou Ghost.' });
      return;
    }

    const published = await publishArticleToCms(connection, {
      title: article.title,
      contentMarkdown: article.contentMarkdown,
      slug: article.slug,
    });

    const updated = await prisma.brandArticle.update({
      where: { id },
      data: {
        status: 'PUBLISHED',
        publishedAt: new Date(),
        publishedUrl: published.url || null,
        cmsPlatform: published.platform,
      },
    });

    await refreshBrandAlerts(orgId);
    res.json({ article: updated, published });
  } catch (err) {
    next(err);
  }
});

brandPulseRoutes.patch('/articles/:id/schedule', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const scheduledAt = z.string().datetime().parse((req.body as { scheduledAt: string }).scheduledAt);
    const updated = await prisma.brandArticle.updateMany({
      where: { id, organizationId: req.organizationId!, status: 'APPROVED' },
      data: { status: 'SCHEDULED', scheduledAt: new Date(scheduledAt) },
    });
    if (updated.count === 0) {
      res.status(404).json({ error: 'Article approuvé introuvable' });
      return;
    }
    const article = await prisma.brandArticle.findUnique({ where: { id } });
    res.json({ article });
  } catch (err) {
    next(err);
  }
});

brandPulseRoutes.get('/cms-connections', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const rows = await prisma.brandCmsConnection.findMany({
      where: { organizationId: req.organizationId! },
      select: {
        id: true,
        platform: true,
        label: true,
        blogId: true,
        defaultStatus: true,
        active: true,
        lastTestedAt: true,
        createdAt: true,
      },
    });
    res.json({ connections: rows });
  } catch (err) {
    next(err);
  }
});

brandPulseRoutes.post('/cms-connections', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const body = cmsConnectionSchema.parse(req.body);
    const row = await prisma.brandCmsConnection.create({
      data: {
        organizationId: req.organizationId!,
        platform: body.platform,
        label: body.label,
        encryptedConfig: encryptJson(body.config),
        blogId: body.blogId,
        defaultStatus: body.defaultStatus || 'draft',
      },
      select: { id: true, platform: true, label: true, active: true },
    });
    res.status(201).json({ connection: row });
  } catch (err) {
    next(err);
  }
});

brandPulseRoutes.post('/cms-connections/:id/test', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const row = await prisma.brandCmsConnection.findFirst({
      where: { id, organizationId: req.organizationId! },
    });
    if (!row) {
      res.status(404).json({ error: 'Connexion introuvable' });
      return;
    }

    const config = decryptJson<Record<string, string>>(row.encryptedConfig);

    if (row.platform === 'WORDPRESS') {
      const ok = await testWordPressConnection({
        siteUrl: config.siteUrl || '',
        username: config.username || '',
        appPassword: config.appPassword || '',
      });
      await prisma.brandCmsConnection.update({
        where: { id },
        data: { lastTestedAt: new Date(), active: ok },
      });
      res.json({ ok, platform: 'WORDPRESS' });
      return;
    }

    if (row.platform === 'GHOST') {
      const ok = await testGhostConnection({
        adminApiUrl: config.adminApiUrl || '',
        adminApiKey: config.adminApiKey || '',
      });
      await prisma.brandCmsConnection.update({
        where: { id },
        data: { lastTestedAt: new Date(), active: ok },
      });
      res.json({ ok, platform: 'GHOST' });
      return;
    }

    const hasConfig = Object.values(config).some((v) => Boolean(v));
    await prisma.brandCmsConnection.update({
      where: { id },
      data: { lastTestedAt: new Date(), active: hasConfig },
    });
    res.json({ ok: hasConfig, platform: row.platform, message: 'Validation configuration (test API à affiner)' });
  } catch (err) {
    next(err);
  }
});

brandPulseRoutes.delete('/cms-connections/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    await prisma.brandCmsConnection.deleteMany({
      where: { id, organizationId: req.organizationId! },
    });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

brandPulseRoutes.get('/channels/status', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.organizationId!;
    const [social, reviews] = await Promise.all([
      getSocialChannelStatus(orgId),
      getReviewsChannelStatus(orgId),
    ]);
    res.json({ social, reviews });
  } catch (err) {
    next(err);
  }
});

brandPulseRoutes.post('/channels/social/detect', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const profile = await getProfileOrThrow(req.organizationId!);
    const status = await connectSocialFromWebsite(req.organizationId!, profile.websiteUrl, profile.brandName);
    res.json({ social: status });
  } catch (err) {
    next(err);
  }
});

brandPulseRoutes.put('/channels/social', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const body = z.object({
      linkedinUrl: z.string().optional(),
      facebookUrl: z.string().optional(),
      instagramUrl: z.string().optional(),
      twitterUrl: z.string().optional(),
      manualMentionScore: z.number().min(0).max(100).optional(),
    }).parse(req.body);
    const status = await connectSocialManual(req.organizationId!, body);
    res.json({ social: status });
  } catch (err) {
    next(err);
  }
});

brandPulseRoutes.put('/channels/reviews', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const body = z.object({
      placeId: z.string().optional(),
      searchQuery: z.string().optional(),
      manualRating: z.number().min(0).max(5).optional(),
      manualReviewCount: z.number().int().min(0).optional(),
    }).parse(req.body);
    const status = await connectReviewsChannel(req.organizationId!, body);
    res.json({ reviews: status });
  } catch (err) {
    next(err);
  }
});

brandPulseRoutes.post('/channels/sync', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const profile = await getProfileOrThrow(req.organizationId!);
    const synced = await syncAllChannels(profile);
    const audit = profile.lastAuditAt ? null : await runSeoAudit(profile.websiteUrl);
    const channels = buildChannelScores(audit, synced);
    await persistScores(req.organizationId!, channels);
    await refreshBrandAlerts(req.organizationId!);
    res.json({ synced, channels });
  } catch (err) {
    next(err);
  }
});

brandPulseRoutes.post('/competitor/benchmark', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const profile = await getProfileOrThrow(req.organizationId!);
    const result = await runCompetitorBenchmark(profile);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

brandPulseRoutes.post('/articles/audit-existing', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const urls = z.array(z.string().url()).max(20).parse((req.body as { urls: string[] }).urls);
    const results = await auditExistingArticles(urls);
    res.json({ results });
  } catch (err) {
    next(err);
  }
});

brandPulseRoutes.get('/report/monthly', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const format = (req.query.format as string) || 'json';
    const html = await buildMonthlyReportHtml(req.organizationId!);
    if (format === 'html') {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(html);
      return;
    }
    res.json({ html });
  } catch (err) {
    next(err);
  }
});

brandPulseRoutes.post('/api-keys', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const label = (req.body as { label?: string }).label;
    const created = await createBrandApiKey(req.organizationId!, label);
    res.status(201).json({
      id: created.id,
      prefix: created.prefix,
      key: created.key,
      message: 'Copiez cette clé maintenant — elle ne sera plus affichée.',
    });
  } catch (err) {
    next(err);
  }
});

brandPulseRoutes.get('/api-keys', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const keys = await prisma.brandApiKey.findMany({
      where: { organizationId: req.organizationId! },
      select: { id: true, label: true, keyPrefix: true, active: true, lastUsedAt: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ keys });
  } catch (err) {
    next(err);
  }
});

brandPulseRoutes.delete('/api-keys/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await prisma.brandApiKey.updateMany({
      where: { id: req.params.id as string, organizationId: req.organizationId! },
      data: { active: false },
    });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

brandPulseRoutes.get('/roadmap', async (_req: AuthRequest, res: Response) => {
  res.json({ roadmap: BRAND_PULSE_ROADMAP });
});

brandPulseRoutes.get('/alerts', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const alerts = await prisma.brandAlert.findMany({
      where: { organizationId: req.organizationId! },
      orderBy: { createdAt: 'desc' },
      take: 30,
    });
    res.json({ alerts });
  } catch (err) {
    next(err);
  }
});

brandPulseRoutes.patch('/alerts/:id/read', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    await prisma.brandAlert.updateMany({
      where: { id, organizationId: req.organizationId! },
      data: { read: true },
    });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});
