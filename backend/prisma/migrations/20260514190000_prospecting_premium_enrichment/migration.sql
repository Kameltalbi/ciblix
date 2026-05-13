-- Prospection IA premium : enrichissement web, cache, tracking activité

ALTER TABLE "ai_prospects" ADD COLUMN "websiteTitle" TEXT;
ALTER TABLE "ai_prospects" ADD COLUMN "websiteDescription" TEXT;
ALTER TABLE "ai_prospects" ADD COLUMN "detectedEmails" JSONB;
ALTER TABLE "ai_prospects" ADD COLUMN "facebookUrl" TEXT;
ALTER TABLE "ai_prospects" ADD COLUMN "instagramUrl" TEXT;
ALTER TABLE "ai_prospects" ADD COLUMN "faviconUrl" TEXT;
ALTER TABLE "ai_prospects" ADD COLUMN "hasResponsiveWebsite" BOOLEAN;
ALTER TABLE "ai_prospects" ADD COLUMN "hasSsl" BOOLEAN;
ALTER TABLE "ai_prospects" ADD COLUMN "seoScore" INTEGER;
ALTER TABLE "ai_prospects" ADD COLUMN "digitalPresenceLevel" TEXT;
ALTER TABLE "ai_prospects" ADD COLUMN "technologiesDetected" JSONB;
ALTER TABLE "ai_prospects" ADD COLUMN "probableBusinessProblem" TEXT;
ALTER TABLE "ai_prospects" ADD COLUMN "suggestedOffer" TEXT;
ALTER TABLE "ai_prospects" ADD COLUMN "lastContactAt" TIMESTAMP(3);

CREATE TABLE "prospecting_search_cache" (
    "cacheKey" TEXT NOT NULL,
    "providerUsed" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "prospecting_search_cache_pkey" PRIMARY KEY ("cacheKey")
);

CREATE INDEX "prospecting_search_cache_expiresAt_idx" ON "prospecting_search_cache"("expiresAt");

CREATE TABLE "prospecting_website_cache" (
    "urlKey" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "prospecting_website_cache_pkey" PRIMARY KEY ("urlKey")
);

CREATE INDEX "prospecting_website_cache_expiresAt_idx" ON "prospecting_website_cache"("expiresAt");

CREATE TABLE "ai_prospect_activities" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "aiProspectId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ai_prospect_activities_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ai_prospect_activities_aiProspectId_createdAt_idx" ON "ai_prospect_activities"("aiProspectId", "createdAt");

CREATE INDEX "ai_prospect_activities_organizationId_idx" ON "ai_prospect_activities"("organizationId");

ALTER TABLE "ai_prospect_activities" ADD CONSTRAINT "ai_prospect_activities_aiProspectId_fkey" FOREIGN KEY ("aiProspectId") REFERENCES "ai_prospects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
