-- CreateEnum
CREATE TYPE "SuggestionType" AS ENUM ('ENVOYER_MESSAGE', 'GENERER_OFFRE', 'RELANCER', 'VERIFIER_INFO', 'PROGRAMMER_SUIVI');

-- CreateEnum
CREATE TYPE "SuggestionStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DISMISSED', 'EXPIRED');

-- CreateTable
CREATE TABLE "suggestions" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "triggeredByEventId" TEXT,
    "type" "SuggestionType" NOT NULL,
    "message" TEXT NOT NULL,
    "targetAgent" TEXT,
    "status" "SuggestionStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" TIMESTAMP(3),

    CONSTRAINT "suggestions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "suggestions_organizationId_status_idx" ON "suggestions"("organizationId", "status");

-- CreateIndex
CREATE INDEX "suggestions_contactId_status_idx" ON "suggestions"("contactId", "status");

-- AddForeignKey
ALTER TABLE "suggestions" ADD CONSTRAINT "suggestions_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suggestions" ADD CONSTRAINT "suggestions_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suggestions" ADD CONSTRAINT "suggestions_triggeredByEventId_fkey" FOREIGN KEY ("triggeredByEventId") REFERENCES "agent_events"("id") ON DELETE SET NULL ON UPDATE CASCADE;
