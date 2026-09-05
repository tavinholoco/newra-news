import { AsyncLocalStorage } from 'node:async_hooks';
import type { FastifyBaseLogger } from 'fastify';
import pino from 'pino';
import { env, type LogLevel } from '../config/env';
import { redactEmails, redactSecrets } from './redact';

/**
 * **O log como sistema, e não como `console.warn` espalhado.**
 *
 * A inspeção de 01/09/2026 (§1 do plano de observabilidade) mediu o estado: o
 * `buildApp` passava `logger: env.NODE_ENV !== 'test'` — um **booleano**, sem
 * `level`, sem `redact`, sem `serializers` — e a API tinha **6** chamadas ao
 * logger do Fastify contra **14 `console.*`** que o contornavam, sem `reqId` e
 * sem correlação nenhuma. O que este arquivo entrega são as três coisas que
 * faltavam: uma instância só, a redação que fecha o vazamento de segredo, e a
 * correlação com o run do pipeline.
 *
 * ## Uma instância, duas portas de entrada
 *
 * `buildApp` passa **a instância** para o Fastify (que aceita instância, não só
 * opções), e quem não tem `request` — service, provider, job — importa
 * `baseLogger` direto. As duas portas escrevem pelo mesmo transporte, com a
 * mesma redação; a diferença é que a do Fastify vem com `reqId` amarrado pelo
 * child logger de cada requisição.
 *
 * ## Sem `transport`, em nenhum ambiente
 *
 * `pino-pretty` em produção é um segundo processo em 0.1 vCPU; em
 * desenvolvimento é modo de falha no boot por ganho cosmético. Quem quiser cor
 * no terminal: `pnpm dev | npx pino-pretty`.
 */

/** Teto da mensagem serializada, em caracteres. */
export const MAX_MESSAGE_CHARS = 500;

/** Teto do `stack`, em quadros (a linha de cabeçalho não conta). */
export const MAX_STACK_FRAMES = 10;

const TRUNCATED = '… [truncado]';

/**
 * O que o pipeline põe no contexto assíncrono, e o que o `mixin` lê de volta.
 *
 * **Correlação sem alterar assinatura.** `runPipeline` embrulha o corpo em
 * `pipelineContext.run({ pipelineLogId }, …)` e, a partir daí, os cinco avisos
 * do `news-fetcher.service`, os dois do `rss.provider`, os dois do
 * `newsdata.provider` e o retry do `ai-utils` passam a carregar o id do run
 * **sem que nenhuma função mude de assinatura**. A alternativa — passar um
 * logger por cinco camadas — é o que faz correlação virar intenção em vez de
 * fato: basta uma camada esquecer o parâmetro.
 *
 * **Não há `reqId` aqui de propósito.** Quem tem requisição já loga por
 * `request.log`, cujo child logger carrega o `reqId` que o `genReqId` do
 * `buildApp` gerou; um segundo lugar guardando o mesmo fato é um segundo lugar
 * para ele divergir.
 */
export interface PipelineLogContext {
  pipelineLogId: string;
}

export const pipelineContext = new AsyncLocalStorage<PipelineLogContext>();

/**
 * O que o pino acrescenta a **toda** linha escrita de dentro de um run.
 *
 * Exportado para ser testado como função: o `mixin` roda dentro do pino, no
 * momento da escrita, então espionar `baseLogger.warn` não veria o campo — o
 * chamador não o passa, e é justamente esse o ponto.
 */
export function pipelineLogMixin(): Record<string, unknown> {
  const store = pipelineContext.getStore();
  return store === undefined ? {} : { pipelineLogId: store.pipelineLogId };
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

const scrub = (text: string): string => redactSecrets(redactEmails(text));

/**
 * O serializer de `err`, que é o conserto do vazamento.
 *
 * Ele faz quatro coisas, e cada uma sai de um achado:
 *
 * 1. **redige** — `redactEmails` (reusado, não reescrito) e `redactSecrets`
 *    sobre a mensagem **e** sobre o `stack`, onde a DSN aparece com a mesma
 *    frequência;
 * 2. **trunca** — `message` em {@link MAX_MESSAGE_CHARS} e `stack` em
 *    {@link MAX_STACK_FRAMES} quadros. Erro de parse de feed traz o documento
 *    inteiro na mensagem;
 * 3. **preserva o diagnóstico** — `name`, `code` e `statusCode` sobrevivem. É
 *    a metade que uma redação boa demais quebra, e é o mesmo argumento que o
 *    `redact.ts` já faz sobre o 422 do Resend: sem `P1001` na frase, a linha
 *    não diz o que aconteceu;
 * 4. **descarta o resto, por lista de permissão.** O `ai.service` pendura um
 *    `primaryError` inteiro na exceção do fallback; serializar tudo que um erro
 *    carrega seria serializar um segundo erro sem passar por redação nenhuma.
 */
export function redactingErrSerializer(error: unknown): Record<string, unknown> {
  if (!(error instanceof Error)) {
    // `catch (e)` recebe o que foi lançado, e nem tudo que se lança é `Error`.
    return {
      name: 'NonError',
      message: truncate(scrub(String(error)), MAX_MESSAGE_CHARS),
    };
  }

  const err = error as Error & { code?: unknown; statusCode?: unknown };
  const out: Record<string, unknown> = {
    name: err.name,
    message: truncate(scrub(err.message), MAX_MESSAGE_CHARS),
  };

  if (typeof err.stack === 'string') out.stack = truncateStack(scrub(err.stack));
  if (err.code !== undefined) out.code = err.code;
  if (err.statusCode !== undefined) out.statusCode = err.statusCode;

  return out;
}

/**
 * `LOG_LEVEL` decide; sem ele, `info` nos dois ambientes reais e `silent` no
 * resto.
 *
 * A variável fica **sem `default` no schema** justamente para o teste poder
 * pedir log quando estiver depurando (`LOG_LEVEL=debug pnpm test`): com um
 * default, "não configurado" e "configurado como info" seriam indistinguíveis.
 *
 * **A condição é por lista de permissão, e isso é sobre a suíte.** `NODE_ENV`
 * tem default no schema, então em execução real ele é sempre um dos três
 * valores; indefinido só acontece quando uma suíte faz
 * `vi.mock('../../src/config/env')` declarando só as chaves de que precisa — e
 * são várias. Escrito como `!== 'test'`, o mock parcial acordaria o logger em
 * `info` e encheria a saída do CI de JSON. Calado é o default certo para o que
 * não é ambiente de verdade.
 */
function resolveLevel(): LogLevel {
  if (env.LOG_LEVEL) return env.LOG_LEVEL;
  return env.NODE_ENV === 'development' || env.NODE_ENV === 'production'
    ? 'info'
    : 'silent';
}

/**
 * **O tipo declarado é `FastifyBaseLogger`, e não o `pino.Logger` que o `pino()`
 * devolve.** A diferença não é estilo: passar a instância com o tipo concreto
 * fixa o parâmetro de logger do `FastifyInstance` em `pino.Logger`, e a partir
 * daí toda função que recebe o app — `registerDailyPipelineJob`, os helpers de
 * teste — deixa de casar com o `FastifyInstance` default. `FastifyBaseLogger` é
 * a interface que o Fastify espera e tem tudo que este projeto chama.
 */
export const baseLogger: FastifyBaseLogger = pino({
  level: resolveLevel(),
  /**
   * O `redact` do pino trabalha por **caminho**, e é isso que ele resolve bem:
   * cabeçalho e campo de objeto. Texto livre — `err.message` — é trabalho do
   * serializer acima, e os dois são necessários.
   */
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'res.headers["set-cookie"]',
      '*.password',
      '*.token',
      '*.secret',
    ],
    censor: '[redigido]',
  },
  serializers: { err: redactingErrSerializer },
  mixin: pipelineLogMixin,
});
