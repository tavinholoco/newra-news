/**
 * **A taxonomia de erro — §7 do plano de observabilidade.**
 *
 * O que a fase fecha: um `AppError` era só uma mensagem e um número. A forma
 * como um service diz "não consegui" chegava ao handler global, virava resposta
 * e escrevia **zero linhas** — não havia como saber, depois, que aconteceu, nem
 * como agrupar duas ocorrências da mesma falha.
 *
 * Agora todo erro que o servidor **escolheu** lançar chega ao handler dizendo
 * três coisas: qual falha é (`code`), de que natureza ela é (`category`) e, se
 * houver, o que a causou (`cause`) e sob que circunstância (`context`).
 */

import type { FastifyBaseLogger } from 'fastify';

/**
 * A natureza da falha, e é ela que a política de retry e de alerta lê.
 *
 * Conjunto fechado e pequeno de propósito: categoria que se ramifica vira
 * dimensão de gráfico ilegível, e a pergunta que ela responde tem poucas
 * respostas úteis — *é culpa de fora, do banco, de quem chamou, ou nossa?*
 */
export const ERROR_CATEGORIES = [
  /** Um terceiro falhou: Gemini, Groq, NewsData, Resend, um feed RSS. */
  'upstream',
  /** O Postgres ou o Prisma falharam. */
  'database',
  /** O que veio na requisição não serve — inclui pedir o que não existe. */
  'validation',
  /** Quem chamou não pode: token ausente, expirado, de outro escopo, sem papel. */
  'authorization',
  /** O dado não casa com o que foi prometido — forma de resposta, invariante. */
  'contract',
  /** Defeito ou configuração nossa. */
  'internal',
] as const;

export type ErrorCategory = (typeof ERROR_CATEGORIES)[number];

/**
 * **`code` é literal deste tuple e nunca é interpolado.**
 *
 * É a regra que faz o desenho inteiro funcionar, e ela não é estilo: a Fase 4
 * grava uma linha de `ErrorEvent` por `(fingerprint, hora)`, e o `code` é a
 * peça do fingerprint que separa uma falha de outra. Enquanto este conjunto for
 * finito, a tabela tem teto — *falhas distintas × 24* — qualquer que seja o
 * tráfego. Um código montado com o id da notícia trocaria esse teto por "uma
 * linha por notícia", que é tabela sem teto num plano free.
 *
 * O corolário é o inverso e vale igual: **código que ninguém lança não entra
 * aqui.** Cardinalidade reservada para um consumidor imaginário é a armadilha
 * da tabela sem leitor pelo avesso. As duas metades da regra têm guarda em
 * `tests/utils/error-taxonomy.test.ts`, derivada da árvore do TypeScript.
 */
export const ERROR_CODES = [
  /** Recurso pedido não existe (`/news/:id`, `/articles/:date`, um favorito). */
  'NOT_FOUND',
  /** JWT de sessão ausente, expirado, malformado, ou de outro escopo. */
  'AUTH_TOKEN_INVALID',
  /**
   * Token válido sendo usado para **outra identidade**.
   *
   * Só o `POST /api/auth/upsert`, que é a única rota que cria usuário: a
   * assinatura confere e o `purpose` passou, e o que não bate é o e-mail do
   * token contra o do corpo. Debaixo do `AUTH_TOKEN_INVALID` — que é o código
   * de maior volume do sistema — o evento mais sensível da API ficaria
   * enterrado, que é a versão por `code` do que a regra de nível evita por
   * `level`.
   */
  'AUTH_SUBJECT_MISMATCH',
  /**
   * Sessão que **nós** assinamos e que não identifica ninguém.
   *
   * Chegar a este ponto exige ter passado pela verificação de assinatura, e
   * quem assina é o BFF — forjar exigiria o `AUTH_JWT_SECRET`. Então um token
   * sem `sub` ou sem `email` é sessão inutilizável emitida por nós (o
   * `api-proxy.ts` assina `email: session.user.email ?? ''`), com o leitor
   * logado e toda rota de conta respondendo 401. Daí `category: 'internal'`.
   */
  'AUTH_SESSION_INCOMPLETE',
  /** `AUTH_JWT_SECRET` ausente — 401 na resposta, defeito nosso na origem. */
  'AUTH_NOT_CONFIGURED',
  /** `Authorization: Bearer <JOB_SECRET>` ausente ou errado. */
  'JOB_SECRET_INVALID',
  /**
   * Senha errada no formulário do `/dev/dashboard`.
   *
   * Separado do `JOB_SECRET_INVALID` porque a superfície é outra: aquele é uma
   * chamada de máquina com segredo velho, este é **o único formulário de senha
   * do produto**, alcançável de fora e adivinhável por quem insistir. É o
   * `authn_fail` do vocabulário de log do OWASP (§3.2), e sem ele a tentativa
   * saía como um 303 em `info`, no meio do tráfego normal.
   */
  'DASHBOARD_SECRET_INVALID',
  /** Sessão válida, papel errado. */
  'ADMIN_REQUIRED',
  /** O default do `AppError` cru: falha nossa que não ganhou nome próprio. */
  'INTERNAL',
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

/**
 * A circunstância, e **só escalar**.
 *
 * O `context` vai para o log e, na Fase 4, para uma coluna. Objeto aninhado é
 * como um segundo erro inteiro entra sem passar por redação nenhuma — é o
 * mesmo argumento que fez o serializer de `err` do `utils/logger.ts` trabalhar
 * por lista de permissão, depois de o `ai.service` pendurar um `primaryError`
 * completo na exceção do fallback. Aqui o teto é o próprio tipo.
 */
export type ErrorContext = Record<string, string | number | boolean | null>;

export interface AppErrorOptions {
  /** Literal do {@link ERROR_CODES}. Padrão: o da subclasse, ou `INTERNAL`. */
  code?: ErrorCode;
  /** Padrão: o da subclasse, ou `internal`. */
  category?: ErrorCategory;
  /** O erro de baixo. Só o nome e a mensagem sobrevivem ao log, redigidos. */
  cause?: unknown;
  context?: ErrorContext;
}

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly category: ErrorCategory;
  readonly context?: ErrorContext;

  constructor(
    message: string,
    public statusCode: number = 500,
    options: AppErrorOptions = {},
  ) {
    // `{ cause: undefined }` **instala** a propriedade — o `Error` do ES2022
    // olha se a chave existe, não se o valor é útil. Passar as opções cruas
    // faria todo erro sem causa carregar um `cause` próprio, e quem perguntar
    // por presença (o `recordError` da Fase 4 é o próximo) leria "houve causa".
    super(message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = 'AppError';
    this.code = options.code ?? 'INTERNAL';
    this.category = options.category ?? 'internal';
    this.context = options.context;
  }
}

/**
 * **404 é `validation`**, e a escolha tem consequência.
 *
 * A categoria decide política: `validation` não é para tentar de novo nem para
 * alertar. Um id que não existe é a requisição pedindo o que não há — descrição
 * de quem chamou, não do interior do servidor. Fosse `internal`, todo endereço
 * errado de robô viraria linha de erro.
 */
export class NotFoundError extends AppError {
  constructor(resource: string, options: AppErrorOptions = {}) {
    super(`${resource} not found`, 404, {
      code: 'NOT_FOUND',
      category: 'validation',
      ...options,
    });
    this.name = 'NotFoundError';
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized', options: AppErrorOptions = {}) {
    super(message, 401, {
      code: 'AUTH_TOKEN_INVALID',
      category: 'authorization',
      ...options,
    });
    this.name = 'UnauthorizedError';
  }
}

/**
 * O default é `ADMIN_REQUIRED` porque **hoje o único 403 da API é o de admin**
 * (`requireAdmin`, em `plugins/auth.ts`). Quando nascer um segundo, ele traz o
 * próprio `code` — e a guarda cobra que o literal esteja no tuple.
 */
export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden', options: AppErrorOptions = {}) {
    super(message, 403, {
      code: 'ADMIN_REQUIRED',
      category: 'authorization',
      ...options,
    });
    this.name = 'ForbiddenError';
  }
}

/**
 * Em que nível a falha é escrita — a regra do §7, com uma correção medida.
 *
 * O plano dizia: `>= 500` é `error`; `< 500` vai a `debug`, exceto
 * `authorization`, que vai a `warn`. As duas pontas continuam valendo — um 404
 * em `/news/:id` é resultado normal e afogaria o sinal; uma recusa de
 * autorização é o `authz_fail` que o vocabulário de log do OWASP pede.
 *
 * **O que entrou foi a terceira linha: `internal` é `error` mesmo abaixo de
 * 500.** Existe um 4xx que não é resultado normal — `AUTH_NOT_CONFIGURED`, o
 * 401 que `verifyAuthJwt` devolve a **todo** token quando `AUTH_JWT_SECRET`
 * está ausente. Pela regra escrita, a configuração que derruba conta e admin de
 * uma vez seria a única falha da API sem uma linha de log, e este projeto já
 * perdeu essa variável em silêncio numa publicação. Categoria dizendo "é
 * defeito nosso" e nível dizendo "não olhe" é contradição; ganha a categoria.
 */
export function logLevelFor(error: AppError): 'error' | 'warn' | 'debug' {
  if (error.statusCode >= 500 || error.category === 'internal') return 'error';
  if (error.category === 'authorization') return 'warn';
  return 'debug';
}

/**
 * Escreve a falha, uma vez, no nível que ela pede.
 *
 * Duas portas chamam: o handler global do `app.ts` e o `preHandler` do
 * `authPlugin` — que recusa sem deixar o erro subir e, por isso, precisa
 * registrar antes de responder. Ter a decisão de nível em **uma** função é o
 * que impede as duas de divergirem; a guarda mede as duas pelo log que saem.
 *
 * O `err` passa pelo serializer de `utils/logger.ts`, que é quem redige, trunca
 * e emite `code`, `category`, `cause` e `context`.
 */
export function logAppError(
  log: FastifyBaseLogger,
  error: AppError,
  fields: { route: string },
): void {
  log[logLevelFor(error)]({ err: error, ...fields }, 'app error');
}
