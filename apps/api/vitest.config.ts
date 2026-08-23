import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: [
        // Bootstrap do processo: sobe o servidor e registra o cron. O que ele
        // faz é exercido pelo `buildApp`, e cobri-lo pediria abrir porta.
        'src/server.ts',
        // **Arquivo só de tipos.** `RawNewsItem` e `GeneratedArticle` são
        // `interface`, e o arquivo não emite uma linha de JavaScript — o v8
        // reportava 0% sobre 18 linhas que não existem em runtime, e isso
        // puxava o número do projeto para baixo sem nenhum risco por trás.
        // Excluído por não ter o que cobrir, não por ser inconveniente: é a
        // única exclusão desse tipo, e ela é por arquivo, não por padrão.
        'src/providers/types.ts',
      ],
      // Critério do PRD §18: cobertura do backend >70%. Medido na revisão da
      // Fase 9 (23/08/2026): 98,4% stmts · 92,9% branch · 98,4% funcs.
      thresholds: {
        lines: 70,
        statements: 70,
        functions: 70,
        branches: 70,
      },
    },
  },
});
