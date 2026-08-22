-- Fase 6 (Account ecosystem) — as três mudanças de banco que a fase exigia.
--
-- Escrita à mão de propósito: o `Favorite` **renomeia** uma coluna, e
-- `migrate diff` resolveria isso como DROP + ADD, apagando os favoritos que já
-- existem em produção.

-- CreateEnum
CREATE TYPE "FavoriteItemType" AS ENUM ('NEWS', 'ARTICLE');

-- CreateEnum
CREATE TYPE "ThemePreference" AS ENUM ('LIGHT', 'DARK', 'SYSTEM');

-- AlterTable: Favorite passa a alcançar notícia E briefing.
-- O DEFAULT 'NEWS' é o backfill: tudo que já está salvo é notícia.
ALTER TABLE "Favorite" RENAME COLUMN "newsId" TO "itemId";
ALTER TABLE "Favorite" ADD COLUMN "itemType" "FavoriteItemType" NOT NULL DEFAULT 'NEWS';

-- DropIndex
DROP INDEX "Favorite_userId_newsId_key";

-- CreateIndex
CREATE UNIQUE INDEX "Favorite_userId_itemType_itemId_key" ON "Favorite"("userId", "itemType", "itemId");

-- CreateTable
CREATE TABLE "UserPreference" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "categories" "Category"[] DEFAULT ARRAY[]::"Category"[],
    "theme" "ThemePreference" NOT NULL DEFAULT 'SYSTEM',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserPreference_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserPreference_userId_key" ON "UserPreference"("userId");

-- AlterTable
ALTER TABLE "Subscriber" ADD COLUMN "userId" TEXT;

-- CreateIndex
CREATE INDEX "Subscriber_userId_idx" ON "Subscriber"("userId");

-- Backfill: inscrição feita com o mesmo e-mail da conta passa a apontar para
-- ela. Quem se inscreveu com outro e-mail continua sem vínculo — é exatamente
-- o caso que o cruzamento por e-mail errava.
UPDATE "Subscriber" AS s
SET "userId" = u."id"
FROM "User" AS u
WHERE lower(s."email") = lower(u."email");
