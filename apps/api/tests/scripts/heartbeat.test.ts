import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  ACTIVITY_WARN_DAYS,
  API_RETRY_PAUSE_MS,
  evaluate,
  main,
  observe,
  renderSummary,
  type Observation,
  type Probe,
} from '../../scripts/heartbeat';

/**
 * **O batimento de fora** — 13.1 do plano de observabilidade (§23).
 *
 * Em setembro os três incidentes caros foram descobertos de fora: a suspensão
 * do Render (doze dias sem briefing) por uma sonda manual, a cota de imagem por
 * um advisory, as advisories pelo CI. Nada no sistema avisava ninguém, e o que
 * mede mora dentro da API — quando ela cai, o painel cai junto. Este script
 * roda num runner do GitHub uma vez por dia, depois da janela do cron, e o job
 * que reprova é o e-mail.
 */

const NOW = new Date('2026-10-08T12:41:00.000Z');
const TODAY = '2026-10-08';

function probe(status: number | null, body = '', ms = 300, headers: Record<string, string> = {}): Probe {
  return { status, body, ms, headers };
}

const homeWith = (locale: string, date: string) =>
  probe(200, `<a href="/${locale}/article/${date}">o briefing</a>`);

/** O que a rota `/api/health/auth` do web devolve (13.7). */
const authWith = (ok: boolean, day: string, status: number | null = ok ? 200 : 401) =>
  probe(
    200,
    JSON.stringify({
      ok,
      reason: ok ? 'accepted' : status === 401 ? 'rejected' : 'unreachable',
      status,
      checkedAt: `${day}T11:03:00.000Z`,
    }),
  );

function healthy(overrides: Partial<Observation> = {}): Observation {
  return {
    now: NOW,
    homes: { 'pt-BR': homeWith('pt-BR', TODAY), en: homeWith('en', TODAY) },
    api: [probe(200, JSON.stringify({ status: 'ok', uptime: 3600 }), 280)],
    latest: probe(200, JSON.stringify({ data: { date: `${TODAY}T00:00:00.000Z` } })),
    authProbe: authWith(true, TODAY),
    repoPushedAt: '2026-10-07T19:07:46Z',
    ...overrides,
  };
}

const state = (o: Observation, id: string) => evaluate(o).checks.find((c) => c.id === id)?.state;

describe('o veredito', () => {
  it('passes when the site, the API, the briefing of the day and both Homes are fine', () => {
    const verdict = evaluate(healthy());

    expect(verdict.ok).toBe(true);
    expect(verdict.today).toBe(TODAY);
    expect(verdict.checks.map((c) => [c.id, c.state])).toEqual([
      ['site', 'ok'],
      ['api', 'ok'],
      ['briefing', 'ok'],
      ['home', 'ok'],
      ['login', 'ok'],
      ['activity', 'ok'],
    ]);
  });

  /**
   * **O login, perguntado sem segredo no CI** (13.7, 09/10/2026). Os fluxos
   * com login do Smoke ficam desligados por decisão do dono; o defeito que
   * eles pegariam — a API recusar a assinatura da Vercel, todo leitor logado
   * em 401 com o site anônimo perfeito — é o que a sonda do cron responde, e
   * esta pergunta a lê.
   */
  it('fails when the API refuses the signature the Vercel makes — the login is broken', () => {
    const login = evaluate(healthy({ authProbe: authWith(false, TODAY) })).checks.find(
      (c) => c.id === 'login',
    );

    expect(login?.state).toBe('fail');
    expect(login?.summary).toMatch(/401/);
    expect(login?.action).toContain('AUTH_JWT_SECRET');
  });

  it('fails when the probe is from the day before — the cron did not ask today', () => {
    const login = evaluate(healthy({ authProbe: authWith(true, '2026-10-07') })).checks.find(
      (c) => c.id === 'login',
    );

    expect(login?.state).toBe('fail');
    expect(login?.summary).toContain('2026-10-07');
    expect(login?.action).toContain('cron.daily-news.warm');
  });

  it('fails when the probe page does not answer with a probe', () => {
    expect(state(healthy({ authProbe: probe(500, 'erro') }), 'login')).toBe('fail');
    expect(state(healthy({ authProbe: probe(200, '<html></html>') }), 'login')).toBe('fail');
  });

  it('does not ask about the login on a day without the briefing — one cause, one line', () => {
    // O cron só pergunta depois de um run em `SUCCESS`; sem o briefing de
    // hoje, a sonda de ontem é o esperado, não outra causa.
    const o = healthy({
      latest: probe(200, JSON.stringify({ data: { date: '2026-10-07T00:00:00.000Z' } })),
      authProbe: authWith(true, '2026-10-07'),
    });

    expect(state(o, 'login')).toBe('skipped');
  });

  it('fails when the Home does not answer 200', () => {
    const o = healthy({ homes: { 'pt-BR': probe(500, 'erro'), en: homeWith('en', TODAY) } });
    expect(state(o, 'site')).toBe('fail');
    expect(evaluate(o).ok).toBe(false);
  });

  /**
   * **O briefing do dia é o sinal que cobre todos os outros** (§23): a API
   * suspensa, o cron que não a acordou, o portão que bloqueou, o pipeline que
   * morreu — todos terminam num dia sem briefing.
   */
  it('fails when the newest briefing is from the day before, and says which day it is', () => {
    const o = healthy({
      latest: probe(200, JSON.stringify({ data: { date: '2026-10-07T00:00:00.000Z' } })),
    });
    const briefing = evaluate(o).checks.find((c) => c.id === 'briefing');

    expect(briefing?.state).toBe('fail');
    expect(briefing?.summary).toContain('2026-10-07');
    expect(evaluate(o).ok).toBe(false);
  });

  it('fails when there is no briefing at all (404)', () => {
    expect(state(healthy({ latest: probe(404, '{"error":"Article not found"}') }), 'briefing')).toBe(
      'fail',
    );
  });

  it('does not blame the Home for a briefing that does not exist — one cause, one line', () => {
    const o = healthy({
      latest: probe(200, JSON.stringify({ data: { date: '2026-10-07T00:00:00.000Z' } })),
      homes: { 'pt-BR': homeWith('pt-BR', '2026-10-07'), en: homeWith('en', '2026-10-07') },
    });

    expect(state(o, 'home')).toBe('skipped');
  });

  /**
   * **O 07/10/2026, visto de fora.** O briefing existia, a `/en` o mostrava, e
   * a Home `/pt-BR` passou a tarde com o da véspera em `HIT`. É o que o 13a′
   * conserta pelo cron; se ele desistir, a única marca é uma linha de log que
   * a Vercel guarda por uma hora — esta pergunta a transforma em e-mail.
   */
  it('fails when the briefing exists and one Home still shows the day before — naming the locale', () => {
    const o = healthy({
      homes: { 'pt-BR': homeWith('pt-BR', '2026-10-07'), en: homeWith('en', TODAY) },
    });
    const home = evaluate(o).checks.find((c) => c.id === 'home');

    expect(home?.state).toBe('fail');
    expect(home?.summary).toContain('/pt-BR');
    expect(home?.summary).not.toContain('/en');
    expect(home?.action).toContain('cron.daily-news.warm');
  });

  it('does not take the link of the other language for the Home of this one', () => {
    const o = healthy({
      homes: { 'pt-BR': homeWith('en', TODAY), en: homeWith('en', TODAY) },
    });
    expect(state(o, 'home')).toBe('fail');
  });

  /**
   * **A suspensão do Render pede uma ação diferente de um timeout**, e o
   * cabeçalho é o que separa: em 19/09 e em 29/08 a resposta foi `503` com
   * `x-render-routing: suspend`. Nada no código resolve — é o Billing.
   */
  it('names a Render suspension apart from any other failure, and does not retry it', async () => {
    const o = healthy({
      api: [probe(503, 'Service Suspended', 120, { 'x-render-routing': 'suspend' })],
      latest: null,
    });
    const api = evaluate(o).checks.find((c) => c.id === 'api');

    expect(api?.state).toBe('fail');
    expect(api?.summary).toMatch(/suspen/i);
    expect(api?.action).toMatch(/Billing/);
    // Sem a API, o briefing não pode ser perguntado — e não é outra causa.
    expect(state(o, 'briefing')).toBe('skipped');
  });

  it('tells a timeout apart from a suspension', () => {
    const o = healthy({ api: [probe(null, '', 120_000), probe(null, '', 120_000)], latest: null });
    const api = evaluate(o).checks.find((c) => c.id === 'api');

    expect(api?.state).toBe('fail');
    expect(api?.summary).not.toMatch(/suspen/i);
  });

  /**
   * **A sonda da API é a série que o 13.3 precisa, de graça.** A acordada do
   * Render mediu ~52 s em outubro contra 4,9 s em agosto, numa amostra só; o
   * envelope do cron depende desse número.
   */
  it('records how long the API took, and whether this probe is what woke it', () => {
    const cold = evaluate(
      healthy({ api: [probe(200, JSON.stringify({ status: 'ok', uptime: 9.4 }), 52_310)] }),
    );
    const warm = evaluate(healthy());

    expect(cold.apiProbe).toMatchObject({ ms: 52_310, woke: true, status: 200, attempts: 1 });
    expect(warm.apiProbe).toMatchObject({ ms: 280, woke: false });
  });

  it('warns before GitHub disables the schedule — 60 days without activity in a public repository', () => {
    const stale = new Date(NOW.getTime() - (ACTIVITY_WARN_DAYS + 1) * 86_400_000).toISOString();
    const activity = evaluate(healthy({ repoPushedAt: stale })).checks.find((c) => c.id === 'activity');

    expect(activity?.state).toBe('fail');
    expect(activity?.action).toMatch(/push/);
    expect(state(healthy({ repoPushedAt: null }), 'activity')).toBe('skipped');
    // Leitura que falhou não é alarme — um falso sobre o próprio alarme
    // ensinaria a ignorar o e-mail.
    expect(state(healthy({ repoPushedAt: 'não é data' }), 'activity')).toBe('skipped');
  });

  /**
   * **O ensaio do alerta** (pedido do dono, 07/10/2026). Uma execução verde não
   * gera e-mail — o certo, com "só falhas" ligado —, então ela prova que o job
   * roda e não que o alerta chega. O ensaio pergunta tudo de verdade e reprova
   * de propósito, dizendo que é ensaio: é o único jeito de ver o e-mail sem
   * esperar um dia ruim.
   */
  it('fails on purpose in a rehearsal, saying so, and still asks everything for real', () => {
    const verdict = evaluate(healthy(), { rehearsal: true });
    const rehearsal = verdict.checks.find((c) => c.id === 'rehearsal');

    expect(verdict.ok).toBe(false);
    expect(rehearsal?.state).toBe('fail');
    expect(rehearsal?.summary).toMatch(/ensaio/i);
    // As outras perguntas continuam respondidas: o resumo do ensaio é o de um
    // dia de verdade, e a sonda da API entra na série do 13.3.
    expect(verdict.checks.filter((c) => c.id !== 'rehearsal').every((c) => c.state === 'ok')).toBe(
      true,
    );
  });

  it('never rehearses unless asked', () => {
    expect(evaluate(healthy()).checks.some((c) => c.id === 'rehearsal')).toBe(false);
    expect(evaluate(healthy(), { rehearsal: false }).ok).toBe(true);
  });

  it('reads today in UTC — the day of `Article.date`, not of the runner', () => {
    // 01:30 em São Paulo de 09/10 ainda é 08/10 em UTC… e 23:59 de 08/10 em
    // São Paulo já é 09/10 em UTC.
    const verdict = evaluate(healthy({ now: new Date('2026-10-09T02:59:00.000Z') }));
    expect(verdict.today).toBe('2026-10-09');
  });
});

describe('o resumo do job', () => {
  it('lists every check, and the API probe always — even on a green day', () => {
    const md = renderSummary(evaluate(healthy()));

    for (const id of ['site', 'api', 'briefing', 'home', 'login', 'activity']) {
      expect(md).toContain(id);
    }
    expect(md).toContain('280 ms');
  });

  it('says what to do for each failure', () => {
    const md = renderSummary(
      evaluate(
        healthy({
          homes: { 'pt-BR': homeWith('pt-BR', '2026-10-07'), en: homeWith('en', TODAY) },
        }),
      ),
    );

    expect(md).toContain('cron.daily-news.warm');
  });
});

describe('a observação, com o fetch de mentira', () => {
  const SITE = 'https://site.test';
  const API = 'https://api.test';

  function respond(map: Record<string, Array<Response | Error>>) {
    const calls: string[] = [];
    const fetchFn = vi.fn(async (input: string | URL) => {
      const url = String(input);
      calls.push(url);
      const queue = map[url];
      const next = queue && queue.length > 1 ? queue.shift() : queue?.[0];
      if (!next) throw new Error(`unexpected ${url}`);
      if (next instanceof Error) throw next;
      return next.clone();
    });
    return { fetchFn, calls };
  }

  const ok = (body: string, headers: Record<string, string> = {}) =>
    new Response(body, { status: 200, headers });

  const PROBE = JSON.stringify({ ok: true, reason: 'accepted', status: 200, checkedAt: `${TODAY}T11:03:00.000Z` });

  it('asks both Homes, the health, the latest briefing and the login probe — and only GETs', async () => {
    const { fetchFn, calls } = respond({
      [`${SITE}/pt-BR`]: [ok(`/pt-BR/article/${TODAY}`)],
      [`${SITE}/en`]: [ok(`/en/article/${TODAY}`)],
      [`${API}/api/health`]: [ok('{"status":"ok","uptime":10}')],
      [`${API}/api/articles/latest`]: [ok(`{"data":{"date":"${TODAY}T00:00:00.000Z"}}`)],
      [`${SITE}/api/health/auth`]: [ok(PROBE)],
    });

    const o = await observe({
      fetch: fetchFn as unknown as typeof fetch,
      siteUrl: SITE,
      apiUrl: API,
      now: () => NOW,
      pause: async () => undefined,
      repoPushedAt: null,
    });

    // A sonda do login é lida **do site** (o cache da Vercel), nunca da API:
    // quem fala com a API é o cron, uma vez por dia.
    expect(calls.sort()).toEqual(
      [
        `${API}/api/articles/latest`,
        `${API}/api/health`,
        `${SITE}/api/health/auth`,
        `${SITE}/en`,
        `${SITE}/pt-BR`,
      ].sort(),
    );
    for (const [, init] of fetchFn.mock.calls as unknown as Array<[string, RequestInit | undefined]>) {
      expect(init?.method ?? 'GET').toBe('GET');
    }
    expect(evaluate(o).ok).toBe(true);
  });

  it('tries the API once more after a pause when the first probe gets no answer', async () => {
    const pause = vi.fn(async () => undefined);
    const { fetchFn } = respond({
      [`${SITE}/pt-BR`]: [ok(`/pt-BR/article/${TODAY}`)],
      [`${SITE}/en`]: [ok(`/en/article/${TODAY}`)],
      [`${API}/api/health`]: [new Error('The operation was aborted due to timeout'), ok('{"uptime":3}')],
      [`${API}/api/articles/latest`]: [ok(`{"data":{"date":"${TODAY}T00:00:00.000Z"}}`)],
      [`${SITE}/api/health/auth`]: [ok(PROBE)],
    });

    const o = await observe({
      fetch: fetchFn as unknown as typeof fetch,
      siteUrl: SITE,
      apiUrl: API,
      now: () => NOW,
      pause,
      repoPushedAt: null,
    });

    expect(o.api).toHaveLength(2);
    expect(o.api[0]?.status).toBeNull();
    expect(pause).toHaveBeenCalledWith(API_RETRY_PAUSE_MS);
    expect(evaluate(o).apiProbe.attempts).toBe(2);
    expect(evaluate(o).ok).toBe(true);
  });

  it('does not ask for the briefing when the API is suspended', async () => {
    const { fetchFn, calls } = respond({
      [`${SITE}/pt-BR`]: [ok(`/pt-BR/article/2026-10-07`)],
      [`${SITE}/en`]: [ok(`/en/article/2026-10-07`)],
      [`${API}/api/health`]: [
        new Response('Service Suspended', { status: 503, headers: { 'x-render-routing': 'suspend' } }),
      ],
    });

    const o = await observe({
      fetch: fetchFn as unknown as typeof fetch,
      siteUrl: SITE,
      apiUrl: API,
      now: () => NOW,
      pause: async () => undefined,
      repoPushedAt: null,
    });

    expect(calls).not.toContain(`${API}/api/articles/latest`);
    expect(o.latest).toBeNull();
    expect(evaluate(o).checks.find((c) => c.id === 'api')?.summary).toMatch(/suspen/i);
  });
});

describe('a saída do processo', () => {
  it('exits 1 on a failing day — the failed job is the e-mail — and writes the summary', async () => {
    const written: string[] = [];
    const lines: string[] = [];
    const code = await main({
      env: { GITHUB_STEP_SUMMARY: 'summary.md', HEARTBEAT_SITE_URL: 'https://s.test', HEARTBEAT_API_URL: 'https://a.test' },
      fetch: (async (input: string | URL) => {
        const url = String(input);
        if (url.endsWith('/api/health')) return new Response('{"uptime":5000}');
        if (url.endsWith('/api/articles/latest')) {
          return new Response('{"data":{"date":"2026-10-07T00:00:00.000Z"}}');
        }
        return new Response('<html></html>');
      }) as typeof fetch,
      now: () => NOW,
      pause: async () => undefined,
      appendSummary: (_file, text) => written.push(text),
      log: (line) => lines.push(line),
    });

    expect(code).toBe(1);
    expect(written.join('')).toContain('briefing');
    // Uma linha estável no log, para a série de acordadas ser lida depois.
    expect(lines.some((l) => /^heartbeat api_ms=\d+ woke=(true|false|unknown) status=200/.test(l))).toBe(
      true,
    );
  });

  it('exits 1 in a rehearsal on a good day — only when HEARTBEAT_REHEARSAL is exactly "true"', async () => {
    const goodDay = (async (input: string | URL) => {
      const url = String(input);
      if (url.endsWith('/api/health')) return new Response('{"uptime":5000}');
      if (url.endsWith('/api/articles/latest')) {
        return new Response(`{"data":{"date":"${TODAY}T00:00:00.000Z"}}`);
      }
      if (url.endsWith('/api/health/auth')) {
        return new Response(
          JSON.stringify({ ok: true, reason: 'accepted', status: 200, checkedAt: `${TODAY}T11:03:00.000Z` }),
        );
      }
      const locale = url.endsWith('/en') ? 'en' : 'pt-BR';
      return new Response(`/${locale}/article/${TODAY}`);
    }) as typeof fetch;
    const run = (rehearsal: string | undefined) =>
      main({
        env: { HEARTBEAT_REHEARSAL: rehearsal },
        fetch: goodDay,
        now: () => NOW,
        pause: async () => undefined,
        appendSummary: () => undefined,
        log: () => undefined,
      });

    expect(await run('true')).toBe(1);
    // O agendamento manda vazio (a entrada só existe no disparo manual), e o
    // disparo manual sem marcar manda "false".
    expect(await run('')).toBe(0);
    expect(await run('false')).toBe(0);
    expect(await run(undefined)).toBe(0);
  });

  it('exits 0 on a good day', async () => {
    const code = await main({
      env: {},
      fetch: (async (input: string | URL) => {
        const url = String(input);
        if (url.endsWith('/api/health')) return new Response('{"uptime":5000}');
        if (url.endsWith('/api/articles/latest')) {
          return new Response(`{"data":{"date":"${TODAY}T00:00:00.000Z"}}`);
        }
        if (url.endsWith('/api/health/auth')) {
          return new Response(
            JSON.stringify({ ok: true, reason: 'accepted', status: 200, checkedAt: `${TODAY}T11:03:00.000Z` }),
          );
        }
        const locale = url.endsWith('/en') ? 'en' : 'pt-BR';
        return new Response(`/${locale}/article/${TODAY}`);
      }) as typeof fetch,
      now: () => NOW,
      pause: async () => undefined,
      appendSummary: () => undefined,
      log: () => undefined,
    });

    expect(code).toBe(0);
  });
});

/**
 * **O workflow que roda o script.** Lido como texto, como o resto de
 * `tests/build/` — e pela mesma razão: o arquivo que decide quando o alerta
 * existe não passa por revisor nenhum depois que entra.
 */
describe('o workflow do batimento', () => {
  const RAIZ = path.resolve(__dirname, '../../../..');
  const yml = readFileSync(path.join(RAIZ, '.github/workflows/heartbeat.yml'), 'utf8')
    .split('\r\n')
    .join('\n');
  const codigo = yml
    .split('\n')
    .map((linha) => {
      const comentario = linha.search(/(?:^|\s)#/);
      return comentario === -1 ? linha : linha.slice(0, comentario);
    })
    .join('\n');

  it('runs once a day, after the whole hour in which the Vercel cron may fire', () => {
    // O Hobby dispara o cron em qualquer minuto da hora agendada, e o run leva
    // ~1,5 min mais as páginas do 13a′: o batimento tem de cair depois da hora
    // inteira, senão ele mede um dia que ainda está acontecendo.
    const vercel = JSON.parse(readFileSync(path.join(RAIZ, 'apps/web/vercel.json'), 'utf8')) as {
      crons: Array<{ schedule: string }>;
    };
    const cronHour = Number(vercel.crons[0]?.schedule.split(' ')[1]);
    const agenda = /cron:\s*'(\d+) (\d+) \* \* \*'/.exec(codigo);

    expect(agenda, 'um `cron:` diário').not.toBeNull();
    expect(Number(agenda?.[2])).toBeGreaterThan(cronHour);
    expect(codigo).toMatch(/workflow_dispatch:/);
  });

  it('runs the script with Node alone — no install, so the alert has one less way to fail', () => {
    expect(codigo).toMatch(/node apps\/api\/scripts\/heartbeat\.ts/);
    expect(codigo).not.toMatch(/pnpm install|npm (ci|install)/);
  });

  it('offers the rehearsal only on the manual trigger, and wires it to the script', () => {
    // Entrada booleana do `workflow_dispatch`, desligada por padrão; o
    // agendamento não tem entrada nenhuma, então nunca ensaia.
    expect(codigo).toMatch(
      /workflow_dispatch:\s*\n\s+inputs:\s*\n\s+rehearse_failure:[\s\S]*?type:\s*boolean[\s\S]*?default:\s*false/,
    );
    expect(codigo).toMatch(/HEARTBEAT_REHEARSAL:\s*\$\{\{\s*inputs\.rehearse_failure\s*\}\}/);
  });

  it('only reads — the token writes nothing', () => {
    expect(codigo).toMatch(/^permissions:\s*\n\s+contents:\s*read\s*$/m);
    expect(codigo).not.toMatch(/:\s*write\b/);
  });
});
