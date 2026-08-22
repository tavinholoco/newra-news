import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GET } from '@/app/api/account/route';
import { GET as GET_PREFERENCES, PUT as PUT_PREFERENCES } from '@/app/api/account/preferences/route';
import { PUT as PUT_NEWSLETTER } from '@/app/api/account/newsletter/route';

const getServerSessionMock = vi.fn();
const signAuthJwtMock = vi.fn();

vi.mock('next-auth', () => ({
  getServerSession: () => getServerSessionMock(),
}));

vi.mock('@/lib/jwt', () => ({
  signAuthJwt: (payload: unknown) => signAuthJwtMock(payload),
}));

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

describe('account proxy routes', () => {
  it('should return 401 without a session, without calling the API', async () => {
    vi.stubGlobal('fetch', vi.fn());
    getServerSessionMock.mockResolvedValue(null);

    const res = await GET(new Request('http://localhost:3000/api/account'));

    expect(res.status).toBe(401);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('should forward the overview with a signed JWT', async () => {
    mockFetchOk({ data: { user: { id: 'user-1' } } });

    const res = await GET(new Request('http://localhost:3000/api/account'));

    expect(res.status).toBe(200);
    expect(signAuthJwtMock).toHaveBeenCalledWith({
      sub: 'user-1',
      email: 'user@test.com',
    });
    const [url] = vi.mocked(fetch).mock.calls[0] as [string];
    expect(url).toContain('/account');
  });

  it('should read the preferences', async () => {
    mockFetchOk({ data: { categories: [], theme: 'SYSTEM' } });

    const res = await GET_PREFERENCES(
      new Request('http://localhost:3000/api/account/preferences'),
    );

    expect(res.status).toBe(200);
    const [url] = vi.mocked(fetch).mock.calls[0] as [string];
    expect(url).toContain('/account/preferences');
  });

  it('should forward the preferences body on PUT', async () => {
    mockFetchOk({ data: { categories: ['WORLD'], theme: 'DARK' } });

    const res = await PUT_PREFERENCES(
      new Request('http://localhost:3000/api/account/preferences', {
        method: 'PUT',
        body: JSON.stringify({ theme: 'DARK' }),
      }),
    );

    expect(res.status).toBe(200);
    const [, init] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe('PUT');
    expect(JSON.parse(String(init.body))).toEqual({ theme: 'DARK' });
  });

  it('should propagate the backend status code', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        json: vi.fn().mockResolvedValue({ error: 'User not found' }),
      }),
    );

    const res = await PUT_NEWSLETTER(
      new Request('http://localhost:3000/api/account/newsletter', {
        method: 'PUT',
        body: JSON.stringify({ subscribed: true }),
      }),
    );

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'User not found' });
  });
});
