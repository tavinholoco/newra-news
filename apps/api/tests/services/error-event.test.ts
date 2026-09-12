import { describe, it, expect, beforeEach, vi } from 'vitest';
import ts from 'typescript';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { prisma } from '@newranews/database';
import { pipelineContext } from '../../src/utils/logger';
import {
  ERROR_EVENT_RETENTION_DAYS,
  deleteExpiredErrorEvents,
  fingerprintFor,
  flushErrorEvents,
  flushErrorEventsBeforeClose,
  pendingErrorEventCount,
  pendingErrorEvents,
  recordError,
  resetErrorEventBuffer,
  windowStartFor,
} from '../../src/services/error-event.service';

/**
 * **A guarda da §8 — o registro durável, e o teto que o mantém barato.**
 *
 * Três coisas precisam continuar sendo verdade, e cada uma já tem história
 * neste projeto:
 *
 * 1. **`recordError` é síncrona.** Armadilha 2 do §17: escrever no banco dentro
 *    do tratamento de um erro *de banco* é falha auto-amplificante. O dia em
 *    que ela virar `async`, alguém acrescenta um `await` no handler e a ida ao
 *    banco entra no caminho que já falhou.
 * 2. **Ela coalesce.** Armadilha 5: sem isso, um laço que falha em cada
 *    iteração escreve linha na velocidade em que falha.
 * 3. **Ela nunca lança**, e a falha de persistência **não se registra de
 *    volta** — o laço se fecharia exatamente quando o banco está fora.
 */

vi.mock('@newranews/database', async () => {
  const actual = await vi.importActual<typeof import('@newranews/database')>(
    '@newranews/database',
  );
  return {
    ...actual,
    prisma: {
      errorEvent: {
        upsert: vi.fn().mockResolvedValue({}),
        deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
    },
  };
});

const AT = new Date('2026-09-10T14:37:12.345Z');

function anError(overrides: Partial<Parameters<typeof recordError>[0]> = {}) {
  return {
    origin: 'API' as const,
    severity: 'ERROR' as const,
    code: 'INTERNAL',
    category: 'internal',
    message: 'the archive did not answer',
    route: '/api/news/:id',
    statusCode: 500,
    ...overrides,
  };
}

beforeEach(() => {
  resetErrorEventBuffer();
  vi.mocked(prisma.errorEvent.upsert).mockClear();
  vi.mocked(prisma.errorEvent.deleteMany).mockClear();
});

describe('§8 — o contrato de `recordError`', () => {
  /**
   * **A pergunta é sobre a forma da função, então quem responde é o parser.**
   *
   * A primeira versão desta guarda lia o valor de retorno em tempo de execução
   * (`expect(recordError(...)).toBeUndefined()`), e o CodeQL a acusou com razão
   * — `js/use-of-returnless-function`: ler o retorno de uma função `void` é
   * defeito em qualquer outro lugar do código, e uma guarda não é exceção que
   * valha um alerta aberto para todo leitor futuro explicar.
   *
   * **A sugestão automática, essa, não serve:** ela trocava a asserção por
   * `expect(() => recordError(...)).not.toThrow()`, que mede outra coisa — e
   * que este arquivo **já** mede, três linhas abaixo. Seria apagar uma guarda
   * e duplicar outra.
   *
   * O que sobra cobre **mais** que a versão acusada, e é o ponto: são duas
   * formas de quebrar o contrato, e cada asserção pega uma que a outra não
   * pega.
   *
   * - `async function recordError(…)` — o `async` obriga o retorno declarado a
   *   virar `Promise<void>`, e é a forma óbvia;
   * - `function recordError(…): Promise<void> { return flush(); }` — **sem
   *   `async`**, que a checagem de modificador sozinha deixaria passar, e que a
   *   asserção de tempo de execução pegava.
   *
   * As duas juntas são o que torna a leitura do retorno dispensável.
   */
  it('é síncrona: sem `async` e com retorno declarado `void`', () => {
    const source = ts.createSourceFile(
      'error-event.service.ts',
      readFileSync(join(__dirname, '../../src/services/error-event.service.ts'), 'utf8'),
      ts.ScriptTarget.ES2022,
      false,
      ts.ScriptKind.TS,
    );

    let found: ts.FunctionDeclaration | undefined;
    const visit = (node: ts.Node): void => {
      if (ts.isFunctionDeclaration(node) && node.name?.text === 'recordError') found = node;
      ts.forEachChild(node, visit);
    };
    visit(source);

    expect(found, 'recordError não foi encontrada — a guarda ficaria vazia').toBeDefined();

    const isAsync = found?.modifiers?.some((m) => m.kind === ts.SyntaxKind.AsyncKeyword);
    expect(isAsync ?? false).toBe(false);

    // O retorno **declarado**, e não o inferido: `Promise<void>` aqui é o dia em
    // que alguém acrescenta um `await` no handler de erro e põe a ida ao banco
    // dentro do caminho que já falhou.
    expect(found?.type?.getText(source)).toBe('void');
  });

  it('não lança quando o buffer recebe lixo', () => {
    expect(() =>
      recordError(anError({ context: { weird: undefined } as never }), AT),
    ).not.toThrow();
  });
});

describe('§8 — uma linha por (fingerprint, hora)', () => {
  it('conta a mesma falha em vez de guardar uma entrada por ocorrência', async () => {
    recordError(anError(), AT);
    recordError(anError(), AT);
    recordError(anError(), AT);

    expect(pendingErrorEvents()).toHaveLength(1);
    expect(pendingErrorEventCount()).toBe(3);

    await flushErrorEvents();

    expect(prisma.errorEvent.upsert).toHaveBeenCalledTimes(1);
    const [arg] = vi.mocked(prisma.errorEvent.upsert).mock.calls[0] as [
      { create: { count: number }; update: { count: { increment: number } } },
    ];
    expect(arg.create.count).toBe(3);
    // Incremento e não atribuição: dois flushes da mesma janela somam.
    expect(arg.update.count.increment).toBe(3);
  });

  it('a hora cheia em UTC é a janela', () => {
    expect(windowStartFor(AT).toISOString()).toBe('2026-09-10T14:00:00.000Z');
  });

  it('separa por hora', () => {
    recordError(anError(), AT);
    recordError(anError(), new Date('2026-09-10T15:00:00.000Z'));

    expect(pendingErrorEvents()).toHaveLength(2);
  });

  it('separa por rota — é a rota que distingue os nove sítios do NOT_FOUND', () => {
    recordError(anError({ route: '/api/news/:id' }), AT);
    recordError(anError({ route: '/api/articles/:date' }), AT);

    expect(pendingErrorEvents()).toHaveLength(2);
  });

  it('separa por severidade, com todo o resto igual', () => {
    /**
     * **Só a severidade muda**, e é o que torna esta asserção capaz de reprovar.
     *
     * A primeira versão comparava o par do pipeline (`PIPELINE_STAGE_DEGRADED`
     * em `WARN` contra `PIPELINE_STAGE_FAILED` em `ERROR`) — e como o **código**
     * já era diferente, ela continuava verde com a severidade removida do
     * fingerprint. Passava verde sobre o defeito que existia para achar, que é
     * a família que este projeto já pagou seis vezes. Só apareceu insistindo em
     * vê-la reprovar.
     */
    const asWarn = fingerprintFor({
      origin: 'API',
      severity: 'WARN',
      code: 'INTERNAL',
      route: '/api/news/:id',
    });
    const asError = fingerprintFor({
      origin: 'API',
      severity: 'ERROR',
      code: 'INTERNAL',
      route: '/api/news/:id',
    });

    expect(asWarn).not.toBe(asError);
  });

  it('usa o `pipelineLogId` de quem chama, e o contexto assíncrono só como reserva', () => {
    // A primeira versão lia só o `AsyncLocalStorage`. O enterro do run morto
    // (`triggerPipeline`, etapa 0) roda **fora** do contexto do run, e gravava
    // `null` sobre um id que estava na mão de quem chamava.
    recordError(anError({ pipelineLogId: 'run-explicito' }), AT);
    expect(pendingErrorEvents()[0]?.pipelineLogId).toBe('run-explicito');

    resetErrorEventBuffer();
    pipelineContext.run({ pipelineLogId: 'run-do-contexto' }, () => {
      recordError(anError(), AT);
    });
    expect(pendingErrorEvents()[0]?.pipelineLogId).toBe('run-do-contexto');
  });

  it('guarda as duas pontas da janela, que é o que liga a linha ao log', async () => {
    recordError(anError({ requestId: 'req-primeiro' }), AT);
    recordError(anError({ requestId: 'req-meio' }), AT);
    recordError(anError({ requestId: 'req-ultimo' }), AT);

    const [entry] = pendingErrorEvents();
    expect(entry?.firstRequestId).toBe('req-primeiro');
    expect(entry?.lastRequestId).toBe('req-ultimo');
  });
});

describe('§8 — o que sai daqui já está redigido', () => {
  it('não deixa a DSN chegar à coluna', async () => {
    recordError(
      anError({
        message: 'connect ECONNREFUSED postgresql://user:hunter2@db.neon.tech:5432/news',
      }),
      AT,
    );

    const [entry] = pendingErrorEvents();
    expect(entry?.message).not.toContain('hunter2');
  });

  it('descarta o que não é escalar no context', () => {
    recordError(
      anError({ context: { stage: 'renormalize', attempt: 3, nested: {} } as never }),
      AT,
    );

    const [entry] = pendingErrorEvents();
    expect(entry?.context).toEqual({ stage: 'renormalize', attempt: 3 });
  });
});

describe('§8 — o flush, e o laço que ele não fecha', () => {
  it('esvazia o buffer antes de ir ao banco', async () => {
    recordError(anError(), AT);
    const flushing = flushErrorEvents();

    expect(pendingErrorEventCount()).toBe(0);
    await flushing;
  });

  it('não lança quando o banco recusa, e não registra a própria falha', async () => {
    vi.mocked(prisma.errorEvent.upsert).mockRejectedValueOnce(new Error('P1001'));
    recordError(anError(), AT);

    await expect(flushErrorEvents()).resolves.toBeUndefined();
    // Se a falha de persistência virasse `recordError`, o buffer voltaria a
    // encher — e encheria justamente quando o banco está fora.
    expect(pendingErrorEventCount()).toBe(0);
  });

  it('o `FATAL` não espera o intervalo', async () => {
    recordError(anError({ severity: 'FATAL' }), AT);
    await vi.waitFor(() => expect(prisma.errorEvent.upsert).toHaveBeenCalled());
  });

  it('o flush de desligamento desiste no prazo em vez de segurar o `close`', async () => {
    // O modo de falha que isto impede foi medido: sem prazo, a suíte de rota
    // que não mocka o Prisma travou o `afterAll` em 10 s de timeout de hook,
    // contra um banco que nem estava no ar.
    vi.mocked(prisma.errorEvent.upsert).mockImplementationOnce(
      () => new Promise(() => undefined) as never,
    );
    recordError(anError(), AT);

    const started = Date.now();
    await flushErrorEventsBeforeClose(50);

    expect(Date.now() - started).toBeLessThan(1_000);
  });
});

describe('§8 — a retenção', () => {
  it('apaga por `windowStart`, com corte em 14 dias', async () => {
    const now = new Date('2026-09-10T00:00:00.000Z');
    await deleteExpiredErrorEvents(now);

    const [arg] = vi.mocked(prisma.errorEvent.deleteMany).mock.calls[0] as [
      { where: { windowStart: { lt: Date } } },
    ];
    const days = Math.round(
      (now.getTime() - arg.where.windowStart.lt.getTime()) / 86_400_000,
    );

    expect(days).toBe(ERROR_EVENT_RETENTION_DAYS);
    expect(ERROR_EVENT_RETENTION_DAYS).toBe(14);
  });
});

/**
 * O teto do fingerprint, do lado que a guarda da Fase 3 não alcança.
 *
 * `error-taxonomy.test.ts` cobra que todo `code` de um `AppError` seja literal
 * do tuple. `recordError` recebe `code: string` — porque `origin: PIPELINE`
 * traz falha que não passa pelo tuple —, e é justamente aí que um
 * `code: \`stage-${n}\`` entraria sem nada acusar, trocando o teto da tabela
 * por "uma linha por valor de n".
 */
describe('§8 — nenhum `code` interpolado chega ao `recordError`', () => {
  const API_SRC = join(__dirname, '../../src');

  function sourceFiles(dir: string = API_SRC): string[] {
    return readdirSync(dir).flatMap((entry) => {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) return sourceFiles(full);
      return entry.endsWith('.ts') ? [relative(API_SRC, full).split(sep).join('/')] : [];
    });
  }

  interface CodeArgument {
    file: string;
    text: string;
    /**
     * As três formas com teto, e `undefined` para o defeito.
     *
     * - `literal` — `code: 'INTERNAL'`;
     * - `identifier` — `code: UNHANDLED_CODE`, constante do módulo;
     * - `taxonomy` — `code: error.code`, a leitura da propriedade que o
     *   `error-taxonomy.test.ts` já limita ao tuple. **A regra é o nome da
     *   propriedade, não o objeto**: um `algo.name` qualquer continua sendo o
     *   defeito, e é a leitura de `.code` que a outra guarda torna segura.
     */
    kind: 'literal' | 'identifier' | 'taxonomy' | undefined;
  }

  /** Todo `code:` passado a `recordError`, em `src/`. */
  function codeArguments(): CodeArgument[] {
    const found: CodeArgument[] = [];

    for (const file of sourceFiles()) {
      const tree = ts.createSourceFile(
        file,
        readFileSync(join(API_SRC, file), 'utf8'),
        ts.ScriptTarget.ES2022,
        false,
        ts.ScriptKind.TS,
      );

      const visit = (node: ts.Node): void => {
        if (
          ts.isCallExpression(node) &&
          ts.isIdentifier(node.expression) &&
          node.expression.text === 'recordError'
        ) {
          for (const arg of node.arguments) {
            if (!ts.isObjectLiteralExpression(arg)) continue;
            for (const property of arg.properties) {
              if (!ts.isPropertyAssignment(property)) continue;
              if (property.name.getText(tree) !== 'code') continue;

              const initializer = property.initializer;
              // `x ? A : B` é aceito quando os dois ramos são constantes — é a
              // forma que o `pipeline-event.service` usa para escolher entre
              // degradado e falho.
              const branches = ts.isConditionalExpression(initializer)
                ? [initializer.whenTrue, initializer.whenFalse]
                : [initializer];

              for (const branch of branches) {
                found.push({
                  file,
                  text: branch.getText(tree),
                  kind: ts.isStringLiteral(branch)
                    ? 'literal'
                    : ts.isIdentifier(branch)
                      ? 'identifier'
                      : ts.isPropertyAccessExpression(branch) &&
                          branch.name.text === 'code'
                        ? 'taxonomy'
                        : undefined,
                });
              }
            }
          }
        }
        ts.forEachChild(node, visit);
      };

      visit(tree);
    }

    return found;
  }

  it('acha o que precisa achar — varredura vazia aprovaria tudo', () => {
    const found = codeArguments();

    expect(found.length).toBeGreaterThanOrEqual(3);
    expect(found.map((c) => c.text)).toContain('UNHANDLED_CODE');
  });

  it('todo `code` é literal ou constante nomeada', () => {
    const interpolated = codeArguments().filter((c) => c.kind === undefined);

    expect(interpolated.map((c) => `${c.file}: ${c.text}`)).toEqual([]);
  });
});
