-- AlterTable
ALTER TABLE "billing_subscriptions" ADD COLUMN IF NOT EXISTS "selectedDiscoveryAgent" TEXT;
