-- Connect Copilot v3 — catalogue produits, mémoire utilisateur, qualification

CREATE TABLE "connect_commercial_products" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT,
  "slug" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "icp" TEXT,
  "arguments" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "objections" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "cta" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "connect_commercial_products_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "connect_user_memory" (
  "userId" TEXT NOT NULL,
  "preferredTone" TEXT DEFAULT 'professionnel',
  "messageLength" TEXT DEFAULT 'court',
  "avoidPhrases" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "styleNotes" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "lastLearnedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "connect_user_memory_pkey" PRIMARY KEY ("userId")
);

ALTER TABLE "connect_prospects" ADD COLUMN IF NOT EXISTS "aiQualification" JSONB;

CREATE UNIQUE INDEX "connect_commercial_products_organizationId_slug_key"
  ON "connect_commercial_products"("organizationId", "slug");
CREATE INDEX "connect_commercial_products_organizationId_active_idx"
  ON "connect_commercial_products"("organizationId", "active");

ALTER TABLE "connect_commercial_products" ADD CONSTRAINT "connect_commercial_products_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "connect_user_memory" ADD CONSTRAINT "connect_user_memory_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Produits globaux par défaut (organizationId NULL)
INSERT INTO "connect_commercial_products" ("id", "organizationId", "slug", "name", "description", "icp", "arguments", "objections", "cta", "active", "sortOrder", "updatedAt")
VALUES
  ('prod_carboscan', NULL, 'carboscan', 'CarboScan',
   'Solution de bilan carbone et conformité ESG pour entreprises industrielles et exportatrices.',
   'Industrie, export, >50 salariés, directeur industriel/RSE/qualité, France/Tunisie/Maghreb',
   ARRAY['Conformité CSRD et reporting ESG', 'Réduction des coûts énergétiques', 'Avantage concurrentiel export', 'ROI mesurable en 12 mois'],
   ARRAY['Trop technique', 'ISO déjà en place', 'Pas de pression réglementaire'],
   'Proposer un diagnostic gratuit de 30 minutes sur votre trajectoire carbone',
   true, 1, CURRENT_TIMESTAMP),
  ('prod_softfacture', NULL, 'softfacture', 'SoftFacture',
   'Facturation et gestion PME — simplification administrative et conformité fiscale.',
   'PME, TPE, cabinets comptables, dirigeants, Tunisie/Francophonie',
   ARRAY['Gain de temps facturation', 'Conformité fiscale tunisienne', 'Interface simple', 'Intégration comptable'],
   ARRAY['ERP déjà en place', 'Volume faible de factures', 'Budget serré'],
   'Démonstration personnalisée de 15 minutes',
   true, 2, CURRENT_TIMESTAMP)
ON CONFLICT DO NOTHING;
