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
import { getSocialChannelStatus } from '../services/brand-pulse/channels/social.js';
import { getReviewsChannelStatus } from '../services/brand-pulse/channels/reviews.js';
import { BRAND_PULSE_ROADMAP } from '../services/brand-pulse/roadmap.js';
import { testWordPressConnection } from '../services/brand-pulse/cms/wordpress.js';
import { testGhostConnection } from '../services/brand-pulse/cms/ghost.js';
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
  const profile = await prisma.brandProfile.findUnique({ where: { organizationId } });
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
    const profile = await prisma.brandProfile.findUnique({
      where: { organizationId: req.organizationId! },
    });
    res.json({ profile });
  } catch (err) {
    next(err);
  }
});

brandPulseRoutes.put('/profile', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const data = profileSchema.parse(req.body);
    const orgId = req.organizationId!;
    const profile = await prisma.brandProfile.upsert({
      where: { organizationId: orgId },
      create: {
        organizationId: orgId,
        brandName: data.brandName,
        websiteUrl: data.websiteUrl,
        sector: data.sector ?? null,
        competitorName: data.competitorName ?? null,
        competitorUrl: data.competitorUrl ?? null,
        brandKeywords: data.brandKeywords,
        editorialTone: data.editorialTone,
        articlesPerWeek: data.articlesPerWeek,
        onboardingDone: data.onboardingDone ?? false,
      },
      update: {
        brandName: data.brandName,
        websiteUrl: data.websiteUrl,
        sector: data.sector ?? null,
        competitorName: data.competitorName ?? null,
        competitorUrl: data.competitorUrl ?? null,
        brandKeywords: data.brandKeywords,
        editorialTone: data.editorialTone,
        articlesPerWeek: data.articlesPerWeek,
        onboardingDone: data.onboardingDone ?? undefined,
      },
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
    const channels = buildChannelScores(audit);
    await persistScores(orgId, channels);

    const recommendations = buildRecommendations(channels, profile.brandName);
    await persistRecommendations(orgId, recommendations);
    await refreshBrandAlerts(orgId);

    await prisma.brandProfile.update({
      where: { organizationId: orgId },
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
    const profile = await prisma.brandProfile.findUnique({ where: { organizationId: orgId } });

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

    res.json({
      profile,
      globalScore: global?.score ?? null,
      channels,
      pipeline,
      articles,
      recommendations,
      alerts,
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
    res.json({ article: updated, message: 'Article approuvé. Publication CMS disponible en Phase 3.' });
  } catch (err) {
    next(err);
  }
});

brandPulseRoutes.post('/articles/:id/publish', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    res.status(501).json({
      error: 'Publication CMS en Phase 3',
      message: 'WordPress et Ghost seront disponibles prochainement. Utilisez l\'export markdown pour l\'instant.',
    });
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

    res.status(501).json({ error: `Test connexion ${row.platform} — Phase 4` });
  } catch (err) {
    next(err);
  }
});

brandPulseRoutes.get('/channels/status', async (_req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const [social, reviews] = await Promise.all([getSocialChannelStatus(), getReviewsChannelStatus()]);
    res.json({ social, reviews });
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
