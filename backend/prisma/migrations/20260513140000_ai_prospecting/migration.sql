-- Prospection IA : prospects trouvés + qualification
CREATE TYPE "AiProspectStatus" AS ENUM ('FOUND', 'QUALIFIED', 'CONTACTED', 'IN_PIPELINE', 'IGNORED');

ALTER TYPE "LeadSource" ADD VALUE 'AI_PROSPECTION';

CREATE TABLE "ai_prospects" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "website" TEXT,
    "linkedin" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "city" TEXT,
    "country" TEXT,
    "industry" TEXT,
    "companySize" TEXT,
    "score" INTEGER NOT NULL DEFAULT 0,
    "scoreReason" TEXT,
    "suggestedPitch" TEXT,
    "aiTags" JSONB,
    "potentialLevel" TEXT,
    "commercialAngle" TEXT,
    "aiSummary" TEXT,
    "interestProbability" INTEGER,
    "leadId" TEXT,
    "status" "AiProspectStatus" NOT NULL DEFAULT 'FOUND',
    "lastSearchQuery" TEXT,
    "followUpPlan" JSONB,
    "emailOpenedAt" TIMESTAMP(3),
    "linkClickedAt" TIMESTAMP(3),
    "lastReplyAt" TIMESTAMP(3),
    "rawProvider" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ai_prospects_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ai_prospects_leadId_key" ON "ai_prospects"("leadId");

CREATE INDEX "ai_prospects_organizationId_idx" ON "ai_prospects"("organizationId");

CREATE INDEX "ai_prospects_status_idx" ON "ai_prospects"("status");

ALTER TABLE "ai_prospects" ADD CONSTRAINT "ai_prospects_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ai_prospects" ADD CONSTRAINT "ai_prospects_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;
