-- Phase trial: SubscriptionStatus + champs essai + TrialExtensionLog
CREATE TYPE "SubscriptionStatus" AS ENUM ('TRIALING', 'ACTIVE', 'PAST_DUE', 'TRIAL_EXPIRED', 'CANCELED');

ALTER TABLE "billing_subscriptions"
  ADD COLUMN IF NOT EXISTS "trialStartedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "trialEndsAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "trialExtendedBy" TEXT,
  ADD COLUMN IF NOT EXISTS "trialExtensionCount" INTEGER NOT NULL DEFAULT 0;

-- Remplir trialEndsAt pour les lignes existantes (createdAt + 7j)
UPDATE "billing_subscriptions"
SET "trialEndsAt" = COALESCE("trialEndsAt", "createdAt" + INTERVAL '7 days'),
    "trialStartedAt" = COALESCE("trialStartedAt", "createdAt");

ALTER TABLE "billing_subscriptions"
  ALTER COLUMN "trialEndsAt" SET NOT NULL;

-- Migrer status string → enum
ALTER TABLE "billing_subscriptions" ADD COLUMN IF NOT EXISTS "status_new" "SubscriptionStatus";

UPDATE "billing_subscriptions"
SET "status_new" = CASE
  WHEN LOWER("status") IN ('active') THEN 'ACTIVE'::"SubscriptionStatus"
  WHEN LOWER("status") IN ('past_due', 'pastdue') THEN 'PAST_DUE'::"SubscriptionStatus"
  WHEN LOWER("status") IN ('trial_expired', 'expired') THEN 'TRIAL_EXPIRED'::"SubscriptionStatus"
  WHEN LOWER("status") IN ('canceled', 'cancelled') THEN 'CANCELED'::"SubscriptionStatus"
  ELSE 'TRIALING'::"SubscriptionStatus"
END;

ALTER TABLE "billing_subscriptions" DROP COLUMN "status";
ALTER TABLE "billing_subscriptions" RENAME COLUMN "status_new" TO "status";
ALTER TABLE "billing_subscriptions" ALTER COLUMN "status" SET DEFAULT 'TRIALING'::"SubscriptionStatus";
ALTER TABLE "billing_subscriptions" ALTER COLUMN "status" SET NOT NULL;

CREATE INDEX IF NOT EXISTS "billing_subscriptions_status_trialEndsAt_idx"
  ON "billing_subscriptions"("status", "trialEndsAt");

CREATE TABLE IF NOT EXISTS "trial_extension_logs" (
  "id" TEXT NOT NULL,
  "subscriptionId" TEXT NOT NULL,
  "extendedBy" TEXT NOT NULL,
  "additionalDays" INTEGER NOT NULL,
  "reason" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "trial_extension_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "trial_extension_logs_subscriptionId_createdAt_idx"
  ON "trial_extension_logs"("subscriptionId", "createdAt");

ALTER TABLE "trial_extension_logs"
  DROP CONSTRAINT IF EXISTS "trial_extension_logs_subscriptionId_fkey";

ALTER TABLE "trial_extension_logs"
  ADD CONSTRAINT "trial_extension_logs_subscriptionId_fkey"
  FOREIGN KEY ("subscriptionId") REFERENCES "billing_subscriptions"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
