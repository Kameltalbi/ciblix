-- =============================================================================
-- PURGE COMPLÈTE des données entreprises (tous tenants)
-- Contexte : fuite cross-tenant — reprise à zéro des dossiers / recherches.
-- CONSERVE : organizations, users, mon offre (org_targeting_profiles), settings.
-- À exécuter UNE FOIS en prod (avec backup recommandé).
-- =============================================================================

BEGIN;

SELECT set_config('app.bypass_rls', 'on', true);

-- Enfants / liens d’abord
TRUNCATE TABLE
  "connect_prospect_history",
  "connect_message_versions",
  "connect_conversation_events",
  "connect_generated_messages",
  "connect_conversations",
  "connect_prospects",
  "suggestions",
  "copilot_messages",
  "whatsapp_session_buffers",
  "contact_dedup_conflicts",
  "fiche_transitions",
  "agent_events",
  "agent_tasks",
  "ai_prospect_activities",
  "scout_opportunities",
  "referentiel_corrections",
  "referentiel_dedup_reviews",
  "contacts",
  "ai_prospects"
RESTART IDENTITY CASCADE;

-- Référentiel mutualisé pollué par les Hunt
TRUNCATE TABLE "entreprises_referentiel" RESTART IDENTITY CASCADE;

-- Caches prospection (résultats de recherche)
TRUNCATE TABLE
  "prospecting_search_cache",
  "prospecting_website_cache"
RESTART IDENTITY CASCADE;

SELECT set_config('app.bypass_rls', 'off', true);

COMMIT;

-- Vérification rapide
SELECT
  (SELECT COUNT(*) FROM contacts) AS contacts,
  (SELECT COUNT(*) FROM ai_prospects) AS ai_prospects,
  (SELECT COUNT(*) FROM entreprises_referentiel) AS referentiel,
  (SELECT COUNT(*) FROM agent_tasks) AS agent_tasks,
  (SELECT COUNT(*) FROM scout_opportunities) AS scout;
