import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      include: ['app/**/*.{ts,tsx}', 'components/**/*.{ts,tsx}', 'lib/**/*.{ts,tsx}', 'i18n/**/*.ts'],
      exclude: [
        // **Nao e conveniencia: sao arquivos que o jsdom nao executa.** O
        // Vitest roda em `environment: jsdom`, e uma `page.tsx` do App Router
        // e um server component assincrono — importa-la aqui nao renderiza
        // nada, so contabiliza linhas como nao-cobertas. O que essas paginas
        // decidem (metadata, estado, `notFound()`) e coberto de forma
        // **estatica** por `tests/lib/state-matrix.test.ts` e
        // `tests/lib/api-failure.test.ts`, que leem o fonte.
        'app/**/{page,layout,loading,error,not-found,opengraph-image,apple-icon,icon}.tsx',
        'app/**/route.ts',
        // Fronteiras de metadata geradas, sem logica propria.
        'app/{sitemap,robots}.ts',
        // Wrapper do next-intl: o comportamento dele e do proprio pacote.
        'i18n/**',
      ],
      /**
       * **O piso existe desde a revisao 10.T; antes nao havia nenhum.** O CI
       * roda `pnpm turbo test:coverage`, e o `@newranews/web` nao tinha o
       * script — entao o passo media **so a API**, e o badge do README falava
       * por um app so. Eram 451 testes sem piso nenhum: o numero podia cair
       * sem nada reprovar.
       *
       * **Medido em 24/08/2026, ao fixar:** 72,32% stmts · 88,82% branch ·
       * 71,32% funcs, com 524 testes em 57 suites.
       *
       * O numero e o mesmo 70 da API, mas **a folga aqui e fina de proposito e
       * vale dizer**: la o piso ficou 24 pontos abaixo do medido, aqui fica
       * pouco mais de um em `functions`. Nao e para perseguir cobertura — e
       * para que uma queda real reprove. Onde ela falta e sabido:
       * `lib/queries.ts` mede 28% de funcoes porque sao invólucros finos de
       * `useQuery`, exercitados de fato pelos testes de componente e nao
       * diretamente. E ai que se ganha ponto, se um dia precisar.
       */
      thresholds: {
        lines: 70,
        statements: 70,
        functions: 70,
        branches: 70,
      },
    },
  },
});
