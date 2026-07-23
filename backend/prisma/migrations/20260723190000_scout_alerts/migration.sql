-- Alertes email Veilleur IA (scan auto)
ALTER TABLE "scout_profiles" ADD COLUMN IF NOT EXISTS "alertEmailEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "scout_profiles" ADD COLUMN IF NOT EXISTS "alertMinScore" INTEGER NOT NULL DEFAULT 70;

-- Type notification Veilleur IA
DO $$ BEGIN
  ALTER TYPE "NotificationType" ADD VALUE 'SCOUT_ALERT';
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
