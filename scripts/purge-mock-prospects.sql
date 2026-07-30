-- Purge prospects fictifs (mock / .example.com) créés par le fallback démo.
SELECT set_config('app.bypass_rls', 'on', false);

UPDATE ai_prospects
SET "deletedAt" = NOW()
WHERE "deletedAt" IS NULL
  AND (
    "rawProvider" ILIKE 'mock:%'
    OR website ILIKE '%.example.com%'
    OR email ILIKE '%.example.com%'
    OR "companyName" ~ '—.*#\d+'
  );

DELETE FROM prospecting_search_cache
WHERE "providerUsed" IN ('mock', 'mock_fallback')
   OR payload::text ILIKE '%.example.com%';

-- Contacts issus du mock (nom = critères collés / site example)
UPDATE contacts
SET "erasedAt" = NOW()
WHERE "erasedAt" IS NULL
  AND (
    email ILIKE '%.example.com%'
    OR "companyName" ILIKE '%Carbone, ESG%'
    OR name ILIKE '%Carbone, ESG%'
  );

SELECT set_config('app.bypass_rls', 'off', false);
