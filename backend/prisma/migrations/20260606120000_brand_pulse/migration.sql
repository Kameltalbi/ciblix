-- BrandPulse AI tables
CREATE TABLE "brand_profiles" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "brandName" TEXT NOT NULL,
    "websiteUrl" TEXT NOT NULL,
    "sector" TEXT,
    "competitorName" TEXT,
    "competitorUrl" TEXT,
    "brandKeywords" JSONB NOT NULL DEFAULT '[]',
    "editorialTone" TEXT NOT NULL DEFAULT 'professionnel',
    "articlesPerWeek" INTEGER NOT NULL DEFAULT 2,
    "onboardingDone" BOOLEAN NOT NULL DEFAULT false,
    "lastAuditAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "brand_profiles_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "brand_score_snapshots" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "details" JSONB,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "brand_score_snapshots_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "brand_articles" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PROPOSED',
    "format" TEXT NOT NULL DEFAULT 'SEO',
    "title" TEXT,
    "slug" TEXT,
    "metaTitle" TEXT,
    "metaDescription" TEXT,
    "contentMarkdown" TEXT,
    "targetKeywords" JSONB NOT NULL DEFAULT '[]',
    "topicReason" JSONB,
    "estimatedImpact" INTEGER,
    "estimatedSeoScore" INTEGER,
    "publishedUrl" TEXT,
    "publishedAt" TIMESTAMP(3),
    "scheduledAt" TIMESTAMP(3),
    "cmsPlatform" TEXT,
    "impactSeoDelta" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "brand_articles_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "brand_recommendations" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "estimatedImpact" INTEGER NOT NULL DEFAULT 0,
    "difficulty" TEXT NOT NULL DEFAULT 'MEDIUM',
    "timeline" TEXT NOT NULL DEFAULT 'SHORT',
    "linkedArticleId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "brand_recommendations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "brand_alerts" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'INFO',
    "message" TEXT NOT NULL,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "brand_alerts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "brand_cms_connections" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "label" TEXT,
    "encryptedConfig" TEXT NOT NULL,
    "blogId" TEXT,
    "defaultStatus" TEXT NOT NULL DEFAULT 'draft',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lastTestedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "brand_cms_connections_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "brand_profiles_organizationId_key" ON "brand_profiles"("organizationId");

CREATE INDEX "brand_score_snapshots_organizationId_channel_computedAt_idx" ON "brand_score_snapshots"("organizationId", "channel", "computedAt");

CREATE INDEX "brand_articles_organizationId_status_idx" ON "brand_articles"("organizationId", "status");

CREATE INDEX "brand_articles_organizationId_createdAt_idx" ON "brand_articles"("organizationId", "createdAt");

CREATE INDEX "brand_recommendations_organizationId_channel_idx" ON "brand_recommendations"("organizationId", "channel");

CREATE INDEX "brand_alerts_organizationId_read_createdAt_idx" ON "brand_alerts"("organizationId", "read", "createdAt");

CREATE INDEX "brand_cms_connections_organizationId_idx" ON "brand_cms_connections"("organizationId");

ALTER TABLE "brand_profiles" ADD CONSTRAINT "brand_profiles_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "brand_score_snapshots" ADD CONSTRAINT "brand_score_snapshots_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "brand_articles" ADD CONSTRAINT "brand_articles_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "brand_recommendations" ADD CONSTRAINT "brand_recommendations_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "brand_alerts" ADD CONSTRAINT "brand_alerts_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "brand_cms_connections" ADD CONSTRAINT "brand_cms_connections_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Migrate comm-bot agent slug to brand-pulse-ai
UPDATE "organization_agents" SET "agentSlug" = 'brand-pulse-ai' WHERE "agentSlug" = 'comm-bot';
UPDATE "agent_usage_monthly" SET "agentSlug" = 'brand-pulse-ai' WHERE "agentSlug" = 'comm-bot';
