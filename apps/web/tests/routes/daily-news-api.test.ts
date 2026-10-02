import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GET } from '@/app/api/cron/daily-news/route';
import { DAILY_REVALIDATION_PATHS } from '@/lib/daily-revalidation';
import { PIPELINE_TRIGGER_ATTEMPTS } from '@/lib/timeouts';

const revalidatePathMock = vi.fn();

vi.mock('next/cache', () => ({
  revalidatePath: (...args: unknown[]) => revalidatePathMock(...args),
}));

// A espera pelo fim do run sonda a cada 10 s por até 150 s; aqui ela sonda
// sem pausa e desiste em 50 ms, para a suíte não esperar relógio de verdade.
vi.mock('@/lib/timeouts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/timeouts')>()),
  PIPELINE_SETTLE_POLL_MS: 0,
  PIPELINE_SETTLE_MAX_MS: 50,
  PIPELINE_REFUSED_PAUSE_MS: 0,
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

beforeEach(() => {
  setEnv({});
  revalidatePathMock.mockClear();
});

afterEach(() => {
  vi.unstubAllGlobals();
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
    const fetchMock = vi.fn().mockResolvedValue(okJson(data));
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
    });
    expect(revalidatePathMock).toHaveBeenCalledTimes(DAILY_REVALIDATION_PATHS.length);
    // Acordar e disparar, e nenhuma sonda de status.
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('waits for the run already running and revalidates when it closes in SUCCESS', async () => {
    const data = existingRun('already-running');
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, status: 200 }) // acordar
      .mockResolvedValueOnce(okJson(data)) // disparo
      .mockResolvedValueOnce(okJson({ data: { id: data.pipelineId, status: 'RUNNING' } }))
      .mockResolvedValueOnce(okJson({ data: { id: data.pipelineId, status: 'SUCCESS' } }));
    vi.stubGlobal('fetch', fetchMock);

    const res = await GET(authorizedRequest());

    expect(await res.json()).toEqual({
      success: true,
      data,
      revalidated: true,
      warmed: true,
      settled: 'SUCCESS',
    });
    // Uma vez, e só no fim: invalidar no aceite regeneraria a partir do banco
    // ainda sendo escrito.
    expect(revalidatePathMock).toHaveBeenCalledTimes(DAILY_REVALIDATION_PATHS.length);
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
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(okJson(data)));

    const res = await GET(
      new Request('http://localhost:3000/api/cron/daily-news', {
        headers: { authorization: `Bearer ${CRON_SECRET}`, 'x-actor-id': 'user-1' },
      }),
    );

    expect(await res.json()).toMatchObject({ revalidated: true, settled: null });
    expect(revalidatePathMock).toHaveBeenCalledTimes(DAILY_REVALIDATION_PATHS.length);
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
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, status: 200 }) // acordar
      .mockResolvedValueOnce(ok(trigger)) // disparo
      .mockResolvedValueOnce(status('RUNNING'))
      .mockResolvedValueOnce(status('SUCCESS'));
    vi.stubGlobal('fetch', fetchMock);

    const res = await GET(authorizedRequest());

    expect((await res.json()).settled).toBe('SUCCESS');
    expect(revalidatePathMock).toHaveBeenCalledTimes(2 * DAILY_REVALIDATION_PATHS.length);
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
    const status = (value: string) => ok({ data: { id: trigger.pipelineId, status: value } });
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({ ok: true, status: 200 })
        .mockResolvedValueOnce(ok(trigger))
        .mockResolvedValueOnce(refused)
        .mockResolvedValueOnce(status('SUCCESS')),
    );

    const res = await GET(authorizedRequest());

    expect((await res.json()).settled).toBe('SUCCESS');
    expect(revalidatePathMock).toHaveBeenCalledTimes(2 * DAILY_REVALIDATION_PATHS.length);
  });
});
