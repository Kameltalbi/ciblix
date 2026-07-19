-- CreateEnum
CREATE TYPE "GmailAiProcessedStatus" AS ENUM ('PROCESSED', 'SKIPPED', 'ERROR');

-- CreateTable
CREATE TABLE "gmail_ai_sync_states" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "historyId" TEXT,
    "labelId" TEXT,
    "activatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSyncAt" TIMESTAMP(3),
    "replyLanguage" TEXT NOT NULL DEFAULT 'fr',
    "replyTone" TEXT NOT NULL DEFAULT 'professionnel',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gmail_ai_sync_states_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gmail_ai_processed_messages" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "providerMessageId" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "subject" TEXT,
    "fromEmail" TEXT,
    "summary" TEXT,
    "draftId" TEXT,
    "status" "GmailAiProcessedStatus" NOT NULL,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gmail_ai_processed_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "gmail_ai_sync_states_userId_key" ON "gmail_ai_sync_states"("userId");

-- CreateIndex
CREATE INDEX "gmail_ai_sync_states_organizationId_idx" ON "gmail_ai_sync_states"("organizationId");

-- CreateIndex
CREATE INDEX "gmail_ai_processed_messages_organizationId_idx" ON "gmail_ai_processed_messages"("organizationId");

-- CreateIndex
CREATE INDEX "gmail_ai_processed_messages_userId_createdAt_idx" ON "gmail_ai_processed_messages"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "gmail_ai_processed_messages_userId_providerMessageId_key" ON "gmail_ai_processed_messages"("userId", "providerMessageId");

-- AddForeignKey
ALTER TABLE "gmail_ai_sync_states" ADD CONSTRAINT "gmail_ai_sync_states_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gmail_ai_sync_states" ADD CONSTRAINT "gmail_ai_sync_states_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gmail_ai_processed_messages" ADD CONSTRAINT "gmail_ai_processed_messages_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gmail_ai_processed_messages" ADD CONSTRAINT "gmail_ai_processed_messages_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
