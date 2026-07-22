-- CreateEnum
CREATE TYPE "CopilotProcessingStatus" AS ENUM ('PROCESSING', 'DONE', 'ERROR');

-- AlterTable agent_events
ALTER TABLE "agent_events" ADD COLUMN IF NOT EXISTS "processingStatus" "CopilotProcessingStatus";
ALTER TABLE "agent_events" ADD COLUMN IF NOT EXISTS "processingError" TEXT;
ALTER TABLE "agent_events" ADD COLUMN IF NOT EXISTS "analysisJson" JSONB;

-- CreateTable copilot_org_configs
CREATE TABLE "copilot_org_configs" (
    "organizationId" TEXT NOT NULL,
    "sector" TEXT,
    "businessLexicon" TEXT,
    "scoringGrid" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "copilot_org_configs_pkey" PRIMARY KEY ("organizationId")
);

-- CreateTable copilot_messages
CREATE TABLE "copilot_messages" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "contactId" TEXT,
    "agentEventId" TEXT,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "copilot_messages_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "copilot_messages_organizationId_userId_createdAt_idx" ON "copilot_messages"("organizationId", "userId", "createdAt");
CREATE INDEX "copilot_messages_contactId_createdAt_idx" ON "copilot_messages"("contactId", "createdAt");
CREATE INDEX "copilot_messages_agentEventId_createdAt_idx" ON "copilot_messages"("agentEventId", "createdAt");

ALTER TABLE "copilot_org_configs" ADD CONSTRAINT "copilot_org_configs_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "copilot_messages" ADD CONSTRAINT "copilot_messages_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "copilot_messages" ADD CONSTRAINT "copilot_messages_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "copilot_messages" ADD CONSTRAINT "copilot_messages_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "copilot_messages" ADD CONSTRAINT "copilot_messages_agentEventId_fkey" FOREIGN KEY ("agentEventId") REFERENCES "agent_events"("id") ON DELETE SET NULL ON UPDATE CASCADE;
