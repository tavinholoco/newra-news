import { describe, it, expect, beforeEach, vi } from 'vitest';
import ts from 'typescript';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { prisma } from '@newranews/database';
import {
  RENDER_FREE_PLAN_HOURS,
  UPTIME_HEARTBEAT_MS,
  flushUptimeBeforeClose,
  getMonthUptimeSeconds,
  resetUptimeClock,
  splitUptimeCredit,
  startUptimeClock,
  tickUptime,
  uptimeCreditedUntil,
} from '../../src/services/uptime.service';

/**
 * **A guarda das horas do plano — §3.1 e §4.3 do plano de observabilidade, 5b.**
 *
 * O que tem de continuar verdade:
 *
 * 1. **A soma é exata ao segundo.** O crédito é de segundos inteiros e o resto
 *    fica para o tique seguinte — arredondar a cada cinco minutos derivaria.
 * 2. **A meia-noite divide.** Um tique que atravessa o dia credita cada parte
 *    no seu dia; é o que faz "horas do mês" ser a soma dos dias do mês.
 * 3. **Nunca lança, e não avança o crédito quando o banco recusa.** O tique
 *    seguinte tenta o intervalo inteiro de novo.
 * 4. **O desligamento tem prazo**, o mesmo do flush do `ErrorEvent`.
 * 5. **O heartbeat está ligado no `server.ts`**, e não no `buildApp` — a
 *    fiação (armadilha 28), pelo parser.
 */

vi.mock('@newranews/database', async () => {
  const actual = await vi.importActual<typeof import('@newranews/database')>(
    '@newranews/database',
  );
  return {
    ...actual,
    prisma: {
      dailyUptime: {
        upsert: vi.fn().mockResolvedValue({}),
        aggregate: vi.fn().mockResolvedValue({ _sum: { seconds: 0 } }),
      },
    },
  };
});

type UpsertCall = [
  {
    where: { date: Date };
    create: { date: Date; seconds: number };
    update: { seconds: { increment: number } };
  },
];

function upserts(): Array<{ date: string; seconds: number }> {
  return (vi.mocked(prisma.dailyUptime.upsert).mock.calls as UpsertCall[]).map(([arg]) => ({
    date: arg.where.date.toISOString(),
    seconds: arg.update.seconds.increment,
  }));
}

beforeEach(() => {
  resetUptimeClock();
  vi.mocked(prisma.dailyUptime.upsert).mockClear().mockResolvedValue({} as never);
  vi.mocked(prisma.dailyUptime.aggregate).mockClear();
});

describe('§3.1 — o crédito, como função pura', () => {
  it('credita só os segundos inteiros e guarda o resto', () => {
    const from = new Date('2026-09-12T10:00:00.000Z');
    const to = new Date('2026-09-12T10:05:00.750Z');

    const { portions, creditedUntil } = splitUptimeCredit(from, to);

    expect(portions).toEqual([{ date: new Date('2026-09-12T00:00:00.000Z'), seconds: 300 }]);
    expect(creditedUntil.toISOString()).toBe('2026-09-12T10:05:00.000Z');
  });

  it('não credita nada em menos de um segundo', () => {
    const from = new Date('2026-09-12T10:00:00.000Z');
    const { portions, creditedUntil } = splitUptimeCredit(from, new Date(from.getTime() + 999));

    expect(portions).toEqual([]);
    expect(creditedUntil).toBe(from);
  });

  it('divide a travessia da meia-noite UTC entre os dois dias, sem perder segundo', () => {
    const from = new Date('2026-09-12T23:58:00.000Z');
    const to = new Date('2026-09-13T00:03:00.000Z');

    const { portions } = splitUptimeCredit(from, to);

    expect(portions).toEqual([
      { date: new Date('2026-09-12T00:00:00.000Z'), seconds: 120 },
      { date: new Date('2026-09-13T00:00:00.000Z'), seconds: 180 },
    ]);
    expect(portions.reduce((sum, p) => sum + p.seconds, 0)).toBe(300);
  });

  it('atravessa mais de um dia quando o banco ficou fora por muito tempo', () => {
    // Um tique que falhou por 30 h de banco fora: o próximo credita tudo.
    const from = new Date('2026-09-12T20:00:00.000Z');
    const to = new Date('2026-09-14T02:00:00.000Z');

    const { portions } = splitUptimeCredit(from, to);

    expect(portions.map((p) => p.date.toISOString().slice(0, 10))).toEqual([
      '2026-09-12',
      '2026-09-13',
      '2026-09-14',
    ]);
    expect(portions.reduce((sum, p) => sum + p.seconds, 0)).toBe(30 * 3600);
  });
});

describe('§3.1 — o tique', () => {
  it('faz `upsert` com `increment` na linha do dia, e avança o crédito', async () => {
    startUptimeClock(new Date('2026-09-12T10:00:00.000Z'));

    await tickUptime(new Date('2026-09-12T10:05:00.400Z'));

    expect(upserts()).toEqual([{ date: '2026-09-12T00:00:00.000Z', seconds: 300 }]);
    expect(uptimeCreditedUntil()?.toISOString()).toBe('2026-09-12T10:05:00.000Z');
  });

  it('não escreve nada antes de `startUptimeClock` — o buildApp não liga o relógio', async () => {
    await tickUptime(new Date('2026-09-12T10:05:00.000Z'));

    expect(prisma.dailyUptime.upsert).not.toHaveBeenCalled();
  });

  it('não lança quando o banco recusa, e não avança o crédito', async () => {
    startUptimeClock(new Date('2026-09-12T10:00:00.000Z'));
    vi.mocked(prisma.dailyUptime.upsert).mockRejectedValueOnce(new Error('connection refused'));

    await expect(tickUptime(new Date('2026-09-12T10:05:00.000Z'))).resolves.toBeUndefined();
    expect(uptimeCreditedUntil()?.toISOString()).toBe('2026-09-12T10:00:00.000Z');

    // O tique seguinte tenta o intervalo inteiro: 10 min, não 5.
    await tickUptime(new Date('2026-09-12T10:10:00.000Z'));
    expect(upserts().at(-1)).toEqual({ date: '2026-09-12T00:00:00.000Z', seconds: 600 });
  });

  it('a perda máxima é um intervalo: o heartbeat é de cinco minutos', () => {
    expect(UPTIME_HEARTBEAT_MS).toBe(5 * 60 * 1000);
  });
});

describe('§3.1 — o desligamento', () => {
  it('credita o resto no `close`', async () => {
    startUptimeClock(new Date('2026-09-12T10:00:00.000Z'));

    await flushUptimeBeforeClose(2_000, new Date('2026-09-12T10:02:30.000Z'));

    expect(upserts()).toEqual([{ date: '2026-09-12T00:00:00.000Z', seconds: 150 }]);
  });

  it('desiste no prazo em vez de segurar o `close`', async () => {
    startUptimeClock(new Date('2026-09-12T10:00:00.000Z'));
    vi.mocked(prisma.dailyUptime.upsert).mockImplementationOnce(
      () => new Promise(() => undefined) as never,
    );

    const startedAt = Date.now();
    await flushUptimeBeforeClose(50, new Date('2026-09-12T10:05:00.000Z'));

    expect(Date.now() - startedAt).toBeLessThan(1_000);
  });
});

describe('§4.3 — a soma do mês', () => {
  it('soma os dias do mês de calendário UTC, e o teto é o do plano', async () => {
    vi.mocked(prisma.dailyUptime.aggregate).mockResolvedValueOnce({
      _sum: { seconds: 1_098_000 },
    } as never);

    const seconds = await getMonthUptimeSeconds(new Date('2026-09-12T15:00:00.000Z'));

    expect(seconds).toBe(1_098_000);
    expect(RENDER_FREE_PLAN_HOURS).toBe(750);

    const [arg] = vi.mocked(prisma.dailyUptime.aggregate).mock.calls[0] as [
      { where: { date: { gte: Date } } },
    ];
    expect(arg.where.date.gte.toISOString()).toBe('2026-09-01T00:00:00.000Z');
  });

  it('responde zero quando o mês não tem linha', async () => {
    vi.mocked(prisma.dailyUptime.aggregate).mockResolvedValueOnce({
      _sum: { seconds: null },
    } as never);

    expect(await getMonthUptimeSeconds(new Date('2026-10-01T00:00:01.000Z'))).toBe(0);
  });
});

/**
 * **A fiação (armadilha 28).** O service certo não vale nada se ninguém o
 * registrar — e ele mora no `server.ts` de propósito, fora do `buildApp` que
 * toda suíte constrói. Um heartbeat que sumisse do `server.ts` deixaria a
 * suíte inteira verde e o arco de saturação em zero para sempre.
 */
describe('§3.1 — o heartbeat está ligado onde o processo sobe', () => {
  it('`server.ts` registra o `uptimeHeartbeatPlugin`', () => {
    const source = ts.createSourceFile(
      'server.ts',
      readFileSync(join(__dirname, '../../src/server.ts'), 'utf8'),
      ts.ScriptTarget.ES2022,
      false,
      ts.ScriptKind.TS,
    );

    let registered = false;
    const visit = (node: ts.Node): void => {
      if (
        ts.isCallExpression(node) &&
        ts.isPropertyAccessExpression(node.expression) &&
        node.expression.name.text === 'register' &&
        node.arguments.some(
          (arg) => ts.isIdentifier(arg) && arg.text === 'uptimeHeartbeatPlugin',
        )
      ) {
        registered = true;
      }
      ts.forEachChild(node, visit);
    };
    visit(source);

    expect(registered).toBe(true);
  });

  it('e o `buildApp` não — o `onClose` dele custaria uma ida ao banco por suíte', () => {
    const app = readFileSync(join(__dirname, '../../src/app.ts'), 'utf8');

    expect(app).not.toContain('uptimeHeartbeatPlugin');
  });
});
