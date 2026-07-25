-- AlterEnum
ALTER TYPE "AgentEventSource" ADD VALUE IF NOT EXISTS 'ANALYSTE';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'AGENT_OPPORTUNITY_READY';

-- CreateEnum
CREATE TYPE "AgentRole" AS ENUM ('SCOUT', 'HUNT', 'ANALYSTE', 'COPILOT');
CREATE TYPE "AgentTaskKind" AS ENUM ('WATCH_SIGNALS', 'ENRICH_COMPANY', 'ANALYZE_FIT', 'PREPARE_OUTREACH');
CREATE TYPE "AgentTaskStatus" AS ENUM ('PENDING', 'RUNNING', 'DONE', 'FAILED', 'CANCELLED');

-- CreateTable
CREATE TABLE "org_targeting_profiles" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "activity" TEXT,
    "productsServices" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "markets" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "countries" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "cities" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "targetClients" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "sectors" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "keywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "excludeCompanies" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "orchestratorEnabled" BOOLEAN NOT NULL DEFAULT true,
    "orchestratorIntervalH" INTEGER NOT NULL DEFAULT 1,
    "lastOrchestratorAt" TIMESTAMP(3),
    "minScoutScoreToHandoff" INTEGER NOT NULL DEFAULT 55,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "org_targeting_profiles_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "org_targeting_profiles_organizationId_key" ON "org_targeting_profiles"("organizationId");

ALTER TABLE "org_targeting_profiles" ADD CONSTRAINT "org_targeting_profiles_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "agent_tasks" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "assignee" "AgentRole" NOT NULL,
    "kind" "AgentTaskKind" NOT NULL,
    "status" "AgentTaskStatus" NOT NULL DEFAULT 'PENDING',
    "priority" INTEGER NOT NULL DEFAULT 50,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "result" JSONB,
    "error" TEXT,
    "parentTaskId" TEXT,
    "contactId" TEXT,
    "dedupeKey" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agent_tasks_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "agent_tasks_organizationId_dedupeKey_key" ON "agent_tasks"("organizationId", "dedupeKey");
CREATE INDEX "agent_tasks_organizationId_status_availableAt_idx" ON "agent_tasks"("organizationId", "status", "availableAt");
CREATE INDEX "agent_tasks_organizationId_assignee_status_idx" ON "agent_tasks"("organizationId", "assignee", "status");
CREATE INDEX "agent_tasks_status_availableAt_idx" ON "agent_tasks"("status", "availableAt");

ALTER TABLE "agent_tasks" ADD CONSTRAINT "agent_tasks_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "agent_tasks" ADD CONSTRAINT "agent_tasks_parentTaskId_fkey" FOREIGN KEY ("parentTaskId") REFERENCES "agent_tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;
