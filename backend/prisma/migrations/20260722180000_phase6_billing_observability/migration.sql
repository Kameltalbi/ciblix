-- Phase 6 : facturation SaaS, quotas, observabilité LLM, onboarding

CREATE TYPE "BillingTier" AS ENUM ('DECOUVERTE', 'CROISSANCE', 'PRO', 'ENTERPRISE');
CREATE TYPE "BillingCurrency" AS ENUM ('TND', 'EUR', 'USD');

ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "onboardingCompletedAt" TIMESTAMP(3);
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "onboardingSector" TEXT;

CREATE TABLE "billing_subscriptions" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "tier" "BillingTier" NOT NULL DEFAULT 'DECOUVERTE',
    "currency" "BillingCurrency" NOT NULL DEFAULT 'TND',
    "stripeCustomerId" TEXT,
    "stripeSubscriptionId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'trialing',
    "currentPeriodEnd" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "billing_subscriptions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "usage_quotas" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "agentActionsUsed" INTEGER NOT NULL DEFAULT 0,
    "agentActionsLimit" INTEGER NOT NULL,
    "overageAllowed" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "usage_quotas_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "llm_usage_logs" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "service" TEXT NOT NULL,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "durationMs" INTEGER NOT NULL DEFAULT 0,
    "tokensEstimate" INTEGER,
    "costEstimateUsd" DOUBLE PRECISION,
    "errorCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "llm_usage_logs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "billing_subscriptions_organizationId_key" ON "billing_subscriptions"("organizationId");
CREATE UNIQUE INDEX "usage_quotas_organizationId_month_key" ON "usage_quotas"("organizationId", "month");
CREATE INDEX "usage_quotas_organizationId_month_idx" ON "usage_quotas"("organizationId", "month");
CREATE INDEX "llm_usage_logs_organizationId_createdAt_idx" ON "llm_usage_logs"("organizationId", "createdAt");
CREATE INDEX "llm_usage_logs_service_createdAt_idx" ON "llm_usage_logs"("service", "createdAt");

ALTER TABLE "billing_subscriptions" ADD CONSTRAINT "billing_subscriptions_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "usage_quotas" ADD CONSTRAINT "usage_quotas_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "llm_usage_logs" ADD CONSTRAINT "llm_usage_logs_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
