import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

/**
 * **`errorFormat: 'minimal'` — a mensagem de erro sem o quadro de código.**
 * O padrão do Prisma põe na `message` o caminho absoluto do arquivo e quatro
 * linhas do fonte ao redor da chamada, e a `message` é o que vai para a
 * coluna do `ErrorEvent` e para a tabela de falhas da `/admin/security`: o
 * ensaio de aceitação (Fase 12 do plano de observabilidade, M5) viu o
 * `AUDIT_WRITE_FAILED` na tela como `C:\…\audit.service.ts:84:29` mais o
 * código, com a causa espremida no fim — e um quadro de código mostra
 * qualquer literal escrito perto da chamada. `minimal` mantém qual chamada
 * falhou (`Invalid \`prisma.news.count()\` invocation:`) e a causa; o
 * `stack`, que vai só para o log, segue com o caminho.
 */
export const prisma = globalForPrisma.prisma ?? new PrismaClient({ errorFormat: 'minimal' });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export * from '@prisma/client';
