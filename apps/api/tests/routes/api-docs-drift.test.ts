import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { FastifyInstance } from 'fastify';
import { buildTestApp } from '../helpers/test-server';

/**
 * **Rota registrada ⇒ rota documentada.** A guarda que a §9.1 pediu.
 *
 * A regra mais cara já aprendida neste backend é "o que não está no schema não
 * existe": o `article.service` carregava os campos de auditoria e as 15 fontes
 * desde a Fase 0.5, o `articleItemSchema` era o da V1, e o
 * `fastify-type-provider-zod` serializa **pelo schema** — o dado ia do banco
 * para o lixo na saída, com a `docs/api.md` descrevendo o comportamento certo.
 * Nada denunciava a divergência porque a comparação entre código e documento
 * só existia na cabeça de quem lembrasse de fazê-la.
 *
 * A deriva era medível quando esta fase abriu: a `docs/api.md` documentava 32
 * endpoints e o `app.ts` registrava 34 — `POST /api/auth/upsert`, a rota pela
 * qual **todo usuário é criado**, não estava escrita em lugar nenhum.
 *
 * Esta guarda não conserta nada; ela torna a deriva impossível de mergear, que
 * é a diferença entre auditoria e guarda.
 */

const DOCS_PATH = join(__dirname, '../../../../docs/api.md');

/**
 * Rotas que o documento não descreve, e por quê.
 *
 * Curta de propósito: exceção aqui é a porta pela qual a deriva volta.
 *
 * - **tudo sob `/api/docs`** — a UI do Swagger é gerada, não escrita, e só é
 *   registrada fora de produção (ver `plugins/swagger.ts`);
 * - **`POST /dev/dashboard/session`** — passo de um formulário HTML, descrito
 *   pela própria página, não endpoint de API.
 */
function isUndocumentedByDesign(route: string): boolean {
  return (
    route.includes(' /api/docs') || route === 'POST /dev/dashboard/session'
  );
}

let app: FastifyInstance;
let documented: Set<string>;

/** `GET /api/news/:id` — método e caminho, na forma que a `docs/api.md` usa. */
function collectRegisteredRoutes(instance: FastifyInstance): string[] {
  const routes: string[] = [];
  // `printRoutes` desenha a árvore do roteador; o parse abaixo reconstrói o
  // caminho a partir da indentação, que é como a árvore codifica a hierarquia.
  const lines = instance
    .printRoutes({ commonPrefix: false })
    .split('\n')
    .filter((line) => line.trim().length > 0);

  const stack: Array<{ depth: number; segment: string }> = [];
  for (const line of lines) {
    const depth = (line.match(/^[│\s]*[└├]??─*\s?/)?.[0] ?? '').length;
    const content = line.replace(/^[│\s]*[└├]?─*\s?/, '');
    const [rawSegment, methodsPart] = content.split(' (');

    while (stack.length > 0 && (stack[stack.length - 1]?.depth ?? 0) >= depth) {
      stack.pop();
    }
    stack.push({ depth, segment: rawSegment ?? '' });

    if (!methodsPart) continue;

    const path = stack.map((entry) => entry.segment).join('');
    const methods = methodsPart.replace(')', '').split(', ');
    for (const method of methods) {
      if (method === 'HEAD' || method === 'OPTIONS') continue;
      routes.push(`${method} ${normalizePath(path)}`);
    }
  }

  return [...new Set(routes)];
}

/** A árvore imprime `/api/news/:id` como `:id`; e a raiz vira caminho sem barra final. */
function normalizePath(path: string): string {
  const withoutTrailing = path.length > 1 ? path.replace(/\/$/, '') : path;
  return withoutTrailing.startsWith('/') ? withoutTrailing : `/${withoutTrailing}`;
}

beforeAll(async () => {
  app = await buildTestApp();
  await app.ready();

  const markdown = readFileSync(DOCS_PATH, 'utf8');
  documented = new Set(
    [...markdown.matchAll(/^### (GET|POST|PUT|DELETE|PATCH) (\S+)/gm)].map(
      (match) => `${match[1]} ${match[2]}`,
    ),
  );
});

afterAll(async () => {
  await app.close();
});

describe('docs/api.md × o roteador', () => {
  it('documents every registered route', () => {
    const missing = collectRegisteredRoutes(app)
      .filter((route) => !isUndocumentedByDesign(route))
      .filter((route) => !documented.has(route));

    expect(missing).toEqual([]);
  });

  it('does not document a route that no longer exists', () => {
    const registered = new Set(collectRegisteredRoutes(app));
    const stale = [...documented].filter((route) => !registered.has(route));

    expect(stale).toEqual([]);
  });

  it('finds routes at all — a parser that returns nothing would pass everything', () => {
    // A guarda mais importante deste arquivo: as duas de cima passam vazias se
    // o parse quebrar numa versão nova do Fastify, e passariam para sempre.
    const registered = collectRegisteredRoutes(app);

    expect(registered.length).toBeGreaterThan(30);
    expect(registered).toContain('GET /api/news/:id');
    expect(registered).toContain('POST /api/auth/upsert');
    expect(documented.size).toBeGreaterThan(30);
  });
});
