-- AlterTable
ALTER TABLE "family_members" ADD COLUMN "deletedAt" DATETIME;

-- CreateIndex
CREATE INDEX "family_members_deletedAt_idx" ON "family_members"("deletedAt");
