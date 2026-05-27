-- CreateTable
CREATE TABLE "agent_usage_monthly" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "monthKey" TEXT NOT NULL,
    "agentSlug" TEXT NOT NULL,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agent_usage_monthly_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "agent_usage_monthly_organizationId_monthKey_agentSlug_key" ON "agent_usage_monthly"("organizationId", "monthKey", "agentSlug");

-- CreateIndex
CREATE INDEX "agent_usage_monthly_organizationId_idx" ON "agent_usage_monthly"("organizationId");

-- AddForeignKey
ALTER TABLE "agent_usage_monthly" ADD CONSTRAINT "agent_usage_monthly_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
