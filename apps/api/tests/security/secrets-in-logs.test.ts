import { describe, it, expect, vi } from 'vitest';
import ts from 'typescript';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

/**
 * **O segredo que saía do processo e ia parar no log do Render.**
 *
 * A inspeção de 01/09/2026 (§1 do plano de observabilidade) mediu o vazamento e
 * o endereço exato: `app.ts` chamava `request.log.error({ err, ... })` **sem
 * serializer**, e uma falha de conexão do Prisma carrega a **DSN com senha**
 * dentro de `err.message`. O `redact` do pino não alcança isso — ele trabalha
 * por **caminho** (`req.headers.authorization`), e `err.message` é texto livre.
 *
 * Por isso o conserto é o serializer de `err`, e esta guarda o exercita com o
 * artigo real, não com um dublê. Ela tem três metades:
 *
 * 1. **o segredo não sobrevive** — DSN, `Bearer <token>`, e o **valor literal**
 *    de cada segredo conhecido do ambiente;
 * 2. **o diagnóstico sobrevive** — `P1001`, `name`, `code`, `statusCode`. Uma
 *    redação que apaga a frase inteira "passa" nesta suíte pelo motivo errado,
 *    e é isso que a asserção de caminho feliz existe para impedir;
 * 3. **`console.*` não volta** — metade estática, com mapa de exceções que
 *    exige motivo escrito.
 *
 * Irmão do `pii-in-logs.test.ts`, que fecha o mesmo tipo de buraco para
 * endereço de e-mail.
 */

/**
 * **O `env` é lido na carga do módulo**, e `redactSecrets` conhece o **valor**
 * de cada segredo — então o que este mock define é exatamente o que a guarda
 * mede. Sem ele a suíte mediria os valores do `tests/setup.ts`, que existem por
 * outro motivo e podem mudar sem que ninguém pense nesta asserção.
 */
vi.mock('../../src/config/env', () => ({
  env: {
    NODE_ENV: 'test',
    DATABASE_URL: 'postgresql://newra:senha-do-banco@ep-quiet-1.neon.tech/newranews',
    JOB_SECRET: 'segredo-do-job-de-verdade',
    AUTH_JWT_SECRET: 'segredo-jwt-compartilhado',
    GEMINI_API_KEY: 'chave-gemini-1234567890',
    GROQ_API_KEY: 'chave-groq-1234567890',
    RESEND_API_KEY: 'chave-resend-1234567890',
    NEWSDATA_API_KEY: 'chave-newsdata-1234567890',
  },
}));

const { redactSecrets, REDACTED_SECRET } = await import('../../src/utils/redact');
const { redactingErrSerializer, MAX_MESSAGE_CHARS, MAX_STACK_FRAMES } = await import(
  '../../src/utils/logger'
);

interface SerializedError {
  name?: string;
  message?: string;
  stack?: string;
  code?: unknown;
  statusCode?: unknown;
}

const serialize = (error: unknown): SerializedError =>
  redactingErrSerializer(error) as SerializedError;

describe('redactSecrets', () => {
  it('masks the password of a Postgres DSN and keeps the host', () => {
    // O host é diagnóstico — é o que diz *qual* banco não respondeu. A senha é
    // a única parte que não pode sobreviver.
    const out = redactSecrets(
      'P1001: cannot reach postgresql://u:hunter2@db.example.com:5432/x',
    );

    expect(out).not.toContain('hunter2');
    expect(out).toContain('db.example.com');
    expect(out).toContain(REDACTED_SECRET);
  });

  it('masks a bearer token without eating the word that identifies it', () => {
    const out = redactSecrets(
      '401 from provider (sent Authorization: Bearer abcdef0123456789)',
    );

    expect(out).not.toContain('abcdef0123456789');
    expect(out).toContain('Bearer');
    expect(out).toContain(REDACTED_SECRET);
  });

  it('masks the literal value of every known secret in the environment', () => {
    // **A parte forte, e o motivo de não ser corrida armamentista de regex:**
    // não é preciso adivinhar o *formato* de um segredo quando se conhece o
    // valor. Um segredo que vaze em formato nenhum reconhecível continua sendo
    // pego, desde que seja um dos que o processo carrega.
    const secrets = [
      'segredo-do-job-de-verdade',
      'segredo-jwt-compartilhado',
      'chave-gemini-1234567890',
      'chave-groq-1234567890',
      'chave-resend-1234567890',
      'chave-newsdata-1234567890',
    ];

    for (const secret of secrets) {
      expect(redactSecrets(`falhou com ${secret} no meio da frase`)).not.toContain(secret);
    }
  });

  it('leaves text without a secret untouched', () => {
    const text = 'ETIMEDOUT ao ler o feed da Folha';
    expect(redactSecrets(text)).toBe(text);
  });
});

describe('o serializer de `err` não deixa segredo chegar ao log', () => {
  it('redacts the Prisma DSN that arrives inside err.message', () => {
    const error = Object.assign(
      new Error(
        "P1001: Can't reach database server at `postgresql://newra:senha-do-banco@ep-quiet-1.neon.tech/newranews`",
      ),
      { name: 'PrismaClientInitializationError', code: 'P1001' },
    );

    const out = serialize(error);

    expect(out.message).not.toContain('senha-do-banco');
    // **O diagnóstico sobrevive** — é a metade que uma redação boa demais
    // quebra, e sem ela esta suíte passaria com um serializer que devolve
    // string vazia.
    expect(out.message).toContain('P1001');
    expect(out.name).toBe('PrismaClientInitializationError');
    expect(out.code).toBe('P1001');
  });

  it('redacts a bearer token carrying the JOB_SECRET', () => {
    const out = serialize(
      new Error('recusou: Authorization: Bearer segredo-do-job-de-verdade'),
    );

    expect(out.message).not.toContain('segredo-do-job-de-verdade');
    expect(out.message).toContain('recusou');
  });

  it('redacts an e-mail address, reusing the redactor that already exists', () => {
    const out = serialize(new Error('Invalid `to` field: assinante@exemplo.com (422)'));

    expect(out.message).not.toContain('assinante@exemplo.com');
    expect(out.message).toContain('422');
  });

  it('redacts the stack too — the DSN appears there as often as in the message', () => {
    const error = new Error('boom');
    error.stack = [
      'Error: boom',
      '    at connect (postgresql://newra:senha-do-banco@ep-quiet-1.neon.tech/newranews)',
    ].join('\n');

    expect(serialize(error).stack).not.toContain('senha-do-banco');
  });

  it('truncates a runaway message', () => {
    const out = serialize(new Error('x'.repeat(MAX_MESSAGE_CHARS + 500)));

    expect((out.message as string).length).toBeLessThan(MAX_MESSAGE_CHARS + 40);
  });

  it('truncates the stack to a readable number of frames', () => {
    const error = new Error('boom');
    error.stack = [
      'Error: boom',
      ...Array.from({ length: 40 }, (_, i) => `    at frame${i} (file.ts:${i}:1)`),
    ].join('\n');

    expect((serialize(error).stack as string).split('\n').length).toBeLessThanOrEqual(
      MAX_STACK_FRAMES + 2,
    );
  });

  it('drops the properties it was not asked to keep', () => {
    /**
     * **Lista de permissão, não de bloqueio.** O `ai.service` pendura um
     * `primaryError` inteiro na exceção do fallback; serializar tudo que o erro
     * carrega seria serializar um segundo erro sem passar por redação nenhuma.
     * O que sobrevive é o que está escrito no serializer.
     */
    const error = Object.assign(new Error('groq falhou'), {
      primaryError: new Error('gemini: Bearer chave-gemini-1234567890'),
      statusCode: 502,
    });

    const out = serialize(error);

    expect(out).not.toHaveProperty('primaryError');
    expect(out.statusCode).toBe(502);
  });

  it('survives something that is not an Error at all', () => {
    // `catch (e)` recebe o que foi lançado, e nem tudo que se lança é `Error`.
    const out = serialize('postgresql://newra:senha-do-banco@ep-quiet-1.neon.tech/newranews');

    expect(out.message).not.toContain('senha-do-banco');
  });
});

// ── Metade estática: `console.*` não volta ──────────────────────────────────

const API_SRC = join(__dirname, '../../src');

/**
 * Arquivos que continuam podendo usar `console.*`, e por quê.
 *
 * Um só, e a razão é de ordem de carga: o parse do ambiente roda **antes de o
 * logger existir** — `logger.ts` importa `env` — e termina em `process.exit(1)`.
 * Um logger ali seria um logger configurado por variáveis que acabaram de ser
 * declaradas inválidas.
 */
const CONSOLE_ALLOWED: Record<string, string> = {
  'config/env.ts':
    'roda na carga do módulo, antes de o logger existir, e é seguido de process.exit(1)',
};

/**
 * As chamadas a `console.*` de um arquivo, contadas pelo **parser do
 * TypeScript**.
 *
 * ## A primeira versão era um scanner de caracteres, e ela passou verde sobre o
 * defeito que existe para achar
 *
 * O raciocínio parecia sólido — um `replace(/\/\/.*$/gm, '')` apagaria a linha
 * a partir do `//` de um `'https://…'`, então escrevi um scanner que trata
 * aspas como delimitador de string. **Ele engolia 481 linhas do `src/`.**
 *
 * A causa é uma aspa **dentro de um literal de expressão regular**:
 * `.replace(/"/g, '&quot;')`, que existe em `routes/dev/dashboard.ts:23` e em
 * `services/newsletter.service.ts:27`. O scanner via aquela `"` como abertura de
 * string e consumia tudo até a próxima — que não vinha —, deixando **254 e 227
 * linhas invisíveis**. Medido: um `console.warn` acrescentado ao fim do
 * `dashboard.ts` passava na guarda sem uma falha.
 *
 * **Distinguir literal de regex de uma divisão exige o token anterior**, que é
 * gramática, não caractere. É a sexta vez que esta família aparece no projeto e
 * a lição finalmente virou outra: onde existe um parser de verdade, use o
 * parser. `typescript` já é dependência de desenvolvimento daqui, e
 * `createSourceFile` responde exatamente o que a guarda pergunta.
 */
function consoleCalls(source: string, fileName: string): number {
  const tree = ts.createSourceFile(fileName, source, ts.ScriptTarget.ES2022, false, ts.ScriptKind.TS);
  let found = 0;

  const visit = (node: ts.Node): void => {
    // `console.warn(...)` e também `console['warn'](...)`.
    if (ts.isCallExpression(node)) {
      const target = ts.isPropertyAccessExpression(node.expression)
        ? node.expression.expression
        : ts.isElementAccessExpression(node.expression)
          ? node.expression.expression
          : undefined;
      if (target && ts.isIdentifier(target) && target.text === 'console') found += 1;
    }
    ts.forEachChild(node, visit);
  };

  visit(tree);
  return found;
}

/** Todo `.ts` sob `src/`, como caminho relativo com barra normal. */
function sourceFiles(dir: string = API_SRC): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return entry.endsWith('.ts') ? [relative(API_SRC, full).split(sep).join('/')] : [];
  });
}

/** Arquivos com chamada real a `console.*`. */
function filesCallingConsole(): string[] {
  return sourceFiles().filter(
    (file) => consoleCalls(readFileSync(join(API_SRC, file), 'utf8'), file) > 0,
  );
}

describe('nenhum `console.*` contorna o logger', () => {
  it('finds no call outside the written exceptions', () => {
    expect(filesCallingConsole().filter((file) => !(file in CONSOLE_ALLOWED))).toEqual([]);
  });

  it('does not carry an exception for a file that no longer calls console', () => {
    const calling = new Set(filesCallingConsole());
    expect(Object.keys(CONSOLE_ALLOWED).filter((file) => !calling.has(file))).toEqual([]);
  });

  it('scans the whole tree — a walker that returns nothing would pass everything', () => {
    const files = sourceFiles();

    expect(files.length).toBeGreaterThan(50);
    expect(files).toContain('utils/logger.ts');
    expect(files).toContain('services/pipeline.service.ts');
    // Controle positivo: a única exceção escrita **é** encontrada. Uma varredura
    // que devolvesse lista vazia passaria nas duas primeiras asserções.
    expect(filesCallingConsole()).toContain('config/env.ts');
  });

  it('counts the call and nothing else — comment, string, template, regex', () => {
    const snippet = [
      '// antes isto era console.warn(x)',
      '/* e aqui também: console.error(y) */',
      "const url = 'https://a.b'; const s = `console.info(z)`;",
      'console.debug(w);',
    ].join('\n');

    expect(consoleCalls(snippet, 'sintetico.ts')).toBe(1);
  });

  it('is not fooled by a quote inside a regex literal — the bug this guard had', () => {
    /**
     * A regressão exata. O scanner de caracteres devolvia **zero** aqui: a `"`
     * do literal de regex abria uma string que nunca fechava, e a chamada da
     * linha seguinte desaparecia junto com o resto do arquivo.
     */
    const snippet = [
      `const escape = (s) => s.replace(/"/g, '&quot;').replace(/'/g, '&#39;');`,
      'console.debug("depois do literal de regex");',
    ].join('\n');

    expect(consoleCalls(snippet, 'sintetico.ts')).toBe(1);
  });
});
