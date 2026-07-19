-- AlterTable
ALTER TABLE "gmail_tokens" ADD COLUMN IF NOT EXISTS "lastRefreshAt" TIMESTAMP(3);

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "GmailAiPriority" AS ENUM ('HIGH', 'MEDIUM', 'LOW');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- AlterTable gmail_ai_sync_states
ALTER TABLE "gmail_ai_sync_states" ADD COLUMN IF NOT EXISTS "enabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "gmail_ai_sync_states" ADD COLUMN IF NOT EXISTS "signature" TEXT;
ALTER TABLE "gmail_ai_sync_states" ADD COLUMN IF NOT EXISTS "ignoreNewsletters" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "gmail_ai_sync_states" ADD COLUMN IF NOT EXISTS "ignorePromotions" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "gmail_ai_sync_states" ADD COLUMN IF NOT EXISTS "ignoreSocial" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable gmail_ai_processed_messages
ALTER TABLE "gmail_ai_processed_messages" ADD COLUMN IF NOT EXISTS "actionRequested" TEXT;
ALTER TABLE "gmail_ai_processed_messages" ADD COLUMN IF NOT EXISTS "analysis" TEXT;
ALTER TABLE "gmail_ai_processed_messages" ADD COLUMN IF NOT EXISTS "priority" "GmailAiPriority";

-- CreateIndex
CREATE INDEX IF NOT EXISTS "gmail_ai_processed_messages_userId_status_idx" ON "gmail_ai_processed_messages"("userId", "status");
