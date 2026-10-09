import { describe, it, expect, beforeEach, vi } from 'vitest';
import ts from 'typescript';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { prisma } from '@newranews/database';
import {
  MAX_WORKSPACE_HOURS,
  getLatestPlanHoursReading,
  recordPlanHoursReading,
} from '../../src/services/plan-hours.service';
import { RENDER_FREE_PLAN_HOURS } from '../../src/services/uptime.service';
import { AppError } from '../../src/utils/errors';
import { baseLogger } from '../../src/utils/logger';

/**
 * **A leitura do Billing — Fase 13 do plano de observabilidade, 13b (§23).**
 *
 * As 750 h do free do Render são do **workspace**, e o workspace tem um
 * segundo serviço (`NetsheetEngine`) que esta API não tem como medir: o
 * Render não expõe cobrança por API, e a chave da API dele não tem escopo
 * (abre a conta inteira). O dono escolheu, em 07/10/2026, digitar na `/admin`
 * o total que o Billing mostra. O que tem de continuar verdade:
 *
 * 1. **A leitura guarda as duas pontas do mesmo instante** — o total do
 *    workspace e as horas desta API (`DailyUptime`) naquele momento. A parte
 *    dos outros serviços é a diferença, e só é honesta se as duas pontas forem
 *    do mesmo instante; reconstruir a desta API depois, de linhas por dia, não
 *    dá a hora.
 * 2. **Leitura abaixo do que esta API já registrou é recusada.** O Render conta
 *    a instância de pé, e o processo sobe depois dela e morre antes — o total
 *    do workspace nunca é menor que a parte que nós medimos. Menor é o número
 *    errado do painel (a linha de um serviço só, um dígito trocado).
 * 3. **A gravação lança.** Ao contrário de `recordAuditEvent`, aqui a escrita
 *    **é** a ação: engolir a falha responderia 201 sobre uma leitura que não
 *    existe — a tela que diz "fiz" sem ter feito (armadilha do 25/08).
 * 4. **Só a leitura do mês corrente vale**, porque o Billing zera no dia 1º.
 */

vi.mock('@newranews/database', async () => {
  const actual = await vi.importActual<typeof import('@newranews/database')>(
    '@newranews/database',
  );
  return {
    ...actual,
    prisma: {
      dailyUptime: { aggregate: vi.fn() },
      auditEvent: { create: vi.fn(), findFirst: vi.fn() },
    },
  };
});

const ACTOR = 'aaaaaaaa-0000-0000-0000-000000000001';
const NOW = new Date('2026-10-06T00:10:00.000Z');

function apiSecondsThisMonth(seconds: number) {
  vi.mocked(prisma.dailyUptime.aggregate).mockResolvedValue({
    _sum: { seconds },
  } as never);
}

beforeEach(() => {
  vi.mocked(prisma.dailyUptime.aggregate).mockReset();
  vi.mocked(prisma.auditEvent.create).mockReset();
  vi.mocked(prisma.auditEvent.findFirst).mockReset();
  vi.restoreAllMocks();
});

describe('13b — registrar a leitura do Billing', () => {
  it('grava o total do workspace e as horas desta API no mesmo instante, com o ator', async () => {
    // 34,9 h desta API (a leitura real de 06/10/2026: 125.640 s).
    apiSecondsThisMonth(125_640);
    vi.mocked(prisma.auditEvent.create).mockResolvedValue({
      createdAt: new Date('2026-10-06T00:10:01.000Z'),
    } as never);

    const reading = await recordPlanHoursReading({
      actorId: ACTOR,
      workspaceHours: 124.27,
      requestId: 'req-1',
      now: NOW,
    });

    expect(reading).toEqual({
      readAt: '2026-10-06T00:10:01.000Z',
      workspaceHours: 124.27,
      apiHours: 34.9,
    });

    const [arg] = vi.mocked(prisma.auditEvent.create).mock.calls[0] as [
      { data: Record<string, unknown> },
    ];
    expect(arg.data).toMatchObject({
      actorId: ACTOR,
      action: 'plan.hours_recorded',
      outcome: 'recorded',
      targetId: null,
      requestId: 'req-1',
      context: { workspaceHours: 124.27, apiHours: 34.9 },
    });

    // As horas desta API são as do mês de calendário de `now`.
    const [aggregate] = vi.mocked(prisma.dailyUptime.aggregate).mock.calls[0] as [
      { where: { date: { gte: Date } } },
    ];
    expect(aggregate.where.date.gte.toISOString()).toBe('2026-10-01T00:00:00.000Z');
  });

  it('recusa uma leitura menor que o que esta API já registrou — e não grava nada', async () => {
    apiSecondsThisMonth(125_640); // 34,9 h

    const attempt = recordPlanHoursReading({
      actorId: ACTOR,
      workspaceHours: 12.427, // um dígito fora do lugar
      requestId: 'req-2',
      now: NOW,
    });

    await expect(attempt).rejects.toBeInstanceOf(AppError);
    await expect(attempt).rejects.toMatchObject({
      statusCode: 400,
      code: 'PLAN_READING_BELOW_API',
      category: 'validation',
      context: { workspaceHours: 12.427, apiHours: 34.9 },
    });
    expect(prisma.auditEvent.create).not.toHaveBeenCalled();
  });

  it('aceita a leitura igual às horas desta API — o workspace sem outro serviço ligado', async () => {
    apiSecondsThisMonth(125_640);
    vi.mocked(prisma.auditEvent.create).mockResolvedValue({ createdAt: NOW } as never);

    const reading = await recordPlanHoursReading({
      actorId: ACTOR,
      workspaceHours: 34.9,
      requestId: null,
      now: NOW,
    });

    expect(reading.workspaceHours).toBe(34.9);
    expect(reading.apiHours).toBe(34.9);
  });

  it('deixa a falha da gravação subir — a escrita é a ação, e 201 sobre nada seria mentira', async () => {
    apiSecondsThisMonth(0);
    vi.mocked(prisma.auditEvent.create).mockRejectedValue(new Error("Can't reach database server"));

    await expect(
      recordPlanHoursReading({ actorId: ACTOR, workspaceHours: 10, requestId: null, now: NOW }),
    ).rejects.toThrow("Can't reach database server");
  });

  it('o teto da entrada folga sobre o pool do plano e recusa dígito a mais', () => {
    // O pool para em 750 (setembro marcou 753,4 com o atraso da suspensão);
    // o teto existe para recusar o "12427" no lugar de "124,27".
    expect(MAX_WORKSPACE_HOURS).toBeGreaterThan(RENDER_FREE_PLAN_HOURS);
    expect(MAX_WORKSPACE_HOURS).toBeLessThan(12_427);
  });
});

describe('13b — ler a leitura mais recente do mês', () => {
  it('pede a ação da leitura, no mês de calendário de `now`, a mais recente primeiro', async () => {
    vi.mocked(prisma.auditEvent.findFirst).mockResolvedValue({
      createdAt: new Date('2026-10-06T00:10:01.000Z'),
      context: { workspaceHours: 124.27, apiHours: 34.9 },
    } as never);

    const reading = await getLatestPlanHoursReading(new Date('2026-10-07T21:00:00.000Z'));

    expect(reading).toEqual({
      readAt: '2026-10-06T00:10:01.000Z',
      workspaceHours: 124.27,
      apiHours: 34.9,
    });

    const [arg] = vi.mocked(prisma.auditEvent.findFirst).mock.calls[0] as [
      {
        where: { action: string; createdAt: { gte: Date } };
        orderBy: { createdAt: string };
      },
    ];
    expect(arg.where.action).toBe('plan.hours_recorded');
    // A leitura de setembro não fala de outubro: o Billing zera no dia 1º.
    expect(arg.where.createdAt.gte.toISOString()).toBe('2026-10-01T00:00:00.000Z');
    expect(arg.orderBy).toEqual({ createdAt: 'desc' });
  });

  it('devolve `null` sem leitura no mês', async () => {
    vi.mocked(prisma.auditEvent.findFirst).mockResolvedValue(null);

    expect(await getLatestPlanHoursReading(NOW)).toBeNull();
  });

  it('ignora, com `warn`, uma linha cujo `context` não é uma leitura', async () => {
    const warn = vi.spyOn(baseLogger, 'warn').mockImplementation(() => undefined);
    vi.mocked(prisma.auditEvent.findFirst).mockResolvedValue({
      createdAt: NOW,
      context: { workspaceHours: '124,27' },
    } as never);

    expect(await getLatestPlanHoursReading(NOW)).toBeNull();
    expect(warn).toHaveBeenCalledTimes(1);
  });
});

/**
 * **O teto do workspace mora num lugar só** — a guarda que a §23 pediu ao
 * 13b. O `750` é a constante `RENDER_FREE_PLAN_HOURS`; um segundo literal em
 * `src/` é um segundo denominador, e é assim que o arco passou setembro
 * dividindo a parte desta API pelo teto inteiro. Pelo parser, porque o número
 * aparece em comentário (e deve continuar aparecendo) — a pergunta é sobre
 * literal numérico, que é gramática.
 */
describe('13b — o denominador lido de um lugar só', () => {
  const API_SRC = join(__dirname, '../../src');

  function sourceFiles(dir: string = API_SRC): string[] {
    return readdirSync(dir).flatMap((entry) => {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) return sourceFiles(full);
      return entry.endsWith('.ts') ? [relative(API_SRC, full).split(sep).join('/')] : [];
    });
  }

  function literalsOf(value: number): string[] {
    const found: string[] = [];
    for (const file of sourceFiles()) {
      const tree = ts.createSourceFile(
        file,
        readFileSync(join(API_SRC, file), 'utf8'),
        ts.ScriptTarget.ES2022,
        true,
        ts.ScriptKind.TS,
      );
      const visit = (node: ts.Node): void => {
        if (ts.isNumericLiteral(node) && Number(node.text.replace(/_/g, '')) === value) {
          const { line } = tree.getLineAndCharacterOfPosition(node.getStart(tree));
          found.push(`${file}:${line + 1}`);
        }
        ts.forEachChild(node, visit);
      };
      visit(tree);
    }
    return found;
  }

  it('o único `750` numérico de `src/` é a declaração de `RENDER_FREE_PLAN_HOURS`', () => {
    const found = literalsOf(RENDER_FREE_PLAN_HOURS);

    expect(found).toHaveLength(1);
    expect(found[0]).toMatch(/^services\/uptime\.service\.ts:\d+$/);
    const line = readFileSync(join(API_SRC, 'services/uptime.service.ts'), 'utf8').split('\n')[
      Number(found[0]!.split(':')[1]) - 1
    ];
    expect(line).toContain('RENDER_FREE_PLAN_HOURS');
  });
});
