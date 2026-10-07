import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Mock } from 'vitest';
import { GET } from '@/app/api/cron/daily-news/route';
import { DAILY_REVALIDATION_PATHS, dailyPages } from '@/lib/daily-revalidation';
import { SITE_URL } from '@/lib/seo';
import {
  CRON_MAX_DURATION_MS,
  DAILY_PAGES_ROUNDS,
  PIPELINE_TRIGGER_ATTEMPTS,
} from '@/lib/timeouts';

const revalidatePathMock = vi.fn();
const logServerErrorMock = vi.fn();

vi.mock('next/cache', () => ({
  revalidatePath: (...args: unknown[]) => revalidatePathMock(...args),
}));

// A linha de log é o que o 13.12 promete quando o cron desiste das páginas;
// fora de `production`/`development` o logger real se cala, então a suíte a
// lê daqui.
vi.mock('@/lib/log-server-error', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/log-server-error')>()),
  logServerError: (...args: unknown[]) => logServerErrorMock(...args),
}));

// A espera pelo fim do run sonda a cada 10 s por até 150 s; aqui ela sonda
// sem pausa e desiste em 50 ms, para a suíte não esperar relógio de verdade.
// O mesmo para a pausa antes de cada rodada de páginas.
vi.mock('@/lib/timeouts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/timeouts')>()),
  PIPELINE_SETTLE_POLL_MS: 0,
  PIPELINE_SETTLE_MAX_MS: 50,
  PIPELINE_REFUSED_PAUSE_MS: 0,
  DAILY_PAGES_PAUSE_MS: 0,
}));

const CRON_SECRET = 'cron-secret';
const JOB_URL = 'https://api.example.com/jobs/daily-pipeline';
const JOB_SECRET = 'job-secret';

const ORIGINAL_ENV = {
  CRON_SECRET: process.env.CRON_SECRET,
  BACKEND_JOB_URL: process.env.BACKEND_JOB_URL,
  BACKEND_JOB_SECRET: process.env.BACKEND_JOB_SECRET,
};

function setEnv(overrides: Record<string, string | undefined>) {
  process.env.CRON_SECRET = CRON_SECRET;
  process.env.BACKEND_JOB_URL = JOB_URL;
  process.env.BACKEND_JOB_SECRET = JOB_SECRET;
  Object.assign(process.env, overrides);
}

function authorizedRequest() {
  return new Request('http://localhost:3000/api/cron/daily-news', {
    headers: { authorization: `Bearer ${CRON_SECRET}` },
  });
}

/**
 * **O site e a API atrás de um `fetch` só, roteado pela URL** — a forma que o
 * cron vê desde o 13.12, quando ele passou a falar com três lugares: a API
 * (acordar, disparar, sondar o run), a rota irmã que invalida
 * (`/api/cron/daily-news/revalidate`) e as páginas do conjunto do dia.
 */
const RUN_DATE = '2026-10-07';
const REVALIDATE_URL = `${SITE_URL}/api/cron/daily-news/revalidate`;

/** Um documento com todas as marcas do run do dia — serve a qualquer página. */
function bodyOf(date: string): string {
  return [
    `<a href="/pt-BR/article/${date}">`,
    `<a href="/en/article/${date}">`,
    `"@id":"${SITE_URL}/pt-BR/article/${date}#article"`,
    `"@id":"${SITE_URL}/en/article/${date}#article"`,
    `self.__next_f.push([1,"{\\"createdAt\\":\\"${date}T11:00:11.000Z\\"}"])`,
  ].join('\n');
}
const FRESH = bodyOf(RUN_DATE);
const YESTERDAY = bodyOf('2026-10-06');

interface PageReply {
  body: string;
  status?: number;
  cache?: string;
}

interface SiteScript {
  trigger: { outcome: string; pipelineId: string; startedAt: string };
  /** Os status que a sonda do run lê, em ordem; o último se repete. */
  statuses?: string[];
  /** O status da rota irmã que invalida. */
  revalidateStatus?: number;
  /** A resposta de cada pedido de página — `hit` conta a partir de 1. */
  page?: (url: string, hit: number) => PageReply | Error;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function siteFetch(script: SiteScript): Mock {
  const hits = new Map<string, number>();
  let poll = 0;
  const statuses = script.statuses ?? ['SUCCESS'];
  // Por padrão toda página já traz o run do disparo.
  const fresh = bodyOf(script.trigger.startedAt.slice(0, 10));

  return vi.fn(async (input: string | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.endsWith('/api/health')) return new Response('ok');
    if (url === JOB_URL) return json(script.trigger);
    if (url.startsWith('https://api.example.com/jobs/')) {
      const status = statuses[Math.min(poll++, statuses.length - 1)];
      return status === '429'
        ? new Response('Too Many Requests', { status: 429 })
        : json({ data: { id: script.trigger.pipelineId, status } });
    }
    if (url.startsWith(REVALIDATE_URL)) {
      expect(init?.method).toBe('POST');
      return json({ revalidated: [] }, script.revalidateStatus ?? 200);
    }
    if (url.startsWith(SITE_URL)) {
      const path = url.slice(SITE_URL.length);
      const hit = (hits.get(path) ?? 0) + 1;
      hits.set(path, hit);
      const reply = script.page?.(path, hit) ?? { body: fresh };
      if (reply instanceof Error) throw reply;
      return new Response(reply.body, {
        status: reply.status ?? 200,
        headers: { 'x-vercel-cache': reply.cache ?? 'REVALIDATED' },
      });
    }
    throw new Error(`unexpected fetch ${url}`);
  });
}

const urlsOf = (fetchMock: Mock) => fetchMock.mock.calls.map(([input]) => String(input));
const pageRequests = (fetchMock: Mock) =>
  urlsOf(fetchMock)
    .filter((url) => url.startsWith(SITE_URL) && !url.startsWith(REVALIDATE_URL))
    .map((url) => url.slice(SITE_URL.length));
const revalidateRequests = (fetchMock: Mock) =>
  urlsOf(fetchMock)
    .filter((url) => url.startsWith(REVALIDATE_URL))
    .map((url) => new URL(url).searchParams.getAll('path'));

const ALL_PATHS = DAILY_REVALIDATION_PATHS.map(([path]) => path);
const PAGE_URLS = dailyPages(RUN_DATE).map((page) => page.url);

beforeEach(() => {
  setEnv({});
  revalidatePathMock.mockClear();
  logServerErrorMock.mockClear();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  for (const [key, value] of Object.entries(ORIGINAL_ENV)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
});

describe('GET /api/cron/daily-news', () => {
  it('revalidates the daily set (listings, briefing and both sitemaps) after success — never the whole layout', async () => {
    const data = {
      outcome: 'started',
      pipelineId: 'pipeline-1',
      startedAt: '2026-08-25T11:00:00.000Z',
    };
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue(data),
      }),
    );

    const res = await GET(authorizedRequest());

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      success: true,
      data,
      revalidated: true,
      warmed: true,
      // A sonda devolveu o corpo do disparo, que não é um status legível.
      settled: 'UNKNOWN',
      // Sem `SUCCESS` não há run do dia a conferir nas páginas: a invalidação
      // fica na própria invocação, como antes do 13.12.
      pages: null,
    });
    // O conjunto mora em `lib/daily-revalidation.ts`, e a guarda dele está em
    // `tests/lib/daily-revalidation.test.ts`; aqui basta a rota usá-lo inteiro.
    expect(revalidatePathMock).toHaveBeenCalledTimes(DAILY_REVALIDATION_PATHS.length);
    // O padrão /[locale] cobre as duas línguas de uma vez — revalidar por
    // caminho resolvido (/pt-BR, /en) não invalida nada (gotcha documentado).
    expect(revalidatePathMock).toHaveBeenCalledWith('/[locale]', 'page');
    expect(revalidatePathMock).toHaveBeenCalledWith('/sitemap.xml');
    // O news sitemap tem janela de 48h: ele é justamente o que precisa refletir
    // a matéria que o pipeline acabou de gravar.
    expect(revalidatePathMock).toHaveBeenCalledWith('/news-sitemap.xml');
    // **Até 01/10/2026 era `('/[locale]', 'layout')`**, que invalidava as
    // milhares de `/news/[id]` junto — e cada uma que um robô tocasse depois
    // acordava a API do Render.
    expect(revalidatePathMock).not.toHaveBeenCalledWith('/[locale]', 'layout');
  });

  /**
   * **O run do dia que outro caminho disparou também chega ao site.**
   *
   * Em 02/10/2026 o cron interno da API disparou às 11:00 em ponto, este cron
   * chegou depois e ouviu `already-succeeded-today` — e, como só invalidava no
   * `started`, a Home ficou o dia inteiro no HTML do build da véspera, com o
   * briefing novo já no banco. O `revalidate` é de um dia: ninguém mais a
   * consertaria.
   */
  const existingRun = (outcome: 'already-running' | 'already-succeeded-today') => ({
    outcome,
    pipelineId: 'pipeline-1',
    startedAt: '2026-10-02T11:00:00.000Z',
  });
  const okJson = (body: unknown) => ({
    ok: true,
    status: 200,
    json: vi.fn().mockResolvedValue(body),
  });

  it('revalidates once when the run of the day already succeeded without us', async () => {
    const data = existingRun('already-succeeded-today');
    const fetchMock = siteFetch({ trigger: data });
    vi.stubGlobal('fetch', fetchMock);

    const res = await GET(authorizedRequest());

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      success: true,
      data,
      revalidated: true,
      warmed: true,
      // O run já fechou: nada a esperar.
      settled: null,
      pages: { runDate: '2026-10-02', rounds: 1, fresh: dailyPages('2026-10-02').map((p) => p.url), stale: [] },
    });
    // Uma invalidação, pela rota irmã, com o conjunto inteiro — e nenhuma
    // sonda de status: o run já fechou.
    expect(revalidateRequests(fetchMock)).toEqual([ALL_PATHS]);
    expect(urlsOf(fetchMock).some((url) => url.includes('/jobs/pipeline-1'))).toBe(false);
    // Nada anotado nesta invocação: a anotação só seria aplicada quando ela
    // retornasse, **depois** das páginas pedidas, e as invalidaria de novo.
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it('waits for the run already running and revalidates when it closes in SUCCESS', async () => {
    const data = existingRun('already-running');
    const fetchMock = siteFetch({ trigger: data, statuses: ['RUNNING', 'SUCCESS'] });
    vi.stubGlobal('fetch', fetchMock);

    const res = await GET(authorizedRequest());

    expect(await res.json()).toMatchObject({
      success: true,
      data,
      revalidated: true,
      warmed: true,
      settled: 'SUCCESS',
      pages: { runDate: '2026-10-02', stale: [] },
    });
    // Uma vez, e só no fim: invalidar no aceite regeneraria a partir do banco
    // ainda sendo escrito.
    expect(revalidateRequests(fetchMock)).toEqual([ALL_PATHS]);
    const [statusUrl] = fetchMock.mock.calls[2] as [string, RequestInit];
    expect(statusUrl).toBe(`https://api.example.com/jobs/${data.pipelineId}`);
  });

  it('does not revalidate a run already running that FAILED', async () => {
    const data = existingRun('already-running');
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({ ok: true, status: 200 })
        .mockResolvedValueOnce(okJson(data))
        .mockResolvedValueOnce(okJson({ data: { id: data.pipelineId, status: 'FAILED' } })),
    );

    const res = await GET(authorizedRequest());

    expect(await res.json()).toMatchObject({ revalidated: false, settled: 'FAILED' });
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it('does not wait for a run already running on a manual trigger from the panel', async () => {
    const data = existingRun('already-running');
    const fetchMock = vi.fn().mockResolvedValue(okJson(data));
    vi.stubGlobal('fetch', fetchMock);

    const res = await GET(
      new Request('http://localhost:3000/api/cron/daily-news', {
        headers: { authorization: `Bearer ${CRON_SECRET}`, 'x-actor-id': 'user-1' },
      }),
    );

    expect(await res.json()).toMatchObject({ revalidated: false, settled: null });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it('revalidates on a manual trigger when the run of the day already succeeded — the panel refreshes the site', async () => {
    const data = existingRun('already-succeeded-today');
    const fetchMock = vi.fn().mockResolvedValue(okJson(data));
    vi.stubGlobal('fetch', fetchMock);

    const res = await GET(
      new Request('http://localhost:3000/api/cron/daily-news', {
        headers: { authorization: `Bearer ${CRON_SECRET}`, 'x-actor-id': 'user-1' },
      }),
    );

    expect(await res.json()).toMatchObject({ revalidated: true, settled: null, pages: null });
    // **O botão continua anotando na própria invocação**, e não pede página
    // nenhuma: ele reentra por aqui de dentro do `/api/admin/run-pipeline` e
    // espera esta resposta — a anotação é aplicada quando aquela requisição
    // termina. Foi assim que o A7.16 regenerou o conjunto em 06/10.
    expect(revalidatePathMock).toHaveBeenCalledTimes(DAILY_REVALIDATION_PATHS.length);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('forwards the pipeline trigger as POST with the job secret', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({
          outcome: 'started',
          pipelineId: 'pipeline-1',
          startedAt: '2026-08-25T11:00:00.000Z',
        }),
      }),
    );

    await GET(authorizedRequest());

    // **A primeira chamada acorda; a segunda dispara.** Desde 01/09/2026 a rota
    // bate em `/api/health` antes do POST — ver `warmApi`. Quem procurar o
    // disparo em `calls[0]` acha o aquecimento.
    const [warmUrl, warmInit] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
    expect(warmUrl).toBe('https://api.example.com/api/health');
    expect(warmInit.method ?? 'GET').toBe('GET');
    // O aquecimento não leva o segredo: ele bate numa rota pública.
    expect(warmInit.headers).toBeUndefined();

    const [url, init] = vi.mocked(fetch).mock.calls[1] as [string, RequestInit];
    expect(url).toBe(JOB_URL);
    expect(init.method).toBe('POST');
    // Igualdade exata de propósito: o cron da Vercel não manda ator, e o
    // disparo agendado **não** pode chegar à API com um `x-actor-id` inventado.
    expect(init.headers).toEqual({ Authorization: `Bearer ${JOB_SECRET}` });
  });

  /**
   * **O ator atravessa (Fase 5 do plano de observabilidade).** O botão do
   * painel reentra por aqui com `x-actor-id`; esta rota só repassa — quem sabe
   * quem clicou é o BFF, e quem grava a trilha é a API.
   */
  it('forwards the x-actor-id of a manual trigger to the API, and nothing else of the caller', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({
          outcome: 'started',
          pipelineId: 'pipeline-1',
          startedAt: '2026-08-25T11:00:00.000Z',
        }),
      }),
    );

    await GET(
      new Request('http://localhost:3000/api/cron/daily-news', {
        headers: {
          authorization: `Bearer ${CRON_SECRET}`,
          'x-actor-id': 'aaaaaaaa-0000-0000-0000-000000000001',
          // Um cabeçalho qualquer do chamador não atravessa: só o ator.
          cookie: 'next-auth.session-token=segredo',
        },
      }),
    );

    const [, init] = vi.mocked(fetch).mock.calls[1] as [string, RequestInit];
    expect(init.headers).toEqual({
      Authorization: `Bearer ${JOB_SECRET}`,
      'x-actor-id': 'aaaaaaaa-0000-0000-0000-000000000001',
    });
  });

  it('returns 401 and does not revalidate when the CRON_SECRET is missing', async () => {
    vi.stubGlobal('fetch', vi.fn());

    const res = await GET(
      new Request('http://localhost:3000/api/cron/daily-news'),
    );

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'Unauthorized' });
    expect(fetch).not.toHaveBeenCalled();
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it('returns 401 when CRON_SECRET is not configured, even for "Bearer undefined"', async () => {
    // A comparação antiga montava `Bearer ${process.env.CRON_SECRET}`: com a
    // variável ausente, o valor esperado era a string `Bearer undefined`.
    delete process.env.CRON_SECRET;
    vi.stubGlobal('fetch', vi.fn());

    const res = await GET(
      new Request('http://localhost:3000/api/cron/daily-news', {
        headers: { authorization: 'Bearer undefined' },
      }),
    );

    expect(res.status).toBe(401);
    expect(fetch).not.toHaveBeenCalled();
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it('returns 401 and does not revalidate when the CRON_SECRET is wrong', async () => {
    vi.stubGlobal('fetch', vi.fn());

    const res = await GET(
      new Request('http://localhost:3000/api/cron/daily-news', {
        headers: { authorization: 'Bearer wrong-secret' },
      }),
    );

    expect(res.status).toBe(401);
    expect(fetch).not.toHaveBeenCalled();
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it('returns 500 and does not revalidate when BACKEND_JOB_URL is not configured', async () => {
    delete process.env.BACKEND_JOB_URL;
    vi.stubGlobal('fetch', vi.fn());

    const res = await GET(authorizedRequest());

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({
      success: false,
      error: 'BACKEND_JOB_URL not configured',
    });
    expect(fetch).not.toHaveBeenCalled();
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it('returns 502 and does not revalidate when the backend responds with an error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 502,
        text: vi.fn().mockResolvedValue('upstream exploded'),
      }),
    );

    const res = await GET(authorizedRequest());

    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({
      success: false,
      error: 'Backend returned 502',
      detail: 'upstream exploded',
    });
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it('returns 500 and does not revalidate when the fetch to the backend throws', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new Error('network down')),
    );

    const res = await GET(authorizedRequest());

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({
      success: false,
      error: 'Pipeline trigger failed',
      // **`warmed` viaja na falha, e é o que separa duas causas.** Sem ele, "a
      // API não acordou" e "a API acordou e recusou" ficam iguais no log da
      // Vercel — que foi exatamente por que o briefing de 01/09 sumiu sem
      // explicação.
      warmed: false,
    });
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  /**
   * **Acordar antes de disparar, e o porquê tem data.**
   *
   * Em 01/09/2026 a API voltou de um mês suspenso, estava dormindo às 11h UTC,
   * e o disparo — que tem 20 s — estourou antes de ela responder. O dia ficou
   * sem briefing, e o único sinal foi o briefing ausente.
   */
  describe('aquecimento', () => {
    const trigger = {
      outcome: 'started',
      pipelineId: 'pipeline-1',
      startedAt: '2026-09-01T11:00:00.000Z',
    };

    it('tries again when the first wake attempt times out, then triggers', async () => {
      const fetchMock = vi
        .fn()
        // primeira tentativa de acordar: a API hibernando não responde a tempo
        .mockRejectedValueOnce(new Error('TimeoutError'))
        // segunda: já acordou
        .mockResolvedValueOnce({ ok: true, status: 200 })
        // o disparo
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: vi.fn().mockResolvedValue(trigger),
        });
      vi.stubGlobal('fetch', fetchMock);

      const res = await GET(authorizedRequest());

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({
        success: true,
        data: trigger,
        revalidated: true,
        warmed: true,
        settled: 'UNKNOWN',
        pages: null,
      });
      // Duas para acordar, o disparo, e a sonda do fim do run (sem resposta
      // neste mock, ela encerra a espera em `UNKNOWN`).
      expect(fetchMock).toHaveBeenCalledTimes(4);
    });

    it('triggers anyway when it never manages to wake the API', async () => {
      // **Desistir de acordar não é desistir de disparar.** A API pode ter
      // acordado entre a última tentativa e o POST, e um disparo que falha
      // custa menos que um dia sem briefing.
      const fetchMock = vi
        .fn()
        .mockRejectedValueOnce(new Error('TimeoutError'))
        .mockRejectedValueOnce(new Error('TimeoutError'))
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: vi.fn().mockResolvedValue(trigger),
        });
      vi.stubGlobal('fetch', fetchMock);

      const res = await GET(authorizedRequest());

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({
        success: true,
        data: trigger,
        revalidated: true,
        // e a resposta conta que o aquecimento não pegou
        warmed: false,
        settled: 'UNKNOWN',
        pages: null,
      });
      expect(fetchMock).toHaveBeenCalledTimes(4);
    });

    it('does not spend a second attempt when the first one wakes it', async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce({ ok: true, status: 200 })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: vi.fn().mockResolvedValue(trigger),
        });
      vi.stubGlobal('fetch', fetchMock);

      await GET(authorizedRequest());

      // Uma para acordar, o disparo, e a sonda do fim do run.
      expect(fetchMock).toHaveBeenCalledTimes(3);
    });

    it('wakes the same host it triggers, derived from BACKEND_JOB_URL', async () => {
      // Usar outra variável abriria a chance de aquecer um host e disparar em
      // outro — e o sintoma disso seria exatamente o defeito que isto conserta.
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce({ ok: true, status: 200 })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: vi.fn().mockResolvedValue(trigger),
        });
      vi.stubGlobal('fetch', fetchMock);

      await GET(authorizedRequest());

      const [warmUrl] = fetchMock.mock.calls[0] as [string];
      const [triggerUrl] = fetchMock.mock.calls[1] as [string];
      expect(new URL(warmUrl).origin).toBe(new URL(triggerUrl).origin);
    });
  });
});

/**
 * **A espera pelo fim do run** (01/10/2026). O `revalidate` das páginas é de um
 * dia, então a página que um robô regenerar durante o run fica com o briefing
 * da véspera até alguém a invalidar de novo — e quem invalida é esta espera.
 *
 * **Até o 13.12 (07/10/2026) estes testes contavam duas invalidações** — uma no
 * aceite, outra no `SUCCESS` — e eram duas chamadas a `revalidatePath`, não duas
 * invalidações: o Next só aplica a tag anotada num route handler quando ele
 * retorna, e a repetida nem entra de novo (`tests/lib/daily-revalidation.test.ts`,
 * "a premissa do Next"). Havia **uma**, no fim da invocação.
 */
describe('GET /api/cron/daily-news — a espera pelo fim do run', () => {
  const trigger = {
    outcome: 'started',
    pipelineId: '11111111-2222-3333-4444-555555555555',
    startedAt: '2026-10-01T11:00:00.000Z',
  };
  const ok = (body: unknown) => ({ ok: true, status: 200, json: vi.fn().mockResolvedValue(body) });
  const status = (value: string) => ok({ data: { id: trigger.pipelineId, status: value } });

  it('revalidates again when the run closes in SUCCESS, polling the status of the same run', async () => {
    const fetchMock = siteFetch({ trigger, statuses: ['RUNNING', 'SUCCESS'] });
    vi.stubGlobal('fetch', fetchMock);

    const res = await GET(authorizedRequest());

    expect((await res.json()).settled).toBe('SUCCESS');
    // A invalidação do `SUCCESS` vai pela rota irmã, e nada fica anotado aqui.
    expect(revalidateRequests(fetchMock)).toEqual([ALL_PATHS]);
    expect(revalidatePathMock).not.toHaveBeenCalled();
    const [statusUrl, init] = fetchMock.mock.calls[2] as [string, RequestInit];
    expect(statusUrl).toBe(`https://api.example.com/jobs/${trigger.pipelineId}`);
    expect(init.headers).toEqual({ Authorization: `Bearer ${JOB_SECRET}` });
  });

  it('does not revalidate a second time when the run FAILED', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({ ok: true, status: 200 })
        .mockResolvedValueOnce(ok(trigger))
        .mockResolvedValueOnce(status('FAILED')),
    );

    const res = await GET(authorizedRequest());

    expect((await res.json()).settled).toBe('FAILED');
    expect(revalidatePathMock).toHaveBeenCalledTimes(DAILY_REVALIDATION_PATHS.length);
  });

  it('gives up at the deadline with the run still RUNNING, and says so', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({ ok: true, status: 200 })
        .mockResolvedValueOnce(ok(trigger))
        .mockResolvedValue(status('RUNNING')),
    );

    const res = await GET(authorizedRequest());

    expect((await res.json()).settled).toBe('RUNNING');
    expect(revalidatePathMock).toHaveBeenCalledTimes(DAILY_REVALIDATION_PATHS.length);
  });

  it('does not wait on a manual trigger from the panel — the button would hang', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, status: 200 })
      .mockResolvedValueOnce(ok(trigger));
    vi.stubGlobal('fetch', fetchMock);

    const res = await GET(
      new Request('http://localhost:3000/api/cron/daily-news', {
        headers: { authorization: `Bearer ${CRON_SECRET}`, 'x-actor-id': 'user-1' },
      }),
    );

    expect((await res.json()).settled).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(revalidatePathMock).toHaveBeenCalledTimes(DAILY_REVALIDATION_PATHS.length);
  });
});

/**
 * **A borda do Render recusa tráfego da Vercel com 429, de forma
 * intermitente** (01/10/2026). Sem repetir, o disparo recusado deixava o dia
 * sem briefing.
 */
describe('GET /api/cron/daily-news — a borda que recusa', () => {
  const trigger = {
    outcome: 'started',
    pipelineId: '11111111-2222-3333-4444-555555555555',
    startedAt: '2026-10-02T11:00:00.000Z',
  };
  const ok = (body: unknown) => ({ ok: true, status: 200, json: vi.fn().mockResolvedValue(body) });
  const refused = { ok: false, status: 429, text: vi.fn().mockResolvedValue('Too Many Requests') };
  const manual = () =>
    new Request('http://localhost:3000/api/cron/daily-news', {
      headers: { authorization: `Bearer ${CRON_SECRET}`, 'x-actor-id': 'user-1' },
    });

  it('triggers again when the edge refuses the trigger with 429, and succeeds', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, status: 200 }) // acordar
      .mockResolvedValueOnce(refused)
      .mockResolvedValueOnce(ok(trigger));
    vi.stubGlobal('fetch', fetchMock);

    const res = await GET(manual());

    expect(res.status).toBe(200);
    expect((await res.json()).data).toEqual(trigger);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('gives up with 502 after the last refused attempt', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({ ok: true, status: 200 }).mockResolvedValue(refused);
    vi.stubGlobal('fetch', fetchMock);

    const res = await GET(manual());

    expect(res.status).toBe(502);
    expect(fetchMock).toHaveBeenCalledTimes(1 + PIPELINE_TRIGGER_ATTEMPTS);
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it('does not retry an answer about the request — a 401 from the API is final', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, status: 200 })
      .mockResolvedValue({ ok: false, status: 401, text: vi.fn().mockResolvedValue('no') });
    vi.stubGlobal('fetch', fetchMock);

    const res = await GET(manual());

    expect(res.status).toBe(502);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('keeps waiting for the run when a status poll is refused', async () => {
    const fetchMock = siteFetch({ trigger, statuses: ['429', 'SUCCESS'] });
    vi.stubGlobal('fetch', fetchMock);

    const res = await GET(authorizedRequest());

    expect((await res.json()).settled).toBe('SUCCESS');
    expect(revalidateRequests(fetchMock)).toEqual([ALL_PATHS]);
  });
});

/**
 * **O cron pede as páginas que invalidou, e confere que trazem o run do dia**
 * (13.12 do plano de observabilidade, 07/10/2026).
 *
 * Em 07/10 a Home `/pt-BR` passou a tarde com o briefing da véspera, em `HIT`,
 * enquanto a `/en` — a **mesma tag** — tinha regenerado com o de hoje. A
 * invalidação aconteceu; uma regeneração depois dela falhou, a Vercel manteve
 * o documento anterior e não tentou de novo até o `revalidate` de um dia
 * vencer. Com o cron como único refrescador, uma falha custava um dia na
 * página mais lida do site. Agora quem regenera é o cron, com a API acordada
 * pelo run, e ele confere o que regenerou.
 */
describe('GET /api/cron/daily-news — as páginas do dia (13.12)', () => {
  const trigger = {
    outcome: 'started',
    pipelineId: '11111111-2222-3333-4444-555555555555',
    startedAt: `${RUN_DATE}T11:00:00.000Z`,
  };

  it('invalidates through the sibling route first, then requests every page of the day — in that order', async () => {
    const fetchMock = siteFetch({ trigger });
    vi.stubGlobal('fetch', fetchMock);

    const res = await GET(authorizedRequest());
    const body = await res.json();

    // **A ordem é a guarda que a §23 pediu.** Pedir antes de a invalidação
    // existir lê o documento velho em `HIT`; e a invalidação vem de **outra**
    // invocação porque a anotada nesta só valeria quando ela retornasse.
    const urls = urlsOf(fetchMock);
    const firstRevalidate = urls.findIndex((url) => url.startsWith(REVALIDATE_URL));
    const firstPage = urls.findIndex(
      (url) => url.startsWith(SITE_URL) && !url.startsWith(REVALIDATE_URL),
    );
    expect(firstRevalidate).toBeGreaterThan(-1);
    expect(firstPage).toBeGreaterThan(firstRevalidate);

    expect(revalidateRequests(fetchMock)).toEqual([ALL_PATHS]);
    expect(pageRequests(fetchMock)).toEqual(PAGE_URLS);
    expect(revalidatePathMock).not.toHaveBeenCalled();
    expect(logServerErrorMock).not.toHaveBeenCalled();
    expect(body).toMatchObject({
      revalidated: true,
      settled: 'SUCCESS',
      pages: { runDate: RUN_DATE, rounds: 1, fresh: PAGE_URLS, stale: [] },
    });
  });

  it('calls the sibling route with the cron secret, and asks each page as a reader would', async () => {
    const fetchMock = siteFetch({ trigger });
    vi.stubGlobal('fetch', fetchMock);

    await GET(authorizedRequest());

    const calls = fetchMock.mock.calls as Array<[string | URL, RequestInit]>;
    const revalidate = calls.find(([input]) => String(input).startsWith(REVALIDATE_URL));
    expect(revalidate?.[1].headers).toEqual({ Authorization: `Bearer ${CRON_SECRET}` });

    // Nenhum segredo vai para as páginas: são pedidos públicos, e o que se
    // quer medir é o documento que o leitor recebe. E nenhum cache do Next no
    // meio — o `fetch` de um route handler é memorizado se ninguém disser.
    const home = calls.find(([input]) => String(input) === `${SITE_URL}/pt-BR`);
    expect(home?.[1].cache).toBe('no-store');
    expect(JSON.stringify(home?.[1].headers ?? {})).not.toContain(CRON_SECRET);
  });

  it('invalidates again only the path of a page that came back without the run of the day, and asks its locales again', async () => {
    const fetchMock = siteFetch({
      trigger,
      // A regeneração da Home em pt-BR falhou: a Vercel serviu o documento da
      // véspera em `HIT` — a forma medida em 07/10.
      page: (url, hit) =>
        url === '/pt-BR' && hit === 1 ? { body: YESTERDAY, cache: 'HIT' } : { body: FRESH },
    });
    vi.stubGlobal('fetch', fetchMock);

    const res = await GET(authorizedRequest());
    const body = await res.json();

    expect(revalidateRequests(fetchMock)).toEqual([ALL_PATHS, ['/[locale]']]);
    // A segunda rodada pede as duas línguas do padrão reinvalidado — a `/en`
    // também foi invalidada de novo, e quem a regeneraria seria um visitante.
    expect(pageRequests(fetchMock)).toEqual([...PAGE_URLS, '/pt-BR', '/en']);
    expect(body.pages).toEqual({ runDate: RUN_DATE, rounds: 2, fresh: PAGE_URLS, stale: [] });
    expect(revalidatePathMock).not.toHaveBeenCalled();
    expect(logServerErrorMock).not.toHaveBeenCalled();
  });

  it('counts a page request that fails or times out as still old, and tries it again', async () => {
    const fetchMock = siteFetch({
      trigger,
      page: (url, hit) =>
        url === '/en/news' && hit === 1
          ? Object.assign(new Error('The operation was aborted due to timeout'), { name: 'TimeoutError' })
          : { body: FRESH },
    });
    vi.stubGlobal('fetch', fetchMock);

    const res = await GET(authorizedRequest());

    expect((await res.json()).pages).toMatchObject({ rounds: 2, stale: [] });
    expect(revalidateRequests(fetchMock)).toEqual([ALL_PATHS, ['/[locale]/news']]);
  });

  it('does not take an error page for the page of the day', async () => {
    const fetchMock = siteFetch({
      trigger,
      // Uma 500 que por acaso carregasse o texto não é a página do dia.
      page: (url, hit) =>
        url === '/sitemap.xml' && hit === 1 ? { body: FRESH, status: 500 } : { body: FRESH },
    });
    vi.stubGlobal('fetch', fetchMock);

    const res = await GET(authorizedRequest());

    expect((await res.json()).pages).toMatchObject({ rounds: 2, stale: [] });
  });

  it('gives up after the last round, leaves only the stale path invalidated for the next visitor, and says so in the log', async () => {
    const fetchMock = siteFetch({
      trigger,
      page: (url) => (url === '/pt-BR/news' ? { body: YESTERDAY, cache: 'HIT' } : { body: FRESH }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const res = await GET(authorizedRequest());
    const body = await res.json();

    expect(revalidateRequests(fetchMock)).toHaveLength(DAILY_PAGES_ROUNDS);
    expect(body.pages).toMatchObject({
      runDate: RUN_DATE,
      rounds: DAILY_PAGES_ROUNDS,
      stale: [{ url: '/pt-BR/news', status: 200, cache: 'HIT' }],
    });
    // **A rede de segurança é o comportamento de antes, e só para o que ficou
    // velho**: anotada aqui, a tag é aplicada quando o cron retorna, e o
    // próximo visitante tenta a regeneração. As páginas conferidas não são
    // invalidadas de novo.
    expect(revalidatePathMock.mock.calls).toEqual([['/[locale]/news', 'page']]);

    expect(logServerErrorMock).toHaveBeenCalledTimes(1);
    const [scope, error, context] = logServerErrorMock.mock.calls[0] as [
      string,
      Error,
      Record<string, unknown>,
    ];
    expect(scope).toBe('cron.daily-news.warm');
    expect(error).toBeInstanceOf(Error);
    expect(context).toMatchObject({ runDate: RUN_DATE, rounds: DAILY_PAGES_ROUNDS });
    expect(String(context.stale)).toContain('/pt-BR/news 200 HIT');
  });

  it('falls back to invalidating in this invocation when the sibling route refuses, and requests no page', async () => {
    const fetchMock = siteFetch({ trigger, revalidateStatus: 401 });
    vi.stubGlobal('fetch', fetchMock);

    const res = await GET(authorizedRequest());
    const body = await res.json();

    // Sem invalidação, pedir as páginas só leria os documentos velhos.
    expect(pageRequests(fetchMock)).toEqual([]);
    expect(revalidatePathMock).toHaveBeenCalledTimes(DAILY_REVALIDATION_PATHS.length);
    expect(body.pages).toMatchObject({ rounds: 1, fresh: [] });
    expect(body.pages.stale).toHaveLength(PAGE_URLS.length);
    const [scope, , context] = logServerErrorMock.mock.calls.at(-1) as [
      string,
      Error,
      Record<string, unknown>,
    ];
    expect(scope).toBe('cron.daily-news.warm');
    expect(context).toMatchObject({ invalidation: 401 });
  });

  it('skips the pages when the cron has no time left, and keeps the old invalidation', async () => {
    // O pior caso do envelope (acordar, o disparo recusado pela borda, a
    // espera inteira pelo run) já soma 280 s dos 290: não sobra nada.
    vi.spyOn(Date, 'now').mockReturnValueOnce(0).mockReturnValue(CRON_MAX_DURATION_MS);
    const fetchMock = siteFetch({ trigger: { ...trigger, outcome: 'already-succeeded-today' } });
    vi.stubGlobal('fetch', fetchMock);

    const res = await GET(authorizedRequest());
    const body = await res.json();

    expect(revalidateRequests(fetchMock)).toEqual([]);
    expect(pageRequests(fetchMock)).toEqual([]);
    expect(revalidatePathMock).toHaveBeenCalledTimes(DAILY_REVALIDATION_PATHS.length);
    expect(body.pages).toMatchObject({ rounds: 0, fresh: [] });
    expect(logServerErrorMock.mock.calls.at(-1)?.[0]).toBe('cron.daily-news.warm');
  });

  it('falls back to the old invalidation when the trigger carries no readable start — never a 500 after a run that succeeded', async () => {
    // O contrato garante o `startedAt`; lançar aqui cairia no `catch` do
    // disparo e deixaria o dia sem invalidação nenhuma.
    const fetchMock = siteFetch({
      trigger: { ...trigger, outcome: 'already-succeeded-today', startedAt: 'não é data' },
    });
    vi.stubGlobal('fetch', fetchMock);

    const res = await GET(authorizedRequest());

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ revalidated: true, pages: null });
    expect(pageRequests(fetchMock)).toEqual([]);
    expect(revalidatePathMock).toHaveBeenCalledTimes(DAILY_REVALIDATION_PATHS.length);
  });

  it('does not request pages when the run FAILED — there is no run of the day to look for', async () => {
    const fetchMock = siteFetch({ trigger, statuses: ['FAILED'] });
    vi.stubGlobal('fetch', fetchMock);

    const res = await GET(authorizedRequest());

    expect(await res.json()).toMatchObject({ settled: 'FAILED', pages: null });
    expect(pageRequests(fetchMock)).toEqual([]);
    expect(revalidateRequests(fetchMock)).toEqual([]);
    expect(revalidatePathMock).toHaveBeenCalledTimes(DAILY_REVALIDATION_PATHS.length);
  });
});
