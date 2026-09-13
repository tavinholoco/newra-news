import { prisma, type Prisma } from '@newranews/database';
import type { ErrorOrigin, ErrorSeverity } from '@newranews/database';
import type { ErrorCategory, ErrorCode, ErrorContext } from '../utils/errors';
import {
  baseLogger,
  pipelineContext,
  scrubErrorContext,
  scrubMessage,
} from '../utils/logger';

/**
 * **O registro durável de uma falha — §8 do plano de observabilidade.**
 *
 * O que a fase fecha: até aqui, o único vestígio de um 500 era uma linha no
 * stdout do Render. Ela rola para fora, não sobrevive a um deploy e não é
 * consultável — então "isto já aconteceu antes?" e "há quanto tempo está
 * quebrado?" não tinham resposta em lugar nenhum.
 *
 * ## Uma linha por `(fingerprint, hora)`, e por que isso não é detalhe
 *
 * Um 500 que dispara 10.000 vezes numa hora é **uma** linha com
 * `count: 10000`. É o que dá teto à tabela: ela cresce com *falhas distintas ×
 * 24*, e não com o tráfego. Sem isso, um laço que falha em cada iteração
 * escreveria linha na velocidade em que falha (armadilha 5 do §17) — e o
 * caminho que já está com problema seria justamente o que derruba o banco.
 *
 * ## A escrita é bufferizada, e `recordError` é **síncrona por contrato**
 *
 * Ela muta um `Map` em memória e retorna `undefined` — não uma `Promise`. É a
 * armadilha 2 do §17 e a lição de 03/09/2026 aplicada à escrita: **o caminho
 * que está falhando não pode ganhar uma ida ao banco**, e gravar dentro do
 * tratamento de um erro *de banco* é falha auto-amplificante. Quem persiste é
 * o intervalo do `plugins/error-events.ts`, a cada
 * {@link ERROR_EVENT_FLUSH_MS}, mais um flush no `onClose`.
 *
 * `severity: 'FATAL'` é a exceção: escreve na hora. São poucos por dia, e
 * perder um para um `SIGTERM` é perder o único registro do que matou o
 * processo — exatamente a forma do incidente de 03/09.
 *
 * ## Nunca lança
 *
 * Mesmo contrato do `logPipelineEvent`: observabilidade que derruba o que
 * observa é pior que observabilidade nenhuma. Falha de persistência vira uma
 * linha de `warn` **pelo `baseLogger` direto** — e não pelo `logAppError`, que
 * chamaria `recordError` de volta e fecharia um laço.
 */

/** De quanto em quanto tempo o buffer vai ao banco. */
export const ERROR_EVENT_FLUSH_MS = 30_000;

/**
 * Quanto o desligamento espera pelo flush final, e **por que ele espera pouco**.
 *
 * O `onClose` tenta gravar o que está no buffer — é o caminho do `SIGTERM`, e
 * este projeto já perdeu um run inteiro para um. Mas esperar *sem prazo* põe uma
 * ida ao banco no caminho do desligamento, e a hora em que há erro acumulado é
 * justamente a hora em que **o banco é o suspeito**: um Postgres fora do ar
 * seguraria o `app.close()` até o supervisor mandar `SIGKILL` — perdendo o
 * buffer do mesmo jeito e atrasando a volta.
 *
 * Medido ao escrever isto: sem prazo, a suíte `admin-pipeline` (que não mocka o
 * Prisma e produz 401 de propósito) travou o `afterAll` em **10 s de timeout de
 * hook**, contra um banco local que nem estava no ar. O sintoma no CI seria
 * esse; em produção, um deploy que não termina.
 */
export const ERROR_EVENT_CLOSE_TIMEOUT_MS = 2_000;

/**
 * Por quantos dias uma falha fica gravada.
 *
 * São **14 e não 30** porque esta tabela responde *"o que está quebrado
 * agora"*; `PipelineLog` e `DailyMetric` respondem *"estava quebrado no mês
 * passado"*. Quem apaga é a etapa 8 do pipeline diário, junto do expurgo que
 * já existe — não é etapa nova, pelo mesmo argumento que pôs o `ProductEvent`
 * lá: um segundo lugar para lembrar de olhar quando algo parar.
 *
 * **Mora aqui e não em `@newranews/types`** — ao contrário do
 * `PRODUCT_EVENT_RETENTION_DAYS`, que está lá e é usado só pela API. Import de
 * **valor** entre pacotes do workspace já derrubou o boot em produção uma vez
 * (`ERR_MODULE_NOT_FOUND`, guarda em `tests/build/runtime-deps.test.ts`), e
 * nenhum consumidor fora da API precisa deste número hoje.
 */
export const ERROR_EVENT_RETENTION_DAYS = 14;

/**
 * O código do que **não** é um `AppError`.
 *
 * O ramo do handler global que responde 500 a um erro cru — Prisma, undici,
 * `TypeError` — não tem `code` nenhum, e é justamente a falha mais grave que a
 * API sabe produzir. Ele não entra em `ERROR_CODES` de propósito: aquele tuple
 * é o conjunto que o servidor **escolhe lançar**, e a guarda da Fase 3 cobra
 * que todo membro dele tenha quem o lance.
 */
export const UNHANDLED_CODE = 'UNHANDLED';

/** Falha que abortou o run do pipeline (o `catch` final de `runPipelineStages`). */
export const PIPELINE_FAILED_CODE = 'PIPELINE_STAGE_FAILED';

/** Etapa não-crítica que falhou sem abortar o run — o `WARN` das etapas 7.5 a 9. */
export const PIPELINE_DEGRADED_CODE = 'PIPELINE_STAGE_DEGRADED';

/**
 * A trilha de auditoria (Fase 5) não conseguiu gravar a ação.
 *
 * Mora aqui e não em `audit.service.ts` porque aquele importa `recordError`
 * deste arquivo: o tipo da união abaixo precisa da constante, e o import no
 * sentido contrário fecharia um ciclo em tempo de execução.
 */
export const AUDIT_WRITE_FAILED_CODE = 'AUDIT_WRITE_FAILED';

/**
 * **Todo código que pode chegar à tabela, como tipo.** É o teto do fingerprint
 * escrito onde o `tsc` o lê: os literais da taxonomia da API mais as quatro
 * constantes deste arquivo. Um `code: \`stage-${n}\`` deixa de compilar, e um
 * `code: algumaString` também. A guarda pelo parser em
 * `tests/services/error-event.test.ts` continua, porque enumera os call sites
 * — mas o teto em si passou a ser garantido em tempo de compilação.
 *
 * `origin: WEB` e `origin: INVARIANT` acrescentam os seus aqui quando nascerem
 * (Fases 7b/7c e 6): a união é o lugar onde a decisão fica visível.
 */
export type RecordedErrorCode =
  | ErrorCode
  | typeof UNHANDLED_CODE
  | typeof PIPELINE_FAILED_CODE
  | typeof PIPELINE_DEGRADED_CODE
  | typeof AUDIT_WRITE_FAILED_CODE;

export interface RecordErrorInput {
  origin: ErrorOrigin;
  severity: ErrorSeverity;
  /**
   * **Literal, nunca interpolado.** É a peça do fingerprint que separa uma
   * falha de outra; montá-lo com o id de um recurso trocaria o teto da tabela
   * por "uma linha por notícia". O tipo fecha o conjunto; a guarda em
   * `tests/services/error-event.test.ts` enumera quem o usa.
   */
  code: RecordedErrorCode;
  category: ErrorCategory;
  message: string;
  /**
   * O escopo da falha, e é a terceira peça do fingerprint: o **padrão** da rota
   * na API (`/api/news/:id`, nunca a URL crua) e a etapa no pipeline
   * (`stage-8.5`). Os dois são conjuntos finitos, que é o que importa aqui.
   */
  route?: string | null;
  statusCode?: number | null;
  requestId?: string | null;
  /**
   * O run a que a falha pertence, quando quem chama **sabe**. O
   * `logPipelineEvent` sempre soube — é o primeiro parâmetro dele —, e a
   * primeira versão deste serviço ignorava isso e lia só o `AsyncLocalStorage`:
   * o enterro do run morto (`triggerPipeline`, etapa 0) roda **fora** do
   * contexto do run, e gravava `pipelineLogId: null` sobre um id que estava na
   * mão. O contexto assíncrono continua sendo a reserva para quem não sabe.
   */
  pipelineLogId?: string | null;
  context?: ErrorContext;
}

interface BufferedError {
  fingerprint: string;
  windowStart: Date;
  origin: ErrorOrigin;
  severity: ErrorSeverity;
  code: string;
  category: string;
  message: string;
  route: string | null;
  statusCode: number | null;
  count: number;
  firstRequestId: string | null;
  lastRequestId: string | null;
  pipelineLogId: string | null;
  context: Prisma.InputJsonValue | undefined;
  firstSeenAt: Date;
  lastSeenAt: Date;
}

const buffer = new Map<string, BufferedError>();

/** Zera o buffer. Existe para o teste — em produção quem esvazia é o flush. */
export function resetErrorEventBuffer(): void {
  buffer.clear();
}

/** Quantas ocorrências estão em memória, esperando o flush. Só para teste. */
export function pendingErrorEventCount(): number {
  return [...buffer.values()].reduce((sum, entry) => sum + entry.count, 0);
}

/**
 * O que está no buffer, como cópia. Só para teste.
 *
 * A alternativa seria as guardas espionarem o `prisma.errorEvent.upsert`, e aí
 * cada uma teria de forçar um flush — misturando "o que foi registrado" com "o
 * que já foi persistido", que são exatamente as duas coisas que esta fase
 * separa de propósito.
 */
export function pendingErrorEvents(): ReadonlyArray<Readonly<BufferedError>> {
  return [...buffer.values()].map((entry) => ({ ...entry }));
}

/** A hora cheia em UTC a que o instante pertence. */
export function windowStartFor(at: Date): Date {
  const start = new Date(at);
  start.setUTCMinutes(0, 0, 0);
  return start;
}

/**
 * A identidade da falha.
 *
 * **O §8 não define a derivação** — ele nomeia os campos e exige o teto. As
 * quatro peças escolhidas aqui são todas de conjunto finito, que é o que o teto
 * exige, e nenhuma carrega id de recurso.
 *
 * **A `severity` entra**, e o motivo é uma colisão real: o pipeline registra a
 * mesma etapa como `WARN` (degradou) e como `ERROR` (abortou), e sem ela as
 * duas cairiam na mesma linha — com a segunda apagando a gravidade da primeira
 * na tela.
 */
export function fingerprintFor(input: {
  origin: ErrorOrigin;
  severity: ErrorSeverity;
  code: string;
  route?: string | null;
}): string {
  return [input.origin, input.severity, input.code, input.route ?? '-'].join(':');
}

/**
 * Registra uma ocorrência. **Síncrona, e nunca lança.**
 *
 * **A guarda é sobre a forma da declaração, pelo parser**: sem `async` e com
 * retorno declarado `void`. As duas asserções são necessárias — `async`
 * obriga o retorno a virar `Promise<void>`, mas dá para devolver uma promessa
 * **sem** `async`, e aí só o tipo denuncia. O que se evita é sempre o mesmo: o
 * dia em que ela virar `Promise`, o `await` que alguém acrescentar no handler
 * de erro põe uma ida ao banco dentro do caminho que já falhou.
 */
export function recordError(input: RecordErrorInput, now: Date = new Date()): void {
  try {
    const windowStart = windowStartFor(now);
    const fingerprint = fingerprintFor(input);
    const key = `${fingerprint}|${windowStart.toISOString()}`;

    // O run: o que quem chamou disse, ou o corrente — o mesmo
    // `AsyncLocalStorage` que põe `pipelineLogId` em toda linha de log escrita
    // de dentro de um run. É o **último visto**, e é por isso que a coluna não
    // é chave estrangeira.
    const pipelineLogId =
      input.pipelineLogId ?? pipelineContext.getStore()?.pipelineLogId ?? null;
    const requestId = input.requestId ?? null;

    const existing = buffer.get(key);
    if (existing) {
      existing.count += 1;
      existing.lastSeenAt = now;
      if (requestId !== null) existing.lastRequestId = requestId;
      if (pipelineLogId !== null) existing.pipelineLogId = pipelineLogId;
      return;
    }

    buffer.set(key, {
      fingerprint,
      windowStart,
      origin: input.origin,
      severity: input.severity,
      code: input.code,
      category: input.category,
      // **A primeira mensagem da janela, não a última.** Ocorrências do mesmo
      // fingerprint são a mesma falha; trocar o texto a cada uma faria a linha
      // mudar debaixo de quem está lendo, sem dizer nada de novo.
      message: scrubMessage(input.message),
      route: input.route ?? null,
      statusCode: input.statusCode ?? null,
      count: 1,
      firstRequestId: requestId,
      lastRequestId: requestId,
      pipelineLogId,
      context: scrubErrorContext(input.context) as Prisma.InputJsonValue | undefined,
      firstSeenAt: now,
      lastSeenAt: now,
    });

    if (input.severity === 'FATAL') {
      // Sem `await`: o contrato desta função é ser síncrona. O que muda é que
      // o `FATAL` não espera os 30 s do intervalo — quem o produz costuma não
      // ter 30 s.
      void flushErrorEvents();
    }
  } catch (error) {
    // Alcança o improvável (um `context` exótico, um `Date` inválido) sem
    // deixar o registro de uma falha virar uma segunda falha.
    baseLogger.warn({ err: error }, '[error-event] failed to buffer');
  }
}

/**
 * Persiste o que está em memória, e **esvazia o buffer antes de ir ao banco**.
 *
 * A troca é deliberada: com o `Map` trocado primeiro, uma ocorrência que chegar
 * durante o `await` entra na janela seguinte em vez de ser contada duas vezes
 * ou perdida no meio do upsert.
 *
 * O `update` incrementa em vez de atribuir — duas instâncias, ou dois flushes
 * da mesma, somam em vez de sobrescrever.
 */
export async function flushErrorEvents(): Promise<void> {
  if (buffer.size === 0) return;

  const pending = [...buffer.values()];
  buffer.clear();


  for (const entry of pending) {
    try {
      await prisma.errorEvent.upsert({
        where: {
          fingerprint_windowStart: {
            fingerprint: entry.fingerprint,
            windowStart: entry.windowStart,
          },
        },
        create: {
          fingerprint: entry.fingerprint,
          windowStart: entry.windowStart,
          origin: entry.origin,
          severity: entry.severity,
          code: entry.code,
          category: entry.category,
          count: entry.count,
          route: entry.route,
          statusCode: entry.statusCode,
          message: entry.message,
          firstRequestId: entry.firstRequestId,
          lastRequestId: entry.lastRequestId,
          pipelineLogId: entry.pipelineLogId,
          context: entry.context,
          firstSeenAt: entry.firstSeenAt,
          lastSeenAt: entry.lastSeenAt,
        },
        update: {
          count: { increment: entry.count },
          lastSeenAt: entry.lastSeenAt,
          lastRequestId: entry.lastRequestId,
          pipelineLogId: entry.pipelineLogId,
        },
      });
    } catch (error) {
      /**
       * **Pelo `baseLogger`, e não pelo `logAppError`.** Aquele chama
       * `recordError`, que é o que acabou de falhar — o laço se fecharia
       * exatamente quando o banco está fora, que é a hora em que ele mais
       * dói. Há teste sobre isto.
       *
       * A ocorrência perdida é o preço, e ele está escrito: `count` é
       * aproximado quando o banco pisca. O log continua tendo a linha.
       */
      baseLogger.warn(
        { err: error, fingerprint: entry.fingerprint, count: entry.count },
        '[error-event] failed to persist',
      );
    }
  }
}

/**
 * O flush do desligamento: tenta gravar, e **desiste no prazo**.
 *
 * A corrida não cancela a consulta — nada no Prisma cancela —, ela só para de
 * esperar. É o que se quer aqui: o `app.close()` segue, e a promessa pendente
 * termina no `catch` de sempre, escrevendo o `warn`.
 *
 * Ver {@link ERROR_EVENT_CLOSE_TIMEOUT_MS} para o motivo do prazo.
 */
export async function flushErrorEventsBeforeClose(
  timeoutMs = ERROR_EVENT_CLOSE_TIMEOUT_MS,
): Promise<void> {
  let timer: NodeJS.Timeout | undefined;

  await Promise.race([
    flushErrorEvents(),
    new Promise<void>((resolve) => {
      timer = setTimeout(resolve, timeoutMs);
      timer.unref();
    }),
  ]);

  if (timer !== undefined) clearTimeout(timer);
}

/**
 * Apaga falha mais velha que {@link ERROR_EVENT_RETENTION_DAYS}.
 *
 * Corta por `windowStart` — a hora a que a falha pertence —, e não por
 * `firstSeenAt`: os dois quase sempre coincidem, e é o primeiro que a tela
 * consulta e o índice cobre.
 */
export async function deleteExpiredErrorEvents(now = new Date()): Promise<number> {
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - ERROR_EVENT_RETENTION_DAYS);

  const { count } = await prisma.errorEvent.deleteMany({
    where: { windowStart: { lt: cutoff } },
  });

  return count;
}
