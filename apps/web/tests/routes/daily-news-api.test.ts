import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GET } from '@/app/api/cron/daily-news/route';

const revalidatePathMock = vi.fn();

vi.mock('next/cache', () => ({
  revalidatePath: (...args: unknown[]) => revalidatePathMock(...args),
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
  it('revalidates the /[locale] layout (covers pt-BR and en) and the sitemap after success', async () => {
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
    });
    expect(revalidatePathMock).toHaveBeenCalledTimes(3);
    // O padrão /[locale] cobre as duas línguas de uma vez — revalidar por
    // caminho resolvido (/pt-BR, /en) não invalida nada (gotcha documentado).
    expect(revalidatePathMock).toHaveBeenCalledWith('/[locale]', 'layout');
    expect(revalidatePathMock).toHaveBeenCalledWith('/sitemap.xml');
    // O news sitemap tem janela de 48h: ele é justamente o que precisa refletir
    // a matéria que o pipeline acabou de gravar.
    expect(revalidatePathMock).toHaveBeenCalledWith('/news-sitemap.xml');
  });

  /**
   * **Nada disparado, nada invalidado.**
   *
   * O `triggerPipeline` da API e idempotente por dia: com um run de hoje ja em
   * `SUCCESS` ou `RUNNING` ele devolve o id daquele e nao executa nada.
   * Invalidar o cache ai joga fora uma pagina quente para regenerar a mesma —
   * e, no caso de `already-running`, regenera a partir do banco que ainda esta
   * sendo escrito.
   */
  for (const outcome of ['already-running', 'already-succeeded-today'] as const) {
    it(`does not revalidate when the outcome is ${outcome}`, async () => {
      const data = {
        outcome,
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
      // `success: true` continua certo: a chamada deu certo. Quem conta o que
      // aconteceu e o `outcome`, e ele viaja inteiro ate o painel.
      expect(await res.json()).toEqual({
        success: true,
        data,
        revalidated: false,
        warmed: true,
      });
      expect(revalidatePathMock).not.toHaveBeenCalled();
    });
  }

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
    expect(init.headers).toEqual({ Authorization: `Bearer ${JOB_SECRET}` });
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
      });
      expect(fetchMock).toHaveBeenCalledTimes(3);
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
      });
      expect(fetchMock).toHaveBeenCalledTimes(3);
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

      expect(fetchMock).toHaveBeenCalledTimes(2);
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
