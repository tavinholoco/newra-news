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
    const data = { pipelineId: 'pipeline-1', status: 'success' };
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
    });
    expect(revalidatePathMock).toHaveBeenCalledTimes(2);
    // O padrão /[locale] cobre as duas línguas de uma vez — revalidar por
    // caminho resolvido (/pt-BR, /en) não invalida nada (gotcha documentado).
    expect(revalidatePathMock).toHaveBeenCalledWith('/[locale]', 'layout');
    expect(revalidatePathMock).toHaveBeenCalledWith('/sitemap.xml');
  });

  it('forwards the pipeline trigger as POST with the job secret', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({ pipelineId: 'pipeline-1' }),
      }),
    );

    await GET(authorizedRequest());

    const [url, init] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
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
    });
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });
});
