import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * **`revalidate` só significa alguma coisa onde a rota é guardada.**
 *
 * A §11.3 pedia para medir *quem espera a API acordar*, em vez de supor. A
 * medição contra produção, em 24/08/2026, achou uma coisa que ninguém teria
 * achado lendo o código:
 *
 * | Rota | `x-vercel-cache` | `Cache-Control` da resposta |
 * |---|---|---|
 * | `/pt-BR` | `HIT`, `Age: 1491` | `public, max-age=0, must-revalidate` |
 * | `/pt-BR/news` | `PRERENDER` | idem |
 * | `/pt-BR/news/[id]` | **`MISS` nas três tentativas** | `private, no-cache, no-store` |
 *
 * As duas telas de leitura declaravam `export const revalidate = 3600` e **não
 * eram guardadas em lugar nenhum**. A causa é uma regra do Next 14 que não
 * aparece em erro nenhum: rota com segmento dinâmico e **sem
 * `generateStaticParams`** é marcada `ƒ` no build — renderizada sob demanda a
 * cada requisição —, e o `revalidate` do arquivo passa a valer só para o cache
 * de dados, nunca para o HTML.
 *
 * O custo caía sobre a página **que se compartilha**: quem chega por busca ou
 * por rede social chega num detalhe, e era a única rota do produto sem cache.
 *
 * Esta guarda existe porque a declaração e o efeito ficam em arquivos
 * diferentes, e nada os liga: **página que declara `revalidate` precisa poder
 * ser guardada.** O par que a satisfaz é `generateStaticParams` na própria
 * página ou nenhum segmento dinâmico abaixo do `[locale]`.
 */

const APP_DIR = join(__dirname, '../../app');

function collectPages(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return collectPages(full);
    return /[\\/]page\.tsx$/.test(full) ? [full] : [];
  });
}

function relativePath(file: string): string {
  return file.replace(/\\/g, '/').split('/apps/web/')[1] ?? file;
}

/** Segmentos dinâmicos abaixo do `[locale]`, que o layout de idioma já resolve. */
function ownDynamicSegments(file: string): string[] {
  const path = relativePath(file);
  return [...path.matchAll(/\[([^\]/]+)\]/g)]
    .map((match) => match[1] as string)
    .filter((segment) => segment !== 'locale');
}

describe('modo de renderização × o que a página declara', () => {
  it('gives every revalidating page a way to be cached', () => {
    const broken = collectPages(APP_DIR)
      .filter((file) => /export const revalidate\s*=/.test(readFileSync(file, 'utf8')))
      .filter((file) => ownDynamicSegments(file).length > 0)
      .filter((file) => !/export function generateStaticParams/.test(readFileSync(file, 'utf8')))
      .map(relativePath);

    expect(broken).toEqual([]);
  });

  it('finds the two detail pages — a matcher that returns nothing would pass everything', () => {
    const dynamicPages = collectPages(APP_DIR)
      .filter((file) => ownDynamicSegments(file).length > 0)
      .map(relativePath);

    expect(dynamicPages).toContain('app/[locale]/news/[id]/page.tsx');
    expect(dynamicPages).toContain('app/[locale]/article/[date]/page.tsx');
  });

  it('does not put revalidate on a page that renders per request', () => {
    // O inverso do mesmo engano: `force-dynamic` e `revalidate` no mesmo arquivo
    // é uma contradição que o Next resolve em silêncio, e o autor fica achando
    // que a página é guardada.
    const contradictory = collectPages(APP_DIR)
      .filter((file) => {
        const source = readFileSync(file, 'utf8');
        return (
          /export const dynamic\s*=\s*'force-dynamic'/.test(source) &&
          /export const revalidate\s*=/.test(source)
        );
      })
      .map(relativePath);

    expect(contradictory).toEqual([]);
  });
});

/**
 * **O mesmo engano num route handler, medido em produção em 09/10/2026** (13.7
 * do plano de observabilidade, armadilha 48). A sonda do login
 * (`app/api/health/auth/route.ts`) declarava `revalidate = 86400` para um robô
 * não acordar a API com ela — e o `fetch` dela levava `cache: 'no-store'`.
 * No Next 14 um `fetch` `no-store` é **uso dinâmico**: o build marcou a rota
 * `ƒ` e o `revalidate` deixou de valer. Duas sondas seguidas em produção
 * deram `X-Vercel-Cache: MISS`, `Age: 0` e dois `checkedAt` diferentes — cada
 * pedido chamava o Render. A suíte da rota passava: ela mocka o `fetch`, e o
 * modo de renderização só existe no build.
 *
 * A guarda pergunta pela causa, que se lê no fonte: **arquivo sob `app/` que
 * declara `revalidate` não faz `fetch` com `cache: 'no-store'` nem
 * `revalidate: 0`** — quem precisar da resposta fresca a cada regeneração
 * usa `next: { revalidate }` com o mesmo período, que a invalidação do cron
 * também alcança.
 */
describe('modo de renderização × o fetch de quem declara revalidate', () => {
  function collectSources(dir: string): string[] {
    return readdirSync(dir).flatMap((entry) => {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) return collectSources(full);
      return /\.(tsx?|jsx?)$/.test(full) ? [full] : [];
    });
  }

  const revalidating = collectSources(APP_DIR).filter((file) =>
    /export const revalidate\s*=/.test(readFileSync(file, 'utf8')),
  );

  it('finds the revalidating files, route handlers included', () => {
    expect(revalidating.map(relativePath)).toContain('app/api/health/auth/route.ts');
  });

  it('never opts a revalidating file into dynamic rendering through its fetch', () => {
    const dynamic = revalidating
      .filter((file) => {
        const source = readFileSync(file, 'utf8')
          .replace(/\/\*[\s\S]*?\*\//g, ' ')
          .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
        return /cache:\s*'no-store'|revalidate:\s*0\b/.test(source);
      })
      .map(relativePath);

    expect(dynamic).toEqual([]);
  });
});
