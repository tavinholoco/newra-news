import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { POST } from '@/app/api/admin/run-pipeline/route';
import { DELETE } from '@/app/api/admin/news/[id]/route';
import { GET as pipelineRunsGet } from '@/app/api/admin/pipeline/runs/route';
import { GET as pipelineRunGet } from '@/app/api/admin/pipeline/runs/[pipelineId]/route';
import { GET as cronGet } from '@/app/api/cron/daily-news/route';
import { NextResponse } from 'next/server';

const getServerSessionMock = vi.fn();
const signAuthJwtMock = vi.fn();

vi.mock('next-auth', () => ({
  getServerSession: () => getServerSessionMock(),
}));

vi.mock('@/lib/jwt', () => ({
  signAuthJwt: (payload: unknown) => signAuthJwtMock(payload),
}));

// A rota run-pipeline reusa o handler do cron — mockamos para isolar o teste
vi.mock('@/app/api/cron/daily-news/route', () => ({
  GET: vi.fn(),
}));

const NEWS_ID = 'cccccccc-0000-0000-0000-000000000001';
const PIPELINE_ID = 'aaaaaaaa-0000-0000-0000-000000000002';

function mockFetchOk(payload: unknown, status = 200) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: status < 400,
      status,
      // `Response` sempre tem `headers`, e o proxy lê o `x-request-id` de lá
      // para devolvê-lo a quem chamou. Mock sem `headers` é mock que descreve
      // uma resposta que não existe.
      headers: new Headers(),
      json: vi.fn().mockResolvedValue(payload),
    }),
  );
}

const adminSession = {
  user: { id: 'admin-1', email: 'admin@test.com', role: 'ADMIN' },
};
const userSession = {
  user: { id: 'user-1', email: 'user@test.com', role: 'USER' },
};

beforeEach(() => {
  getServerSessionMock.mockReset();
  signAuthJwtMock.mockReset();
  signAuthJwtMock.mockResolvedValue('signed-jwt');
  vi.mocked(cronGet).mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('POST /api/admin/run-pipeline', () => {
  it('should return 401 without a session', async () => {
    getServerSessionMock.mockResolvedValue(null);

    const res = await POST();

    expect(res.status).toBe(401);
    expect(cronGet).not.toHaveBeenCalled();
  });

  it('should return 403 for a non-admin user', async () => {
    getServerSessionMock.mockResolvedValue(userSession);

    const res = await POST();

    expect(res.status).toBe(403);
    expect(cronGet).not.toHaveBeenCalled();
  });

  it('should return 500 when CRON_SECRET is not configured', async () => {
    getServerSessionMock.mockResolvedValue(adminSession);
    const original = process.env.CRON_SECRET;
    delete process.env.CRON_SECRET;

    try {
      const res = await POST();

      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({
        error: 'CRON_SECRET not configured',
      });
      expect(cronGet).not.toHaveBeenCalled();
    } finally {
      process.env.CRON_SECRET = original;
    }
  });

  it('should call the cron route with the CRON_SECRET for an admin', async () => {
    getServerSessionMock.mockResolvedValue(adminSession);
    process.env.CRON_SECRET = 'cron-secret';
    vi.mocked(cronGet).mockResolvedValue(
      NextResponse.json(
        {
          success: true,
          data: {
            outcome: 'started' as const,
            pipelineId: 'pipe-1',
            startedAt: '2026-08-25T11:00:00.000Z',
          },
          revalidated: true,
          // O BFF do cron passou a devolver `warmed` — ele acorda a API antes
          // de disparar, desde 01/09/2026.
          warmed: true,
        },
        { status: 200 },
      ),
    );

    const res = await POST();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      success: true,
      data: {
        outcome: 'started',
        pipelineId: 'pipe-1',
        startedAt: '2026-08-25T11:00:00.000Z',
      },
      revalidated: true,
      warmed: true,
    });
    const [request] = vi.mocked(cronGet).mock.calls[0] as [Request];
    expect(request.headers.get('authorization')).toBe('Bearer cron-secret');
  });

  /**
   * **Este é o único lugar da cadeia que sabe quem clicou** (Fase 5 do plano
   * de observabilidade). O cron recebe o `CRON_SECRET` e a API o `JOB_SECRET`;
   * o `User.id` da sessão vai em `x-actor-id` e é o que a trilha de auditoria
   * grava como ator. O **id**, não o e-mail — a tabela não guarda dado pessoal.
   */
  it('puts the session user id in x-actor-id when reentering the cron route', async () => {
    getServerSessionMock.mockResolvedValue(adminSession);
    process.env.CRON_SECRET = 'cron-secret';
    vi.mocked(cronGet).mockResolvedValue(
      NextResponse.json(
        {
          success: true,
          data: {
            outcome: 'started' as const,
            pipelineId: 'pipe-1',
            startedAt: '2026-08-25T11:00:00.000Z',
          },
          revalidated: true,
          warmed: true,
        },
        { status: 200 },
      ),
    );

    await POST();

    const [request] = vi.mocked(cronGet).mock.calls[0] as [Request];
    expect(request.headers.get('x-actor-id')).toBe('admin-1');
    expect(request.headers.get('x-actor-id')).not.toContain('@');
  });
});

describe('DELETE /api/admin/news/:id', () => {
  it('should return 401 without a session', async () => {
    getServerSessionMock.mockResolvedValue(null);
    vi.stubGlobal('fetch', vi.fn());

    const res = await DELETE(new Request('http://localhost:3000/api/admin/news/x'), {
      params: { id: NEWS_ID },
    });

    expect(res.status).toBe(401);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('should return 403 for a non-admin user', async () => {
    getServerSessionMock.mockResolvedValue(userSession);
    vi.stubGlobal('fetch', vi.fn());

    const res = await DELETE(new Request('http://localhost:3000/api/admin/news/x'), {
      params: { id: NEWS_ID },
    });

    expect(res.status).toBe(403);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('should forward the DELETE with a signed JWT carrying the role', async () => {
    getServerSessionMock.mockResolvedValue(adminSession);
    mockFetchOk({ data: { deleted: true, id: NEWS_ID } });

    const res = await DELETE(new Request('http://localhost:3000/api/admin/news/x'), {
      params: { id: NEWS_ID },
    });

    expect(res.status).toBe(200);
    expect(signAuthJwtMock).toHaveBeenCalledWith({
      sub: 'admin-1',
      email: 'admin@test.com',
      role: 'ADMIN',
    });
    const [url, init] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
    expect(url).toContain(`/news/${NEWS_ID}`);
    expect(init.method).toBe('DELETE');
    expect(init.headers).toEqual({ Authorization: 'Bearer signed-jwt' });
  });

  it('should propagate the backend status code', async () => {
    getServerSessionMock.mockResolvedValue(adminSession);
    mockFetchOk({ error: 'News not found' }, 404);

    const res = await DELETE(new Request('http://localhost:3000/api/admin/news/x'), {
      params: { id: NEWS_ID },
    });

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'News not found' });
  });
});
describe('GET /api/admin/pipeline/runs', () => {
  /**
   * **Fase 2 — a porta do BFF para o pipeline.**
   *
   * A recusa aqui não é a que decide (a API recusa por conta própria, e há
   * matriz de autorização provando isso); ela evita a chamada quando não há
   * sessão. O que estes testes guardam é que a rota nova passou pelo
   * `proxyToApi` com `requireRole`, em vez de trazer a própria cópia da leitura
   * de sessão — que foi o que a revisão da Fase 11 desfez em três rotas.
   */
  it('answers 401 without a session', async () => {
    getServerSessionMock.mockResolvedValue(null);
    vi.stubGlobal('fetch', vi.fn());

    const res = await pipelineRunsGet(
      new Request('http://localhost:3000/api/admin/pipeline/runs'),
    );

    expect(res.status).toBe(401);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('answers 403 for a non-admin user, without calling the API', async () => {
    getServerSessionMock.mockResolvedValue(userSession);
    vi.stubGlobal('fetch', vi.fn());

    const res = await pipelineRunsGet(
      new Request('http://localhost:3000/api/admin/pipeline/runs'),
    );

    expect(res.status).toBe(403);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('forwards the query string untouched — the API is the one validator', async () => {
    getServerSessionMock.mockResolvedValue(adminSession);
    mockFetchOk({ data: { runs: [], recentErrors: [] }, meta: { total: 0 } });

    const res = await pipelineRunsGet(
      new Request(
        'http://localhost:3000/api/admin/pipeline/runs?status=FAILED&limit=10',
      ),
    );

    expect(res.status).toBe(200);
    const [url, init] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/admin/pipeline/runs?status=FAILED&limit=10');
    expect(init.method).toBe('GET');
    expect(signAuthJwtMock).toHaveBeenCalledWith({
      sub: 'admin-1',
      email: 'admin@test.com',
      role: 'ADMIN',
    });
  });
});

describe('GET /api/admin/pipeline/runs/:pipelineId', () => {
  it('answers 403 for a non-admin user', async () => {
    getServerSessionMock.mockResolvedValue(userSession);
    vi.stubGlobal('fetch', vi.fn());

    const res = await pipelineRunGet(
      new Request('http://localhost:3000/api/admin/pipeline/runs/x'),
      { params: { pipelineId: PIPELINE_ID } },
    );

    expect(res.status).toBe(403);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('puts the id in the upstream path', async () => {
    getServerSessionMock.mockResolvedValue(adminSession);
    mockFetchOk({ data: { log: {}, events: [] } });

    await pipelineRunGet(
      new Request('http://localhost:3000/api/admin/pipeline/runs/x'),
      { params: { pipelineId: PIPELINE_ID } },
    );

    const [url] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
    expect(url).toContain(`/admin/pipeline/runs/${PIPELINE_ID}`);
  });

  it('propagates a 400 from the API — an id outside the UUID format', async () => {
    // A validação do formato mora na API, e só lá. O 400 dela chega aqui como
    // 400, e o `ApiError` do cliente o trata como "não existe", igual ao 404.
    getServerSessionMock.mockResolvedValue(adminSession);
    mockFetchOk({ error: 'params/pipelineId must be a valid UUID' }, 400);

    const res = await pipelineRunGet(
      new Request('http://localhost:3000/api/admin/pipeline/runs/x'),
      { params: { pipelineId: 'not-a-uuid' } },
    );

    expect(res.status).toBe(400);
  });
});
