import { describe, it, expect, beforeEach, vi } from 'vitest';
import ts from 'typescript';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { prisma } from '@newranews/database';
import {
  AUDIT_ACTIONS,
  AUDIT_EVENT_RETENTION_DAYS,
  deleteExpiredAuditEvents,
  listAuditEvents,
  recordAuditEvent,
} from '../../src/services/audit.service';
import {
  AUDIT_WRITE_FAILED_CODE,
  pendingErrorEvents,
  resetErrorEventBuffer,
} from '../../src/services/error-event.service';

/**
 * **A guarda da trilha de auditoria — §9 do plano de observabilidade, 5b.**
 *
 * Três coisas precisam continuar sendo verdade:
 *
 * 1. **`recordAuditEvent` nunca lança.** A ação já aconteceu quando ela roda;
 *    falhar a resposta diria ao admin que a exclusão não deu certo quando deu.
 * 2. **A falha do registro não morre em silêncio** — vira `ErrorEvent`, porque
 *    trilha de auditoria que falha calada é o defeito que a Fase 4 existe para
 *    acabar. (Ao contrário do flush do `ErrorEvent`, que não se registra de
 *    volta: aqui não há laço a fechar.)
 * 3. **`action` é literal do tuple**, e todo membro do tuple tem quem o grave.
 *    Mesma regra do `ErrorEvent.code`, e pela mesma razão: o conjunto fechado
 *    mora no código, não num enum do Postgres.
 */

vi.mock('@newranews/database', async () => {
  const actual = await vi.importActual<typeof import('@newranews/database')>(
    '@newranews/database',
  );
  return {
    ...actual,
    prisma: {
      auditEvent: {
        create: vi.fn().mockResolvedValue({}),
        findMany: vi.fn().mockResolvedValue([]),
        count: vi.fn().mockResolvedValue(0),
        deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
    },
  };
});

const ACTOR = 'aaaaaaaa-0000-0000-0000-000000000001';
const NEWS = 'cccccccc-0000-0000-0000-000000000003';
const AT = new Date('2026-09-12T15:00:00.000Z');

beforeEach(() => {
  vi.mocked(prisma.auditEvent.create).mockClear().mockResolvedValue({} as never);
  vi.mocked(prisma.auditEvent.findMany).mockClear().mockResolvedValue([]);
  vi.mocked(prisma.auditEvent.count).mockClear().mockResolvedValue(0);
  vi.mocked(prisma.auditEvent.deleteMany).mockClear();
  resetErrorEventBuffer();
});

describe('§9 — o contrato de `recordAuditEvent`', () => {
  it('grava uma linha por ocorrência, com ator, ação, alvo e desfecho', async () => {
    await recordAuditEvent({
      actorId: ACTOR,
      action: 'news.deleted',
      targetId: NEWS,
      outcome: 'deleted',
      requestId: 'req-1',
      context: { reason: 'spam' },
    });

    expect(prisma.auditEvent.create).toHaveBeenCalledTimes(1);
    const [arg] = vi.mocked(prisma.auditEvent.create).mock.calls[0] as [
      { data: Record<string, unknown> },
    ];
    expect(arg.data).toMatchObject({
      actorId: ACTOR,
      action: 'news.deleted',
      targetId: NEWS,
      outcome: 'deleted',
      requestId: 'req-1',
      context: { reason: 'spam' },
    });
  });

  it('não lança quando o banco recusa', async () => {
    vi.mocked(prisma.auditEvent.create).mockRejectedValueOnce(new Error('connection refused'));

    await expect(
      recordAuditEvent({ actorId: ACTOR, action: 'pipeline.triggered', outcome: 'started' }),
    ).resolves.toBeUndefined();
  });

  it('registra a própria falha como `ErrorEvent`, com a ação como escopo', async () => {
    vi.mocked(prisma.auditEvent.create).mockRejectedValueOnce(new Error('connection refused'));

    await recordAuditEvent({
      actorId: ACTOR,
      action: 'pipeline.triggered',
      outcome: 'started',
      requestId: 'req-9',
    });

    const pending = pendingErrorEvents();
    expect(pending).toHaveLength(1);
    expect(pending[0]).toMatchObject({
      origin: 'API',
      severity: 'ERROR',
      code: AUDIT_WRITE_FAILED_CODE,
      category: 'database',
      route: 'pipeline.triggered',
      lastRequestId: 'req-9',
    });
  });

  it('passa o `context` pela mesma redação do `ErrorEvent` — só escalar sobrevive', async () => {
    await recordAuditEvent({
      actorId: ACTOR,
      action: 'news.deleted',
      context: { nested: { deep: true } as never, ok: 1 },
    });

    const [arg] = vi.mocked(prisma.auditEvent.create).mock.calls[0] as [
      { data: { context: unknown } },
    ];
    expect(arg.data.context).toEqual({ ok: 1 });
  });
});

describe('§9 — a leitura', () => {
  it('lê a janela mais recente primeiro, com o total contado à parte', async () => {
    vi.mocked(prisma.auditEvent.findMany).mockResolvedValueOnce([
      {
        id: 'e1',
        actorId: ACTOR,
        action: 'news.deleted',
        targetId: NEWS,
        outcome: 'deleted',
        requestId: 'req-1',
        context: null,
        createdAt: AT,
      },
    ] as never);
    vi.mocked(prisma.auditEvent.count).mockResolvedValueOnce(312);

    const trail = await listAuditEvents({ days: 30, limit: 50, now: AT });

    expect(trail.total).toBe(312);
    expect(trail.events).toHaveLength(1);
    expect(trail.events[0]).toMatchObject({ id: 'e1', createdAt: AT.toISOString() });
    expect(trail.window).toEqual({ days: 30, since: '2026-08-13T15:00:00.000Z' });

    const [query] = vi.mocked(prisma.auditEvent.findMany).mock.calls[0] as [
      { orderBy: unknown; take: number; where: { createdAt: { gte: Date } } },
    ];
    expect(query.orderBy).toEqual({ createdAt: 'desc' });
    expect(query.take).toBe(50);
    expect(query.where.createdAt.gte.toISOString()).toBe('2026-08-13T15:00:00.000Z');
  });
});

describe('§9 — a retenção', () => {
  it('apaga por `createdAt`, com corte em 365 dias', async () => {
    expect(AUDIT_EVENT_RETENTION_DAYS).toBe(365);

    await deleteExpiredAuditEvents(AT);

    const [arg] = vi.mocked(prisma.auditEvent.deleteMany).mock.calls[0] as [
      { where: { createdAt: { lt: Date } } },
    ];
    const days = Math.round((AT.getTime() - arg.where.createdAt.lt.getTime()) / 86_400_000);
    expect(days).toBe(365);
  });
});

/**
 * **Nenhuma `action` interpolada, e nenhuma sem quem a grave.**
 *
 * As duas metades da regra do `ErrorEvent.code`, aplicadas ao tuple da
 * auditoria — e pela mesma ferramenta: o parser, porque literal contra
 * template é gramática. O conjunto de call sites é derivado de `src/`, não
 * digitado: uma rota nova que grave auditoria entra na varredura sozinha.
 */
describe('§9 — `action` é literal do tuple, e todo literal tem call site', () => {
  const API_SRC = join(__dirname, '../../src');

  function sourceFiles(dir: string = API_SRC): string[] {
    return readdirSync(dir).flatMap((entry) => {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) return sourceFiles(full);
      return entry.endsWith('.ts') ? [relative(API_SRC, full).split(sep).join('/')] : [];
    });
  }

  interface ActionArgument {
    file: string;
    text: string;
    literal: string | undefined;
  }

  /** Todo `action:` passado a `recordAuditEvent`, em `src/`. */
  function actionArguments(): ActionArgument[] {
    const found: ActionArgument[] = [];

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
          node.expression.text === 'recordAuditEvent'
        ) {
          for (const arg of node.arguments) {
            if (!ts.isObjectLiteralExpression(arg)) continue;
            for (const property of arg.properties) {
              if (!ts.isPropertyAssignment(property)) continue;
              if (property.name.getText(tree) !== 'action') continue;
              const init = property.initializer;
              found.push({
                file,
                text: init.getText(tree),
                literal: ts.isStringLiteral(init) ? init.text : undefined,
              });
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
    const found = actionArguments();

    expect(found.length).toBeGreaterThanOrEqual(2);
    expect(found.map((a) => a.file)).toContain('routes/news/admin.ts');
    expect(found.map((a) => a.file)).toContain('routes/jobs/index.ts');
  });

  it('toda `action` é literal do tuple', () => {
    const offenders = actionArguments().filter(
      (a) => a.literal === undefined || !(AUDIT_ACTIONS as readonly string[]).includes(a.literal),
    );

    expect(offenders.map((a) => `${a.file}: ${a.text}`)).toEqual([]);
  });

  it('todo membro do tuple tem quem o grave', () => {
    const used = new Set(actionArguments().map((a) => a.literal));
    const orphans = AUDIT_ACTIONS.filter((action) => !used.has(action));

    expect(orphans).toEqual([]);
  });
});
