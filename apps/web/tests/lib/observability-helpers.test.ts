import { describe, it, expect } from 'vitest';
import {
  formatCalendarDay,
  formatDeltaPercent,
  formatHours,
  formatMegabytes,
  formatMilliseconds,
  formatRate,
  formatRatio,
  formatUptime,
} from '@/lib/format';
import { kpiDelta } from '@/lib/kpi';
import { fillCalendarDays } from '@/lib/series';
import ts from 'typescript';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import {
  ATTENTION_RATIO,
  PACE_MIN_ELAPSED_HOURS,
  parseHoursInput,
  planPace,
  saturationTone,
  workspaceHours,
  workspaceReadingOf,
} from '@/lib/saturation';

/**
 * As funções puras do PR 5c — o que a tela de observabilidade calcula antes
 * de desenhar. Cada uma existe por um defeito nomeado no cabeçalho dela, e o
 * teste é sobre esse defeito.
 */

describe('formatDeltaPercent', () => {
  it('carries the sign, in the locale', () => {
    expect(formatDeltaPercent(491, 436.4)).toBe('+12,5%');
    expect(formatDeltaPercent(27_000, 30_000)).toBe('-10%');
    expect(formatDeltaPercent(491, 436.4, 'en-US')).toBe('+12.5%');
  });

  it('is null without an honest baseline — never "+∞%"', () => {
    expect(formatDeltaPercent(10, 0)).toBeNull();
    expect(formatDeltaPercent(10, null)).toBeNull();
    expect(formatDeltaPercent(null, 10)).toBeNull();
  });
});

describe('kpiDelta', () => {
  const options = { period: 'vs. média 7 d', locale: 'pt-BR' };

  it('says whether the direction is good, not only where it points', () => {
    expect(kpiDelta(491, 436.4, options)).toEqual({
      text: '+12,5%',
      direction: 'up',
      tone: 'better',
      period: 'vs. média 7 d',
    });
    // Duração subindo é pior.
    expect(kpiDelta(33_000, 30_000, { ...options, betterWhen: 'down' })?.tone).toBe('worse');
    expect(kpiDelta(27_000, 30_000, { ...options, betterWhen: 'down' })?.tone).toBe('better');
  });

  it('is flat exactly when the text rounds to 0%', () => {
    // 0,04% imprime "0%": seta neutra. 0,3% imprime "+0,3%": seta para cima.
    expect(kpiDelta(1000.4, 1000, options)).toMatchObject({ direction: 'flat', tone: 'neutral', text: '0%' });
    expect(kpiDelta(491, 489.7, options)).toMatchObject({ direction: 'up', text: '+0,3%' });
  });

  it('is null when there is nothing to compare against', () => {
    expect(kpiDelta(undefined, 436.4, options)).toBeNull();
    expect(kpiDelta(491, 0, options)).toBeNull();
  });
});

describe('saturationTone', () => {
  it('is neutral below the attention line, orange up to the ceiling, red past it', () => {
    expect(ATTENTION_RATIO).toBe(0.8);
    expect(saturationTone(0.41)).toBe('neutral');
    expect(saturationTone(0.8)).toBe('attention');
    expect(saturationTone(0.99)).toBe('attention');
    // 29/08/2026: passar de 1 é o que suspendeu a API.
    expect(saturationTone(1)).toBe('exceeded');
    expect(saturationTone(1.04)).toBe('exceeded');
  });
});

describe('planPace', () => {
  const plan = {
    month: '2026-09',
    monthStart: '2026-09-01T00:00:00.000Z',
    secondsUsed: 0,
    hoursUsed: 240,
    limitHours: 750,
    ratio: 0.32,
    workspaceReading: null,
  };

  it('projects the month from the hours elapsed — the number that would have warned before 29/08', () => {
    // Dia 11 às 00:00 UTC: 240 h decorridas e 240 h usadas é 24/7, e 24/7 em
    // setembro são 720 h — 96% do plano, com o arco de hoje dizendo só 32%.
    const pace = planPace(plan, new Date('2026-09-11T00:00:00.000Z'));

    expect(pace).toEqual({
      projectedHours: 720,
      projectedRatio: 0.96,
      hoursInMonth: 720,
      scope: 'api',
    });
  });

  it('says nothing before a day of sample — the gate without a baseline', () => {
    expect(PACE_MIN_ELAPSED_HOURS).toBe(24);
    expect(planPace({ ...plan, hoursUsed: 2 }, new Date('2026-09-01T02:00:00.000Z'))).toBeNull();
    expect(planPace({ ...plan, hoursUsed: 24 }, new Date('2026-09-02T00:00:00.000Z'))).not.toBeNull();
  });

  it('says nothing when the plan month is not the clock month', () => {
    expect(planPace(plan, new Date('2026-10-05T00:00:00.000Z'))).toBeNull();
  });

  it('uses the calendar length of the month', () => {
    const october = { ...plan, month: '2026-10', monthStart: '2026-10-01T00:00:00.000Z' };
    expect(planPace(october, new Date('2026-10-11T00:00:00.000Z'))?.hoursInMonth).toBe(744);
  });
});

/**
 * **O workspace inteiro — Fase 13 do plano de observabilidade, 13b (§23).**
 *
 * As 750 h são do workspace, que o `NetsheetEngine` divide com esta API; a
 * leitura do Billing que o dono digita traz o total e a parte desta API no
 * mesmo instante. Esta é a conta, num lugar só: a parte dos outros, o ritmo
 * deles, a estimativa de agora e a projeção do mês.
 */
describe('workspaceHours — a leitura do Billing vira o workspace inteiro', () => {
  const october = {
    month: '2026-10',
    monthStart: '2026-10-01T00:00:00.000Z',
    secondsUsed: 0,
    hoursUsed: 40.1,
    limitHours: 750,
    ratio: 40.1 / 750,
    workspaceReading: {
      readAt: '2026-10-06T00:00:00.000Z',
      workspaceHours: 124.9,
      apiHours: 34.9,
    },
  };

  it('a parte dos outros serviços é o total menos esta API, no instante da leitura', () => {
    const workspace = workspaceHours(
      { ...october, hoursUsed: 34.9 },
      new Date('2026-10-06T00:00:00.000Z'),
    )!;

    // 120 h decorridas na leitura, 90 h dos outros: 75 % do relógio.
    expect(workspace.otherHoursAtRead).toBeCloseTo(90, 6);
    expect(workspace.otherRate).toBeCloseTo(0.75, 6);
    expect(workspace.otherHoursNow).toBeCloseTo(90, 6);
    expect(workspace.totalHoursNow).toBeCloseTo(124.9, 6);
    expect(workspace.ratio).toBeCloseTo(124.9 / 750, 6);
  });

  it('entre uma leitura e outra, os outros andam no ritmo da leitura; esta API é medida', () => {
    // Um dia depois: 18 h a mais dos outros (0,75 × 24), e esta API no que o
    // `DailyUptime` diz agora.
    const workspace = workspaceHours(october, new Date('2026-10-07T00:00:00.000Z'))!;

    expect(workspace.otherHoursNow).toBeCloseTo(108, 6);
    expect(workspace.totalHoursNow).toBeCloseTo(148.1, 6);
    expect(workspace.ratio).toBeCloseTo(148.1 / 750, 6);
  });

  it('o teto é o que a API manda — nunca um 750 escrito aqui', () => {
    const workspace = workspaceHours(
      { ...october, limitHours: 500 },
      new Date('2026-10-07T00:00:00.000Z'),
    )!;

    expect(workspace.ratio).toBeCloseTo(148.1 / 500, 6);
  });

  it('leitura das primeiras 24 h do mês não tem ritmo — os outros ficam no número dela', () => {
    const early = {
      ...october,
      workspaceReading: { readAt: '2026-10-01T06:00:00.000Z', workspaceHours: 9, apiHours: 1.5 },
    };
    const workspace = workspaceHours(early, new Date('2026-10-03T00:00:00.000Z'))!;

    expect(workspace.otherRate).toBeNull();
    expect(workspace.otherHoursNow).toBeCloseTo(7.5, 6);
  });

  it('`null` sem leitura, e com uma leitura de outro mês — o Billing zera no dia 1º', () => {
    const now = new Date('2026-10-07T00:00:00.000Z');
    expect(workspaceHours({ ...october, workspaceReading: null }, now)).toBeNull();
    expect(
      workspaceHours(
        {
          ...october,
          workspaceReading: { readAt: '2026-09-29T00:00:00.000Z', workspaceHours: 700, apiHours: 200 },
        },
        now,
      ),
    ).toBeNull();
  });

  it('a resposta sem o campo (a API anterior à Fase 13 — armadilha 37) é o mesmo que sem leitura', () => {
    const { workspaceReading: _dropped, ...legacy } = october;
    const plan = legacy as typeof october;
    const now = new Date('2026-10-07T00:00:00.000Z');

    expect(workspaceReadingOf(plan)).toBeNull();
    expect(workspaceHours(plan, now)).toBeNull();
    expect(planPace(plan, now)?.scope).toBe('api');
  });
});

describe('planPace — com a leitura, projeta o workspace', () => {
  const october = {
    month: '2026-10',
    monthStart: '2026-10-01T00:00:00.000Z',
    secondsUsed: 0,
    hoursUsed: 48,
    limitHours: 750,
    ratio: 48 / 750,
    workspaceReading: {
      readAt: '2026-10-06T00:00:00.000Z',
      workspaceHours: 130,
      apiHours: 40,
    },
  };

  it('soma os dois ritmos — esta API medida até agora, os outros na leitura', () => {
    // 07/10 00:00: 144 h decorridas; esta API 48/144 = 1/3; os outros
    // 90/120 = 0,75. Juntos, 1,0833 × 744 h = 806 h — acima do teto, que é a
    // conta de outubro de 2026 que o arco desta API sozinha escondia.
    const pace = planPace(october, new Date('2026-10-07T00:00:00.000Z'))!;

    expect(pace.scope).toBe('workspace');
    expect(pace.hoursInMonth).toBe(744);
    expect(pace.projectedHours).toBeCloseTo((1 / 3 + 0.75) * 744, 6);
    expect(pace.projectedRatio).toBeCloseTo(((1 / 3 + 0.75) * 744) / 750, 6);
  });

  it('cala quando a leitura não tem ritmo — projetar só esta API esconderia os outros', () => {
    const early = {
      ...october,
      workspaceReading: { readAt: '2026-10-01T06:00:00.000Z', workspaceHours: 9, apiHours: 1.5 },
    };

    expect(planPace(early, new Date('2026-10-07T00:00:00.000Z'))).toBeNull();
  });
});

describe('parseHoursInput — o número do Billing, como o teclado o escreve', () => {
  it.each([
    ['124,27', 124.27],
    ['124.27', 124.27],
    [' 124 ', 124],
    ['0', 0],
  ])('lê %j como %d', (text, hours) => {
    expect(parseHoursInput(text)).toBe(hours);
  });

  it.each(['', 'abc', '-3', '1.234,5', '12,4,2', '1e3', '124 h'])('recusa %j', (text) => {
    expect(parseHoursInput(text)).toBeNull();
  });
});

/**
 * **O teto do workspace mora num lugar só** — do lado da tela. O `750` vem da
 * API em `limitHours`; um literal aqui seria um segundo denominador, e é como
 * o arco passou setembro dividindo a parte desta API pelo teto inteiro. Pelo
 * parser: o número aparece em comentário, e deve continuar aparecendo.
 */
describe('o denominador do arco vem da API, nunca de um literal', () => {
  const WEB_ROOT = join(__dirname, '../..');

  function sources(dir: string): string[] {
    return readdirSync(dir).flatMap((entry) => {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) return sources(full);
      return /\.tsx?$/.test(entry) ? [full] : [];
    });
  }

  it('nenhum `750` numérico em `lib/`, `components/` ou `app/`', () => {
    const files = ['lib', 'components', 'app'].flatMap((dir) => sources(join(WEB_ROOT, dir)));
    const found: string[] = [];

    for (const file of files) {
      const tree = ts.createSourceFile(
        file,
        readFileSync(file, 'utf8'),
        ts.ScriptTarget.ES2022,
        true,
        file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
      );
      const visit = (node: ts.Node): void => {
        if (ts.isNumericLiteral(node) && Number(node.text.replace(/_/g, '')) === 750) {
          const { line } = tree.getLineAndCharacterOfPosition(node.getStart(tree));
          found.push(`${relative(WEB_ROOT, file).split(sep).join('/')}:${line + 1}`);
        }
        ts.forEachChild(node, visit);
      };
      visit(tree);
    }

    expect(files.length).toBeGreaterThan(50);
    expect(found).toEqual([]);
  });
});

describe('fillCalendarDays', () => {
  const period = { start: '2026-09-11T18:35:00.000Z', end: '2026-09-14T18:35:00.000Z' };
  const empty = (date: string) => ({ date, sessions: 0, events: 0 });

  it('gives every calendar day of the window a slot, zero where nothing happened', () => {
    // A API só devolve os dias com evento: um dia numa janela de 30 virava
    // uma barra de largura inteira, e o eixo do tempo deixava de existir.
    const filled = fillCalendarDays([{ date: '2026-09-13', sessions: 4, events: 9 }], period, empty);

    expect(filled.map((day) => day.date)).toEqual(['2026-09-11', '2026-09-12', '2026-09-13', '2026-09-14']);
    expect(filled.map((day) => day.sessions)).toEqual([0, 0, 4, 0]);
  });

  it('counts the days in UTC — the keys are UTC days', () => {
    // 23:30 UTC do dia 11 ainda é dia 11; no fuso de São Paulo seria 20:30 do
    // mesmo dia, mas em Tóquio já seria dia 12 — e a chave é UTC.
    const filled = fillCalendarDays([], { start: '2026-09-11T23:30:00.000Z', end: '2026-09-12T00:30:00.000Z' }, empty);
    expect(filled.map((day) => day.date)).toEqual(['2026-09-11', '2026-09-12']);
  });

  it('leaves the points alone when the window is not a window', () => {
    const points = [{ date: '2026-09-13', sessions: 1, events: 1 }];
    expect(fillCalendarDays(points, { start: 'nope', end: period.end }, empty)).toBe(points);
    expect(fillCalendarDays(points, { start: period.end, end: period.start }, empty)).toBe(points);
  });
});

describe('os formatadores da observabilidade', () => {
  it('formatMilliseconds keeps the tens of milliseconds a latency lives in', () => {
    expect(formatMilliseconds(42)).toBe('42 ms');
    expect(formatMilliseconds(4903)).toBe('4,9 s');
    expect(formatMilliseconds(4903, 'en-US')).toBe('4.9 s');
  });

  it('formatRatio goes past 100% — the arc must say 104%, not 100%', () => {
    expect(formatRatio(0.4067)).toBe('41%');
    expect(formatRatio(1.04)).toBe('104%');
    expect(formatRatio(-0.2)).toBe('0%');
  });

  it('formatRate keeps two decimals for an HTTP error rate', () => {
    expect(formatRate(0.0008)).toBe('0,08%');
    expect(formatRate(0)).toBe('0%');
  });

  it('formatMegabytes, formatHours and formatUptime read like an operator would', () => {
    expect(formatMegabytes(98_304_000)).toBe('94 MB');
    expect(formatMegabytes(536_870_912)).toBe('512 MB');
    expect(formatHours(305.4)).toBe('305 h');
    expect(formatUptime(11_520)).toBe('3 h 12 min');
    expect(formatUptime(2_700)).toBe('45 min');
    expect(formatUptime(30)).toBe('30 s');
  });

  it('formatCalendarDay reads a YYYY-MM-DD key in UTC, so 01/09 stays 01/09 in Brazil', () => {
    // `byDay.date` é o dia UTC do `toISOString().slice(0, 10)`. Lido no fuso
    // local, `2026-09-01` viraria 31/08 em qualquer fuso negativo.
    expect(formatCalendarDay('2026-09-01')).toMatch(/^01 de set\.?$/);
    expect(formatCalendarDay('2026-09-01', 'en-US')).toBe('Sep 01');
  });
});
