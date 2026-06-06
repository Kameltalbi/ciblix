-- Multi-marques : rattacher scores, articles, canaux à une brandProfile

ALTER TABLE "brand_score_snapshots" ADD COLUMN "brandProfileId" TEXT;
ALTER TABLE "brand_articles" ADD COLUMN "brandProfileId" TEXT;
ALTER TABLE "brand_recommendations" ADD COLUMN "brandProfileId" TEXT;
ALTER TABLE "brand_alerts" ADD COLUMN "brandProfileId" TEXT;
ALTER TABLE "brand_cms_connections" ADD COLUMN "brandProfileId" TEXT;
ALTER TABLE "brand_channel_connections" ADD COLUMN "brandProfileId" TEXT;
ALTER TABLE "brand_competitor_snapshots" ADD COLUMN "brandProfileId" TEXT;

-- Backfill : marque principale de chaque organisation
UPDATE "brand_score_snapshots" s
SET "brandProfileId" = p.id
FROM "brand_profiles" p
WHERE p."organizationId" = s."organizationId" AND p."isPrimary" = true;

UPDATE "brand_articles" a
SET "brandProfileId" = p.id
FROM "brand_profiles" p
WHERE p."organizationId" = a."organizationId" AND p."isPrimary" = true;

UPDATE "brand_recommendations" r
SET "brandProfileId" = p.id
FROM "brand_profiles" p
WHERE p."organizationId" = r."organizationId" AND p."isPrimary" = true;

UPDATE "brand_alerts" a
SET "brandProfileId" = p.id
FROM "brand_profiles" p
WHERE p."organizationId" = a."organizationId" AND p."isPrimary" = true;

UPDATE "brand_cms_connections" c
SET "brandProfileId" = p.id
FROM "brand_profiles" p
WHERE p."organizationId" = c."organizationId" AND p."isPrimary" = true;

UPDATE "brand_channel_connections" c
SET "brandProfileId" = p.id
FROM "brand_profiles" p
WHERE p."organizationId" = c."organizationId" AND p."isPrimary" = true;

UPDATE "brand_competitor_snapshots" s
SET "brandProfileId" = p.id
FROM "brand_profiles" p
WHERE p."organizationId" = s."organizationId" AND p."isPrimary" = true;

-- Fallback : première marque de l'org si pas de principale
UPDATE "brand_score_snapshots" s
SET "brandProfileId" = (
  SELECT p.id FROM "brand_profiles" p
  WHERE p."organizationId" = s."organizationId"
  ORDER BY p."isPrimary" DESC, p."createdAt" ASC
  LIMIT 1
)
WHERE "brandProfileId" IS NULL;

UPDATE "brand_articles" a
SET "brandProfileId" = (
  SELECT p.id FROM "brand_profiles" p
  WHERE p."organizationId" = a."organizationId"
  ORDER BY p."isPrimary" DESC, p."createdAt" ASC
  LIMIT 1
)
WHERE "brandProfileId" IS NULL;

UPDATE "brand_recommendations" r
SET "brandProfileId" = (
  SELECT p.id FROM "brand_profiles" p
  WHERE p."organizationId" = r."organizationId"
  ORDER BY p."isPrimary" DESC, p."createdAt" ASC
  LIMIT 1
)
WHERE "brandProfileId" IS NULL;

UPDATE "brand_alerts" a
SET "brandProfileId" = (
  SELECT p.id FROM "brand_profiles" p
  WHERE p."organizationId" = a."organizationId"
  ORDER BY p."isPrimary" DESC, p."createdAt" ASC
  LIMIT 1
)
WHERE "brandProfileId" IS NULL;

UPDATE "brand_cms_connections" c
SET "brandProfileId" = (
  SELECT p.id FROM "brand_profiles" p
  WHERE p."organizationId" = c."organizationId"
  ORDER BY p."isPrimary" DESC, p."createdAt" ASC
  LIMIT 1
)
WHERE "brandProfileId" IS NULL;

UPDATE "brand_channel_connections" c
SET "brandProfileId" = (
  SELECT p.id FROM "brand_profiles" p
  WHERE p."organizationId" = c."organizationId"
  ORDER BY p."isPrimary" DESC, p."createdAt" ASC
  LIMIT 1
)
WHERE "brandProfileId" IS NULL;

UPDATE "brand_competitor_snapshots" s
SET "brandProfileId" = (
  SELECT p.id FROM "brand_profiles" p
  WHERE p."organizationId" = s."organizationId"
  ORDER BY p."isPrimary" DESC, p."createdAt" ASC
  LIMIT 1
)
WHERE "brandProfileId" IS NULL;

ALTER TABLE "brand_score_snapshots" ALTER COLUMN "brandProfileId" SET NOT NULL;
ALTER TABLE "brand_articles" ALTER COLUMN "brandProfileId" SET NOT NULL;
ALTER TABLE "brand_recommendations" ALTER COLUMN "brandProfileId" SET NOT NULL;
ALTER TABLE "brand_alerts" ALTER COLUMN "brandProfileId" SET NOT NULL;
ALTER TABLE "brand_cms_connections" ALTER COLUMN "brandProfileId" SET NOT NULL;
ALTER TABLE "brand_channel_connections" ALTER COLUMN "brandProfileId" SET NOT NULL;
ALTER TABLE "brand_competitor_snapshots" ALTER COLUMN "brandProfileId" SET NOT NULL;

ALTER TABLE "brand_score_snapshots" ADD CONSTRAINT "brand_score_snapshots_brandProfileId_fkey"
  FOREIGN KEY ("brandProfileId") REFERENCES "brand_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "brand_articles" ADD CONSTRAINT "brand_articles_brandProfileId_fkey"
  FOREIGN KEY ("brandProfileId") REFERENCES "brand_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "brand_recommendations" ADD CONSTRAINT "brand_recommendations_brandProfileId_fkey"
  FOREIGN KEY ("brandProfileId") REFERENCES "brand_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "brand_alerts" ADD CONSTRAINT "brand_alerts_brandProfileId_fkey"
  FOREIGN KEY ("brandProfileId") REFERENCES "brand_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "brand_cms_connections" ADD CONSTRAINT "brand_cms_connections_brandProfileId_fkey"
  FOREIGN KEY ("brandProfileId") REFERENCES "brand_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "brand_channel_connections" ADD CONSTRAINT "brand_channel_connections_brandProfileId_fkey"
  FOREIGN KEY ("brandProfileId") REFERENCES "brand_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "brand_competitor_snapshots" ADD CONSTRAINT "brand_competitor_snapshots_brandProfileId_fkey"
  FOREIGN KEY ("brandProfileId") REFERENCES "brand_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

DROP INDEX IF EXISTS "brand_score_snapshots_organizationId_channel_computedAt_idx";
CREATE INDEX "brand_score_snapshots_organizationId_brandProfileId_channel_computedAt_idx"
  ON "brand_score_snapshots"("organizationId", "brandProfileId", "channel", "computedAt");

DROP INDEX IF EXISTS "brand_articles_organizationId_status_idx";
DROP INDEX IF EXISTS "brand_articles_organizationId_createdAt_idx";
CREATE INDEX "brand_articles_organizationId_brandProfileId_status_idx"
  ON "brand_articles"("organizationId", "brandProfileId", "status");
CREATE INDEX "brand_articles_organizationId_brandProfileId_createdAt_idx"
  ON "brand_articles"("organizationId", "brandProfileId", "createdAt");

DROP INDEX IF EXISTS "brand_recommendations_organizationId_channel_idx";
CREATE INDEX "brand_recommendations_organizationId_brandProfileId_channel_idx"
  ON "brand_recommendations"("organizationId", "brandProfileId", "channel");

DROP INDEX IF EXISTS "brand_alerts_organizationId_read_createdAt_idx";
CREATE INDEX "brand_alerts_organizationId_brandProfileId_read_createdAt_idx"
  ON "brand_alerts"("organizationId", "brandProfileId", "read", "createdAt");

DROP INDEX IF EXISTS "brand_cms_connections_organizationId_idx";
CREATE INDEX "brand_cms_connections_organizationId_brandProfileId_idx"
  ON "brand_cms_connections"("organizationId", "brandProfileId");

ALTER TABLE "brand_channel_connections" DROP CONSTRAINT IF EXISTS "brand_channel_connections_organizationId_channel_key";
CREATE UNIQUE INDEX "brand_channel_connections_brandProfileId_channel_key"
  ON "brand_channel_connections"("brandProfileId", "channel");

DROP INDEX IF EXISTS "brand_competitor_snapshots_organizationId_computedAt_idx";
CREATE INDEX "brand_competitor_snapshots_organizationId_brandProfileId_computedAt_idx"
  ON "brand_competitor_snapshots"("organizationId", "brandProfileId", "computedAt");
