import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * **Variável que a API lê ⇒ variável que o blueprint declara.**
 *
 * O achado da §11.7, e é do tipo que só aparece quando alguém recria o serviço:
 * o `render.yaml` declarava 15 variáveis e **não declarava `AUTH_JWT_SECRET`
 * nem `ADMIN_EMAILS`**. As duas estão no `.env.example` e no `setup.md`, e
 * estavam configuradas à mão no painel do Render desde 16/08 — foi assim que o
 * login de produção passou a funcionar.
 *
 * Enquanto o serviço atual existir, funciona. Recriado a partir do blueprint,
 * ele sobe **sem autenticação configurada**, e `verifyAuthJwt` falha fechado: o
 * sintoma seria toda rota de conta devolvendo 401 num serviço com health check
 * verde. É exatamente o formato de defeito que este projeto já catalogou duas
 * vezes — o pacote que compilava sem emitir JavaScript e a rota de metadata que
 * o middleware engolia: tudo verde, e a coisa não funciona.
 *
 * **O `zod` não protege contra isto, e é por isso que a guarda é necessária.**
 * `AUTH_JWT_SECRET` é `.optional()` no schema — tem de ser, senão a API não sobe
 * em desenvolvimento —, então "variável obrigatória" não é o critério. O
 * critério é **declarada**: toda chave que o schema conhece aparece no
 * blueprint, ou tem uma linha aqui dizendo por que não.
 *
 * A leitura é estática, como as outras guardas de `tests/build/`: importar
 * `src/config/env` executaria o parse de carga do módulo, que chama
 * `process.exit(1)` quando falta variável — dentro do processo de teste.
 */

const REPO_ROOT = join(__dirname, '../../../..');
const RENDER_YAML = join(REPO_ROOT, 'render.yaml');
const ENV_SOURCE = join(__dirname, '../../src/config/env.ts');

/**
 * Leitura com fim de linha normalizado.
 *
 * O `render.yaml` chega com CRLF numa checkout do Windows e com LF no runner do
 * CI. Guarda que casa fim de linha mede o sistema operacional de quem rodou, e
 * foi a primeira coisa que esta suíte reprovou.
 */
function read(path: string): string {
  return readFileSync(path, 'utf8').split('\r\n').join('\n');
}

/**
 * Chaves que a API lê e o blueprint não declara, e por quê.
 *
 * As duas são da plataforma, não do produto:
 *
 * - **`PORT`** é injetada pelo Render em todo serviço web; declará-la aqui
 *   sobrescreveria o valor que ele escolheu;
 * - **`HOST`** tem default `0.0.0.0`, que é o único bind que funciona num
 *   container — não há segundo valor plausível a configurar.
 */
const NOT_IN_BLUEPRINT: Record<string, string> = {
  PORT: 'injetada pelo Render em todo serviço web',
  HOST: 'default 0.0.0.0 é o único bind que funciona num container',
};

/** As chaves do `envSchema`, lidas do fonte. */
function schemaKeys(): string[] {
  const source = read(ENV_SOURCE);
  const block = /export const envSchema = z\.object\(\{([\s\S]*?)\n\}\);/.exec(source);
  if (!block) return [];

  return [...(block[1] as string).matchAll(/^\s{2}([A-Z][A-Z0-9_]*)\s*:/gm)].map(
    (match) => match[1] as string,
  );
}

/** As chaves declaradas no blueprint. */
function blueprintKeys(): string[] {
  return [...read(RENDER_YAML).matchAll(/^\s*-\s*key:\s*([A-Z][A-Z0-9_]*)\s*$/gm)].map(
    (match) => match[1] as string,
  );
}

describe('paridade de ambiente: render.yaml × o que a API exige', () => {
  it('declares every variable the API reads', () => {
    const declared = new Set(blueprintKeys());
    const missing = schemaKeys().filter(
      (key) => !declared.has(key) && !(key in NOT_IN_BLUEPRINT),
    );

    expect(missing).toEqual([]);
  });

  it('does not declare a variable the API no longer reads', () => {
    // `NODE_VERSION` é do runtime do Render, não do schema — e é a única.
    const known = new Set([...schemaKeys(), 'NODE_VERSION']);
    const stale = blueprintKeys().filter((key) => !known.has(key));

    expect(stale).toEqual([]);
  });

  it('does not carry an exception for a variable that is declared anyway', () => {
    const declared = new Set(blueprintKeys());
    expect(Object.keys(NOT_IN_BLUEPRINT).filter((key) => declared.has(key))).toEqual([]);
  });

  it('keeps the shared secret out of the repository', () => {
    // `sync: false` é o que diz "o valor vem do painel". Um valor literal aqui
    // seria o segredo compartilhado entre as duas metades, versionado.
    const yaml = read(RENDER_YAML);
    expect(yaml).toMatch(/- key: AUTH_JWT_SECRET\n\s*sync: false/);
    expect(yaml).toMatch(/- key: ADMIN_EMAILS\n\s*sync: false/);
  });

  it('finds keys on both sides — a parser that returns nothing would pass everything', () => {
    expect(schemaKeys().length).toBeGreaterThan(15);
    expect(schemaKeys()).toContain('AUTH_JWT_SECRET');
    expect(blueprintKeys().length).toBeGreaterThan(15);
    expect(blueprintKeys()).toContain('DATABASE_URL');
  });
});
