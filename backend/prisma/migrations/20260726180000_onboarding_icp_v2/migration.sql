-- Onboarding V2 — ICP inversé + fiche offre
ALTER TABLE "org_targeting_profiles"
  ADD COLUMN IF NOT EXISTS "identitySourceType" TEXT,
  ADD COLUMN IF NOT EXISTS "identitySourceUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "identitySourceLabel" TEXT,
  ADD COLUMN IF NOT EXISTS "referenceClients" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS "geoZonePresets" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS "extractedTenantProfile" JSONB,
  ADD COLUMN IF NOT EXISTS "inverseIcp" JSONB,
  ADD COLUMN IF NOT EXISTS "inverseIcpText" TEXT,
  ADD COLUMN IF NOT EXISTS "offerSheet" JSONB,
  ADD COLUMN IF NOT EXISTS "offerValidatedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "offerValidatedBy" TEXT,
  ADD COLUMN IF NOT EXISTS "learnedPrefs" JSONB,
  ADD COLUMN IF NOT EXISTS "ttfrlStartedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "ttfrlFirstLeadAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "onboardingEvents" JSONB;
