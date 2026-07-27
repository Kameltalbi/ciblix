-- Connect Copilot v4 — RAG entreprise (sources + chunks + FTS)

CREATE TYPE "ConnectKnowledgeSourceType" AS ENUM ('WEBSITE', 'FILE', 'TEXT', 'FAQ', 'PRICING');
CREATE TYPE "ConnectKnowledgeStatus" AS ENUM ('PENDING', 'READY', 'FAILED');

CREATE TABLE "connect_knowledge_sources" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "createdById" TEXT,
  "name" TEXT NOT NULL,
  "type" "ConnectKnowledgeSourceType" NOT NULL,
  "sourceUrl" TEXT,
  "storageRef" TEXT,
  "mimeType" TEXT,
  "status" "ConnectKnowledgeStatus" NOT NULL DEFAULT 'PENDING',
  "extractedText" TEXT,
  "error" TEXT,
  "chunkCount" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "connect_knowledge_sources_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "connect_knowledge_chunks" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "sourceId" TEXT NOT NULL,
  "position" INTEGER NOT NULL,
  "title" TEXT,
  "content" TEXT NOT NULL,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "connect_knowledge_chunks_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "connect_knowledge_sources_organizationId_status_idx"
  ON "connect_knowledge_sources"("organizationId", "status");
CREATE INDEX "connect_knowledge_sources_organizationId_updatedAt_idx"
  ON "connect_knowledge_sources"("organizationId", "updatedAt");
CREATE INDEX "connect_knowledge_chunks_organizationId_sourceId_idx"
  ON "connect_knowledge_chunks"("organizationId", "sourceId");

-- Full-text search index (simple config — FR/EN/AR friendly enough for MVP)
CREATE INDEX "connect_knowledge_chunks_fts_idx"
  ON "connect_knowledge_chunks"
  USING GIN (to_tsvector('simple', coalesce("title", '') || ' ' || "content"));

ALTER TABLE "connect_knowledge_sources"
  ADD CONSTRAINT "connect_knowledge_sources_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "connect_knowledge_chunks"
  ADD CONSTRAINT "connect_knowledge_chunks_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "connect_knowledge_chunks"
  ADD CONSTRAINT "connect_knowledge_chunks_sourceId_fkey"
  FOREIGN KEY ("sourceId") REFERENCES "connect_knowledge_sources"("id") ON DELETE CASCADE ON UPDATE CASCADE;
