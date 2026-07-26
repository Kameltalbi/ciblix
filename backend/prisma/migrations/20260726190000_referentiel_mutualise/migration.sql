-- Référentiel mutualisé + lien Contact + RLS couche 2

CREATE TYPE "EntrepriseStatutActivite" AS ENUM ('ACTIVE', 'CESSEE', 'EN_LIQUIDATION', 'INCONNUE');
CREATE TYPE "ReferentielCorrectionStatut" AS ENUM ('PENDING', 'CONFIRMED', 'REJECTED', 'REVERTED');
CREATE TYPE "ReferentielCorrectionType" AS ENUM (
  'ENTREPRISE_FERMEE', 'ADRESSE_ERRONEE', 'TELEPHONE_ERRONE', 'SITE_INVALIDE', 'SECTEUR_FAUX', 'DOUBLON'
);
CREATE TYPE "ReferentielDedupStatut" AS ENUM ('PENDING', 'MERGED', 'DISMISSED');

CREATE TABLE "entreprises_referentiel" (
  "id" TEXT NOT NULL,
  "identifiantNational" TEXT,
  "paysImmatriculation" TEXT,
  "nomLegal" TEXT NOT NULL,
  "nomsAlternatifs" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "secteur" TEXT,
  "codeActivite" TEXT,
  "adresseSiege" TEXT,
  "zoneGeographique" TEXT,
  "siteWeb" TEXT,
  "siteWebDomain" TEXT,
  "presenceDigitale" JSONB,
  "telephoneStandard" TEXT,
  "emailGenerique" TEXT,
  "tailleEstimee" TEXT,
  "anneeCreation" INTEGER,
  "statutActivite" "EntrepriseStatutActivite" NOT NULL DEFAULT 'INCONNUE',
  "sources" JSONB NOT NULL DEFAULT '[]',
  "fieldProvenance" JSONB NOT NULL DEFAULT '{}',
  "dateDerniereVerification" TIMESTAMP(3),
  "scoreFraicheur" INTEGER NOT NULL DEFAULT 50,
  "scoreConfianceGlobal" INTEGER NOT NULL DEFAULT 50,
  "nomNormalise" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "entreprises_referentiel_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "entreprises_referentiel_identifiantNational_paysImmatriculation_idx"
  ON "entreprises_referentiel"("identifiantNational", "paysImmatriculation");
CREATE INDEX "entreprises_referentiel_siteWebDomain_idx" ON "entreprises_referentiel"("siteWebDomain");
CREATE INDEX "entreprises_referentiel_nomNormalise_zoneGeographique_idx"
  ON "entreprises_referentiel"("nomNormalise", "zoneGeographique");
CREATE INDEX "entreprises_referentiel_secteur_idx" ON "entreprises_referentiel"("secteur");
CREATE INDEX "entreprises_referentiel_scoreFraicheur_idx" ON "entreprises_referentiel"("scoreFraicheur");
CREATE INDEX "entreprises_referentiel_paysImmatriculation_statutActivite_idx"
  ON "entreprises_referentiel"("paysImmatriculation", "statutActivite");

-- Index unique partiel : identifiant national quand présent
CREATE UNIQUE INDEX "entreprises_referentiel_national_id_unique"
  ON "entreprises_referentiel"("identifiantNational", "paysImmatriculation")
  WHERE "identifiantNational" IS NOT NULL AND "paysImmatriculation" IS NOT NULL;

CREATE TABLE "referentiel_corrections" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "entrepriseId" TEXT NOT NULL,
  "type" "ReferentielCorrectionType" NOT NULL,
  "champ" TEXT,
  "valeurAvant" TEXT,
  "valeurApres" TEXT,
  "motif" TEXT,
  "statut" "ReferentielCorrectionStatut" NOT NULL DEFAULT 'PENDING',
  "validationMode" TEXT,
  "reportedByUserId" TEXT,
  "confirmedAt" TIMESTAMP(3),
  "confirmedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "referentiel_corrections_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "referentiel_corrections_organizationId_createdAt_idx"
  ON "referentiel_corrections"("organizationId", "createdAt");
CREATE INDEX "referentiel_corrections_entrepriseId_statut_idx"
  ON "referentiel_corrections"("entrepriseId", "statut");
CREATE INDEX "referentiel_corrections_statut_createdAt_idx"
  ON "referentiel_corrections"("statut", "createdAt");

ALTER TABLE "referentiel_corrections"
  ADD CONSTRAINT "referentiel_corrections_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "referentiel_corrections_entrepriseId_fkey"
    FOREIGN KEY ("entrepriseId") REFERENCES "entreprises_referentiel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "referentiel_dedup_reviews" (
  "id" TEXT NOT NULL,
  "entrepriseAId" TEXT NOT NULL,
  "entrepriseBId" TEXT NOT NULL,
  "scoreSimilarite" DOUBLE PRECISION NOT NULL,
  "motif" TEXT,
  "statut" "ReferentielDedupStatut" NOT NULL DEFAULT 'PENDING',
  "reporterOrgId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" TIMESTAMP(3),
  CONSTRAINT "referentiel_dedup_reviews_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "referentiel_dedup_reviews_statut_createdAt_idx"
  ON "referentiel_dedup_reviews"("statut", "createdAt");

ALTER TABLE "referentiel_dedup_reviews"
  ADD CONSTRAINT "referentiel_dedup_reviews_entrepriseAId_fkey"
    FOREIGN KEY ("entrepriseAId") REFERENCES "entreprises_referentiel"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "referentiel_dedup_reviews_entrepriseBId_fkey"
    FOREIGN KEY ("entrepriseBId") REFERENCES "entreprises_referentiel"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "referentiel_dedup_reviews_reporterOrgId_fkey"
    FOREIGN KEY ("reporterOrgId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "contacts"
  ADD COLUMN IF NOT EXISTS "entrepriseReferentielId" TEXT;

CREATE INDEX IF NOT EXISTS "contacts_entrepriseReferentielId_idx"
  ON "contacts"("entrepriseReferentielId");

-- Une fiche tenant par entreprise référentiel (quand lié)
CREATE UNIQUE INDEX IF NOT EXISTS "contacts_organizationId_entrepriseReferentielId_key"
  ON "contacts"("organizationId", "entrepriseReferentielId")
  WHERE "entrepriseReferentielId" IS NOT NULL;

ALTER TABLE "contacts"
  DROP CONSTRAINT IF EXISTS "contacts_entrepriseReferentielId_fkey";
ALTER TABLE "contacts"
  ADD CONSTRAINT "contacts_entrepriseReferentielId_fkey"
    FOREIGN KEY ("entrepriseReferentielId") REFERENCES "entreprises_referentiel"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- RLS couche 2 (contacts = fiches_tenant)
ALTER TABLE "contacts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "contacts" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS contacts_tenant_isolation ON "contacts";
CREATE POLICY contacts_tenant_isolation ON "contacts"
  USING (
    current_setting('app.current_tenant_id', true) IS NULL
    OR current_setting('app.current_tenant_id', true) = ''
    OR "organizationId" = current_setting('app.current_tenant_id', true)
  )
  WITH CHECK (
    current_setting('app.current_tenant_id', true) IS NULL
    OR current_setting('app.current_tenant_id', true) = ''
    OR "organizationId" = current_setting('app.current_tenant_id', true)
  );

-- Corrections : isolation tenant en écriture/lecture signalements
ALTER TABLE "referentiel_corrections" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "referentiel_corrections" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS corrections_tenant_isolation ON "referentiel_corrections";
CREATE POLICY corrections_tenant_isolation ON "referentiel_corrections"
  USING (
    current_setting('app.current_tenant_id', true) IS NULL
    OR current_setting('app.current_tenant_id', true) = ''
    OR "organizationId" = current_setting('app.current_tenant_id', true)
  )
  WITH CHECK (
    current_setting('app.current_tenant_id', true) IS NULL
    OR current_setting('app.current_tenant_id', true) = ''
    OR "organizationId" = current_setting('app.current_tenant_id', true)
  );

-- Référentiel = lecture mutualisée (pas de tenant_id) — pas de RLS restrictive
-- Les écritures applicatives passent par upsertEntrepriseReferentiel (faits publics only)
