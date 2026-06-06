-- Phase 2-7: channel connections, competitor snapshots, API keys, multi-brand profiles

-- Drop unique on organizationId (multi-brand Phase 7)
ALTER TABLE "brand_profiles" DROP CONSTRAINT IF EXISTS "brand_profiles_organizationId_key";

ALTER TABLE "brand_profiles" ADD COLUMN IF NOT EXISTS "slug" TEXT NOT NULL DEFAULT 'primary';
ALTER TABLE "brand_profiles" ADD COLUMN IF NOT EXISTS "isPrimary" BOOLEAN NOT NULL DEFAULT true;

CREATE UNIQUE INDEX IF NOT EXISTS "brand_profiles_organizationId_slug_key" ON "brand_profiles"("organizationId", "slug");
CREATE INDEX IF NOT EXISTS "brand_profiles_organizationId_isPrimary_idx" ON "brand_profiles"("organizationId", "isPrimary");

-- Notification type
DO $$ BEGIN
  ALTER TYPE "NotificationType" ADD VALUE 'BRAND_PULSE_ALERT';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "brand_channel_connections" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'MANUAL',
    "encryptedConfig" TEXT,
    "metadata" JSONB,
    "lastSyncAt" TIMESTAMP(3),
    "lastScore" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "brand_channel_connections_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "brand_channel_connections_organizationId_channel_key" ON "brand_channel_connections"("organizationId", "channel");

ALTER TABLE "brand_channel_connections" DROP CONSTRAINT IF EXISTS "brand_channel_connections_organizationId_fkey";
ALTER TABLE "brand_channel_connections" ADD CONSTRAINT "brand_channel_connections_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "brand_competitor_snapshots" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "competitorName" TEXT NOT NULL,
    "globalScore" INTEGER NOT NULL,
    "channels" JSONB NOT NULL,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "brand_competitor_snapshots_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "brand_competitor_snapshots_organizationId_computedAt_idx" ON "brand_competitor_snapshots"("organizationId", "computedAt");

ALTER TABLE "brand_competitor_snapshots" DROP CONSTRAINT IF EXISTS "brand_competitor_snapshots_organizationId_fkey";
ALTER TABLE "brand_competitor_snapshots" ADD CONSTRAINT "brand_competitor_snapshots_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "brand_api_keys" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "label" TEXT,
    "keyHash" TEXT NOT NULL,
    "keyPrefix" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "brand_api_keys_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "brand_api_keys_organizationId_idx" ON "brand_api_keys"("organizationId");
CREATE INDEX IF NOT EXISTS "brand_api_keys_keyPrefix_idx" ON "brand_api_keys"("keyPrefix");

ALTER TABLE "brand_api_keys" DROP CONSTRAINT IF EXISTS "brand_api_keys_organizationId_fkey";
ALTER TABLE "brand_api_keys" ADD CONSTRAINT "brand_api_keys_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
