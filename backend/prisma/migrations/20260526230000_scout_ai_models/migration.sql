-- CreateTable
CREATE TABLE "scout_profiles" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "keywords" JSONB NOT NULL,
    "sectors" JSONB NOT NULL,
    "geoZones" JSONB NOT NULL,
    "tenderEnabled" BOOLEAN NOT NULL DEFAULT true,
    "eventEnabled" BOOLEAN NOT NULL DEFAULT true,
    "newsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "autoScanEnabled" BOOLEAN NOT NULL DEFAULT false,
    "scanIntervalH" INTEGER NOT NULL DEFAULT 24,
    "lastScanAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scout_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scout_opportunities" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "snippet" TEXT,
    "aiSummary" TEXT,
    "relevanceScore" INTEGER NOT NULL DEFAULT 50,
    "deadline" TEXT,
    "location" TEXT,
    "budget" TEXT,
    "publishedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "searchQuery" TEXT,
    "rawData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scout_opportunities_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "scout_profiles_organizationId_key" ON "scout_profiles"("organizationId");

-- CreateIndex
CREATE INDEX "scout_opportunities_organizationId_category_idx" ON "scout_opportunities"("organizationId", "category");

-- CreateIndex
CREATE INDEX "scout_opportunities_organizationId_status_idx" ON "scout_opportunities"("organizationId", "status");

-- CreateIndex
CREATE INDEX "scout_opportunities_organizationId_createdAt_idx" ON "scout_opportunities"("organizationId", "createdAt");

-- AddForeignKey
ALTER TABLE "scout_profiles" ADD CONSTRAINT "scout_profiles_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scout_opportunities" ADD CONSTRAINT "scout_opportunities_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
