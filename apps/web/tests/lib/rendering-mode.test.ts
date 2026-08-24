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
