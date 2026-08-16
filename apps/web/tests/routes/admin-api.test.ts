import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { POST } from '@/app/api/admin/run-pipeline/route';
import { DELETE } from '@/app/api/admin/news/[id]/route';
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

function mockFetchOk(payload: unknown, status = 200) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: status < 400,
      status,
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
        { success: true, data: { pipelineId: 'pipe-1' }, revalidated: true },
        { status: 200 },
      ),
    );

    const res = await POST();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      success: true,
      data: { pipelineId: 'pipe-1' },
      revalidated: true,
    });
    const [request] = vi.mocked(cronGet).mock.calls[0] as [Request];
    expect(request.headers.get('authorization')).toBe('Bearer cron-secret');
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
