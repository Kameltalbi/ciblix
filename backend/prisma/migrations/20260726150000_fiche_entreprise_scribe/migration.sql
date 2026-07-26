-- Réalignement fiche entreprise + Scribe
CREATE TYPE "FicheEntrepriseEtat" AS ENUM (
  'DECOUVERTE',
  'QUALIFIEE',
  'CONTACTEE',
  'EN_DISCUSSION',
  'GAGNEE',
  'PERDUE',
  'ARCHIVEE',
  'BLOQUEE_HUMAIN'
);

ALTER TABLE "contacts"
  ADD COLUMN IF NOT EXISTS "ficheEtat" "FicheEntrepriseEtat",
  ADD COLUMN IF NOT EXISTS "ficheEtatAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "ficheData" JSONB,
  ADD COLUMN IF NOT EXISTS "ficheBlockReason" TEXT;

CREATE INDEX IF NOT EXISTS "contacts_organizationId_ficheEtat_idx"
  ON "contacts"("organizationId", "ficheEtat");

CREATE TABLE IF NOT EXISTS "fiche_transitions" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "contactId" TEXT NOT NULL,
  "etatPrecedent" TEXT,
  "etatNouveau" TEXT NOT NULL,
  "agentEmetteur" TEXT NOT NULL,
  "champsEcrits" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "conditionOk" BOOLEAN NOT NULL DEFAULT true,
  "raison" TEXT NOT NULL,
  "prochainAgent" TEXT,
  "payload" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "fiche_transitions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "fiche_transitions_organizationId_createdAt_idx"
  ON "fiche_transitions"("organizationId", "createdAt");
CREATE INDEX IF NOT EXISTS "fiche_transitions_organizationId_contactId_createdAt_idx"
  ON "fiche_transitions"("organizationId", "contactId", "createdAt");
CREATE INDEX IF NOT EXISTS "fiche_transitions_organizationId_etatNouveau_idx"
  ON "fiche_transitions"("organizationId", "etatNouveau");

ALTER TABLE "fiche_transitions"
  DROP CONSTRAINT IF EXISTS "fiche_transitions_organizationId_fkey",
  DROP CONSTRAINT IF EXISTS "fiche_transitions_contactId_fkey";

ALTER TABLE "fiche_transitions"
  ADD CONSTRAINT "fiche_transitions_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "fiche_transitions_contactId_fkey"
    FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AgentRole SCRIBE + PROCESS_INTERACTION
DO $$ BEGIN
  ALTER TYPE "AgentRole" ADD VALUE 'SCRIBE';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE "AgentTaskKind" ADD VALUE 'PROCESS_INTERACTION';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
