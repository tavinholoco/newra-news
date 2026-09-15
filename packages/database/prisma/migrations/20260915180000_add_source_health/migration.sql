-- CreateEnum
CREATE TYPE "SourceKind" AS ENUM ('RSS', 'AGGREGATOR');

-- CreateEnum
CREATE TYPE "SourceOutcome" AS ENUM ('OK', 'EMPTY', 'FAILED');

-- CreateTable
CREATE TABLE "SourceHealth" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "kind" "SourceKind" NOT NULL,
    "day" TIMESTAMP(3) NOT NULL,
    "fetched" INTEGER NOT NULL DEFAULT 0,
    "kept" INTEGER NOT NULL DEFAULT 0,
    "outcome" "SourceOutcome" NOT NULL,
    "failureReason" TEXT,
    "latencyMs" INTEGER,
    "pipelineLogId" TEXT,

    CONSTRAINT "SourceHealth_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SourceHealth_day_idx" ON "SourceHealth"("day");

-- CreateIndex
CREATE UNIQUE INDEX "SourceHealth_source_day_key" ON "SourceHealth"("source", "day");

