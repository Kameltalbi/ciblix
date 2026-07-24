-- AlterTable
ALTER TABLE "ai_prospects" ADD COLUMN IF NOT EXISTS "commercialProfile" JSONB;
ALTER TABLE "ai_prospects" ADD COLUMN IF NOT EXISTS "googleMapsUrl" TEXT;
