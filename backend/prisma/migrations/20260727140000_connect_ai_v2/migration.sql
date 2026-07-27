-- Connect AI v2 — OAuth extension, conversations, agents registry

CREATE TYPE "ConnectConversationEventType" AS ENUM (
  'MESSAGE_GENERATED', 'MESSAGE_INSERTED', 'MESSAGE_SENT',
  'REPLY_RECEIVED', 'MEETING_BOOKED', 'NOTE', 'PIPELINE_UPDATE'
);

CREATE TYPE "ConnectProspectObjective" AS ENUM (
  'GET_MEETING', 'PRESENT_CARBOSCAN', 'PRESENT_SOFTFACTURE',
  'RE_ENGAGE', 'INVITE_DEMO', 'FIRST_CONTACT', 'FOLLOW_UP', 'CUSTOM'
);

CREATE TABLE "connect_conversations" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "prospectId" TEXT NOT NULL,
  "channelId" TEXT NOT NULL,
  "objective" "ConnectProspectObjective",
  "pipelineStage" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "connect_conversations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "connect_conversation_events" (
  "id" TEXT NOT NULL,
  "conversationId" TEXT NOT NULL,
  "eventType" "ConnectConversationEventType" NOT NULL,
  "content" TEXT,
  "messageId" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "connect_conversation_events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "connect_extension_auth_codes" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "codeHash" TEXT NOT NULL,
  "codeChallenge" TEXT NOT NULL,
  "redirectUri" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "connect_extension_auth_codes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ciblix_agents" (
  "id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ciblix_agents_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "connect_conversations_organizationId_prospectId_userId_key"
  ON "connect_conversations"("organizationId", "prospectId", "userId");
CREATE INDEX "connect_conversations_organizationId_updatedAt_idx"
  ON "connect_conversations"("organizationId", "updatedAt");
CREATE INDEX "connect_conversation_events_conversationId_createdAt_idx"
  ON "connect_conversation_events"("conversationId", "createdAt");
CREATE INDEX "connect_extension_auth_codes_userId_expiresAt_idx"
  ON "connect_extension_auth_codes"("userId", "expiresAt");
CREATE UNIQUE INDEX "ciblix_agents_slug_key" ON "ciblix_agents"("slug");

ALTER TABLE "connect_conversations" ADD CONSTRAINT "connect_conversations_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "connect_conversations" ADD CONSTRAINT "connect_conversations_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "connect_conversations" ADD CONSTRAINT "connect_conversations_prospectId_fkey"
  FOREIGN KEY ("prospectId") REFERENCES "connect_prospects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "connect_conversations" ADD CONSTRAINT "connect_conversations_channelId_fkey"
  FOREIGN KEY ("channelId") REFERENCES "connect_channels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "connect_conversation_events" ADD CONSTRAINT "connect_conversation_events_conversationId_fkey"
  FOREIGN KEY ("conversationId") REFERENCES "connect_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "connect_extension_auth_codes" ADD CONSTRAINT "connect_extension_auth_codes_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "connect_extension_auth_codes" ADD CONSTRAINT "connect_extension_auth_codes_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "ciblix_agents" ("id", "slug", "name", "description", "active", "sortOrder", "updatedAt")
VALUES
  ('agent_connect', 'connect-ai', 'Connect AI', 'Prospection assistée via extension', true, 1, CURRENT_TIMESTAMP),
  ('agent_mail', 'mail-ai', 'Mail AI', 'Messagerie assistée', false, 2, CURRENT_TIMESTAMP),
  ('agent_proposal', 'proposal-ai', 'Proposal AI', 'Propositions commerciales', false, 3, CURRENT_TIMESTAMP),
  ('agent_meeting', 'meeting-ai', 'Meeting AI', 'Préparation réunions', false, 4, CURRENT_TIMESTAMP),
  ('agent_research', 'research-ai', 'Research AI', 'Recherche entreprises', false, 5, CURRENT_TIMESTAMP),
  ('agent_brand', 'brand-ai', 'Brand AI', 'Image de marque', false, 6, CURRENT_TIMESTAMP)
ON CONFLICT DO NOTHING;
