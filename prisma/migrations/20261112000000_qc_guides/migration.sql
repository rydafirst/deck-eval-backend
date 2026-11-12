-- CreateTable
CREATE TABLE "QcGuide" (
    "key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "body" TEXT NOT NULL,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QcGuide_pkey" PRIMARY KEY ("key")
);
