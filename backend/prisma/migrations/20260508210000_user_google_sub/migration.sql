-- AlterTable
ALTER TABLE "users" ADD COLUMN "googleSub" TEXT;

-- CreateIndex (nullable unique — plusieurs NULL autorisés)
CREATE UNIQUE INDEX "users_googleSub_key" ON "users"("googleSub");
