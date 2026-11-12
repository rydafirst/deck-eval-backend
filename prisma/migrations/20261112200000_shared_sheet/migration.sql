ALTER TABLE "Task" ADD COLUMN "sharedSheet" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Answer" ADD COLUMN "updatedById" TEXT;
CREATE INDEX "Answer_submissionId_updatedAt_idx" ON "Answer"("submissionId", "updatedAt");
