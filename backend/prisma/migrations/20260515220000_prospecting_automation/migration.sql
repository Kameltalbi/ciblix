-- Prospection automatique périodique (plan programmable Hunt IA).

CREATE TABLE "prospecting_automations" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "createdByUserId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "name" TEXT NOT NULL DEFAULT 'Prospection planifiée',
    "criteria" JSONB NOT NULL,
    "intervalHours" INTEGER NOT NULL,
    "refreshCache" BOOLEAN NOT NULL DEFAULT false,
    "qualifyAfterSearch" BOOLEAN NOT NULL DEFAULT true,
    "maxNewPerRun" INTEGER NOT NULL DEFAULT 40,
    "nextRunAt" TIMESTAMP(3) NOT NULL,
    "lastRunAt" TIMESTAMP(3),
    "lastRunImported" INTEGER,
    "lastRunQualified" INTEGER,
    "lastRunError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "prospecting_automations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "prospecting_automations_organizationId_key" ON "prospecting_automations"("organizationId");

ALTER TABLE "prospecting_automations" ADD CONSTRAINT "prospecting_automations_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
