-- Mission IA fields on org_targeting_profiles
ALTER TABLE "org_targeting_profiles" ADD COLUMN IF NOT EXISTS "missionStatus" TEXT NOT NULL DEFAULT 'NONE';
ALTER TABLE "org_targeting_profiles" ADD COLUMN IF NOT EXISTS "missionStep" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "org_targeting_profiles" ADD COLUMN IF NOT EXISTS "missionCompletedAt" TIMESTAMP(3);
ALTER TABLE "org_targeting_profiles" ADD COLUMN IF NOT EXISTS "missionSummary" TEXT;
ALTER TABLE "org_targeting_profiles" ADD COLUMN IF NOT EXISTS "companyBrief" TEXT;
ALTER TABLE "org_targeting_profiles" ADD COLUMN IF NOT EXISTS "extractedInsights" JSONB;
ALTER TABLE "org_targeting_profiles" ADD COLUMN IF NOT EXISTS "regions" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "org_targeting_profiles" ADD COLUMN IF NOT EXISTS "idealProfiles" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "org_targeting_profiles" ADD COLUMN IF NOT EXISTS "detectSignals" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "org_targeting_profiles" ADD COLUMN IF NOT EXISTS "commercialPriorities" TEXT;
ALTER TABLE "org_targeting_profiles" ADD COLUMN IF NOT EXISTS "excludeClients" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "org_targeting_profiles" ADD COLUMN IF NOT EXISTS "excludeCompetitors" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "org_targeting_profiles" ADD COLUMN IF NOT EXISTS "excludePartners" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "org_targeting_profiles" ADD COLUMN IF NOT EXISTS "excludeSectors" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "org_targeting_profiles" ADD COLUMN IF NOT EXISTS "excludeCountries" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- Agents off until mission ACTIVE
ALTER TABLE "org_targeting_profiles" ALTER COLUMN "orchestratorEnabled" SET DEFAULT false;
UPDATE "org_targeting_profiles" SET "orchestratorEnabled" = false WHERE "missionStatus" IS DISTINCT FROM 'ACTIVE' OR "missionCompletedAt" IS NULL;
