import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { POST } from '@/app/api/cron/daily-news/revalidate/route';
import { DAILY_REVALIDATION_PATHS } from '@/lib/daily-revalidation';

const revalidatePathMock = vi.fn();

vi.mock('next/cache', () => ({
  revalidatePath: (...args: unknown[]) => revalidatePathMock(...args),
}));

/**
 * **A rota que invalida o conjunto do dia numa invocação própria** (13.12 do
 * plano de observabilidade, 07/10/2026).
 *
 * Ela existe por uma razão só: o Next aplica a tag anotada num route handler
 * **quando ele retorna**. O cron precisa da invalidação aplicada *antes* de
 * pedir as páginas, então a anotação mora numa invocação que termina primeiro —
 * esta. É o mesmo caminho do botão da `/admin`, que reentra no cron de dentro
 * de outra requisição.
 */

const CRON_SECRET = 'cron-secret';
const ORIGINAL_SECRET = process.env.CRON_SECRET;
const ALL_PATHS = DAILY_REVALIDATION_PATHS.map(([path]) => path);

function post(query = '', authorization: string | null = `Bearer ${CRON_SECRET}`) {
  return POST(
    new Request(`http://localhost:3000/api/cron/daily-news/revalidate${query}`, {
      method: 'POST',
      headers: authorization ? { authorization } : {},
    }),
  );
}

beforeEach(() => {
  process.env.CRON_SECRET = CRON_SECRET;
  revalidatePathMock.mockClear();
});

afterEach(() => {
  if (ORIGINAL_SECRET === undefined) delete process.env.CRON_SECRET;
  else process.env.CRON_SECRET = ORIGINAL_SECRET;
});

describe('POST /api/cron/daily-news/revalidate', () => {
  it('invalidates the whole daily set when no path is named', async () => {
    const res = await post();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ revalidated: ALL_PATHS });
    expect(revalidatePathMock).toHaveBeenCalledTimes(DAILY_REVALIDATION_PATHS.length);
    expect(revalidatePathMock).toHaveBeenCalledWith('/[locale]', 'page');
    expect(revalidatePathMock).toHaveBeenCalledWith('/sitemap.xml');
  });

  it('invalidates only the named paths — the cron asks again only for what stayed old', async () => {
    const res = await post(`?path=${encodeURIComponent('/[locale]/news')}`);

    expect(await res.json()).toEqual({ revalidated: ['/[locale]/news'] });
    expect(revalidatePathMock.mock.calls).toEqual([['/[locale]/news', 'page']]);
  });

  it('refuses a path outside the daily set, and invalidates nothing', async () => {
    // A `/news/[id]` são milhares de páginas que os robôs percorrem: fora do
    // conjunto de propósito (`lib/daily-revalidation.ts`). Esta porta não abre
    // um caminho para invalidá-las.
    const res = await post(
      `?path=${encodeURIComponent('/[locale]')}&path=${encodeURIComponent('/[locale]/news/[id]')}`,
    );

    expect(res.status).toBe(400);
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it('answers 401 without the cron secret, and invalidates nothing', async () => {
    expect((await post('', null)).status).toBe(401);
    expect((await post('', 'Bearer wrong-secret')).status).toBe(401);
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it('answers 401 when CRON_SECRET is not configured, even for "Bearer undefined"', async () => {
    delete process.env.CRON_SECRET;

    expect((await post('', 'Bearer undefined')).status).toBe(401);
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });
});
