import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * **Em quem cada metade confia, e por quê — a parte que dá para verificar.**
 *
 * O mapa de confiança está escrito no plugin de CORS da API, que é a fronteira
 * onde ele vale ou não vale. Três das quatro linhas dele são configuração; a
 * que **este arquivo** protege é a única que era pura convenção:
 *
 * > navegador → API (direto): sem autenticação, **e mutação nunca vem por aqui**.
 *
 * É dela que depende o `methods` do CORS, e ela nunca esteve declarada. O
 * sintoma de quebrá-la seria um preflight falhando em produção — a mesma classe
 * do bug da barra final no `CORS_ORIGIN`, em 16/08 —, e o único jeito de
 * descobrir era alguém clicar.
 *
 * As três asserções abaixo escrevem a convenção como regra:
 *
 * 1. **o segredo compartilhado tem dois usuários, e são nominais** — quem
 *    assina JWT é o BFF e o callback de sign-in, mais ninguém;
 * 2. **o cliente HTTP do navegador para a API só usa método público** — GET e
 *    POST, que é o que o CORS permite de fato para o navegador;
 * 3. **PUT e DELETE existem, e só atravessando o BFF** — as quatro rotas de
 *    mutação passam por `fetchWebApi`, que é same-origin.
 */

const WEB_ROOT = join(__dirname, '../..');
const API_CLIENT = join(WEB_ROOT, 'lib', 'api.ts');

/** Os únicos módulos autorizados a assinar com o segredo compartilhado. */
const SECRET_HOLDERS = ['lib/api-proxy.ts', 'lib/auth.ts', 'lib/jwt.ts'];

/**
 * Métodos que o navegador pode usar **direto na API**.
 *
 * A API declara `GET, POST, PUT, DELETE, OPTIONS` no CORS desde a Fase 9,
 * porque declarar o que existe é o certo — mas o que o navegador de fato usa
 * ali são os dois primeiros, e é essa restrição que torna a política segura por
 * desenho em vez de segura por acaso.
 */
const PUBLIC_METHODS = ['GET', 'POST'];

function collectFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    return statSync(full).isDirectory()
      ? collectFiles(full)
      : /\.tsx?$/.test(full)
        ? [full]
        : [];
  });
}

function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

function relativePath(file: string): string {
  return file.replace(/\\/g, '/').split('/apps/web/')[1] ?? file;
}

/** O corpo de cada chamada a uma função, com os parênteses balanceados. */
function callsTo(source: string, fn: string): string[] {
  const calls: string[] = [];
  const pattern = new RegExp(`\\b${fn}\\s*(?:<[^(]*>)?\\s*\\(`, 'g');

  for (const match of source.matchAll(pattern)) {
    let depth = 1;
    let index = (match.index ?? 0) + match[0].length;
    const start = index;

    while (index < source.length && depth > 0) {
      const char = source[index];
      if (char === '(') depth += 1;
      else if (char === ')') depth -= 1;
      index += 1;
    }

    calls.push(source.slice(start, index - 1));
  }

  return calls;
}

function methodOf(call: string): string {
  return /method:\s*'([A-Z]+)'/.exec(call)?.[1] ?? 'GET';
}

describe('a fronteira de confiança entre o site e a API', () => {
  it('keeps the shared secret in the two modules that are supposed to hold it', () => {
    const holders = [join(WEB_ROOT, 'lib'), join(WEB_ROOT, 'app'), join(WEB_ROOT, 'components')]
      .flatMap(collectFiles)
      .filter((file) => {
        const source = stripComments(readFileSync(file, 'utf8'));
        return /\bsignAuthJwt\b|AUTH_JWT_SECRET/.test(source);
      })
      .map(relativePath)
      .sort();

    expect(holders).toEqual([...SECRET_HOLDERS].sort());
  });

  it('never lets the browser call the API directly with a mutating method', () => {
    // `fetchApi` é o cliente que fala com a API por outra origem. Um PUT ou um
    // DELETE aqui exigiria preflight, e a suposição que sustenta a política de
    // CORS deixaria de valer em silêncio.
    const source = stripComments(readFileSync(API_CLIENT, 'utf8'));
    const methods = callsTo(source, 'fetchApi').map(methodOf);

    expect(methods.length).toBeGreaterThan(5);
    expect([...new Set(methods)].sort()).toEqual(PUBLIC_METHODS);
  });

  it('routes every mutation through the same-origin BFF', () => {
    const source = stripComments(readFileSync(API_CLIENT, 'utf8'));
    const methods = callsTo(source, 'fetchWebApi').map(methodOf);

    // As quatro mutações de conta: preferências e newsletter (PUT), salvar
    // (POST) e remover (DELETE) — e todas por rota same-origin do Next.
    expect(methods).toContain('PUT');
    expect(methods).toContain('DELETE');
  });
});
