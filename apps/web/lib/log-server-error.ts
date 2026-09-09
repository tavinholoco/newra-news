/**
 * **Uma linha JSON em stderr, que é o log de função da Vercel.**
 *
 * A Fase 7a do plano de observabilidade (§11.1). O §1 mediu a frase inteira:
 * *"todo `catch` do BFF é vazio"*. Três deles transformam uma falha num status
 * — o 502 do `proxyToApi`, o 502 do repasse de eventos, o 500 do disparo do
 * pipeline — e não deixam rastro nenhum. Aqui não há Render, não há pino e não
 * há processo de longa duração para hospedar um: **o log de função é o log**, e
 * o que não for escrito em stderr dentro da invocação não existe em lugar
 * nenhum depois que ela termina.
 *
 * ## Irmão do `apps/api/src/utils/redact.ts`, e não duplicata dele
 *
 * O §11.1 manda escrever isto no comentário, para ninguém "deduplicar" os dois,
 * e o argumento é o inventário: **os dois conjuntos de segredos são disjuntos
 * nas duas direções.** O `NEXTAUTH_SECRET`, o `CRON_SECRET` e os dois pares de
 * OAuth existem só neste processo; o `DATABASE_URL` e as chaves dos provedores
 * de IA existem só no de lá. Um arquivo servindo aos dois faria cada processo
 * carregar a lista do outro — e uma lista de segredos que não corresponde ao
 * ambiente é pior que inútil: ela dá a impressão de cobertura.
 *
 * A diferença vai além da lista. Lá há redação de **e-mail** (a resposta 422 do
 * Resend ecoa o endereço do assinante) e da **senha de uma DSN** (a mensagem do
 * Prisma cita a string de conexão). Nenhum dos dois existe aqui: este processo
 * não fala com o banco, e não há provedor de e-mail deste lado. O que existe
 * aqui e não existe lá é o **JWT assinado por requisição** — que não está no
 * ambiente, então nenhuma lista de valores o alcança, e por isso o padrão de
 * `Bearer` é obrigatório.
 *
 * A guarda é `tests/lib/bff-error-log.test.ts`, e ela reprova nas duas direções:
 * segredo do `.env.example` fora da lista, e as duas listas ficando iguais.
 *
 * ## Server-only, e isso é uma restrição de verdade
 *
 * `process.stderr` não existe no navegador. Este módulo é importado **só** pelo
 * BFF (`lib/api-proxy.ts` e `app/api/**`); `lib/api.ts` fica de fora de
 * propósito, porque viaja para o cliente pelo `subscribe-form.tsx`. Há guarda
 * cobrando isso.
 */

/**
 * Os segredos que **este** processo carrega.
 *
 * Derivado do `apps/web/.env.example`, e a guarda compara os dois: variável
 * nova com `SECRET` no nome sem linha aqui reprova no CI, e não em produção. É
 * a lição do `13` dos feeds noutra forma — lista que descreve uma coleção quer
 * guarda derivada da coleção.
 */
export const WEB_SECRET_ENV_KEYS = [
  'CRON_SECRET',
  'BACKEND_JOB_SECRET',
  'NEXTAUTH_SECRET',
  'AUTH_JWT_SECRET',
  'GOOGLE_CLIENT_SECRET',
  'GITHUB_CLIENT_SECRET',
] as const;

export const REDACTED_SECRET = '[segredo redigido]';

/**
 * Abaixo disto o valor não é tratado como segredo.
 *
 * Sem o piso, uma variável configurada com string vazia — que casa em toda
 * posição de todo texto — transformaria a linha inteira em `[segredo redigido]`.
 * O mesmo número do lado da API, pelo mesmo motivo.
 */
export const MIN_SECRET_LENGTH = 8;

/** Teto da mensagem serializada, em caracteres. */
export const MAX_MESSAGE_CHARS = 500;

/** Teto do `stack`, em quadros (a linha de cabeçalho não conta). */
export const MAX_STACK_FRAMES = 10;

/**
 * Quantos `cause` seguir a partir do erro de fora.
 *
 * Três chega em qualquer cadeia que este BFF produz (`TypeError: fetch failed`
 * → erro de socket → `errno`) e é o que impede um ciclo de pendurar a
 * serialização. `Error.cause` não promete ser acíclico, e a única coisa pior
 * que um log ausente é um log que trava a função que ele observa.
 */
export const MAX_CAUSE_DEPTH = 3;

const TRUNCATED = '… [truncado]';

/** `Bearer <token>` — a palavra fica, o token não. */
const BEARER_PATTERN = /\b(Bearer)\s+[\w.\-+/=~]{8,}/gi;

/**
 * Segredo sai do texto que vai virar linha de log.
 *
 * Duas camadas, e a primeira é a que tira esta função da corrida armamentista
 * de regex: **o valor literal de cada segredo do ambiente**. Não é preciso
 * adivinhar o formato de um segredo quando se conhece o valor.
 *
 * A segunda é o `Bearer`, e ela existe por um motivo que não é redundante com a
 * primeira: o JWT que o `proxyToApi` assina **é gerado por requisição**, nunca
 * esteve no ambiente, e carrega o id e o e-mail de quem está lendo.
 *
 * O que sobrevive é de propósito — a palavra `Bearer` diz *qual* cabeçalho foi
 * recusado, e é o mesmo argumento que o `redact.ts` da API faz sobre o 422 do
 * Resend: redigir mantém a frase e tira o dado.
 */
export function redactSecrets(text: string): string {
  let out = text;

  for (const key of WEB_SECRET_ENV_KEYS) {
    const value = process.env[key];
    if (typeof value === 'string' && value.length >= MIN_SECRET_LENGTH) {
      // `split`/`join` e não `replace`: substituição literal, sem escapar regex
      // sobre um valor que ninguém controla.
      out = out.split(value).join(REDACTED_SECRET);
    }
  }

  return out.replace(BEARER_PATTERN, `$1 ${REDACTED_SECRET}`);
}

function truncate(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max)}${TRUNCATED}`;
}

function truncateStack(stack: string): string {
  // A primeira linha do `stack` é o cabeçalho (`Error: mensagem`); os quadros
  // vêm depois dela.
  const lines = stack.split('\n');
  if (lines.length <= MAX_STACK_FRAMES + 1) return stack;

  return [...lines.slice(0, MAX_STACK_FRAMES + 1), `    ${TRUNCATED}`].join('\n');
}

/**
 * O erro, redigido, truncado, e **com o `cause`**.
 *
 * O `cause` é a razão de esta função não ser três linhas, e o §11.1 nomeia
 * metade do motivo: o `ApiError.cause` do `lib/api.ts` está documentado como
 * existindo *"para manter o rastro para o log do servidor"* e **nenhum código o
 * lia**. A outra metade é maior e vale mais: no Node, um `fetch` que não
 * completa lança `TypeError: fetch failed` — uma frase que não diz nada. O que
 * de fato aconteceu (`ECONNREFUSED`, `ENOTFOUND`, `UND_ERR_CONNECT_TIMEOUT`)
 * está **só** no `cause`. Sem seguir a cadeia, este log registraria três
 * palavras inúteis para o único caso que ele existe para explicar.
 *
 * O resto é descartado **por lista de permissão**, como o serializer da API:
 * serializar tudo que um erro carrega é serializar o que nunca passou por
 * redação nenhuma.
 */
function serializeError(error: unknown, depth = 0): Record<string, unknown> {
  if (!(error instanceof Error)) {
    // `catch (e)` recebe o que foi lançado, e nem tudo que se lança é `Error`.
    return {
      name: 'NonError',
      message: truncate(redactSecrets(String(error)), MAX_MESSAGE_CHARS),
    };
  }

  const err = error as Error & { code?: unknown; cause?: unknown };
  const out: Record<string, unknown> = {
    name: err.name,
    message: truncate(redactSecrets(err.message), MAX_MESSAGE_CHARS),
  };

  if (typeof err.stack === 'string') {
    out.stack = truncateStack(redactSecrets(err.stack));
  }
  if (err.code !== undefined) out.code = err.code;
  if (err.cause !== undefined && err.cause !== null && depth < MAX_CAUSE_DEPTH) {
    out.cause = serializeError(err.cause, depth + 1);
  }

  return out;
}

/**
 * O que acompanha a falha. **Só primitivo, e o tipo é a defesa.**
 *
 * Objeto arbitrário aqui traria duas coisas de uma vez: um ciclo capaz de
 * derrubar o `JSON.stringify` dentro do handler de um erro, e texto que nunca
 * passou por redação. O que o BFF precisa dizer cabe em primitivo — o
 * `requestId`, o caminho, o método, o `warmed`.
 */
export type ServerLogContext = Record<
  string,
  string | number | boolean | null | undefined
>;

/**
 * A linha, como texto. Separada do escritor de propósito: o **que** se escreve é
 * função pura e testável; o **se** se escreve depende do ambiente.
 *
 * A forma é a do pino, que é o que a API escreve desde a Fase 1 — `level`
 * numérico, `time` em milissegundos, o erro sob `err`. Não é cosmética: com as
 * duas metades da costura escrevendo o mesmo formato, uma consulta só lê as
 * duas, e o `requestId` que atravessa as duas pernas é o campo que as junta.
 */
export function serverErrorLine(
  scope: string,
  error: unknown,
  context: ServerLogContext = {},
): string {
  try {
    const fields: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(context)) {
      if (value === undefined) continue;
      fields[key] = typeof value === 'string' ? redactSecrets(value) : value;
    }

    /**
     * **O contexto entra primeiro, e não é estilo.** Espalhado depois, uma chave
     * chamada `scope` — ou `err`, ou `level` — sobrescreveria o campo reservado
     * de mesmo nome, e a linha passaria a mentir sobre qual caminho falhou sem
     * que nada acusasse. Com os reservados por último, quem chama pode passar o
     * que quiser: o significado da linha é decidido aqui.
     */
    return JSON.stringify({
      ...fields,
      level: 50,
      time: Date.now(),
      scope,
      err: serializeError(error),
      msg: `${scope} failed`,
    });
  } catch {
    /**
     * **O princípio 1 do §2: observabilidade nunca quebra o caminho que
     * observa.** Um `stack` com getter que lança, um `toString` hostil, um
     * `code` que não serializa — tudo isso chega aqui vindo de um `catch`, que
     * é o pior lugar possível para lançar de novo. A linha mínima ainda diz
     * qual escopo falhou, que é mais do que havia antes desta fase.
     */
    return JSON.stringify({
      level: 50,
      time: Date.now(),
      scope,
      err: { name: 'UnserializableError' },
      msg: `${scope} failed`,
    });
  }
}

/**
 * Escreve nos dois ambientes reais, e cala no resto — **por lista de
 * permissão**.
 *
 * É a lição da Fase 1, literal. Escrito como `!== 'test'`, o logger acorda
 * sempre que `NODE_ENV` chega indefinido — e lá isso fez duas suítes despejarem
 * JSON com stack trace no stdout do CI **com todos os testes verdes**. Aqui a
 * suíte exercita os três `catch` de propósito; sem a lista, cada execução
 * imprimiria uma pilha por teste.
 *
 * A leitura é por índice (`process.env['NODE_ENV']`) e não por membro: a forma
 * de membro é a que os empacotadores substituem por literal em tempo de build, e
 * um valor congelado no bundle não é o valor do ambiente.
 */
export function shouldWriteServerLog(): boolean {
  const nodeEnv = process.env['NODE_ENV'];
  return nodeEnv === 'production' || nodeEnv === 'development';
}

/**
 * O que os `catch` do BFF chamam.
 *
 * `void` e não `Promise`: `process.stderr.write` numa função da Vercel é
 * síncrono para pipe, e mesmo que não fosse, **esperar a escrita dentro do
 * handler de uma falha é a armadilha 2 do §17** noutra forma. Quem chama já
 * está no caminho ruim e tem uma resposta a devolver.
 */
export function logServerError(
  scope: string,
  error: unknown,
  context: ServerLogContext = {},
): void {
  if (!shouldWriteServerLog()) return;

  try {
    process.stderr.write(`${serverErrorLine(scope, error, context)}\n`);
  } catch {
    // stderr fechado ou indisponível. Não há para onde relatar que não se
    // conseguiu relatar, e derrubar o `catch` do chamador seria trocar uma
    // falha registrada por uma falha em cascata.
  }
}
