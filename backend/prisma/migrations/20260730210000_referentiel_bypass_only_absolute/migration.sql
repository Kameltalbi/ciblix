-- Isolation absolue du référentiel mutualisé :
-- plus aucune lecture / écriture tenant (Hunt ne doit plus alimenter ce pool).
-- Accès réservé au bypass (admin / workers de maintenance).

SELECT set_config('app.bypass_rls', 'on', false);

TRUNCATE TABLE "entreprises_referentiel" CASCADE;

DO $$ BEGIN
  IF to_regclass('public.entreprises_referentiel') IS NOT NULL THEN
    ALTER TABLE "entreprises_referentiel" ENABLE ROW LEVEL SECURITY;
    ALTER TABLE "entreprises_referentiel" FORCE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS referentiel_read_authenticated ON "entreprises_referentiel";
    DROP POLICY IF EXISTS referentiel_write_bypass ON "entreprises_referentiel";
    DROP POLICY IF EXISTS referentiel_update_bypass ON "entreprises_referentiel";
    DROP POLICY IF EXISTS referentiel_delete_bypass ON "entreprises_referentiel";

    CREATE POLICY referentiel_select_bypass_only ON "entreprises_referentiel"
      FOR SELECT
      USING (current_setting('app.bypass_rls', true) = 'on');
    CREATE POLICY referentiel_insert_bypass_only ON "entreprises_referentiel"
      FOR INSERT
      WITH CHECK (current_setting('app.bypass_rls', true) = 'on');
    CREATE POLICY referentiel_update_bypass_only ON "entreprises_referentiel"
      FOR UPDATE
      USING (current_setting('app.bypass_rls', true) = 'on')
      WITH CHECK (current_setting('app.bypass_rls', true) = 'on');
    CREATE POLICY referentiel_delete_bypass_only ON "entreprises_referentiel"
      FOR DELETE
      USING (current_setting('app.bypass_rls', true) = 'on');
  END IF;
END $$;

-- Dedup reviews : même verrouillage
DO $$ BEGIN
  IF to_regclass('public.referentiel_dedup_reviews') IS NOT NULL THEN
    ALTER TABLE "referentiel_dedup_reviews" ENABLE ROW LEVEL SECURITY;
    ALTER TABLE "referentiel_dedup_reviews" FORCE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS referentiel_dedup_bypass ON "referentiel_dedup_reviews";
    CREATE POLICY referentiel_dedup_bypass ON "referentiel_dedup_reviews"
      FOR ALL
      USING (current_setting('app.bypass_rls', true) = 'on')
      WITH CHECK (current_setting('app.bypass_rls', true) = 'on');
  END IF;
END $$;

SELECT set_config('app.bypass_rls', 'off', false);
SELECT set_config('app.current_tenant_id', '', false);
