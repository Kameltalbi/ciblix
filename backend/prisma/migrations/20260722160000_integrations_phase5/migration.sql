-- Phase 5 : WhatsApp, webhooks sortants, téléphonie/visio

CREATE TYPE "TelephonyRecordingConsentMode" AS ENUM ('DISABLED', 'CLIENT_RESPONSIBLE');

ALTER TABLE "organizations" ADD COLUMN "whatsappBusinessAccountId" TEXT;
ALTER TABLE "organizations" ADD COLUMN "whatsappPhoneNumberId" TEXT;
ALTER TABLE "organizations" ADD COLUMN "whatsappWebhookToken" TEXT;
ALTER TABLE "organizations" ADD COLUMN "whatsappSessionTimeoutMinutes" INTEGER NOT NULL DEFAULT 30;
ALTER TABLE "organizations" ADD COLUMN "zoomOAuthToken" TEXT;
ALTER TABLE "organizations" ADD COLUMN "telephonyWebhookSecret" TEXT;
ALTER TABLE "organizations" ADD COLUMN "telephonyRecordingConsentMode" "TelephonyRecordingConsentMode" NOT NULL DEFAULT 'DISABLED';
ALTER TABLE "organizations" ADD COLUMN "telephonyConsentConfirmedAt" TIMESTAMP(3);
ALTER TABLE "organizations" ADD COLUMN "telephonyConsentConfirmedBy" TEXT;

ALTER TABLE "contacts" ADD COLUMN "whatsappConsentAt" TIMESTAMP(3);

CREATE TABLE "whatsapp_session_buffers" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "whatsappId" TEXT NOT NULL,
    "contactId" TEXT,
    "messages" JSONB NOT NULL DEFAULT '[]',
    "lastMessageAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "whatsapp_session_buffers_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "outbound_webhook_configs" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "targetUrl" TEXT NOT NULL,
    "secret" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "eventTypes" "AgentEventType"[] DEFAULT ARRAY[]::"AgentEventType"[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "outbound_webhook_configs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "webhook_delivery_logs" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "agentEventId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "httpStatus" INTEGER,
    "attempts" INTEGER NOT NULL DEFAULT 1,
    "lastAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "errorMessage" TEXT,

    CONSTRAINT "webhook_delivery_logs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "whatsapp_session_buffers_organizationId_whatsappId_key" ON "whatsapp_session_buffers"("organizationId", "whatsappId");
CREATE INDEX "whatsapp_session_buffers_organizationId_lastMessageAt_idx" ON "whatsapp_session_buffers"("organizationId", "lastMessageAt");

CREATE UNIQUE INDEX "outbound_webhook_configs_organizationId_key" ON "outbound_webhook_configs"("organizationId");

CREATE INDEX "webhook_delivery_logs_organizationId_status_idx" ON "webhook_delivery_logs"("organizationId", "status");
CREATE INDEX "webhook_delivery_logs_agentEventId_idx" ON "webhook_delivery_logs"("agentEventId");

ALTER TABLE "whatsapp_session_buffers" ADD CONSTRAINT "whatsapp_session_buffers_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "whatsapp_session_buffers" ADD CONSTRAINT "whatsapp_session_buffers_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "outbound_webhook_configs" ADD CONSTRAINT "outbound_webhook_configs_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "webhook_delivery_logs" ADD CONSTRAINT "webhook_delivery_logs_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
