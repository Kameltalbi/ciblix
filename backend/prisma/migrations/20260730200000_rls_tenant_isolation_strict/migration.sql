-- =============================================================================
-- RLS multi-tenant étanche (fail-closed)
-- Sans app.current_tenant_id et sans app.bypass_rls=on → 0 ligne
-- Bypass réservé : login, SUPERADMIN, migrations, workers
-- =============================================================================

SELECT set_config('app.bypass_rls', 'on', false);


DO $$ BEGIN
  IF to_regclass('public.users') IS NULL THEN
    RAISE NOTICE 'skip missing table users';
  ELSE
    ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
    ALTER TABLE "users" FORCE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS tenant_isolation ON "users";
    DROP POLICY IF EXISTS users_tenant_isolation ON "users";
    DROP POLICY IF EXISTS contacts_tenant_isolation ON "users";
    DROP POLICY IF EXISTS corrections_tenant_isolation ON "users";
    CREATE POLICY tenant_isolation ON "users"
      FOR ALL
      USING (
        current_setting('app.bypass_rls', true) = 'on'
        OR (
          NULLIF(current_setting('app.current_tenant_id', true), '') IS NOT NULL
          AND "organizationId" = current_setting('app.current_tenant_id', true)
        )
      )
      WITH CHECK (
        current_setting('app.bypass_rls', true) = 'on'
        OR (
          NULLIF(current_setting('app.current_tenant_id', true), '') IS NOT NULL
          AND "organizationId" = current_setting('app.current_tenant_id', true)
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.clients') IS NULL THEN
    RAISE NOTICE 'skip missing table clients';
  ELSE
    ALTER TABLE "clients" ENABLE ROW LEVEL SECURITY;
    ALTER TABLE "clients" FORCE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS tenant_isolation ON "clients";
    DROP POLICY IF EXISTS clients_tenant_isolation ON "clients";
    DROP POLICY IF EXISTS contacts_tenant_isolation ON "clients";
    DROP POLICY IF EXISTS corrections_tenant_isolation ON "clients";
    CREATE POLICY tenant_isolation ON "clients"
      FOR ALL
      USING (
        current_setting('app.bypass_rls', true) = 'on'
        OR (
          NULLIF(current_setting('app.current_tenant_id', true), '') IS NOT NULL
          AND "organizationId" = current_setting('app.current_tenant_id', true)
        )
      )
      WITH CHECK (
        current_setting('app.bypass_rls', true) = 'on'
        OR (
          NULLIF(current_setting('app.current_tenant_id', true), '') IS NOT NULL
          AND "organizationId" = current_setting('app.current_tenant_id', true)
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.leads') IS NULL THEN
    RAISE NOTICE 'skip missing table leads';
  ELSE
    ALTER TABLE "leads" ENABLE ROW LEVEL SECURITY;
    ALTER TABLE "leads" FORCE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS tenant_isolation ON "leads";
    DROP POLICY IF EXISTS leads_tenant_isolation ON "leads";
    DROP POLICY IF EXISTS contacts_tenant_isolation ON "leads";
    DROP POLICY IF EXISTS corrections_tenant_isolation ON "leads";
    CREATE POLICY tenant_isolation ON "leads"
      FOR ALL
      USING (
        current_setting('app.bypass_rls', true) = 'on'
        OR (
          NULLIF(current_setting('app.current_tenant_id', true), '') IS NOT NULL
          AND "organizationId" = current_setting('app.current_tenant_id', true)
        )
      )
      WITH CHECK (
        current_setting('app.bypass_rls', true) = 'on'
        OR (
          NULLIF(current_setting('app.current_tenant_id', true), '') IS NOT NULL
          AND "organizationId" = current_setting('app.current_tenant_id', true)
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.ai_prospects') IS NULL THEN
    RAISE NOTICE 'skip missing table ai_prospects';
  ELSE
    ALTER TABLE "ai_prospects" ENABLE ROW LEVEL SECURITY;
    ALTER TABLE "ai_prospects" FORCE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS tenant_isolation ON "ai_prospects";
    DROP POLICY IF EXISTS ai_prospects_tenant_isolation ON "ai_prospects";
    DROP POLICY IF EXISTS contacts_tenant_isolation ON "ai_prospects";
    DROP POLICY IF EXISTS corrections_tenant_isolation ON "ai_prospects";
    CREATE POLICY tenant_isolation ON "ai_prospects"
      FOR ALL
      USING (
        current_setting('app.bypass_rls', true) = 'on'
        OR (
          NULLIF(current_setting('app.current_tenant_id', true), '') IS NOT NULL
          AND "organizationId" = current_setting('app.current_tenant_id', true)
        )
      )
      WITH CHECK (
        current_setting('app.bypass_rls', true) = 'on'
        OR (
          NULLIF(current_setting('app.current_tenant_id', true), '') IS NOT NULL
          AND "organizationId" = current_setting('app.current_tenant_id', true)
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.prospecting_automations') IS NULL THEN
    RAISE NOTICE 'skip missing table prospecting_automations';
  ELSE
    ALTER TABLE "prospecting_automations" ENABLE ROW LEVEL SECURITY;
    ALTER TABLE "prospecting_automations" FORCE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS tenant_isolation ON "prospecting_automations";
    DROP POLICY IF EXISTS prospecting_automations_tenant_isolation ON "prospecting_automations";
    DROP POLICY IF EXISTS contacts_tenant_isolation ON "prospecting_automations";
    DROP POLICY IF EXISTS corrections_tenant_isolation ON "prospecting_automations";
    CREATE POLICY tenant_isolation ON "prospecting_automations"
      FOR ALL
      USING (
        current_setting('app.bypass_rls', true) = 'on'
        OR (
          NULLIF(current_setting('app.current_tenant_id', true), '') IS NOT NULL
          AND "organizationId" = current_setting('app.current_tenant_id', true)
        )
      )
      WITH CHECK (
        current_setting('app.bypass_rls', true) = 'on'
        OR (
          NULLIF(current_setting('app.current_tenant_id', true), '') IS NOT NULL
          AND "organizationId" = current_setting('app.current_tenant_id', true)
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.ai_prospect_activities') IS NULL THEN
    RAISE NOTICE 'skip missing table ai_prospect_activities';
  ELSE
    ALTER TABLE "ai_prospect_activities" ENABLE ROW LEVEL SECURITY;
    ALTER TABLE "ai_prospect_activities" FORCE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS tenant_isolation ON "ai_prospect_activities";
    DROP POLICY IF EXISTS ai_prospect_activities_tenant_isolation ON "ai_prospect_activities";
    DROP POLICY IF EXISTS contacts_tenant_isolation ON "ai_prospect_activities";
    DROP POLICY IF EXISTS corrections_tenant_isolation ON "ai_prospect_activities";
    CREATE POLICY tenant_isolation ON "ai_prospect_activities"
      FOR ALL
      USING (
        current_setting('app.bypass_rls', true) = 'on'
        OR (
          NULLIF(current_setting('app.current_tenant_id', true), '') IS NOT NULL
          AND "organizationId" = current_setting('app.current_tenant_id', true)
        )
      )
      WITH CHECK (
        current_setting('app.bypass_rls', true) = 'on'
        OR (
          NULLIF(current_setting('app.current_tenant_id', true), '') IS NOT NULL
          AND "organizationId" = current_setting('app.current_tenant_id', true)
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.calendar_events') IS NULL THEN
    RAISE NOTICE 'skip missing table calendar_events';
  ELSE
    ALTER TABLE "calendar_events" ENABLE ROW LEVEL SECURITY;
    ALTER TABLE "calendar_events" FORCE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS tenant_isolation ON "calendar_events";
    DROP POLICY IF EXISTS calendar_events_tenant_isolation ON "calendar_events";
    DROP POLICY IF EXISTS contacts_tenant_isolation ON "calendar_events";
    DROP POLICY IF EXISTS corrections_tenant_isolation ON "calendar_events";
    CREATE POLICY tenant_isolation ON "calendar_events"
      FOR ALL
      USING (
        current_setting('app.bypass_rls', true) = 'on'
        OR (
          NULLIF(current_setting('app.current_tenant_id', true), '') IS NOT NULL
          AND "organizationId" = current_setting('app.current_tenant_id', true)
        )
      )
      WITH CHECK (
        current_setting('app.bypass_rls', true) = 'on'
        OR (
          NULLIF(current_setting('app.current_tenant_id', true), '') IS NOT NULL
          AND "organizationId" = current_setting('app.current_tenant_id', true)
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.expenses') IS NULL THEN
    RAISE NOTICE 'skip missing table expenses';
  ELSE
    ALTER TABLE "expenses" ENABLE ROW LEVEL SECURITY;
    ALTER TABLE "expenses" FORCE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS tenant_isolation ON "expenses";
    DROP POLICY IF EXISTS expenses_tenant_isolation ON "expenses";
    DROP POLICY IF EXISTS contacts_tenant_isolation ON "expenses";
    DROP POLICY IF EXISTS corrections_tenant_isolation ON "expenses";
    CREATE POLICY tenant_isolation ON "expenses"
      FOR ALL
      USING (
        current_setting('app.bypass_rls', true) = 'on'
        OR (
          NULLIF(current_setting('app.current_tenant_id', true), '') IS NOT NULL
          AND "organizationId" = current_setting('app.current_tenant_id', true)
        )
      )
      WITH CHECK (
        current_setting('app.bypass_rls', true) = 'on'
        OR (
          NULLIF(current_setting('app.current_tenant_id', true), '') IS NOT NULL
          AND "organizationId" = current_setting('app.current_tenant_id', true)
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.custom_categories') IS NULL THEN
    RAISE NOTICE 'skip missing table custom_categories';
  ELSE
    ALTER TABLE "custom_categories" ENABLE ROW LEVEL SECURITY;
    ALTER TABLE "custom_categories" FORCE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS tenant_isolation ON "custom_categories";
    DROP POLICY IF EXISTS custom_categories_tenant_isolation ON "custom_categories";
    DROP POLICY IF EXISTS contacts_tenant_isolation ON "custom_categories";
    DROP POLICY IF EXISTS corrections_tenant_isolation ON "custom_categories";
    CREATE POLICY tenant_isolation ON "custom_categories"
      FOR ALL
      USING (
        current_setting('app.bypass_rls', true) = 'on'
        OR (
          NULLIF(current_setting('app.current_tenant_id', true), '') IS NOT NULL
          AND "organizationId" = current_setting('app.current_tenant_id', true)
        )
      )
      WITH CHECK (
        current_setting('app.bypass_rls', true) = 'on'
        OR (
          NULLIF(current_setting('app.current_tenant_id', true), '') IS NOT NULL
          AND "organizationId" = current_setting('app.current_tenant_id', true)
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.affaires') IS NULL THEN
    RAISE NOTICE 'skip missing table affaires';
  ELSE
    ALTER TABLE "affaires" ENABLE ROW LEVEL SECURITY;
    ALTER TABLE "affaires" FORCE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS tenant_isolation ON "affaires";
    DROP POLICY IF EXISTS affaires_tenant_isolation ON "affaires";
    DROP POLICY IF EXISTS contacts_tenant_isolation ON "affaires";
    DROP POLICY IF EXISTS corrections_tenant_isolation ON "affaires";
    CREATE POLICY tenant_isolation ON "affaires"
      FOR ALL
      USING (
        current_setting('app.bypass_rls', true) = 'on'
        OR (
          NULLIF(current_setting('app.current_tenant_id', true), '') IS NOT NULL
          AND "organizationId" = current_setting('app.current_tenant_id', true)
        )
      )
      WITH CHECK (
        current_setting('app.bypass_rls', true) = 'on'
        OR (
          NULLIF(current_setting('app.current_tenant_id', true), '') IS NOT NULL
          AND "organizationId" = current_setting('app.current_tenant_id', true)
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.activites') IS NULL THEN
    RAISE NOTICE 'skip missing table activites';
  ELSE
    ALTER TABLE "activites" ENABLE ROW LEVEL SECURITY;
    ALTER TABLE "activites" FORCE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS tenant_isolation ON "activites";
    DROP POLICY IF EXISTS activites_tenant_isolation ON "activites";
    DROP POLICY IF EXISTS contacts_tenant_isolation ON "activites";
    DROP POLICY IF EXISTS corrections_tenant_isolation ON "activites";
    CREATE POLICY tenant_isolation ON "activites"
      FOR ALL
      USING (
        current_setting('app.bypass_rls', true) = 'on'
        OR (
          NULLIF(current_setting('app.current_tenant_id', true), '') IS NOT NULL
          AND "organizationId" = current_setting('app.current_tenant_id', true)
        )
      )
      WITH CHECK (
        current_setting('app.bypass_rls', true) = 'on'
        OR (
          NULLIF(current_setting('app.current_tenant_id', true), '') IS NOT NULL
          AND "organizationId" = current_setting('app.current_tenant_id', true)
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.lead_activites') IS NULL THEN
    RAISE NOTICE 'skip missing table lead_activites';
  ELSE
    ALTER TABLE "lead_activites" ENABLE ROW LEVEL SECURITY;
    ALTER TABLE "lead_activites" FORCE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS tenant_isolation ON "lead_activites";
    DROP POLICY IF EXISTS lead_activites_tenant_isolation ON "lead_activites";
    DROP POLICY IF EXISTS contacts_tenant_isolation ON "lead_activites";
    DROP POLICY IF EXISTS corrections_tenant_isolation ON "lead_activites";
    CREATE POLICY tenant_isolation ON "lead_activites"
      FOR ALL
      USING (
        current_setting('app.bypass_rls', true) = 'on'
        OR (
          NULLIF(current_setting('app.current_tenant_id', true), '') IS NOT NULL
          AND "organizationId" = current_setting('app.current_tenant_id', true)
        )
      )
      WITH CHECK (
        current_setting('app.bypass_rls', true) = 'on'
        OR (
          NULLIF(current_setting('app.current_tenant_id', true), '') IS NOT NULL
          AND "organizationId" = current_setting('app.current_tenant_id', true)
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.emails') IS NULL THEN
    RAISE NOTICE 'skip missing table emails';
  ELSE
    ALTER TABLE "emails" ENABLE ROW LEVEL SECURITY;
    ALTER TABLE "emails" FORCE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS tenant_isolation ON "emails";
    DROP POLICY IF EXISTS emails_tenant_isolation ON "emails";
    DROP POLICY IF EXISTS contacts_tenant_isolation ON "emails";
    DROP POLICY IF EXISTS corrections_tenant_isolation ON "emails";
    CREATE POLICY tenant_isolation ON "emails"
      FOR ALL
      USING (
        current_setting('app.bypass_rls', true) = 'on'
        OR (
          NULLIF(current_setting('app.current_tenant_id', true), '') IS NOT NULL
          AND "organizationId" = current_setting('app.current_tenant_id', true)
        )
      )
      WITH CHECK (
        current_setting('app.bypass_rls', true) = 'on'
        OR (
          NULLIF(current_setting('app.current_tenant_id', true), '') IS NOT NULL
          AND "organizationId" = current_setting('app.current_tenant_id', true)
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.gmail_tokens') IS NULL THEN
    RAISE NOTICE 'skip missing table gmail_tokens';
  ELSE
    ALTER TABLE "gmail_tokens" ENABLE ROW LEVEL SECURITY;
    ALTER TABLE "gmail_tokens" FORCE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS tenant_isolation ON "gmail_tokens";
    DROP POLICY IF EXISTS gmail_tokens_tenant_isolation ON "gmail_tokens";
    DROP POLICY IF EXISTS contacts_tenant_isolation ON "gmail_tokens";
    DROP POLICY IF EXISTS corrections_tenant_isolation ON "gmail_tokens";
    CREATE POLICY tenant_isolation ON "gmail_tokens"
      FOR ALL
      USING (
        current_setting('app.bypass_rls', true) = 'on'
        OR (
          NULLIF(current_setting('app.current_tenant_id', true), '') IS NOT NULL
          AND "organizationId" = current_setting('app.current_tenant_id', true)
        )
      )
      WITH CHECK (
        current_setting('app.bypass_rls', true) = 'on'
        OR (
          NULLIF(current_setting('app.current_tenant_id', true), '') IS NOT NULL
          AND "organizationId" = current_setting('app.current_tenant_id', true)
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.gmail_ai_sync_states') IS NULL THEN
    RAISE NOTICE 'skip missing table gmail_ai_sync_states';
  ELSE
    ALTER TABLE "gmail_ai_sync_states" ENABLE ROW LEVEL SECURITY;
    ALTER TABLE "gmail_ai_sync_states" FORCE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS tenant_isolation ON "gmail_ai_sync_states";
    DROP POLICY IF EXISTS gmail_ai_sync_states_tenant_isolation ON "gmail_ai_sync_states";
    DROP POLICY IF EXISTS contacts_tenant_isolation ON "gmail_ai_sync_states";
    DROP POLICY IF EXISTS corrections_tenant_isolation ON "gmail_ai_sync_states";
    CREATE POLICY tenant_isolation ON "gmail_ai_sync_states"
      FOR ALL
      USING (
        current_setting('app.bypass_rls', true) = 'on'
        OR (
          NULLIF(current_setting('app.current_tenant_id', true), '') IS NOT NULL
          AND "organizationId" = current_setting('app.current_tenant_id', true)
        )
      )
      WITH CHECK (
        current_setting('app.bypass_rls', true) = 'on'
        OR (
          NULLIF(current_setting('app.current_tenant_id', true), '') IS NOT NULL
          AND "organizationId" = current_setting('app.current_tenant_id', true)
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.gmail_ai_processed_messages') IS NULL THEN
    RAISE NOTICE 'skip missing table gmail_ai_processed_messages';
  ELSE
    ALTER TABLE "gmail_ai_processed_messages" ENABLE ROW LEVEL SECURITY;
    ALTER TABLE "gmail_ai_processed_messages" FORCE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS tenant_isolation ON "gmail_ai_processed_messages";
    DROP POLICY IF EXISTS gmail_ai_processed_messages_tenant_isolation ON "gmail_ai_processed_messages";
    DROP POLICY IF EXISTS contacts_tenant_isolation ON "gmail_ai_processed_messages";
    DROP POLICY IF EXISTS corrections_tenant_isolation ON "gmail_ai_processed_messages";
    CREATE POLICY tenant_isolation ON "gmail_ai_processed_messages"
      FOR ALL
      USING (
        current_setting('app.bypass_rls', true) = 'on'
        OR (
          NULLIF(current_setting('app.current_tenant_id', true), '') IS NOT NULL
          AND "organizationId" = current_setting('app.current_tenant_id', true)
        )
      )
      WITH CHECK (
        current_setting('app.bypass_rls', true) = 'on'
        OR (
          NULLIF(current_setting('app.current_tenant_id', true), '') IS NOT NULL
          AND "organizationId" = current_setting('app.current_tenant_id', true)
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.prevision_mois') IS NULL THEN
    RAISE NOTICE 'skip missing table prevision_mois';
  ELSE
    ALTER TABLE "prevision_mois" ENABLE ROW LEVEL SECURITY;
    ALTER TABLE "prevision_mois" FORCE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS tenant_isolation ON "prevision_mois";
    DROP POLICY IF EXISTS prevision_mois_tenant_isolation ON "prevision_mois";
    DROP POLICY IF EXISTS contacts_tenant_isolation ON "prevision_mois";
    DROP POLICY IF EXISTS corrections_tenant_isolation ON "prevision_mois";
    CREATE POLICY tenant_isolation ON "prevision_mois"
      FOR ALL
      USING (
        current_setting('app.bypass_rls', true) = 'on'
        OR (
          NULLIF(current_setting('app.current_tenant_id', true), '') IS NOT NULL
          AND "organizationId" = current_setting('app.current_tenant_id', true)
        )
      )
      WITH CHECK (
        current_setting('app.bypass_rls', true) = 'on'
        OR (
          NULLIF(current_setting('app.current_tenant_id', true), '') IS NOT NULL
          AND "organizationId" = current_setting('app.current_tenant_id', true)
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.products') IS NULL THEN
    RAISE NOTICE 'skip missing table products';
  ELSE
    ALTER TABLE "products" ENABLE ROW LEVEL SECURITY;
    ALTER TABLE "products" FORCE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS tenant_isolation ON "products";
    DROP POLICY IF EXISTS products_tenant_isolation ON "products";
    DROP POLICY IF EXISTS contacts_tenant_isolation ON "products";
    DROP POLICY IF EXISTS corrections_tenant_isolation ON "products";
    CREATE POLICY tenant_isolation ON "products"
      FOR ALL
      USING (
        current_setting('app.bypass_rls', true) = 'on'
        OR (
          NULLIF(current_setting('app.current_tenant_id', true), '') IS NOT NULL
          AND "organizationId" = current_setting('app.current_tenant_id', true)
        )
      )
      WITH CHECK (
        current_setting('app.bypass_rls', true) = 'on'
        OR (
          NULLIF(current_setting('app.current_tenant_id', true), '') IS NOT NULL
          AND "organizationId" = current_setting('app.current_tenant_id', true)
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.notifications') IS NULL THEN
    RAISE NOTICE 'skip missing table notifications';
  ELSE
    ALTER TABLE "notifications" ENABLE ROW LEVEL SECURITY;
    ALTER TABLE "notifications" FORCE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS tenant_isolation ON "notifications";
    DROP POLICY IF EXISTS notifications_tenant_isolation ON "notifications";
    DROP POLICY IF EXISTS contacts_tenant_isolation ON "notifications";
    DROP POLICY IF EXISTS corrections_tenant_isolation ON "notifications";
    CREATE POLICY tenant_isolation ON "notifications"
      FOR ALL
      USING (
        current_setting('app.bypass_rls', true) = 'on'
        OR (
          NULLIF(current_setting('app.current_tenant_id', true), '') IS NOT NULL
          AND "organizationId" = current_setting('app.current_tenant_id', true)
        )
      )
      WITH CHECK (
        current_setting('app.bypass_rls', true) = 'on'
        OR (
          NULLIF(current_setting('app.current_tenant_id', true), '') IS NOT NULL
          AND "organizationId" = current_setting('app.current_tenant_id', true)
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.support_tickets') IS NULL THEN
    RAISE NOTICE 'skip missing table support_tickets';
  ELSE
    ALTER TABLE "support_tickets" ENABLE ROW LEVEL SECURITY;
    ALTER TABLE "support_tickets" FORCE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS tenant_isolation ON "support_tickets";
    DROP POLICY IF EXISTS support_tickets_tenant_isolation ON "support_tickets";
    DROP POLICY IF EXISTS contacts_tenant_isolation ON "support_tickets";
    DROP POLICY IF EXISTS corrections_tenant_isolation ON "support_tickets";
    CREATE POLICY tenant_isolation ON "support_tickets"
      FOR ALL
      USING (
        current_setting('app.bypass_rls', true) = 'on'
        OR (
          NULLIF(current_setting('app.current_tenant_id', true), '') IS NOT NULL
          AND "organizationId" = current_setting('app.current_tenant_id', true)
        )
      )
      WITH CHECK (
        current_setting('app.bypass_rls', true) = 'on'
        OR (
          NULLIF(current_setting('app.current_tenant_id', true), '') IS NOT NULL
          AND "organizationId" = current_setting('app.current_tenant_id', true)
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.support_ticket_messages') IS NULL THEN
    RAISE NOTICE 'skip missing table support_ticket_messages';
  ELSE
    ALTER TABLE "support_ticket_messages" ENABLE ROW LEVEL SECURITY;
    ALTER TABLE "support_ticket_messages" FORCE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS tenant_isolation ON "support_ticket_messages";
    DROP POLICY IF EXISTS support_ticket_messages_tenant_isolation ON "support_ticket_messages";
    DROP POLICY IF EXISTS contacts_tenant_isolation ON "support_ticket_messages";
    DROP POLICY IF EXISTS corrections_tenant_isolation ON "support_ticket_messages";
    CREATE POLICY tenant_isolation ON "support_ticket_messages"
      FOR ALL
      USING (
        current_setting('app.bypass_rls', true) = 'on'
        OR (
          NULLIF(current_setting('app.current_tenant_id', true), '') IS NOT NULL
          AND "organizationId" = current_setting('app.current_tenant_id', true)
        )
      )
      WITH CHECK (
        current_setting('app.bypass_rls', true) = 'on'
        OR (
          NULLIF(current_setting('app.current_tenant_id', true), '') IS NOT NULL
          AND "organizationId" = current_setting('app.current_tenant_id', true)
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.audit_logs') IS NULL THEN
    RAISE NOTICE 'skip missing table audit_logs';
  ELSE
    ALTER TABLE "audit_logs" ENABLE ROW LEVEL SECURITY;
    ALTER TABLE "audit_logs" FORCE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS tenant_isolation ON "audit_logs";
    DROP POLICY IF EXISTS audit_logs_tenant_isolation ON "audit_logs";
    DROP POLICY IF EXISTS contacts_tenant_isolation ON "audit_logs";
    DROP POLICY IF EXISTS corrections_tenant_isolation ON "audit_logs";
    CREATE POLICY tenant_isolation ON "audit_logs"
      FOR ALL
      USING (
        current_setting('app.bypass_rls', true) = 'on'
        OR (
          NULLIF(current_setting('app.current_tenant_id', true), '') IS NOT NULL
          AND "organizationId" = current_setting('app.current_tenant_id', true)
        )
      )
      WITH CHECK (
        current_setting('app.bypass_rls', true) = 'on'
        OR (
          NULLIF(current_setting('app.current_tenant_id', true), '') IS NOT NULL
          AND "organizationId" = current_setting('app.current_tenant_id', true)
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.email_templates') IS NULL THEN
    RAISE NOTICE 'skip missing table email_templates';
  ELSE
    ALTER TABLE "email_templates" ENABLE ROW LEVEL SECURITY;
    ALTER TABLE "email_templates" FORCE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS tenant_isolation ON "email_templates";
    DROP POLICY IF EXISTS email_templates_tenant_isolation ON "email_templates";
    DROP POLICY IF EXISTS contacts_tenant_isolation ON "email_templates";
    DROP POLICY IF EXISTS corrections_tenant_isolation ON "email_templates";
    CREATE POLICY tenant_isolation ON "email_templates"
      FOR ALL
      USING (
        current_setting('app.bypass_rls', true) = 'on'
        OR (
          NULLIF(current_setting('app.current_tenant_id', true), '') IS NOT NULL
          AND "organizationId" = current_setting('app.current_tenant_id', true)
        )
      )
      WITH CHECK (
        current_setting('app.bypass_rls', true) = 'on'
        OR (
          NULLIF(current_setting('app.current_tenant_id', true), '') IS NOT NULL
          AND "organizationId" = current_setting('app.current_tenant_id', true)
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.subscriptions') IS NULL THEN
    RAISE NOTICE 'skip missing table subscriptions';
  ELSE
    ALTER TABLE "subscriptions" ENABLE ROW LEVEL SECURITY;
    ALTER TABLE "subscriptions" FORCE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS tenant_isolation ON "subscriptions";
    DROP POLICY IF EXISTS subscriptions_tenant_isolation ON "subscriptions";
    DROP POLICY IF EXISTS contacts_tenant_isolation ON "subscriptions";
    DROP POLICY IF EXISTS corrections_tenant_isolation ON "subscriptions";
    CREATE POLICY tenant_isolation ON "subscriptions"
      FOR ALL
      USING (
        current_setting('app.bypass_rls', true) = 'on'
        OR (
          NULLIF(current_setting('app.current_tenant_id', true), '') IS NOT NULL
          AND "organizationId" = current_setting('app.current_tenant_id', true)
        )
      )
      WITH CHECK (
        current_setting('app.bypass_rls', true) = 'on'
        OR (
          NULLIF(current_setting('app.current_tenant_id', true), '') IS NOT NULL
          AND "organizationId" = current_setting('app.current_tenant_id', true)
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.sales_objectives') IS NULL THEN
    RAISE NOTICE 'skip missing table sales_objectives';
  ELSE
    ALTER TABLE "sales_objectives" ENABLE ROW LEVEL SECURITY;
    ALTER TABLE "sales_objectives" FORCE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS tenant_isolation ON "sales_objectives";
    DROP POLICY IF EXISTS sales_objectives_tenant_isolation ON "sales_objectives";
    DROP POLICY IF EXISTS contacts_tenant_isolation ON "sales_objectives";
    DROP POLICY IF EXISTS corrections_tenant_isolation ON "sales_objectives";
    CREATE POLICY tenant_isolation ON "sales_objectives"
      FOR ALL
      USING (
        current_setting('app.bypass_rls', true) = 'on'
        OR (
          NULLIF(current_setting('app.current_tenant_id', true), '') IS NOT NULL
          AND "organizationId" = current_setting('app.current_tenant_id', true)
        )
      )
      WITH CHECK (
        current_setting('app.bypass_rls', true) = 'on'
        OR (
          NULLIF(current_setting('app.current_tenant_id', true), '') IS NOT NULL
          AND "organizationId" = current_setting('app.current_tenant_id', true)
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.user_permissions') IS NULL THEN
    RAISE NOTICE 'skip missing table user_permissions';
  ELSE
    ALTER TABLE "user_permissions" ENABLE ROW LEVEL SECURITY;
    ALTER TABLE "user_permissions" FORCE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS tenant_isolation ON "user_permissions";
    DROP POLICY IF EXISTS user_permissions_tenant_isolation ON "user_permissions";
    DROP POLICY IF EXISTS contacts_tenant_isolation ON "user_permissions";
    DROP POLICY IF EXISTS corrections_tenant_isolation ON "user_permissions";
    CREATE POLICY tenant_isolation ON "user_permissions"
      FOR ALL
      USING (
        current_setting('app.bypass_rls', true) = 'on'
        OR (
          NULLIF(current_setting('app.current_tenant_id', true), '') IS NOT NULL
          AND "organizationId" = current_setting('app.current_tenant_id', true)
        )
      )
      WITH CHECK (
        current_setting('app.bypass_rls', true) = 'on'
        OR (
          NULLIF(current_setting('app.current_tenant_id', true), '') IS NOT NULL
          AND "organizationId" = current_setting('app.current_tenant_id', true)
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.commission_configs') IS NULL THEN
    RAISE NOTICE 'skip missing table commission_configs';
  ELSE
    ALTER TABLE "commission_configs" ENABLE ROW LEVEL SECURITY;
    ALTER TABLE "commission_configs" FORCE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS tenant_isolation ON "commission_configs";
    DROP POLICY IF EXISTS commission_configs_tenant_isolation ON "commission_configs";
    DROP POLICY IF EXISTS contacts_tenant_isolation ON "commission_configs";
    DROP POLICY IF EXISTS corrections_tenant_isolation ON "commission_configs";
    CREATE POLICY tenant_isolation ON "commission_configs"
      FOR ALL
      USING (
        current_setting('app.bypass_rls', true) = 'on'
        OR (
          NULLIF(current_setting('app.current_tenant_id', true), '') IS NOT NULL
          AND "organizationId" = current_setting('app.current_tenant_id', true)
        )
      )
      WITH CHECK (
        current_setting('app.bypass_rls', true) = 'on'
        OR (
          NULLIF(current_setting('app.current_tenant_id', true), '') IS NOT NULL
          AND "organizationId" = current_setting('app.current_tenant_id', true)
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.organization_agents') IS NULL THEN
    RAISE NOTICE 'skip missing table organization_agents';
  ELSE
    ALTER TABLE "organization_agents" ENABLE ROW LEVEL SECURITY;
    ALTER TABLE "organization_agents" FORCE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS tenant_isolation ON "organization_agents";
    DROP POLICY IF EXISTS organization_agents_tenant_isolation ON "organization_agents";
    DROP POLICY IF EXISTS contacts_tenant_isolation ON "organization_agents";
    DROP POLICY IF EXISTS corrections_tenant_isolation ON "organization_agents";
    CREATE POLICY tenant_isolation ON "organization_agents"
      FOR ALL
      USING (
        current_setting('app.bypass_rls', true) = 'on'
        OR (
          NULLIF(current_setting('app.current_tenant_id', true), '') IS NOT NULL
          AND "organizationId" = current_setting('app.current_tenant_id', true)
        )
      )
      WITH CHECK (
        current_setting('app.bypass_rls', true) = 'on'
        OR (
          NULLIF(current_setting('app.current_tenant_id', true), '') IS NOT NULL
          AND "organizationId" = current_setting('app.current_tenant_id', true)
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.agent_usage_monthly') IS NULL THEN
    RAISE NOTICE 'skip missing table agent_usage_monthly';
  ELSE
    ALTER TABLE "agent_usage_monthly" ENABLE ROW LEVEL SECURITY;
    ALTER TABLE "agent_usage_monthly" FORCE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS tenant_isolation ON "agent_usage_monthly";
    DROP POLICY IF EXISTS agent_usage_monthly_tenant_isolation ON "agent_usage_monthly";
    DROP POLICY IF EXISTS contacts_tenant_isolation ON "agent_usage_monthly";
    DROP POLICY IF EXISTS corrections_tenant_isolation ON "agent_usage_monthly";
    CREATE POLICY tenant_isolation ON "agent_usage_monthly"
      FOR ALL
      USING (
        current_setting('app.bypass_rls', true) = 'on'
        OR (
          NULLIF(current_setting('app.current_tenant_id', true), '') IS NOT NULL
          AND "organizationId" = current_setting('app.current_tenant_id', true)
        )
      )
      WITH CHECK (
        current_setting('app.bypass_rls', true) = 'on'
        OR (
          NULLIF(current_setting('app.current_tenant_id', true), '') IS NOT NULL
          AND "organizationId" = current_setting('app.current_tenant_id', true)
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.scout_profiles') IS NULL THEN
    RAISE NOTICE 'skip missing table scout_profiles';
  ELSE
    ALTER TABLE "scout_profiles" ENABLE ROW LEVEL SECURITY;
    ALTER TABLE "scout_profiles" FORCE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS tenant_isolation ON "scout_profiles";
    DROP POLICY IF EXISTS scout_profiles_tenant_isolation ON "scout_profiles";
    DROP POLICY IF EXISTS contacts_tenant_isolation ON "scout_profiles";
    DROP POLICY IF EXISTS corrections_tenant_isolation ON "scout_profiles";
    CREATE POLICY tenant_isolation ON "scout_profiles"
      FOR ALL
      USING (
        current_setting('app.bypass_rls', true) = 'on'
        OR (
          NULLIF(current_setting('app.current_tenant_id', true), '') IS NOT NULL
          AND "organizationId" = current_setting('app.current_tenant_id', true)
        )
      )
      WITH CHECK (
        current_setting('app.bypass_rls', true) = 'on'
        OR (
          NULLIF(current_setting('app.current_tenant_id', true), '') IS NOT NULL
          AND "organizationId" = current_setting('app.current_tenant_id', true)
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.scout_opportunities') IS NULL THEN
    RAISE NOTICE 'skip missing table scout_opportunities';
  ELSE
    ALTER TABLE "scout_opportunities" ENABLE ROW LEVEL SECURITY;
    ALTER TABLE "scout_opportunities" FORCE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS tenant_isolation ON "scout_opportunities";
    DROP POLICY IF EXISTS scout_opportunities_tenant_isolation ON "scout_opportunities";
    DROP POLICY IF EXISTS contacts_tenant_isolation ON "scout_opportunities";
    DROP POLICY IF EXISTS corrections_tenant_isolation ON "scout_opportunities";
    CREATE POLICY tenant_isolation ON "scout_opportunities"
      FOR ALL
      USING (
        current_setting('app.bypass_rls', true) = 'on'
        OR (
          NULLIF(current_setting('app.current_tenant_id', true), '') IS NOT NULL
          AND "organizationId" = current_setting('app.current_tenant_id', true)
        )
      )
      WITH CHECK (
        current_setting('app.bypass_rls', true) = 'on'
        OR (
          NULLIF(current_setting('app.current_tenant_id', true), '') IS NOT NULL
          AND "organizationId" = current_setting('app.current_tenant_id', true)
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.brand_profiles') IS NULL THEN
    RAISE NOTICE 'skip missing table brand_profiles';
  ELSE
    ALTER TABLE "brand_profiles" ENABLE ROW LEVEL SECURITY;
    ALTER TABLE "brand_profiles" FORCE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS tenant_isolation ON "brand_profiles";
    DROP POLICY IF EXISTS brand_profiles_tenant_isolation ON "brand_profiles";
    DROP POLICY IF EXISTS contacts_tenant_isolation ON "brand_profiles";
    DROP POLICY IF EXISTS corrections_tenant_isolation ON "brand_profiles";
    CREATE POLICY tenant_isolation ON "brand_profiles"
      FOR ALL
      USING (
        current_setting('app.bypass_rls', true) = 'on'
        OR (
          NULLIF(current_setting('app.current_tenant_id', true), '') IS NOT NULL
          AND "organizationId" = current_setting('app.current_tenant_id', true)
        )
      )
      WITH CHECK (
        current_setting('app.bypass_rls', true) = 'on'
        OR (
          NULLIF(current_setting('app.current_tenant_id', true), '') IS NOT NULL
          AND "organizationId" = current_setting('app.current_tenant_id', true)
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.brand_score_snapshots') IS NULL THEN
    RAISE NOTICE 'skip missing table brand_score_snapshots';
  ELSE
    ALTER TABLE "brand_score_snapshots" ENABLE ROW LEVEL SECURITY;
    ALTER TABLE "brand_score_snapshots" FORCE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS tenant_isolation ON "brand_score_snapshots";
    DROP POLICY IF EXISTS brand_score_snapshots_tenant_isolation ON "brand_score_snapshots";
    DROP POLICY IF EXISTS contacts_tenant_isolation ON "brand_score_snapshots";
    DROP POLICY IF EXISTS corrections_tenant_isolation ON "brand_score_snapshots";
    CREATE POLICY tenant_isolation ON "brand_score_snapshots"
      FOR ALL
      USING (
        current_setting('app.bypass_rls', true) = 'on'
        OR (
          NULLIF(current_setting('app.current_tenant_id', true), '') IS NOT NULL
          AND "organizationId" = current_setting('app.current_tenant_id', true)
        )
      )
      WITH CHECK (
        current_setting('app.bypass_rls', true) = 'on'
        OR (
          NULLIF(current_setting('app.current_tenant_id', true), '') IS NOT NULL
          AND "organizationId" = current_setting('app.current_tenant_id', true)
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.brand_articles') IS NULL THEN
    RAISE NOTICE 'skip missing table brand_articles';
  ELSE
    ALTER TABLE "brand_articles" ENABLE ROW LEVEL SECURITY;
    ALTER TABLE "brand_articles" FORCE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS tenant_isolation ON "brand_articles";
    DROP POLICY IF EXISTS brand_articles_tenant_isolation ON "brand_articles";
    DROP POLICY IF EXISTS contacts_tenant_isolation ON "brand_articles";
    DROP POLICY IF EXISTS corrections_tenant_isolation ON "brand_articles";
    CREATE POLICY tenant_isolation ON "brand_articles"
      FOR ALL
      USING (
        current_setting('app.bypass_rls', true) = 'on'
        OR (
          NULLIF(current_setting('app.current_tenant_id', true), '') IS NOT NULL
          AND "organizationId" = current_setting('app.current_tenant_id', true)
        )
      )
      WITH CHECK (
        current_setting('app.bypass_rls', true) = 'on'
        OR (
          NULLIF(current_setting('app.current_tenant_id', true), '') IS NOT NULL
          AND "organizationId" = current_setting('app.current_tenant_id', true)
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.brand_recommendations') IS NULL THEN
    RAISE NOTICE 'skip missing table brand_recommendations';
  ELSE
    ALTER TABLE "brand_recommendations" ENABLE ROW LEVEL SECURITY;
    ALTER TABLE "brand_recommendations" FORCE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS tenant_isolation ON "brand_recommendations";
    DROP POLICY IF EXISTS brand_recommendations_tenant_isolation ON "brand_recommendations";
    DROP POLICY IF EXISTS contacts_tenant_isolation ON "brand_recommendations";
    DROP POLICY IF EXISTS corrections_tenant_isolation ON "brand_recommendations";
    CREATE POLICY tenant_isolation ON "brand_recommendations"
      FOR ALL
      USING (
        current_setting('app.bypass_rls', true) = 'on'
        OR (
          NULLIF(current_setting('app.current_tenant_id', true), '') IS NOT NULL
          AND "organizationId" = current_setting('app.current_tenant_id', true)
        )
      )
      WITH CHECK (
        current_setting('app.bypass_rls', true) = 'on'
        OR (
          NULLIF(current_setting('app.current_tenant_id', true), '') IS NOT NULL
          AND "organizationId" = current_setting('app.current_tenant_id', true)
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.brand_alerts') IS NULL THEN
    RAISE NOTICE 'skip missing table brand_alerts';
  ELSE
    ALTER TABLE "brand_alerts" ENABLE ROW LEVEL SECURITY;
    ALTER TABLE "brand_alerts" FORCE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS tenant_isolation ON "brand_alerts";
    DROP POLICY IF EXISTS brand_alerts_tenant_isolation ON "brand_alerts";
    DROP POLICY IF EXISTS contacts_tenant_isolation ON "brand_alerts";
    DROP POLICY IF EXISTS corrections_tenant_isolation ON "brand_alerts";
    CREATE POLICY tenant_isolation ON "brand_alerts"
      FOR ALL
      USING (
        current_setting('app.bypass_rls', true) = 'on'
        OR (
          NULLIF(current_setting('app.current_tenant_id', true), '') IS NOT NULL
          AND "organizationId" = current_setting('app.current_tenant_id', true)
        )
      )
      WITH CHECK (
        current_setting('app.bypass_rls', true) = 'on'
        OR (
          NULLIF(current_setting('app.current_tenant_id', true), '') IS NOT NULL
          AND "organizationId" = current_setting('app.current_tenant_id', true)
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.brand_cms_connections') IS NULL THEN
    RAISE NOTICE 'skip missing table brand_cms_connections';
  ELSE
    ALTER TABLE "brand_cms_connections" ENABLE ROW LEVEL SECURITY;
    ALTER TABLE "brand_cms_connections" FORCE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS tenant_isolation ON "brand_cms_connections";
    DROP POLICY IF EXISTS brand_cms_connections_tenant_isolation ON "brand_cms_connections";
    DROP POLICY IF EXISTS contacts_tenant_isolation ON "brand_cms_connections";
    DROP POLICY IF EXISTS corrections_tenant_isolation ON "brand_cms_connections";
    CREATE POLICY tenant_isolation ON "brand_cms_connections"
      FOR ALL
      USING (
        current_setting('app.bypass_rls', true) = 'on'
        OR (
          NULLIF(current_setting('app.current_tenant_id', true), '') IS NOT NULL
          AND "organizationId" = current_setting('app.current_tenant_id', true)
        )
      )
      WITH CHECK (
        current_setting('app.bypass_rls', true) = 'on'
        OR (
          NULLIF(current_setting('app.current_tenant_id', true), '') IS NOT NULL
          AND "organizationId" = current_setting('app.current_tenant_id', true)
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.brand_channel_connections') IS NULL THEN
    RAISE NOTICE 'skip missing table brand_channel_connections';
  ELSE
    ALTER TABLE "brand_channel_connections" ENABLE ROW LEVEL SECURITY;
    ALTER TABLE "brand_channel_connections" FORCE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS tenant_isolation ON "brand_channel_connections";
    DROP POLICY IF EXISTS brand_channel_connections_tenant_isolation ON "brand_channel_connections";
    DROP POLICY IF EXISTS contacts_tenant_isolation ON "brand_channel_connections";
    DROP POLICY IF EXISTS corrections_tenant_isolation ON "brand_channel_connections";
    CREATE POLICY tenant_isolation ON "brand_channel_connections"
      FOR ALL
      USING (
        current_setting('app.bypass_rls', true) = 'on'
        OR (
          NULLIF(current_setting('app.current_tenant_id', true), '') IS NOT NULL
          AND "organizationId" = current_setting('app.current_tenant_id', true)
        )
      )
      WITH CHECK (
        current_setting('app.bypass_rls', true) = 'on'
        OR (
          NULLIF(current_setting('app.current_tenant_id', true), '') IS NOT NULL
          AND "organizationId" = current_setting('app.current_tenant_id', true)
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.brand_competitor_snapshots') IS NULL THEN
    RAISE NOTICE 'skip missing table brand_competitor_snapshots';
  ELSE
    ALTER TABLE "brand_competitor_snapshots" ENABLE ROW LEVEL SECURITY;
    ALTER TABLE "brand_competitor_snapshots" FORCE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS tenant_isolation ON "brand_competitor_snapshots";
    DROP POLICY IF EXISTS brand_competitor_snapshots_tenant_isolation ON "brand_competitor_snapshots";
    DROP POLICY IF EXISTS contacts_tenant_isolation ON "brand_competitor_snapshots";
    DROP POLICY IF EXISTS corrections_tenant_isolation ON "brand_competitor_snapshots";
    CREATE POLICY tenant_isolation ON "brand_competitor_snapshots"
      FOR ALL
      USING (
        current_setting('app.bypass_rls', true) = 'on'
        OR (
          NULLIF(current_setting('app.current_tenant_id', true), '') IS NOT NULL
          AND "organizationId" = current_setting('app.current_tenant_id', true)
        )
      )
      WITH CHECK (
        current_setting('app.bypass_rls', true) = 'on'
        OR (
          NULLIF(current_setting('app.current_tenant_id', true), '') IS NOT NULL
          AND "organizationId" = current_setting('app.current_tenant_id', true)
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.brand_api_keys') IS NULL THEN
    RAISE NOTICE 'skip missing table brand_api_keys';
  ELSE
    ALTER TABLE "brand_api_keys" ENABLE ROW LEVEL SECURITY;
    ALTER TABLE "brand_api_keys" FORCE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS tenant_isolation ON "brand_api_keys";
    DROP POLICY IF EXISTS brand_api_keys_tenant_isolation ON "brand_api_keys";
    DROP POLICY IF EXISTS contacts_tenant_isolation ON "brand_api_keys";
    DROP POLICY IF EXISTS corrections_tenant_isolation ON "brand_api_keys";
    CREATE POLICY tenant_isolation ON "brand_api_keys"
      FOR ALL
      USING (
        current_setting('app.bypass_rls', true) = 'on'
        OR (
          NULLIF(current_setting('app.current_tenant_id', true), '') IS NOT NULL
          AND "organizationId" = current_setting('app.current_tenant_id', true)
        )
      )
      WITH CHECK (
        current_setting('app.bypass_rls', true) = 'on'
        OR (
          NULLIF(current_setting('app.current_tenant_id', true), '') IS NOT NULL
          AND "organizationId" = current_setting('app.current_tenant_id', true)
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.contacts') IS NULL THEN
    RAISE NOTICE 'skip missing table contacts';
  ELSE
    ALTER TABLE "contacts" ENABLE ROW LEVEL SECURITY;
    ALTER TABLE "contacts" FORCE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS tenant_isolation ON "contacts";
    DROP POLICY IF EXISTS contacts_tenant_isolation ON "contacts";
    DROP POLICY IF EXISTS contacts_tenant_isolation ON "contacts";
    DROP POLICY IF EXISTS corrections_tenant_isolation ON "contacts";
    CREATE POLICY tenant_isolation ON "contacts"
      FOR ALL
      USING (
        current_setting('app.bypass_rls', true) = 'on'
        OR (
          NULLIF(current_setting('app.current_tenant_id', true), '') IS NOT NULL
          AND "organizationId" = current_setting('app.current_tenant_id', true)
        )
      )
      WITH CHECK (
        current_setting('app.bypass_rls', true) = 'on'
        OR (
          NULLIF(current_setting('app.current_tenant_id', true), '') IS NOT NULL
          AND "organizationId" = current_setting('app.current_tenant_id', true)
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.fiche_transitions') IS NULL THEN
    RAISE NOTICE 'skip missing table fiche_transitions';
  ELSE
    ALTER TABLE "fiche_transitions" ENABLE ROW LEVEL SECURITY;
    ALTER TABLE "fiche_transitions" FORCE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS tenant_isolation ON "fiche_transitions";
    DROP POLICY IF EXISTS fiche_transitions_tenant_isolation ON "fiche_transitions";
    DROP POLICY IF EXISTS contacts_tenant_isolation ON "fiche_transitions";
    DROP POLICY IF EXISTS corrections_tenant_isolation ON "fiche_transitions";
    CREATE POLICY tenant_isolation ON "fiche_transitions"
      FOR ALL
      USING (
        current_setting('app.bypass_rls', true) = 'on'
        OR (
          NULLIF(current_setting('app.current_tenant_id', true), '') IS NOT NULL
          AND "organizationId" = current_setting('app.current_tenant_id', true)
        )
      )
      WITH CHECK (
        current_setting('app.bypass_rls', true) = 'on'
        OR (
          NULLIF(current_setting('app.current_tenant_id', true), '') IS NOT NULL
          AND "organizationId" = current_setting('app.current_tenant_id', true)
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.referentiel_corrections') IS NULL THEN
    RAISE NOTICE 'skip missing table referentiel_corrections';
  ELSE
    ALTER TABLE "referentiel_corrections" ENABLE ROW LEVEL SECURITY;
    ALTER TABLE "referentiel_corrections" FORCE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS tenant_isolation ON "referentiel_corrections";
    DROP POLICY IF EXISTS referentiel_corrections_tenant_isolation ON "referentiel_corrections";
    DROP POLICY IF EXISTS contacts_tenant_isolation ON "referentiel_corrections";
    DROP POLICY IF EXISTS corrections_tenant_isolation ON "referentiel_corrections";
    CREATE POLICY tenant_isolation ON "referentiel_corrections"
      FOR ALL
      USING (
        current_setting('app.bypass_rls', true) = 'on'
        OR (
          NULLIF(current_setting('app.current_tenant_id', true), '') IS NOT NULL
          AND "organizationId" = current_setting('app.current_tenant_id', true)
        )
      )
      WITH CHECK (
        current_setting('app.bypass_rls', true) = 'on'
        OR (
          NULLIF(current_setting('app.current_tenant_id', true), '') IS NOT NULL
          AND "organizationId" = current_setting('app.current_tenant_id', true)
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.agent_events') IS NULL THEN
    RAISE NOTICE 'skip missing table agent_events';
  ELSE
    ALTER TABLE "agent_events" ENABLE ROW LEVEL SECURITY;
    ALTER TABLE "agent_events" FORCE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS tenant_isolation ON "agent_events";
    DROP POLICY IF EXISTS agent_events_tenant_isolation ON "agent_events";
    DROP POLICY IF EXISTS contacts_tenant_isolation ON "agent_events";
    DROP POLICY IF EXISTS corrections_tenant_isolation ON "agent_events";
    CREATE POLICY tenant_isolation ON "agent_events"
      FOR ALL
      USING (
        current_setting('app.bypass_rls', true) = 'on'
        OR (
          NULLIF(current_setting('app.current_tenant_id', true), '') IS NOT NULL
          AND "organizationId" = current_setting('app.current_tenant_id', true)
        )
      )
      WITH CHECK (
        current_setting('app.bypass_rls', true) = 'on'
        OR (
          NULLIF(current_setting('app.current_tenant_id', true), '') IS NOT NULL
          AND "organizationId" = current_setting('app.current_tenant_id', true)
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.suggestions') IS NULL THEN
    RAISE NOTICE 'skip missing table suggestions';
  ELSE
    ALTER TABLE "suggestions" ENABLE ROW LEVEL SECURITY;
    ALTER TABLE "suggestions" FORCE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS tenant_isolation ON "suggestions";
    DROP POLICY IF EXISTS suggestions_tenant_isolation ON "suggestions";
    DROP POLICY IF EXISTS contacts_tenant_isolation ON "suggestions";
    DROP POLICY IF EXISTS corrections_tenant_isolation ON "suggestions";
    CREATE POLICY tenant_isolation ON "suggestions"
      FOR ALL
      USING (
        current_setting('app.bypass_rls', true) = 'on'
        OR (
          NULLIF(current_setting('app.current_tenant_id', true), '') IS NOT NULL
          AND "organizationId" = current_setting('app.current_tenant_id', true)
        )
      )
      WITH CHECK (
        current_setting('app.bypass_rls', true) = 'on'
        OR (
          NULLIF(current_setting('app.current_tenant_id', true), '') IS NOT NULL
          AND "organizationId" = current_setting('app.current_tenant_id', true)
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.contact_dedup_conflicts') IS NULL THEN
    RAISE NOTICE 'skip missing table contact_dedup_conflicts';
  ELSE
    ALTER TABLE "contact_dedup_conflicts" ENABLE ROW LEVEL SECURITY;
    ALTER TABLE "contact_dedup_conflicts" FORCE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS tenant_isolation ON "contact_dedup_conflicts";
    DROP POLICY IF EXISTS contact_dedup_conflicts_tenant_isolation ON "contact_dedup_conflicts";
    DROP POLICY IF EXISTS contacts_tenant_isolation ON "contact_dedup_conflicts";
    DROP POLICY IF EXISTS corrections_tenant_isolation ON "contact_dedup_conflicts";
    CREATE POLICY tenant_isolation ON "contact_dedup_conflicts"
      FOR ALL
      USING (
        current_setting('app.bypass_rls', true) = 'on'
        OR (
          NULLIF(current_setting('app.current_tenant_id', true), '') IS NOT NULL
          AND "organizationId" = current_setting('app.current_tenant_id', true)
        )
      )
      WITH CHECK (
        current_setting('app.bypass_rls', true) = 'on'
        OR (
          NULLIF(current_setting('app.current_tenant_id', true), '') IS NOT NULL
          AND "organizationId" = current_setting('app.current_tenant_id', true)
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.copilot_org_configs') IS NULL THEN
    RAISE NOTICE 'skip missing table copilot_org_configs';
  ELSE
    ALTER TABLE "copilot_org_configs" ENABLE ROW LEVEL SECURITY;
    ALTER TABLE "copilot_org_configs" FORCE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS tenant_isolation ON "copilot_org_configs";
    DROP POLICY IF EXISTS copilot_org_configs_tenant_isolation ON "copilot_org_configs";
    DROP POLICY IF EXISTS contacts_tenant_isolation ON "copilot_org_configs";
    DROP POLICY IF EXISTS corrections_tenant_isolation ON "copilot_org_configs";
    CREATE POLICY tenant_isolation ON "copilot_org_configs"
      FOR ALL
      USING (
        current_setting('app.bypass_rls', true) = 'on'
        OR (
          NULLIF(current_setting('app.current_tenant_id', true), '') IS NOT NULL
          AND "organizationId" = current_setting('app.current_tenant_id', true)
        )
      )
      WITH CHECK (
        current_setting('app.bypass_rls', true) = 'on'
        OR (
          NULLIF(current_setting('app.current_tenant_id', true), '') IS NOT NULL
          AND "organizationId" = current_setting('app.current_tenant_id', true)
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.copilot_messages') IS NULL THEN
    RAISE NOTICE 'skip missing table copilot_messages';
  ELSE
    ALTER TABLE "copilot_messages" ENABLE ROW LEVEL SECURITY;
    ALTER TABLE "copilot_messages" FORCE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS tenant_isolation ON "copilot_messages";
    DROP POLICY IF EXISTS copilot_messages_tenant_isolation ON "copilot_messages";
    DROP POLICY IF EXISTS contacts_tenant_isolation ON "copilot_messages";
    DROP POLICY IF EXISTS corrections_tenant_isolation ON "copilot_messages";
    CREATE POLICY tenant_isolation ON "copilot_messages"
      FOR ALL
      USING (
        current_setting('app.bypass_rls', true) = 'on'
        OR (
          NULLIF(current_setting('app.current_tenant_id', true), '') IS NOT NULL
          AND "organizationId" = current_setting('app.current_tenant_id', true)
        )
      )
      WITH CHECK (
        current_setting('app.bypass_rls', true) = 'on'
        OR (
          NULLIF(current_setting('app.current_tenant_id', true), '') IS NOT NULL
          AND "organizationId" = current_setting('app.current_tenant_id', true)
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.whatsapp_session_buffers') IS NULL THEN
    RAISE NOTICE 'skip missing table whatsapp_session_buffers';
  ELSE
    ALTER TABLE "whatsapp_session_buffers" ENABLE ROW LEVEL SECURITY;
    ALTER TABLE "whatsapp_session_buffers" FORCE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS tenant_isolation ON "whatsapp_session_buffers";
    DROP POLICY IF EXISTS whatsapp_session_buffers_tenant_isolation ON "whatsapp_session_buffers";
    DROP POLICY IF EXISTS contacts_tenant_isolation ON "whatsapp_session_buffers";
    DROP POLICY IF EXISTS corrections_tenant_isolation ON "whatsapp_session_buffers";
    CREATE POLICY tenant_isolation ON "whatsapp_session_buffers"
      FOR ALL
      USING (
        current_setting('app.bypass_rls', true) = 'on'
        OR (
          NULLIF(current_setting('app.current_tenant_id', true), '') IS NOT NULL
          AND "organizationId" = current_setting('app.current_tenant_id', true)
        )
      )
      WITH CHECK (
        current_setting('app.bypass_rls', true) = 'on'
        OR (
          NULLIF(current_setting('app.current_tenant_id', true), '') IS NOT NULL
          AND "organizationId" = current_setting('app.current_tenant_id', true)
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.outbound_webhook_configs') IS NULL THEN
    RAISE NOTICE 'skip missing table outbound_webhook_configs';
  ELSE
    ALTER TABLE "outbound_webhook_configs" ENABLE ROW LEVEL SECURITY;
    ALTER TABLE "outbound_webhook_configs" FORCE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS tenant_isolation ON "outbound_webhook_configs";
    DROP POLICY IF EXISTS outbound_webhook_configs_tenant_isolation ON "outbound_webhook_configs";
    DROP POLICY IF EXISTS contacts_tenant_isolation ON "outbound_webhook_configs";
    DROP POLICY IF EXISTS corrections_tenant_isolation ON "outbound_webhook_configs";
    CREATE POLICY tenant_isolation ON "outbound_webhook_configs"
      FOR ALL
      USING (
        current_setting('app.bypass_rls', true) = 'on'
        OR (
          NULLIF(current_setting('app.current_tenant_id', true), '') IS NOT NULL
          AND "organizationId" = current_setting('app.current_tenant_id', true)
        )
      )
      WITH CHECK (
        current_setting('app.bypass_rls', true) = 'on'
        OR (
          NULLIF(current_setting('app.current_tenant_id', true), '') IS NOT NULL
          AND "organizationId" = current_setting('app.current_tenant_id', true)
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.webhook_delivery_logs') IS NULL THEN
    RAISE NOTICE 'skip missing table webhook_delivery_logs';
  ELSE
    ALTER TABLE "webhook_delivery_logs" ENABLE ROW LEVEL SECURITY;
    ALTER TABLE "webhook_delivery_logs" FORCE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS tenant_isolation ON "webhook_delivery_logs";
    DROP POLICY IF EXISTS webhook_delivery_logs_tenant_isolation ON "webhook_delivery_logs";
    DROP POLICY IF EXISTS contacts_tenant_isolation ON "webhook_delivery_logs";
    DROP POLICY IF EXISTS corrections_tenant_isolation ON "webhook_delivery_logs";
    CREATE POLICY tenant_isolation ON "webhook_delivery_logs"
      FOR ALL
      USING (
        current_setting('app.bypass_rls', true) = 'on'
        OR (
          NULLIF(current_setting('app.current_tenant_id', true), '') IS NOT NULL
          AND "organizationId" = current_setting('app.current_tenant_id', true)
        )
      )
      WITH CHECK (
        current_setting('app.bypass_rls', true) = 'on'
        OR (
          NULLIF(current_setting('app.current_tenant_id', true), '') IS NOT NULL
          AND "organizationId" = current_setting('app.current_tenant_id', true)
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.billing_subscriptions') IS NULL THEN
    RAISE NOTICE 'skip missing table billing_subscriptions';
  ELSE
    ALTER TABLE "billing_subscriptions" ENABLE ROW LEVEL SECURITY;
    ALTER TABLE "billing_subscriptions" FORCE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS tenant_isolation ON "billing_subscriptions";
    DROP POLICY IF EXISTS billing_subscriptions_tenant_isolation ON "billing_subscriptions";
    DROP POLICY IF EXISTS contacts_tenant_isolation ON "billing_subscriptions";
    DROP POLICY IF EXISTS corrections_tenant_isolation ON "billing_subscriptions";
    CREATE POLICY tenant_isolation ON "billing_subscriptions"
      FOR ALL
      USING (
        current_setting('app.bypass_rls', true) = 'on'
        OR (
          NULLIF(current_setting('app.current_tenant_id', true), '') IS NOT NULL
          AND "organizationId" = current_setting('app.current_tenant_id', true)
        )
      )
      WITH CHECK (
        current_setting('app.bypass_rls', true) = 'on'
        OR (
          NULLIF(current_setting('app.current_tenant_id', true), '') IS NOT NULL
          AND "organizationId" = current_setting('app.current_tenant_id', true)
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.usage_quotas') IS NULL THEN
    RAISE NOTICE 'skip missing table usage_quotas';
  ELSE
    ALTER TABLE "usage_quotas" ENABLE ROW LEVEL SECURITY;
    ALTER TABLE "usage_quotas" FORCE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS tenant_isolation ON "usage_quotas";
    DROP POLICY IF EXISTS usage_quotas_tenant_isolation ON "usage_quotas";
    DROP POLICY IF EXISTS contacts_tenant_isolation ON "usage_quotas";
    DROP POLICY IF EXISTS corrections_tenant_isolation ON "usage_quotas";
    CREATE POLICY tenant_isolation ON "usage_quotas"
      FOR ALL
      USING (
        current_setting('app.bypass_rls', true) = 'on'
        OR (
          NULLIF(current_setting('app.current_tenant_id', true), '') IS NOT NULL
          AND "organizationId" = current_setting('app.current_tenant_id', true)
        )
      )
      WITH CHECK (
        current_setting('app.bypass_rls', true) = 'on'
        OR (
          NULLIF(current_setting('app.current_tenant_id', true), '') IS NOT NULL
          AND "organizationId" = current_setting('app.current_tenant_id', true)
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.llm_usage_logs') IS NULL THEN
    RAISE NOTICE 'skip missing table llm_usage_logs';
  ELSE
    ALTER TABLE "llm_usage_logs" ENABLE ROW LEVEL SECURITY;
    ALTER TABLE "llm_usage_logs" FORCE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS tenant_isolation ON "llm_usage_logs";
    DROP POLICY IF EXISTS llm_usage_logs_tenant_isolation ON "llm_usage_logs";
    DROP POLICY IF EXISTS contacts_tenant_isolation ON "llm_usage_logs";
    DROP POLICY IF EXISTS corrections_tenant_isolation ON "llm_usage_logs";
    CREATE POLICY tenant_isolation ON "llm_usage_logs"
      FOR ALL
      USING (
        current_setting('app.bypass_rls', true) = 'on'
        OR (
          NULLIF(current_setting('app.current_tenant_id', true), '') IS NOT NULL
          AND "organizationId" = current_setting('app.current_tenant_id', true)
        )
      )
      WITH CHECK (
        current_setting('app.bypass_rls', true) = 'on'
        OR (
          NULLIF(current_setting('app.current_tenant_id', true), '') IS NOT NULL
          AND "organizationId" = current_setting('app.current_tenant_id', true)
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.org_targeting_profiles') IS NULL THEN
    RAISE NOTICE 'skip missing table org_targeting_profiles';
  ELSE
    ALTER TABLE "org_targeting_profiles" ENABLE ROW LEVEL SECURITY;
    ALTER TABLE "org_targeting_profiles" FORCE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS tenant_isolation ON "org_targeting_profiles";
    DROP POLICY IF EXISTS org_targeting_profiles_tenant_isolation ON "org_targeting_profiles";
    DROP POLICY IF EXISTS contacts_tenant_isolation ON "org_targeting_profiles";
    DROP POLICY IF EXISTS corrections_tenant_isolation ON "org_targeting_profiles";
    CREATE POLICY tenant_isolation ON "org_targeting_profiles"
      FOR ALL
      USING (
        current_setting('app.bypass_rls', true) = 'on'
        OR (
          NULLIF(current_setting('app.current_tenant_id', true), '') IS NOT NULL
          AND "organizationId" = current_setting('app.current_tenant_id', true)
        )
      )
      WITH CHECK (
        current_setting('app.bypass_rls', true) = 'on'
        OR (
          NULLIF(current_setting('app.current_tenant_id', true), '') IS NOT NULL
          AND "organizationId" = current_setting('app.current_tenant_id', true)
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.agent_tasks') IS NULL THEN
    RAISE NOTICE 'skip missing table agent_tasks';
  ELSE
    ALTER TABLE "agent_tasks" ENABLE ROW LEVEL SECURITY;
    ALTER TABLE "agent_tasks" FORCE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS tenant_isolation ON "agent_tasks";
    DROP POLICY IF EXISTS agent_tasks_tenant_isolation ON "agent_tasks";
    DROP POLICY IF EXISTS contacts_tenant_isolation ON "agent_tasks";
    DROP POLICY IF EXISTS corrections_tenant_isolation ON "agent_tasks";
    CREATE POLICY tenant_isolation ON "agent_tasks"
      FOR ALL
      USING (
        current_setting('app.bypass_rls', true) = 'on'
        OR (
          NULLIF(current_setting('app.current_tenant_id', true), '') IS NOT NULL
          AND "organizationId" = current_setting('app.current_tenant_id', true)
        )
      )
      WITH CHECK (
        current_setting('app.bypass_rls', true) = 'on'
        OR (
          NULLIF(current_setting('app.current_tenant_id', true), '') IS NOT NULL
          AND "organizationId" = current_setting('app.current_tenant_id', true)
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.connect_prospects') IS NULL THEN
    RAISE NOTICE 'skip missing table connect_prospects';
  ELSE
    ALTER TABLE "connect_prospects" ENABLE ROW LEVEL SECURITY;
    ALTER TABLE "connect_prospects" FORCE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS tenant_isolation ON "connect_prospects";
    DROP POLICY IF EXISTS connect_prospects_tenant_isolation ON "connect_prospects";
    DROP POLICY IF EXISTS contacts_tenant_isolation ON "connect_prospects";
    DROP POLICY IF EXISTS corrections_tenant_isolation ON "connect_prospects";
    CREATE POLICY tenant_isolation ON "connect_prospects"
      FOR ALL
      USING (
        current_setting('app.bypass_rls', true) = 'on'
        OR (
          NULLIF(current_setting('app.current_tenant_id', true), '') IS NOT NULL
          AND "organizationId" = current_setting('app.current_tenant_id', true)
        )
      )
      WITH CHECK (
        current_setting('app.bypass_rls', true) = 'on'
        OR (
          NULLIF(current_setting('app.current_tenant_id', true), '') IS NOT NULL
          AND "organizationId" = current_setting('app.current_tenant_id', true)
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.connect_generated_messages') IS NULL THEN
    RAISE NOTICE 'skip missing table connect_generated_messages';
  ELSE
    ALTER TABLE "connect_generated_messages" ENABLE ROW LEVEL SECURITY;
    ALTER TABLE "connect_generated_messages" FORCE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS tenant_isolation ON "connect_generated_messages";
    DROP POLICY IF EXISTS connect_generated_messages_tenant_isolation ON "connect_generated_messages";
    DROP POLICY IF EXISTS contacts_tenant_isolation ON "connect_generated_messages";
    DROP POLICY IF EXISTS corrections_tenant_isolation ON "connect_generated_messages";
    CREATE POLICY tenant_isolation ON "connect_generated_messages"
      FOR ALL
      USING (
        current_setting('app.bypass_rls', true) = 'on'
        OR (
          NULLIF(current_setting('app.current_tenant_id', true), '') IS NOT NULL
          AND "organizationId" = current_setting('app.current_tenant_id', true)
        )
      )
      WITH CHECK (
        current_setting('app.bypass_rls', true) = 'on'
        OR (
          NULLIF(current_setting('app.current_tenant_id', true), '') IS NOT NULL
          AND "organizationId" = current_setting('app.current_tenant_id', true)
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.connect_extension_sessions') IS NULL THEN
    RAISE NOTICE 'skip missing table connect_extension_sessions';
  ELSE
    ALTER TABLE "connect_extension_sessions" ENABLE ROW LEVEL SECURITY;
    ALTER TABLE "connect_extension_sessions" FORCE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS tenant_isolation ON "connect_extension_sessions";
    DROP POLICY IF EXISTS connect_extension_sessions_tenant_isolation ON "connect_extension_sessions";
    DROP POLICY IF EXISTS contacts_tenant_isolation ON "connect_extension_sessions";
    DROP POLICY IF EXISTS corrections_tenant_isolation ON "connect_extension_sessions";
    CREATE POLICY tenant_isolation ON "connect_extension_sessions"
      FOR ALL
      USING (
        current_setting('app.bypass_rls', true) = 'on'
        OR (
          NULLIF(current_setting('app.current_tenant_id', true), '') IS NOT NULL
          AND "organizationId" = current_setting('app.current_tenant_id', true)
        )
      )
      WITH CHECK (
        current_setting('app.bypass_rls', true) = 'on'
        OR (
          NULLIF(current_setting('app.current_tenant_id', true), '') IS NOT NULL
          AND "organizationId" = current_setting('app.current_tenant_id', true)
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.connect_analytics_events') IS NULL THEN
    RAISE NOTICE 'skip missing table connect_analytics_events';
  ELSE
    ALTER TABLE "connect_analytics_events" ENABLE ROW LEVEL SECURITY;
    ALTER TABLE "connect_analytics_events" FORCE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS tenant_isolation ON "connect_analytics_events";
    DROP POLICY IF EXISTS connect_analytics_events_tenant_isolation ON "connect_analytics_events";
    DROP POLICY IF EXISTS contacts_tenant_isolation ON "connect_analytics_events";
    DROP POLICY IF EXISTS corrections_tenant_isolation ON "connect_analytics_events";
    CREATE POLICY tenant_isolation ON "connect_analytics_events"
      FOR ALL
      USING (
        current_setting('app.bypass_rls', true) = 'on'
        OR (
          NULLIF(current_setting('app.current_tenant_id', true), '') IS NOT NULL
          AND "organizationId" = current_setting('app.current_tenant_id', true)
        )
      )
      WITH CHECK (
        current_setting('app.bypass_rls', true) = 'on'
        OR (
          NULLIF(current_setting('app.current_tenant_id', true), '') IS NOT NULL
          AND "organizationId" = current_setting('app.current_tenant_id', true)
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.connect_org_settings') IS NULL THEN
    RAISE NOTICE 'skip missing table connect_org_settings';
  ELSE
    ALTER TABLE "connect_org_settings" ENABLE ROW LEVEL SECURITY;
    ALTER TABLE "connect_org_settings" FORCE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS tenant_isolation ON "connect_org_settings";
    DROP POLICY IF EXISTS connect_org_settings_tenant_isolation ON "connect_org_settings";
    DROP POLICY IF EXISTS contacts_tenant_isolation ON "connect_org_settings";
    DROP POLICY IF EXISTS corrections_tenant_isolation ON "connect_org_settings";
    CREATE POLICY tenant_isolation ON "connect_org_settings"
      FOR ALL
      USING (
        current_setting('app.bypass_rls', true) = 'on'
        OR (
          NULLIF(current_setting('app.current_tenant_id', true), '') IS NOT NULL
          AND "organizationId" = current_setting('app.current_tenant_id', true)
        )
      )
      WITH CHECK (
        current_setting('app.bypass_rls', true) = 'on'
        OR (
          NULLIF(current_setting('app.current_tenant_id', true), '') IS NOT NULL
          AND "organizationId" = current_setting('app.current_tenant_id', true)
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.connect_conversations') IS NULL THEN
    RAISE NOTICE 'skip missing table connect_conversations';
  ELSE
    ALTER TABLE "connect_conversations" ENABLE ROW LEVEL SECURITY;
    ALTER TABLE "connect_conversations" FORCE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS tenant_isolation ON "connect_conversations";
    DROP POLICY IF EXISTS connect_conversations_tenant_isolation ON "connect_conversations";
    DROP POLICY IF EXISTS contacts_tenant_isolation ON "connect_conversations";
    DROP POLICY IF EXISTS corrections_tenant_isolation ON "connect_conversations";
    CREATE POLICY tenant_isolation ON "connect_conversations"
      FOR ALL
      USING (
        current_setting('app.bypass_rls', true) = 'on'
        OR (
          NULLIF(current_setting('app.current_tenant_id', true), '') IS NOT NULL
          AND "organizationId" = current_setting('app.current_tenant_id', true)
        )
      )
      WITH CHECK (
        current_setting('app.bypass_rls', true) = 'on'
        OR (
          NULLIF(current_setting('app.current_tenant_id', true), '') IS NOT NULL
          AND "organizationId" = current_setting('app.current_tenant_id', true)
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.connect_extension_auth_codes') IS NULL THEN
    RAISE NOTICE 'skip missing table connect_extension_auth_codes';
  ELSE
    ALTER TABLE "connect_extension_auth_codes" ENABLE ROW LEVEL SECURITY;
    ALTER TABLE "connect_extension_auth_codes" FORCE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS tenant_isolation ON "connect_extension_auth_codes";
    DROP POLICY IF EXISTS connect_extension_auth_codes_tenant_isolation ON "connect_extension_auth_codes";
    DROP POLICY IF EXISTS contacts_tenant_isolation ON "connect_extension_auth_codes";
    DROP POLICY IF EXISTS corrections_tenant_isolation ON "connect_extension_auth_codes";
    CREATE POLICY tenant_isolation ON "connect_extension_auth_codes"
      FOR ALL
      USING (
        current_setting('app.bypass_rls', true) = 'on'
        OR (
          NULLIF(current_setting('app.current_tenant_id', true), '') IS NOT NULL
          AND "organizationId" = current_setting('app.current_tenant_id', true)
        )
      )
      WITH CHECK (
        current_setting('app.bypass_rls', true) = 'on'
        OR (
          NULLIF(current_setting('app.current_tenant_id', true), '') IS NOT NULL
          AND "organizationId" = current_setting('app.current_tenant_id', true)
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.connect_knowledge_sources') IS NULL THEN
    RAISE NOTICE 'skip missing table connect_knowledge_sources';
  ELSE
    ALTER TABLE "connect_knowledge_sources" ENABLE ROW LEVEL SECURITY;
    ALTER TABLE "connect_knowledge_sources" FORCE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS tenant_isolation ON "connect_knowledge_sources";
    DROP POLICY IF EXISTS connect_knowledge_sources_tenant_isolation ON "connect_knowledge_sources";
    DROP POLICY IF EXISTS contacts_tenant_isolation ON "connect_knowledge_sources";
    DROP POLICY IF EXISTS corrections_tenant_isolation ON "connect_knowledge_sources";
    CREATE POLICY tenant_isolation ON "connect_knowledge_sources"
      FOR ALL
      USING (
        current_setting('app.bypass_rls', true) = 'on'
        OR (
          NULLIF(current_setting('app.current_tenant_id', true), '') IS NOT NULL
          AND "organizationId" = current_setting('app.current_tenant_id', true)
        )
      )
      WITH CHECK (
        current_setting('app.bypass_rls', true) = 'on'
        OR (
          NULLIF(current_setting('app.current_tenant_id', true), '') IS NOT NULL
          AND "organizationId" = current_setting('app.current_tenant_id', true)
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.connect_knowledge_chunks') IS NULL THEN
    RAISE NOTICE 'skip missing table connect_knowledge_chunks';
  ELSE
    ALTER TABLE "connect_knowledge_chunks" ENABLE ROW LEVEL SECURITY;
    ALTER TABLE "connect_knowledge_chunks" FORCE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS tenant_isolation ON "connect_knowledge_chunks";
    DROP POLICY IF EXISTS connect_knowledge_chunks_tenant_isolation ON "connect_knowledge_chunks";
    DROP POLICY IF EXISTS contacts_tenant_isolation ON "connect_knowledge_chunks";
    DROP POLICY IF EXISTS corrections_tenant_isolation ON "connect_knowledge_chunks";
    CREATE POLICY tenant_isolation ON "connect_knowledge_chunks"
      FOR ALL
      USING (
        current_setting('app.bypass_rls', true) = 'on'
        OR (
          NULLIF(current_setting('app.current_tenant_id', true), '') IS NOT NULL
          AND "organizationId" = current_setting('app.current_tenant_id', true)
        )
      )
      WITH CHECK (
        current_setting('app.bypass_rls', true) = 'on'
        OR (
          NULLIF(current_setting('app.current_tenant_id', true), '') IS NOT NULL
          AND "organizationId" = current_setting('app.current_tenant_id', true)
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.connect_prompt_templates') IS NULL THEN
    RAISE NOTICE 'skip missing table connect_prompt_templates';
  ELSE
    ALTER TABLE "connect_prompt_templates" ENABLE ROW LEVEL SECURITY;
    ALTER TABLE "connect_prompt_templates" FORCE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS tenant_isolation ON "connect_prompt_templates";
    CREATE POLICY tenant_isolation ON "connect_prompt_templates"
      FOR ALL
      USING (
        current_setting('app.bypass_rls', true) = 'on'
        OR "organizationId" IS NULL
        OR (
          NULLIF(current_setting('app.current_tenant_id', true), '') IS NOT NULL
          AND "organizationId" = current_setting('app.current_tenant_id', true)
        )
      )
      WITH CHECK (
        current_setting('app.bypass_rls', true) = 'on'
        OR (
          NULLIF(current_setting('app.current_tenant_id', true), '') IS NOT NULL
          AND "organizationId" = current_setting('app.current_tenant_id', true)
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.connect_commercial_products') IS NULL THEN
    RAISE NOTICE 'skip missing table connect_commercial_products';
  ELSE
    ALTER TABLE "connect_commercial_products" ENABLE ROW LEVEL SECURITY;
    ALTER TABLE "connect_commercial_products" FORCE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS tenant_isolation ON "connect_commercial_products";
    CREATE POLICY tenant_isolation ON "connect_commercial_products"
      FOR ALL
      USING (
        current_setting('app.bypass_rls', true) = 'on'
        OR "organizationId" IS NULL
        OR (
          NULLIF(current_setting('app.current_tenant_id', true), '') IS NOT NULL
          AND "organizationId" = current_setting('app.current_tenant_id', true)
        )
      )
      WITH CHECK (
        current_setting('app.bypass_rls', true) = 'on'
        OR (
          NULLIF(current_setting('app.current_tenant_id', true), '') IS NOT NULL
          AND "organizationId" = current_setting('app.current_tenant_id', true)
        )
      );
  END IF;
END $$;

-- Historique Connect (pas d'organizationId) — isolation via prospect parent
DO $$ BEGIN
  IF to_regclass('public.connect_prospect_history') IS NOT NULL THEN
    ALTER TABLE "connect_prospect_history" ENABLE ROW LEVEL SECURITY;
    ALTER TABLE "connect_prospect_history" FORCE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS tenant_isolation ON "connect_prospect_history";
    CREATE POLICY tenant_isolation ON "connect_prospect_history"
      FOR ALL
      USING (
        current_setting('app.bypass_rls', true) = 'on'
        OR EXISTS (
          SELECT 1 FROM "connect_prospects" p
          WHERE p.id = "connect_prospect_history"."prospectId"
            AND NULLIF(current_setting('app.current_tenant_id', true), '') IS NOT NULL
            AND p."organizationId" = current_setting('app.current_tenant_id', true)
        )
      )
      WITH CHECK (
        current_setting('app.bypass_rls', true) = 'on'
        OR EXISTS (
          SELECT 1 FROM "connect_prospects" p
          WHERE p.id = "connect_prospect_history"."prospectId"
            AND NULLIF(current_setting('app.current_tenant_id', true), '') IS NOT NULL
            AND p."organizationId" = current_setting('app.current_tenant_id', true)
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.connect_conversation_events') IS NOT NULL THEN
    ALTER TABLE "connect_conversation_events" ENABLE ROW LEVEL SECURITY;
    ALTER TABLE "connect_conversation_events" FORCE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS tenant_isolation ON "connect_conversation_events";
    CREATE POLICY tenant_isolation ON "connect_conversation_events"
      FOR ALL
      USING (
        current_setting('app.bypass_rls', true) = 'on'
        OR EXISTS (
          SELECT 1 FROM "connect_conversations" c
          WHERE c.id = "connect_conversation_events"."conversationId"
            AND NULLIF(current_setting('app.current_tenant_id', true), '') IS NOT NULL
            AND c."organizationId" = current_setting('app.current_tenant_id', true)
        )
      )
      WITH CHECK (
        current_setting('app.bypass_rls', true) = 'on'
        OR EXISTS (
          SELECT 1 FROM "connect_conversations" c
          WHERE c.id = "connect_conversation_events"."conversationId"
            AND NULLIF(current_setting('app.current_tenant_id', true), '') IS NOT NULL
            AND c."organizationId" = current_setting('app.current_tenant_id', true)
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.connect_message_versions') IS NOT NULL THEN
    ALTER TABLE "connect_message_versions" ENABLE ROW LEVEL SECURITY;
    ALTER TABLE "connect_message_versions" FORCE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS tenant_isolation ON "connect_message_versions";
    CREATE POLICY tenant_isolation ON "connect_message_versions"
      FOR ALL
      USING (
        current_setting('app.bypass_rls', true) = 'on'
        OR EXISTS (
          SELECT 1 FROM "connect_generated_messages" m
          WHERE m.id = "connect_message_versions"."messageId"
            AND NULLIF(current_setting('app.current_tenant_id', true), '') IS NOT NULL
            AND m."organizationId" = current_setting('app.current_tenant_id', true)
        )
      )
      WITH CHECK (
        current_setting('app.bypass_rls', true) = 'on'
        OR EXISTS (
          SELECT 1 FROM "connect_generated_messages" m
          WHERE m.id = "connect_message_versions"."messageId"
            AND NULLIF(current_setting('app.current_tenant_id', true), '') IS NOT NULL
            AND m."organizationId" = current_setting('app.current_tenant_id', true)
        )
      );
  END IF;
END $$;

-- Référentiel partagé : lecture OK pour tous les tenants authentifiés ; écriture via bypass / service
DO $$ BEGIN
  IF to_regclass('public.entreprises_referentiel') IS NOT NULL THEN
    ALTER TABLE "entreprises_referentiel" ENABLE ROW LEVEL SECURITY;
    ALTER TABLE "entreprises_referentiel" FORCE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS referentiel_read_authenticated ON "entreprises_referentiel";
    DROP POLICY IF EXISTS referentiel_write_bypass ON "entreprises_referentiel";
    CREATE POLICY referentiel_read_authenticated ON "entreprises_referentiel"
      FOR SELECT
      USING (
        current_setting('app.bypass_rls', true) = 'on'
        OR NULLIF(current_setting('app.current_tenant_id', true), '') IS NOT NULL
      );
    CREATE POLICY referentiel_write_bypass ON "entreprises_referentiel"
      FOR INSERT
      WITH CHECK (current_setting('app.bypass_rls', true) = 'on' OR NULLIF(current_setting('app.current_tenant_id', true), '') IS NOT NULL);
    CREATE POLICY referentiel_update_bypass ON "entreprises_referentiel"
      FOR UPDATE
      USING (current_setting('app.bypass_rls', true) = 'on' OR NULLIF(current_setting('app.current_tenant_id', true), '') IS NOT NULL)
      WITH CHECK (current_setting('app.bypass_rls', true) = 'on' OR NULLIF(current_setting('app.current_tenant_id', true), '') IS NOT NULL);
    CREATE POLICY referentiel_delete_bypass ON "entreprises_referentiel"
      FOR DELETE
      USING (current_setting('app.bypass_rls', true) = 'on');
  END IF;
END $$;

SELECT set_config('app.bypass_rls', 'off', false);
SELECT set_config('app.current_tenant_id', '', false);
