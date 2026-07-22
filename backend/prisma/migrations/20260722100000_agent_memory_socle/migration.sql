-- CreateEnum
CREATE TYPE "ContactCreatedVia" AS ENUM ('HUNT', 'COPILOT', 'GMAIL', 'SCOUT', 'MANUAL_IMPORT');

-- CreateEnum
CREATE TYPE "AgentEventSource" AS ENUM ('HUNT', 'COPILOT', 'GMAIL', 'SCOUT', 'OFFREBOT', 'FACTCHECK');

-- CreateEnum
CREATE TYPE "AgentEventType" AS ENUM ('APPEL', 'WHATSAPP', 'EMAIL', 'NOTE', 'OPPORTUNITE');

-- CreateEnum
CREATE TYPE "AgentEventResolutionStatus" AS ENUM ('PENDING', 'RESOLVED', 'NEEDS_REVIEW');

-- AlterTable
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "agentEventRawRetentionDays" INTEGER NOT NULL DEFAULT 90;

-- CreateTable
CREATE TABLE "contacts" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT,
    "companyName" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "whatsappId" TEXT,
    "phoneNormalized" TEXT,
    "emailNormalized" TEXT,
    "whatsappNormalized" TEXT,
    "aliases" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdVia" "ContactCreatedVia" NOT NULL,
    "erasedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_events" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "contactId" TEXT,
    "source" "AgentEventSource" NOT NULL,
    "type" "AgentEventType" NOT NULL,
    "contenuBrutRef" TEXT,
    "contenuBrutExpiresAt" TIMESTAMP(3),
    "resume" TEXT,
    "score" DOUBLE PRECISION,
    "actionsSuggerees" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "consentConfirmedBy" TEXT,
    "consentConfirmedAt" TIMESTAMP(3),
    "resolutionStatus" "AgentEventResolutionStatus" NOT NULL DEFAULT 'PENDING',
    "resolutionAttempts" INTEGER NOT NULL DEFAULT 0,
    "resolutionLastAt" TIMESTAMP(3),
    "resolutionNextRetryAt" TIMESTAMP(3),
    "sourceRef" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agent_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contact_dedup_conflicts" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "existingContactId" TEXT NOT NULL,
    "attemptedName" TEXT,
    "attemptedPhone" TEXT,
    "attemptedEmail" TEXT,
    "attemptedWhatsapp" TEXT,
    "source" "AgentEventSource" NOT NULL,
    "sourceRef" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contact_dedup_conflicts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "contacts_organizationId_idx" ON "contacts"("organizationId");
CREATE INDEX "contacts_organizationId_phoneNormalized_idx" ON "contacts"("organizationId", "phoneNormalized");
CREATE INDEX "contacts_organizationId_emailNormalized_idx" ON "contacts"("organizationId", "emailNormalized");
CREATE INDEX "contacts_organizationId_whatsappNormalized_idx" ON "contacts"("organizationId", "whatsappNormalized");
CREATE INDEX "contacts_organizationId_companyName_idx" ON "contacts"("organizationId", "companyName");

CREATE UNIQUE INDEX "contacts_org_phone_unique" ON "contacts"("organizationId", "phoneNormalized") WHERE "phoneNormalized" IS NOT NULL;
CREATE UNIQUE INDEX "contacts_org_email_unique" ON "contacts"("organizationId", "emailNormalized") WHERE "emailNormalized" IS NOT NULL;
CREATE UNIQUE INDEX "contacts_org_whatsapp_unique" ON "contacts"("organizationId", "whatsappNormalized") WHERE "whatsappNormalized" IS NOT NULL;

CREATE INDEX "agent_events_organizationId_createdAt_idx" ON "agent_events"("organizationId", "createdAt");
CREATE INDEX "agent_events_organizationId_contactId_createdAt_idx" ON "agent_events"("organizationId", "contactId", "createdAt");
CREATE INDEX "agent_events_userId_createdAt_idx" ON "agent_events"("userId", "createdAt");
CREATE INDEX "agent_events_resolutionStatus_resolutionAttempts_idx" ON "agent_events"("resolutionStatus", "resolutionAttempts");
CREATE INDEX "agent_events_resolutionStatus_resolutionNextRetryAt_idx" ON "agent_events"("resolutionStatus", "resolutionNextRetryAt");
CREATE INDEX "agent_events_source_sourceRef_idx" ON "agent_events"("source", "sourceRef");

CREATE INDEX "contact_dedup_conflicts_organizationId_createdAt_idx" ON "contact_dedup_conflicts"("organizationId", "createdAt");

-- AddForeignKey
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "agent_events" ADD CONSTRAINT "agent_events_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "agent_events" ADD CONSTRAINT "agent_events_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "agent_events" ADD CONSTRAINT "agent_events_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "contact_dedup_conflicts" ADD CONSTRAINT "contact_dedup_conflicts_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "contact_dedup_conflicts" ADD CONSTRAINT "contact_dedup_conflicts_existingContactId_fkey" FOREIGN KEY ("existingContactId") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
