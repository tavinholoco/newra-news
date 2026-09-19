import { prisma, type Prisma } from '@newranews/database';
import type { AuditTrail } from '@newranews/types';
import type { ErrorContext } from '../utils/errors';
import { baseLogger, scrubErrorContext } from '../utils/logger';
import { AUDIT_WRITE_FAILED_CODE, recordError } from './error-event.service';

/**
 * **A trilha de ação de admin — §9 do plano de observabilidade, PR 5b.**
 *
 * O que fecha: até aqui uma notícia apagada não deixava rastro de quem a
 * apagou, e um disparo manual do pipeline era indistinguível do cron.
 * `request.user.sub` chegava ao `DELETE /api/news/:id` e morria com a resposta;
 * a linha de log do Render era o único outro registro, e ela rola para fora. É
 * o `authz_admin` do vocabulário de log do OWASP (§3.2).
 *
 * ## Uma linha por ocorrência, ao contrário do `ErrorEvent` — de propósito
 *
 * Auditoria responde *qual* clique, de *quem*, *quando*. Coalescer por hora
 * apagaria exatamente isso. O teto vem de outro lugar: **só um humano com sessão
 * ADMIN produz linha**, então a tabela cresce com cliques de admin, nunca com
 * tráfego — e é por isso que a escrita aqui pode ir ao banco no próprio
 * handler, sem o buffer que o `recordError` precisa.
 *
 * ## `action` é literal deste tuple, nunca interpolado
 *
 * Mesma regra do `ErrorEvent.code`: o conjunto fechado mora no código, com
 * guarda pelo parser (`tests/services/audit.service.test.ts`), e não num enum
 * do Postgres — enum ali cobraria uma migration por ação nova, além da rota e
 * das três guardas que ela já custa. O corolário vale igual: ação que ninguém
 * registra não entra aqui.
 *
 * ## Nunca lança
 *
 * A ação já aconteceu quando esta função é chamada — a notícia foi apagada, o
 * run foi criado. Falhar a resposta por causa do registro diria ao admin que a
 * exclusão não deu certo quando deu. A falha do registro vira `warn` no log
 * **e** linha de `ErrorEvent` (`AUDIT_WRITE_FAILED`), porque uma trilha de
 * auditoria que falha em silêncio é o defeito que a Fase 4 existe para acabar.
 */
export const AUDIT_ACTIONS = [
  /** `POST /api/jobs/daily-pipeline` com `x-actor-id` — o disparo manual, pelo painel. */
  'pipeline.triggered',
  /** `DELETE /api/news/:id`. */
  'news.deleted',
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];

/**
 * Por quantos dias uma ação fica gravada.
 *
 * **365 — mais que qualquer outra tabela**, porque log de segurança responde
 * pergunta feita meses depois ("quem apagou aquela matéria em março?"). O
 * `ErrorEvent` vive 14 dias porque responde "o que está quebrado agora"; esta
 * responde "o que alguém fez", e a pergunta não envelhece na mesma velocidade.
 * Quem apaga é a etapa 8 do pipeline diário, junto dos outros expurgos.
 */
export const AUDIT_EVENT_RETENTION_DAYS = 365;

export interface RecordAuditEventInput {
  /** `User.id` de quem agiu. Obrigatório: linha de auditoria sem ator não é auditoria. */
  actorId: string;
  /** Literal de {@link AUDIT_ACTIONS}. */
  action: AuditAction;
  /** O alvo, quando a ação criou ou tocou algo: id da notícia, id do run. */
  targetId?: string | null;
  /** O desfecho que a rota devolveu — separa "clicou" de "aconteceu". */
  outcome?: string | null;
  /** O `x-request-id`, que acha a linha de log. */
  requestId?: string | null;
  /** Amostra escalar, mesma regra e mesma redação do `ErrorEvent.context`. */
  context?: ErrorContext;
}

/** Teto da listagem. Auditoria se lê recente-primeiro; página maior que isto pede filtro. */
export const AUDIT_LIST_MAX = 200;
export const AUDIT_LIST_DEFAULT = 50;

/**
 * Grava uma ação. **Nunca lança** — ver o cabeçalho.
 */
export async function recordAuditEvent(input: RecordAuditEventInput): Promise<void> {
  try {
    await prisma.auditEvent.create({
      data: {
        actorId: input.actorId,
        action: input.action,
        targetId: input.targetId ?? null,
        outcome: input.outcome ?? null,
        requestId: input.requestId ?? null,
        context: scrubErrorContext(input.context) as Prisma.InputJsonValue | undefined,
      },
    });
  } catch (error) {
    baseLogger.warn(
      { err: error, action: input.action, actorId: input.actorId },
      '[audit] failed to persist',
    );
    // A ação é o escopo do fingerprint (o papel que a rota faz na API e a
    // etapa faz no pipeline): conjunto finito, e diz **qual** trilha está
    // falhando sem abrir o log.
    recordError({
      origin: 'API',
      severity: 'ERROR',
      code: AUDIT_WRITE_FAILED_CODE,
      category: 'database',
      message: error instanceof Error ? error.message : String(error),
      route: input.action,
      requestId: input.requestId ?? null,
      context: { action: input.action, outcome: input.outcome ?? null },
    });
  }
}

/**
 * As ações mais recentes na janela, mais recentes primeiro.
 *
 * O `total` vem de um `count` separado, e não de `events.length`: é o que
 * permite à tela dizer "50 de 312" em vez de "50". Duas consultas sobre o
 * mesmo índice (`createdAt`) custam menos que um `findMany` sem `take`.
 */
export async function listAuditEvents(options: {
  days: number;
  limit: number;
  now?: Date;
}): Promise<AuditTrail> {
  const now = options.now ?? new Date();
  const since = new Date(now.getTime() - options.days * 24 * 60 * 60 * 1000);
  const where = { createdAt: { gte: since } };

  const [rows, total] = await Promise.all([
    prisma.auditEvent.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: options.limit,
    }),
    prisma.auditEvent.count({ where }),
  ]);

  return {
    window: { days: options.days, since: since.toISOString() },
    total,
    events: rows.map((row) => ({
      id: row.id,
      actorId: row.actorId,
      action: row.action,
      targetId: row.targetId,
      outcome: row.outcome,
      requestId: row.requestId,
      context: (row.context as Record<string, unknown> | null) ?? null,
      createdAt: row.createdAt.toISOString(),
    })),
  };
}

/**
 * Apaga ação mais velha que {@link AUDIT_EVENT_RETENTION_DAYS}, por `createdAt`
 * — a coluna que o índice cobre e que a tela ordena.
 */
export async function deleteExpiredAuditEvents(now = new Date()): Promise<number> {
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - AUDIT_EVENT_RETENTION_DAYS);

  const { count } = await prisma.auditEvent.deleteMany({
    where: { createdAt: { lt: cutoff } },
  });

  return count;
}
