-- CreateTable
CREATE TABLE "organization_agents" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "agentSlug" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "activatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deactivatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organization_agents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "organization_agents_organizationId_idx" ON "organization_agents"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "organization_agents_organizationId_agentSlug_key" ON "organization_agents"("organizationId", "agentSlug");

-- AddForeignKey
ALTER TABLE "organization_agents" ADD CONSTRAINT "organization_agents_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
