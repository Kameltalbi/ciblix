-- Isolation multi-tenant : purger les téléphones/emails Hunt stockés dans le référentiel partagé.
-- Ces coords pouvaient être redistribuées aux autres organisations via FIND_COMPANIES.
UPDATE "entreprises_referentiel"
SET "telephoneStandard" = NULL
WHERE "telephoneStandard" IS NOT NULL;

UPDATE "entreprises_referentiel"
SET "emailGenerique" = NULL
WHERE "emailGenerique" IS NOT NULL
  AND LOWER(SPLIT_PART("emailGenerique", '@', 1)) NOT IN (
    'contact', 'info', 'hello', 'accueil', 'admin', 'office', 'commercial', 'sales', 'support'
  );
