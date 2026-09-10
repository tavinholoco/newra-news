-- CreateEnum
CREATE TYPE "ErrorOrigin" AS ENUM ('API', 'PIPELINE', 'WEB', 'INVARIANT');

-- CreateEnum
CREATE TYPE "ErrorSeverity" AS ENUM ('WARN', 'ERROR', 'FATAL');

-- CreateTable
CREATE TABLE "ErrorEvent" (
    "id" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "origin" "ErrorOrigin" NOT NULL,
    "severity" "ErrorSeverity" NOT NULL,
    "code" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,
    "route" TEXT,
    "statusCode" INTEGER,
    "message" TEXT NOT NULL,
    "firstRequestId" TEXT,
    "lastRequestId" TEXT,
    "pipelineLogId" TEXT,
    "context" JSONB,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ErrorEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ErrorEvent_windowStart_idx" ON "ErrorEvent"("windowStart");

-- CreateIndex
CREATE INDEX "ErrorEvent_origin_windowStart_idx" ON "ErrorEvent"("origin", "windowStart");

-- CreateIndex
CREATE INDEX "ErrorEvent_severity_windowStart_idx" ON "ErrorEvent"("severity", "windowStart");

-- CreateIndex
CREATE UNIQUE INDEX "ErrorEvent_fingerprint_windowStart_key" ON "ErrorEvent"("fingerprint", "windowStart");

-- CreateIndex
CREATE INDEX "PipelineLog_startedAt_idx" ON "PipelineLog"("startedAt");

-- CreateIndex
CREATE INDEX "PipelineLog_status_startedAt_idx" ON "PipelineLog"("status", "startedAt");
