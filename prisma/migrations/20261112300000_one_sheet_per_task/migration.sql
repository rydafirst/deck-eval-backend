ALTER TABLE "Task" DROP COLUMN "sharedSheet";
ALTER TABLE "Task" DROP COLUMN "ratersNeeded";
DROP INDEX "Submission_taskId_userId_key";
CREATE INDEX "Submission_taskId_idx" ON "Submission"("taskId");
