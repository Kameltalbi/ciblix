-- CreateEnum
CREATE TYPE "ContactPipelineStatus" AS ENUM ('NOUVEAU', 'CHAUD', 'TIEDE', 'A_RELANCER', 'FROID', 'ARCHIVE');

-- AlterTable contacts
ALTER TABLE "contacts" ADD COLUMN IF NOT EXISTS "pipelineStatus" "ContactPipelineStatus" NOT NULL DEFAULT 'NOUVEAU';
ALTER TABLE "contacts" ADD COLUMN IF NOT EXISTS "pipelineStatusScore" DOUBLE PRECISION;
ALTER TABLE "contacts" ADD COLUMN IF NOT EXISTS "pipelineStatusAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "contacts_organizationId_pipelineStatus_idx" ON "contacts"("organizationId", "pipelineStatus");
CREATE INDEX IF NOT EXISTS "contacts_organizationId_pipelineStatusAt_idx" ON "contacts"("organizationId", "pipelineStatusAt");

-- AlterTable organizations
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "pipelineThresholds" JSONB;
