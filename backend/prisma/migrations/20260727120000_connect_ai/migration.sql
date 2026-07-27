-- Connect AI — agent de prospection assistée

-- Enums
CREATE TYPE "ConnectChannelSlug" AS ENUM ('LINKEDIN', 'GMAIL', 'OUTLOOK', 'WHATSAPP', 'FACEBOOK', 'INSTAGRAM', 'TWITTER', 'CRM', 'HUBSPOT', 'SALESFORCE');
CREATE TYPE "ConnectMessageStrategy" AS ENUM ('CONNECTION', 'FIRST_MESSAGE', 'FOLLOW_UP', 'POST_MEETING', 'INTRODUCTION', 'DEMO_INVITE', 'MEETING_REQUEST', 'CUSTOM');
CREATE TYPE "ConnectProductChoice" AS ENUM ('CARBOSCAN', 'SOFTFACTURE', 'BOTH', 'CUSTOM');
CREATE TYPE "ConnectAnalyticsEventType" AS ENUM ('MESSAGE_GENERATED', 'MESSAGE_COPIED', 'MESSAGE_INSERTED', 'MESSAGE_SAVED', 'PROFILE_ANALYZED', 'EXTENSION_SYNC');

-- Extend existing enums
ALTER TYPE "ContactCreatedVia" ADD VALUE IF NOT EXISTS 'CONNECT';
ALTER TYPE "AgentEventSource" ADD VALUE IF NOT EXISTS 'CONNECT';

-- Tables
CREATE TABLE "connect_channels" (
    "id" TEXT NOT NULL,
    "slug" "ConnectChannelSlug" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "connect_channels_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "connect_channels_slug_key" ON "connect_channels"("slug");

CREATE TABLE "connect_prospects" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT,
    "channelId" TEXT NOT NULL,
    "contactId" TEXT,
    "firstName" TEXT,
    "lastName" TEXT,
    "fullName" TEXT,
    "company" TEXT,
    "jobTitle" TEXT,
    "country" TEXT,
    "sector" TEXT,
    "profileUrl" TEXT,
    "headline" TEXT,
    "description" TEXT,
    "connectionCount" INTEGER,
    "experience" JSONB,
    "education" JSONB,
    "rawProfile" JSONB,
    "aiScore" INTEGER,
    "aiSummary" TEXT,
    "aiOpportunities" TEXT,
    "aiRisks" TEXT,
    "aiAngle" TEXT,
    "aiAnalysis" JSONB,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "connect_prospects_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "connect_prospect_history" (
    "id" TEXT NOT NULL,
    "prospectId" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "source" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "connect_prospect_history_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "connect_prompt_templates" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "strategy" "ConnectMessageStrategy" NOT NULL,
    "channelSlug" "ConnectChannelSlug",
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "connect_prompt_templates_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "connect_prompt_versions" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "systemPrompt" TEXT NOT NULL,
    "userPrompt" TEXT NOT NULL,
    "metadata" JSONB,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "connect_prompt_versions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "connect_generated_messages" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "prospectId" TEXT,
    "channelId" TEXT NOT NULL,
    "promptVersionId" TEXT,
    "strategy" "ConnectMessageStrategy" NOT NULL,
    "product" "ConnectProductChoice" NOT NULL,
    "content" TEXT NOT NULL,
    "aiModel" TEXT,
    "generationMs" INTEGER,
    "copiedAt" TIMESTAMP(3),
    "insertedAt" TIMESTAMP(3),
    "savedAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "connect_generated_messages_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "connect_message_versions" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "connect_message_versions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "connect_extension_sessions" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "browser" TEXT,
    "extensionVersion" TEXT,
    "lastSyncAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "connect_extension_sessions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "connect_analytics_events" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT,
    "channelId" TEXT,
    "eventType" "ConnectAnalyticsEventType" NOT NULL,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "connect_analytics_events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "connect_org_settings" (
    "organizationId" TEXT NOT NULL,
    "defaultLanguage" TEXT NOT NULL DEFAULT 'fr',
    "defaultTone" TEXT NOT NULL DEFAULT 'professionnel',
    "defaultStyle" TEXT NOT NULL DEFAULT 'concis',
    "defaultLength" TEXT NOT NULL DEFAULT 'moyen',
    "favoriteProducts" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "signature" TEXT,
    "customPrompt" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "connect_org_settings_pkey" PRIMARY KEY ("organizationId")
);

CREATE TABLE "connect_user_settings" (
    "userId" TEXT NOT NULL,
    "language" TEXT,
    "tone" TEXT,
    "style" TEXT,
    "length" TEXT,
    "favoriteProducts" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "signature" TEXT,
    "customPrompt" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "connect_user_settings_pkey" PRIMARY KEY ("userId")
);

-- Indexes
CREATE INDEX "connect_prospects_organizationId_channelId_idx" ON "connect_prospects"("organizationId", "channelId");
CREATE INDEX "connect_prospects_organizationId_profileUrl_idx" ON "connect_prospects"("organizationId", "profileUrl");
CREATE INDEX "connect_prospects_organizationId_updatedAt_idx" ON "connect_prospects"("organizationId", "updatedAt");
CREATE INDEX "connect_prospect_history_prospectId_createdAt_idx" ON "connect_prospect_history"("prospectId", "createdAt");
CREATE UNIQUE INDEX "connect_prompt_templates_organizationId_slug_key" ON "connect_prompt_templates"("organizationId", "slug");
CREATE INDEX "connect_prompt_templates_organizationId_strategy_idx" ON "connect_prompt_templates"("organizationId", "strategy");
CREATE UNIQUE INDEX "connect_prompt_versions_templateId_version_key" ON "connect_prompt_versions"("templateId", "version");
CREATE INDEX "connect_prompt_versions_templateId_version_idx" ON "connect_prompt_versions"("templateId", "version");
CREATE INDEX "connect_generated_messages_organizationId_createdAt_idx" ON "connect_generated_messages"("organizationId", "createdAt");
CREATE INDEX "connect_generated_messages_organizationId_userId_createdAt_idx" ON "connect_generated_messages"("organizationId", "userId", "createdAt");
CREATE INDEX "connect_generated_messages_prospectId_createdAt_idx" ON "connect_generated_messages"("prospectId", "createdAt");
CREATE UNIQUE INDEX "connect_message_versions_messageId_version_key" ON "connect_message_versions"("messageId", "version");
CREATE INDEX "connect_extension_sessions_organizationId_userId_idx" ON "connect_extension_sessions"("organizationId", "userId");
CREATE INDEX "connect_analytics_events_organizationId_eventType_createdAt_idx" ON "connect_analytics_events"("organizationId", "eventType", "createdAt");
CREATE INDEX "connect_analytics_events_organizationId_createdAt_idx" ON "connect_analytics_events"("organizationId", "createdAt");

-- Foreign keys
ALTER TABLE "connect_prospects" ADD CONSTRAINT "connect_prospects_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "connect_prospects" ADD CONSTRAINT "connect_prospects_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "connect_prospects" ADD CONSTRAINT "connect_prospects_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "connect_channels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "connect_prospect_history" ADD CONSTRAINT "connect_prospect_history_prospectId_fkey" FOREIGN KEY ("prospectId") REFERENCES "connect_prospects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "connect_prompt_templates" ADD CONSTRAINT "connect_prompt_templates_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "connect_prompt_versions" ADD CONSTRAINT "connect_prompt_versions_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "connect_prompt_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "connect_generated_messages" ADD CONSTRAINT "connect_generated_messages_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "connect_generated_messages" ADD CONSTRAINT "connect_generated_messages_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "connect_generated_messages" ADD CONSTRAINT "connect_generated_messages_prospectId_fkey" FOREIGN KEY ("prospectId") REFERENCES "connect_prospects"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "connect_generated_messages" ADD CONSTRAINT "connect_generated_messages_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "connect_channels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "connect_generated_messages" ADD CONSTRAINT "connect_generated_messages_promptVersionId_fkey" FOREIGN KEY ("promptVersionId") REFERENCES "connect_prompt_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "connect_message_versions" ADD CONSTRAINT "connect_message_versions_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "connect_generated_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "connect_extension_sessions" ADD CONSTRAINT "connect_extension_sessions_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "connect_extension_sessions" ADD CONSTRAINT "connect_extension_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "connect_analytics_events" ADD CONSTRAINT "connect_analytics_events_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "connect_analytics_events" ADD CONSTRAINT "connect_analytics_events_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "connect_analytics_events" ADD CONSTRAINT "connect_analytics_events_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "connect_channels"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "connect_org_settings" ADD CONSTRAINT "connect_org_settings_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "connect_user_settings" ADD CONSTRAINT "connect_user_settings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed LinkedIn channel
INSERT INTO "connect_channels" ("id", "slug", "name", "description", "active", "updatedAt")
VALUES ('connect_ch_linkedin', 'LINKEDIN', 'LinkedIn', 'Prospection assistée sur LinkedIn', true, CURRENT_TIMESTAMP)
ON CONFLICT DO NOTHING;
