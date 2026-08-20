-- CreateEnum
CREATE TYPE "ArticleStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'FAILED');

-- AlterTable
ALTER TABLE "Article" ADD COLUMN     "generatedAt" TIMESTAMP(3),
ADD COLUMN     "modelVersion" TEXT,
ADD COLUMN     "promptVersion" TEXT,
ADD COLUMN     "status" "ArticleStatus" NOT NULL DEFAULT 'PUBLISHED';

-- CreateTable
CREATE TABLE "BriefingSource" (
    "id" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "newsId" TEXT,
    "position" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BriefingSource_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BriefingSource_articleId_position_idx" ON "BriefingSource"("articleId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "BriefingSource_articleId_sourceUrl_key" ON "BriefingSource"("articleId", "sourceUrl");

-- AddForeignKey
ALTER TABLE "BriefingSource" ADD CONSTRAINT "BriefingSource_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article"("id") ON DELETE CASCADE ON UPDATE CASCADE;
