ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'SUPPORT_TICKET_NEW';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'SUPPORT_TICKET_REPLY';

CREATE TYPE "SupportTicketStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'WAITING_USER', 'RESOLVED', 'CLOSED');
CREATE TYPE "SupportTicketPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');
CREATE TYPE "SupportTicketCategory" AS ENUM ('BUG', 'BILLING', 'FEATURE', 'OTHER');

CREATE TABLE "support_tickets" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "createdById" TEXT NOT NULL,
  "assigneeId" TEXT,
  "subject" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "status" "SupportTicketStatus" NOT NULL DEFAULT 'OPEN',
  "priority" "SupportTicketPriority" NOT NULL DEFAULT 'MEDIUM',
  "category" "SupportTicketCategory" NOT NULL DEFAULT 'OTHER',
  "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "closedAt" TIMESTAMP(3),
  CONSTRAINT "support_tickets_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "support_ticket_messages" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "ticketId" TEXT NOT NULL,
  "authorId" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "support_ticket_messages_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "support_tickets_organizationId_status_idx" ON "support_tickets"("organizationId", "status");
CREATE INDEX "support_tickets_createdById_createdAt_idx" ON "support_tickets"("createdById", "createdAt");
CREATE INDEX "support_tickets_assigneeId_idx" ON "support_tickets"("assigneeId");
CREATE INDEX "support_ticket_messages_organizationId_ticketId_createdAt_idx" ON "support_ticket_messages"("organizationId", "ticketId", "createdAt");
CREATE INDEX "support_ticket_messages_authorId_idx" ON "support_ticket_messages"("authorId");

ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "support_ticket_messages" ADD CONSTRAINT "support_ticket_messages_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "support_ticket_messages" ADD CONSTRAINT "support_ticket_messages_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "support_tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "support_ticket_messages" ADD CONSTRAINT "support_ticket_messages_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
