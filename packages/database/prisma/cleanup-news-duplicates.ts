import { PrismaClient } from '@prisma/client';

/**
 * Remove notícias duplicadas por `sourceUrl`, mantendo apenas a mais recente
 * (desempate por createdAt DESC, id DESC — determinístico).
 *
 * Necessário antes de aplicar a constraint única em `News.sourceUrl` (o
 * `prisma db push` falha se a tabela já tiver duplicatas). Uso:
 *
 *   # só conta as duplicatas (não altera nada)
 *   DATABASE_URL=... DRY_RUN=true pnpm --filter @newranews/database db:cleanup-news-duplicates
 *
 *   # remove de fato
 *   DATABASE_URL=... pnpm --filter @newranews/database db:cleanup-news-duplicates
 */
const prisma = new PrismaClient();

const DRY_RUN = process.env.DRY_RUN === 'true';

async function main() {
  const totalBefore = await prisma.news.count();

  // Agrupa por sourceUrl e mantém a linha mais recente de cada grupo
  const duplicates = await prisma.$queryRaw<Array<{ id: string; sourceUrl: string }>>`
    SELECT id, "sourceUrl" FROM (
      SELECT id, "sourceUrl",
             ROW_NUMBER() OVER (
               PARTITION BY "sourceUrl"
               ORDER BY "createdAt" DESC, id DESC
             ) AS rn
      FROM "News"
    ) ranked
    WHERE rn > 1
  `;

  if (duplicates.length === 0) {
    console.log(`Nenhuma duplicata encontrada (${totalBefore} notícias no total). Nada a fazer.`);
    return;
  }

  const uniqueUrls = new Set(duplicates.map((d) => d.sourceUrl));
  console.log(
    `Duplicatas encontradas: ${duplicates.length} linhas extras (${uniqueUrls.size} URLs com mais de 1 linha).`,
  );
  console.log(`Total antes: ${totalBefore} notícias.`);

  if (DRY_RUN) {
    console.log('DRY_RUN=true — nada foi alterado. Remova DRY_RUN para executar a limpeza.');
    return;
  }

  const ids = duplicates.map((d) => d.id);
  // Apaga em lotes para não estourar limites de bind do Postgres (65535 params)
  let deleted = 0;
  for (let i = 0; i < ids.length; i += 1000) {
    const batch = ids.slice(i, i + 1000);
    const result = await prisma.news.deleteMany({ where: { id: { in: batch } } });
    deleted += result.count;
  }

  const totalAfter = await prisma.news.count();
  console.log(`Removidas ${deleted} linhas duplicadas. Total depois: ${totalAfter} notícias.`);
  console.log('Pronto para aplicar a constraint única (prisma db push).');
}

main()
  .catch((err) => {
    console.error('Cleanup falhou:', err);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
