import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import ts from 'typescript';
import {
  MAX_CAUSE_DEPTH,
  MAX_MESSAGE_CHARS,
  MAX_STACK_FRAMES,
  REDACTED_SECRET,
  WEB_SECRET_ENV_KEYS,
  logServerError,
  redactSecrets,
  serverErrorLine,
  shouldWriteServerLog,
} from '@/lib/log-server-error';
import { proxyToApi } from '@/lib/api-proxy';

/**
 * **A Fase 7a: os `catch` do BFF param de engolir a falha.**
 *
 * O §1 do plano de observabilidade mediu a frase inteira — *"todo `catch` do
 * BFF é vazio"*. Três deles transformam uma falha num status e não deixam
 * rastro nenhum: o 502 do `proxyToApi`, o 502 do repasse de eventos e o 500 do
 * disparo do pipeline. Os três rodam numa função da Vercel, onde **o log de
 * função é o log**: o que não for escrito em stderr ali não existe em lugar
 * nenhum.
 *
 * Esta guarda cobra as quatro coisas que a fase promete, e cada uma existe
 * porque a ausência dela já custou caro neste projeto:
 *
 * 1. **nenhum `catch` do BFF fica sem log** — por parser, nunca por regex
 *    (armadilha 27 do §17);
 * 2. **a redação cobre os segredos que este processo carrega**, e a lista sai
 *    do `.env.example` em vez de ser digitada num segundo lugar;
 * 3. **o `logServerError` está ligado** onde a fase diz que está (armadilha 28:
 *    guarda sobre a peça, sem guarda sobre a fiação, não guarda nada);
 * 4. **ele nunca derruba o caminho que observa** — o princípio 1 do §2.
 */

const WEB_ROOT = join(__dirname, '../..');

/**
 * O BFF, e só ele.
 *
 * `lib/api.ts` fica **de fora de propósito**: ele é o cliente HTTP compartilhado
 * com o navegador (`components/newsletter/subscribe-form.tsx` o importa de um
 * componente de cliente), e `process.stderr` não existe lá. O `catch` do
 * `getRelatedNews` continua engolindo a falha, e isso é dívida escrita — ver
 * `RELATED_NEWS_DEBT` abaixo.
 */
const BFF_PATHS = [join(WEB_ROOT, 'app', 'api'), join(WEB_ROOT, 'lib', 'api-proxy.ts')];

/**
 * `catch` sem log, e o motivo de cada um. A chave é `<arquivo>#<função>` — e não
 * a linha, que apodrece a cada edição que passa perto.
 */
const CATCH_ALLOWED: Record<string, string> = {
  'app/api/cron/daily-news/route.ts#warmApi':
    'falhar é o caminho esperado — a API hibernando é o motivo de a função existir, e a própria tentativa é o que a acorda. O desfecho viaja em `warmed`, que o catch do disparo loga',
};

function collectFiles(target: string): string[] {
  if (statSync(target).isFile()) return /\.tsx?$/.test(target) ? [target] : [];
  return readdirSync(target).flatMap((entry) => collectFiles(join(target, entry)));
}

function relativePath(file: string): string {
  return relative(WEB_ROOT, file).split(sep).join('/');
}

/** O nome da função que envolve o nó — a chave estável da lista de exceção. */
function enclosingName(node: ts.Node): string {
  for (let current = node.parent; current; current = current.parent) {
    if (ts.isFunctionDeclaration(current) && current.name) return current.name.text;
    if (ts.isMethodDeclaration(current) && ts.isIdentifier(current.name)) {
      return current.name.text;
    }
    if (
      (ts.isArrowFunction(current) || ts.isFunctionExpression(current)) &&
      ts.isVariableDeclaration(current.parent) &&
      ts.isIdentifier(current.parent.name)
    ) {
      return current.parent.name.text;
    }
  }
  return '<top-level>';
}

interface CatchSite {
  key: string;
  logs: boolean;
}

/**
 * Os `catch` de um arquivo, pelo **parser do TypeScript**.
 *
 * Armadilha 27 do §17, e ela é literal aqui: a pergunta *"este `catch` chama o
 * logger?"* é sobre a estrutura do código — onde o bloco começa, onde termina, e
 * o que é chamada de função lá dentro. Uma varredura de texto responderia *"o
 * arquivo menciona `logServerError` em algum lugar"*, que passa verde num
 * arquivo com dois `catch` e um log só — que é exatamente a forma do
 * `daily-news/route.ts`.
 *
 * `.catch(() => null)` **não** entra na conta: não é `CatchClause`, é chamada de
 * método. Os três que existem (o parse de JSON do proxy, o do repasse de eventos
 * e o do `run-pipeline`) têm o desfecho no corpo da resposta, e é lá que eles são
 * cobrados — o `bff-seam.test.ts` já reprova corpo `null`.
 */
function catchSitesIn(source: string, label: string): CatchSite[] {
  const tree = ts.createSourceFile(
    label,
    source,
    ts.ScriptTarget.ES2022,
    /* setParentNodes */ true,
    label.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );

  const sites: CatchSite[] = [];

  const callsLogger = (root: ts.Node): boolean => {
    let found = false;
    const walk = (node: ts.Node): void => {
      if (
        ts.isCallExpression(node) &&
        ts.isIdentifier(node.expression) &&
        node.expression.text === 'logServerError'
      ) {
        found = true;
      }
      ts.forEachChild(node, walk);
    };
    walk(root);
    return found;
  };

  const visit = (node: ts.Node): void => {
    if (ts.isCatchClause(node)) {
      sites.push({ key: `${label}#${enclosingName(node)}`, logs: callsLogger(node.block) });
    }
    ts.forEachChild(node, visit);
  };

  visit(tree);
  return sites;
}

function catchSites(file: string): CatchSite[] {
  return catchSitesIn(readFileSync(file, 'utf8'), relativePath(file));
}

function allCatchSites(): CatchSite[] {
  return BFF_PATHS.flatMap(collectFiles).flatMap(catchSites);
}

describe('BFF — nenhum `catch` engole a falha em silêncio', () => {
  it('logs from every catch outside the written exceptions', () => {
    const silent = allCatchSites()
      .filter((site) => !site.logs)
      .map((site) => site.key)
      .filter((key) => !(key in CATCH_ALLOWED));

    expect([...new Set(silent)]).toEqual([]);
  });

  it('finds catch clauses at all — a parser that returns nothing would pass everything', () => {
    // A guarda da Fase 1 passou verde sobre um `console.warn` real porque a
    // varredura tinha apagado 481 linhas do `src/`. A asserção que faltava era
    // esta: o coletor **acha** alguma coisa.
    const sites = allCatchSites();
    expect(sites.length).toBeGreaterThanOrEqual(4);
    expect(sites.filter((site) => site.logs).length).toBeGreaterThanOrEqual(3);
  });

  it('does not carry an exception for a catch that no longer exists', () => {
    const keys = new Set(allCatchSites().map((site) => site.key));
    expect(Object.keys(CATCH_ALLOWED).filter((key) => !keys.has(key))).toEqual([]);
  });

  it('reports a catch that does not log — the detector answers false too', () => {
    // Sem esta, "todo catch loga" poderia ser verdade porque o detector devolve
    // `true` para qualquer coisa. O par mínimo: um `catch` que loga e um que
    // não, pelo mesmo caminho de código da guarda.
    const sample = [
      'function silencioso() { try { a(); } catch { return 1; } }',
      'function ruidoso() { try { a(); } catch (e) { logServerError("s", e); } }',
    ].join('\n');
    const parsed = catchSitesIn(sample, 'sample.ts');

    expect(parsed.map((site) => site.logs)).toEqual([false, true]);
  });
});

/**
 * A dívida que esta fase **não** fecha, escrita para não ser redescoberta.
 *
 * O `getRelatedNews` do `lib/api.ts` devolve `[]` em qualquer falha e não
 * registra nada — o bloco "leia também" some sem sintoma. Ele não entra aqui
 * porque `lib/api.ts` viaja para o navegador, e o `logServerError` é
 * server-only. Fechá-lo pede um logger que saiba onde está rodando, que é
 * trabalho da §11.2/§11.3.
 *
 * **Gatilho:** a primeira vez que alguém perguntar por que a seção sumiu.
 */
describe('a dívida escrita continua sendo verdade', () => {
  it('still swallows the failure in getRelatedNews, and the file is still shared with the browser', () => {
    const api = readFileSync(join(WEB_ROOT, 'lib', 'api.ts'), 'utf8');
    expect(api).toContain('getRelatedNews');
    // Se um dia isto reprovar, a dívida foi paga — apague este teste e a nota.
    expect(api).not.toContain('logServerError');
  });
});

/**
 * **`process.stderr` não existe no navegador**, e o que impede este módulo de
 * chegar lá não é disciplina: é esta asserção.
 *
 * O caminho é curto e nada o sinaliza — `lib/api.ts` já viaja para o cliente
 * pelo `subscribe-form.tsx`, então bastaria alguém importar o logger de lá para
 * pôr o `logServerError` num componente de cliente. O build não reprova (o
 * `process` do navegador é um objeto vazio que o Next injeta), o `tsc` não
 * reprova, e o sintoma é uma tela em branco só no caminho da falha — que é o
 * caminho que ninguém exercita.
 */
describe('o logger do servidor não alcança o navegador', () => {
  it('is imported only from the BFF, never from a client component', () => {
    const SCANNED = ['app', 'lib', 'components'].map((dir) => join(WEB_ROOT, dir));
    const importers = SCANNED.flatMap(collectFiles).filter((file) =>
      /from\s+'@\/lib\/log-server-error'/.test(readFileSync(file, 'utf8')),
    );

    // Se o import sumir de todo lugar, a fase foi desfeita sem nada acusar.
    expect(importers.length).toBeGreaterThanOrEqual(3);

    const clientImporters = importers.filter((file) =>
      /^\s*['"]use client['"]/m.test(readFileSync(file, 'utf8')),
    );
    expect(clientImporters.map(relativePath)).toEqual([]);
  });
});

/**
 * **A lista de segredos sai do `.env.example`, não de um segundo lugar.**
 *
 * É a lição do `13` dos feeds em outra forma: lista que descreve uma coleção
 * quer guarda derivada da coleção. Segredo novo no `.env.example` sem linha na
 * redação reprova aqui, e não em produção.
 */
function secretKeysInEnvExample(): string[] {
  const example = readFileSync(join(WEB_ROOT, '.env.example'), 'utf8');
  return [...example.matchAll(/^([A-Z0-9_]*SECRET[A-Z0-9_]*)\s*=/gm)].map(
    (match) => match[1] ?? '',
  );
}

describe('a redação do BFF', () => {
  it('covers every secret the .env.example declares', () => {
    const declared = secretKeysInEnvExample();
    expect(declared.length).toBeGreaterThanOrEqual(4);
    expect(
      declared.filter((key) => !(WEB_SECRET_ENV_KEYS as readonly string[]).includes(key)),
    ).toEqual([]);
  });

  it('is a sibling of the API redactor, not a duplicate of it', () => {
    /**
     * O §11.1 manda escrever isto para ninguém "deduplicar" os dois, e a prosa
     * sozinha não reprova nada. Os dois conjuntos são **disjuntos nas duas
     * direções**: o `NEXTAUTH_SECRET` e os dois pares de OAuth só existem aqui;
     * o `DATABASE_URL` e as chaves dos provedores de IA só existem lá. Um
     * arquivo servindo aos dois carregaria, em cada processo, a lista do outro.
     */
    const apiRedact = readFileSync(join(WEB_ROOT, '../api/src/utils/redact.ts'), 'utf8');
    const apiKeys = [...apiRedact.matchAll(/^\s*'([A-Z0-9_]+)',$/gm)].map((m) => m[1] ?? '');
    const webKeys = WEB_SECRET_ENV_KEYS as readonly string[];

    expect(apiKeys.length).toBeGreaterThanOrEqual(5);
    expect(apiKeys.filter((key) => !webKeys.includes(key)).length).toBeGreaterThan(0);
    expect(webKeys.filter((key) => !apiKeys.includes(key)).length).toBeGreaterThan(0);
  });

  it('masks the literal value of each configured secret', () => {
    const originals = WEB_SECRET_ENV_KEYS.map((key) => [key, process.env[key]] as const);
    try {
      for (const key of WEB_SECRET_ENV_KEYS) process.env[key] = `valor-de-${key}-1234`;

      for (const key of WEB_SECRET_ENV_KEYS) {
        const leaked = `falhou com ${process.env[key]} no meio da frase`;
        expect(redactSecrets(leaked)).not.toContain(`valor-de-${key}`);
        expect(redactSecrets(leaked)).toContain(REDACTED_SECRET);
      }
    } finally {
      for (const [key, value] of originals) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    }
  });

  it('leaves a short or empty value alone — it would redact the whole line', () => {
    const original = process.env.CRON_SECRET;
    try {
      process.env.CRON_SECRET = '';
      expect(redactSecrets('nada a esconder')).toBe('nada a esconder');
      process.env.CRON_SECRET = 'abc';
      expect(redactSecrets('abcdefg')).toBe('abcdefg');
    } finally {
      if (original === undefined) delete process.env.CRON_SECRET;
      else process.env.CRON_SECRET = original;
    }
  });

  it('masks a bearer token that is not an env value — the JWT it signs per request', () => {
    // O `proxyToApi` assina um JWT por requisição: ele não está no ambiente,
    // então a camada de valor literal não o alcança. E ele carrega o id e o
    // e-mail de quem está lendo.
    const line = 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.abc.def';
    expect(redactSecrets(line)).toContain('Bearer');
    expect(redactSecrets(line)).not.toContain('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9');
  });
});

describe('a linha que o BFF escreve', () => {
  it('is one JSON object, in the shape the API already writes', () => {
    const line = serverErrorLine('bff.proxy', new Error('deu ruim'), {
      requestId: 'req-1',
    });
    const parsed = JSON.parse(line) as Record<string, unknown>;

    // pino escreve `level` numérico e `time` em ms — mesma forma, uma consulta
    // só para os dois lados da costura.
    expect(parsed.level).toBe(50);
    expect(typeof parsed.time).toBe('number');
    expect(parsed.scope).toBe('bff.proxy');
    expect(parsed.requestId).toBe('req-1');
    expect(parsed.msg).toBe('bff.proxy failed');
    expect((parsed.err as Record<string, unknown>).message).toBe('deu ruim');
    expect(line).not.toContain('\n');
  });

  it('reads ApiError.cause — the field documented as existing for the server log', () => {
    /**
     * O §11.1 nomeia isto: o `cause` do `lib/api.ts` é documentado como
     * existindo "para manter o rastro para o log do servidor" e **nenhum código
     * o lia**. É a mesma chave que salva o caso mais comum de todos: o undici
     * lança `TypeError: fetch failed`, e o que aconteceu de verdade
     * (`ECONNREFUSED`, `ETIMEDOUT`) está só no `cause`.
     */
    const cause = Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:3001'), {
      code: 'ECONNREFUSED',
    });
    const outer = Object.assign(new TypeError('fetch failed'), { cause });

    interface SerializedError {
      message: string;
      code?: unknown;
      cause?: SerializedError;
    }
    const err = JSON.parse(serverErrorLine('bff.proxy', outer)).err as SerializedError;

    expect(err.message).toBe('fetch failed');
    expect(err.cause?.message).toBe('connect ECONNREFUSED 127.0.0.1:3001');
    expect(err.cause?.code).toBe('ECONNREFUSED');
  });

  it('stops following cause before a cycle can hang it', () => {
    const a = new Error('a');
    const b = Object.assign(new Error('b'), { cause: a });
    Object.assign(a, { cause: b });

    const line = serverErrorLine('bff.proxy', a);
    let depth = 0;
    for (
      let node = JSON.parse(line).err as { cause?: unknown } | undefined;
      node?.cause;
      node = node.cause as { cause?: unknown }
    ) {
      depth += 1;
    }
    expect(depth).toBeLessThanOrEqual(MAX_CAUSE_DEPTH);
  });

  it('truncates the message and the stack', () => {
    const error = new Error('x'.repeat(MAX_MESSAGE_CHARS * 3));
    error.stack = [
      'Error: cabeçalho',
      ...Array.from({ length: 40 }, (_, i) => `    at f${i}`),
    ].join('\n');

    const err = JSON.parse(serverErrorLine('bff.proxy', error)).err as {
      message: string;
      stack: string;
    };

    expect(err.message.length).toBeLessThan(MAX_MESSAGE_CHARS * 2);
    expect(err.stack.split('\n').length).toBeLessThanOrEqual(MAX_STACK_FRAMES + 2);
  });

  it('redacts the context too, not only the error', () => {
    const original = process.env.CRON_SECRET;
    try {
      process.env.CRON_SECRET = 'segredo-do-cron-1234';
      const line = serverErrorLine('cron.daily-news', new Error('falhou'), {
        detail: 'recusou o segredo-do-cron-1234',
      });
      expect(line).not.toContain('segredo-do-cron-1234');
      expect(JSON.parse(line).detail).toContain(REDACTED_SECRET);
    } finally {
      if (original === undefined) delete process.env.CRON_SECRET;
      else process.env.CRON_SECRET = original;
    }
  });

  it('does not let the context hijack a reserved field', () => {
    // Espalhado depois dos reservados, um `scope` no contexto trocaria o nome do
    // caminho que falhou — e a linha mentiria sobre a própria origem.
    const line = serverErrorLine('bff.proxy', new Error('x'), {
      scope: 'outro',
      msg: 'outro',
      level: 1,
    });
    const parsed = JSON.parse(line) as Record<string, unknown>;

    expect(parsed.scope).toBe('bff.proxy');
    expect(parsed.msg).toBe('bff.proxy failed');
    expect(parsed.level).toBe(50);
  });

  it('serializes what was thrown even when it is not an Error', () => {
    const line = serverErrorLine('bff.events', 'só uma string');
    expect((JSON.parse(line).err as Record<string, unknown>).name).toBe('NonError');
  });

  it('never throws — observability does not break the path it observes', () => {
    /**
     * O princípio 1 do §2, e o cenário não é hipotético: quem chega aqui vem de
     * um `catch`, e o que foi lançado pode ser qualquer coisa. Um `stack` com
     * getter que lança derruba a serialização **dentro do handler de uma
     * falha** — trocando um erro registrado por um erro em cascata que ninguém
     * pediu.
     *
     * Um objeto qualquer não serve como prova aqui: ele cai no ramo `NonError`,
     * onde `String(x)` devolve `[object Object]` sem tocar em getter nenhum. É
     * preciso um `Error` de verdade com uma armadilha dentro.
     */
    const hostile = new Error('base');
    Object.defineProperty(hostile, 'stack', {
      get(): string {
        throw new Error('não');
      },
    });

    expect(() => serverErrorLine('bff.proxy', hostile)).not.toThrow();
    expect(JSON.parse(serverErrorLine('bff.proxy', hostile)).scope).toBe('bff.proxy');
    expect(() => logServerError('bff.proxy', hostile)).not.toThrow();
  });

  it('survives a context value that cannot be serialized', () => {
    // O tipo já barra objeto arbitrário, mas o tipo não roda em produção.
    const line = serverErrorLine('bff.proxy', new Error('x'), {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ruim: BigInt(1) as any,
    });
    expect(() => JSON.parse(line)).not.toThrow();
    expect(JSON.parse(line).scope).toBe('bff.proxy');
  });
});

/**
 * `process.env.NODE_ENV` é **read-only no tipo** (o `next-env.d.ts` o declara
 * assim, para o valor não ser trocado em runtime por engano). Escrever nele numa
 * suíte é legítimo e o `tsc` não tem como saber a diferença — o molde estreito
 * fica aqui, uma vez, em vez de um `as` espalhado por linha.
 */
const mutableEnv = process.env as Record<string, string | undefined>;

describe('quando a linha é escrita, e quando não é', () => {
  const ORIGINAL_NODE_ENV = process.env.NODE_ENV;

  afterEach(() => {
    if (ORIGINAL_NODE_ENV === undefined) delete mutableEnv.NODE_ENV;
    else mutableEnv.NODE_ENV = ORIGINAL_NODE_ENV;
  });

  it('stays silent outside a real environment, by allow-list', () => {
    // A lição da Fase 1: `!== 'test'` acende o logger sempre que `NODE_ENV`
    // chega indefinido, e aí a suíte despeja JSON com stack no stdout do CI com
    // todos os testes verdes. Calado é o default certo.
    mutableEnv.NODE_ENV = 'test';
    expect(shouldWriteServerLog()).toBe(false);
    delete mutableEnv.NODE_ENV;
    expect(shouldWriteServerLog()).toBe(false);
  });

  it('writes in the two real environments', () => {
    for (const value of ['production', 'development']) {
      mutableEnv.NODE_ENV = value;
      expect(shouldWriteServerLog()).toBe(true);
    }
  });

  it('writes a single line to stderr, which is the function log on Vercel', () => {
    mutableEnv.NODE_ENV = 'production';
    const write = vi.spyOn(process.stderr, 'write').mockReturnValue(true);
    try {
      logServerError('bff.events', new Error('deu ruim'));
      expect(write).toHaveBeenCalledTimes(1);
      const [line] = write.mock.calls[0] as [string];
      expect(line.endsWith('\n')).toBe(true);
      expect(JSON.parse(line.trim()).scope).toBe('bff.events');
    } finally {
      write.mockRestore();
    }
  });
});

// ── A fiação (armadilha 28) ────────────────────────────────────────────

const getServerSessionMock = vi.fn();
const signAuthJwtMock = vi.fn();

vi.mock('next-auth', () => ({ getServerSession: () => getServerSessionMock() }));
vi.mock('@/lib/jwt', () => ({ signAuthJwt: (p: unknown) => signAuthJwtMock(p) }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

/** O spy tipado pelo próprio alvo — `vi.spyOn` genérico não casa com a
 *  sobrecarga de `process.stderr.write`. */
function spyStderr() {
  return vi.spyOn(process.stderr, 'write').mockReturnValue(true);
}

describe('a fiação: os três catch chamam o logger de verdade', () => {
  const ORIGINAL_NODE_ENV = process.env.NODE_ENV;
  let write: ReturnType<typeof spyStderr>;

  beforeEach(() => {
    mutableEnv.NODE_ENV = 'production';
    write = spyStderr();
    getServerSessionMock.mockReset();
    signAuthJwtMock.mockReset();
    signAuthJwtMock.mockResolvedValue('signed-jwt');
    getServerSessionMock.mockResolvedValue({
      user: { id: 'user-1', email: 'user@test.com', role: 'ADMIN' },
    });
  });

  afterEach(() => {
    write.mockRestore();
    vi.unstubAllGlobals();
    if (ORIGINAL_NODE_ENV === undefined) delete mutableEnv.NODE_ENV;
    else mutableEnv.NODE_ENV = ORIGINAL_NODE_ENV;
  });

  function lines(): Record<string, unknown>[] {
    return write.mock.calls.map(
      ([line]) => JSON.parse(String(line).trim()) as Record<string, unknown>,
    );
  }

  it('logs the proxy 502 with the request id that both legs share', async () => {
    /**
     * **É a peça que faz o `x-request-id` finalmente pagar.** Ele é ecoado no
     * sucesso desde a Fase 11 e jogado fora na falha — e a falha é o único
     * momento em que alguém vai procurar por ele.
     */
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new DOMException('timed out', 'TimeoutError')),
    );

    const res = await proxyToApi(
      new Request('http://localhost:3000/api/account?q=busca-do-leitor', {
        headers: { 'x-request-id': 'req-da-fase-7a' },
      }),
      '/account',
    );

    expect(res.status).toBe(502);
    const [line] = lines();
    expect(line?.scope).toBe('bff.proxy');
    expect(line?.requestId).toBe('req-da-fase-7a');
    expect(line?.path).toBe('/account');
    expect(line?.method).toBe('GET');
    // A query string não entra: ela carrega o que o leitor digitou.
    expect(JSON.stringify(line)).not.toContain('busca-do-leitor');
  });

  it('says nothing on the happy path', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers(),
        json: vi.fn().mockResolvedValue({ data: {} }),
      }),
    );

    await proxyToApi(new Request('http://localhost:3000/api/account'), '/account');
    expect(write).not.toHaveBeenCalled();
  });

  it('logs the event relay 502', async () => {
    const { POST } = await import('@/app/api/events/route');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('fetch failed')));

    const res = await POST(
      new Request('http://localhost:3000/api/events', {
        method: 'POST',
        body: '{"events":[]}',
      }),
    );

    expect(res.status).toBe(502);
    expect(lines()[0]?.scope).toBe('bff.events');
  });

  it('logs the pipeline trigger 500 with `warmed`, the field that separates two causes', async () => {
    /**
     * O briefing de 01/09/2026 sumiu e o único sinal foi a ausência dele. O
     * `warmed` já viajava na resposta desde então — mas ninguém lê aquela
     * resposta: quem chama é o cron da Vercel. No log ele finalmente separa "a
     * API não acordou" de "acordou e recusou".
     */
    const { GET } = await import('@/app/api/cron/daily-news/route');
    const originals = {
      CRON_SECRET: process.env.CRON_SECRET,
      BACKEND_JOB_URL: process.env.BACKEND_JOB_URL,
      BACKEND_JOB_SECRET: process.env.BACKEND_JOB_SECRET,
    };
    process.env.CRON_SECRET = 'cron-secret-de-teste';
    process.env.BACKEND_JOB_URL = 'https://api.example.com/jobs/daily-pipeline';
    process.env.BACKEND_JOB_SECRET = 'job-secret-de-teste';

    try {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('fetch failed')));

      const res = await GET(
        new Request('http://localhost:3000/api/cron/daily-news', {
          headers: { authorization: 'Bearer cron-secret-de-teste' },
        }),
      );

      expect(res.status).toBe(500);
      const line = lines().find((entry) => entry.scope === 'cron.daily-news');
      expect(line).toBeDefined();
      expect(line?.warmed).toBe(false);
    } finally {
      for (const [key, value] of Object.entries(originals)) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    }
  });
});
