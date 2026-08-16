import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GET, POST } from '@/app/api/favorites/route';
import { DELETE } from '@/app/api/favorites/[newsId]/route';

const getServerSessionMock = vi.fn();
const signAuthJwtMock = vi.fn();

vi.mock('next-auth', () => ({
  getServerSession: () => getServerSessionMock(),
}));

vi.mock('@/lib/jwt', () => ({
  signAuthJwt: (payload: unknown) => signAuthJwtMock(payload),
}));

const NEWS_ID = 'cccccccc-0000-0000-0000-000000000001';

function mockFetchOk(payload: unknown) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue(payload),
    }),
  );
}

beforeEach(() => {
  getServerSessionMock.mockReset();
  signAuthJwtMock.mockReset();
  signAuthJwtMock.mockResolvedValue('signed-jwt');
  getServerSessionMock.mockResolvedValue({
    user: { id: 'user-1', email: 'user@test.com' },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('favorites proxy routes', () => {
  it('GET should return 401 without a session', async () => {
    vi.stubGlobal('fetch', vi.fn());
    getServerSessionMock.mockResolvedValue(null);

    const res = await GET(new Request('http://localhost:3000/api/favorites'));

    expect(res.status).toBe(401);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('GET should forward the request with a signed JWT', async () => {
    mockFetchOk({ data: [], meta: { total: 0 } });

    const res = await GET(
      new Request('http://localhost:3000/api/favorites?page=1&limit=100'),
    );

    expect(res.status).toBe(200);
    expect(signAuthJwtMock).toHaveBeenCalledWith({
      sub: 'user-1',
      email: 'user@test.com',
    });
    const [url, init] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/favorites?page=1&limit=100');
    expect(init.headers).toEqual({ Authorization: 'Bearer signed-jwt' });
  });

  it('POST should forward method and body', async () => {
    mockFetchOk({ data: { id: 'fav-1', newsId: NEWS_ID } });

    const res = await POST(
      new Request('http://localhost:3000/api/favorites', {
        method: 'POST',
        body: JSON.stringify({ newsId: NEWS_ID }),
      }),
    );

    expect(res.status).toBe(200);
    const [, init] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe('POST');
    expect(JSON.parse(String(init.body))).toEqual({ newsId: NEWS_ID });
  });

  it('DELETE should forward the newsId in the path', async () => {
    mockFetchOk({ data: { removed: true } });

    const res = await DELETE(
      new Request(`http://localhost:3000/api/favorites/${NEWS_ID}`, {
        method: 'DELETE',
      }),
      { params: { newsId: NEWS_ID } },
    );

    expect(res.status).toBe(200);
    const [url, init] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
    expect(url).toContain(`/favorites/${NEWS_ID}`);
    expect(init.method).toBe('DELETE');
  });

  it('should propagate the backend status code', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        json: vi.fn().mockResolvedValue({ error: 'Favorite not found' }),
      }),
    );

    const res = await DELETE(
      new Request(`http://localhost:3000/api/favorites/${NEWS_ID}`, {
        method: 'DELETE',
      }),
      { params: { newsId: NEWS_ID } },
    );

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'Favorite not found' });
  });
});
