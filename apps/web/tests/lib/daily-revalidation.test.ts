import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { DAILY_REVALIDATION_PATHS } from '@/lib/daily-revalidation';
import { GET as refresh } from '@/app/api/cron/refresh/route';

/**
 * **A ISR deixou de acordar a API do Render a cada hora (01/10/2026).**
 *
 * Toda regeneração de uma página guardada chama a API, e a API dorme com
 * ~15 min sem tráfego no plano free. O conteúdo muda **uma vez por dia**, no
 * pipeline; o que o mantém fresco são os dois crons invalidando o conjunto de
 * `lib/daily-revalidation.ts`, e o `revalidate` de cada arquivo é só a rede de
 * segurança. As quatro guardas abaixo são o que impede a próxima página nova
 * de nascer com `revalidate = 3600` copiado da vizinha — que é como as horas
 * de setembro foram gastas sem ninguém escrever um keep-alive.
 */

const revalidatePathMock = vi.fn();

vi.mock('next/cache', () => ({
  revalidatePath: (...args: unknown[]) => revalidatePathMock(...args),
}));

const WEB_DIR = join(__dirname, '../..');
const APP_DIR = join(WEB_DIR, 'app');

/** O piso: nenhuma página guardada regenera mais de uma vez por dia sozinha. */
const MIN_REVALIDATE_SECONDS = 86_400;

function collectSources(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return collectSources(full);
    return /\.tsx?$/.test(full) ? [full] : [];
  });
}

function relativePath(file: string): string {
  return file.replace(/\\/g, '/').split('/apps/web/')[1] ?? file;
}

const REVALIDATE = /export const revalidate\s*=\s*([^;\n]+)/;

describe('a ISR não acorda a API mais de uma vez por dia', () => {
  it('declares every revalidate under app/ as at least one day', () => {
    const declared = collectSources(APP_DIR)
      .map((file) => ({ file: relativePath(file), match: REVALIDATE.exec(readFileSync(file, 'utf8')) }))
      .filter((entry): entry is { file: string; match: RegExpExecArray } => entry.match !== null);

    // Um matcher que não acha nada aprovaria tudo.
    expect(declared.length).toBeGreaterThanOrEqual(7);

    const tooOften = declared
      .map(({ file, match }) => ({ file, seconds: Number((match[1] as string).replace(/_/g, '')) }))
      .filter(({ seconds }) => !(seconds >= MIN_REVALIDATE_SECONDS));

    expect(tooOften).toEqual([]);
  });

  it('points every revalidated path at a route that exists', () => {
    const missing = DAILY_REVALIDATION_PATHS.filter(([path, type]) => {
      if (type === 'page') return !existsSync(join(APP_DIR, path, 'page.tsx'));
      if (path === '/sitemap.xml') return !existsSync(join(APP_DIR, 'sitemap.ts'));
      return !existsSync(join(APP_DIR, path, 'route.ts'));
    }).map(([path]) => path);

    expect(missing).toEqual([]);
  });

  it('leaves the news detail out, and never invalidates the whole layout', () => {
    // A `/news/[id]` são milhares de páginas que os robôs percorrem o dia todo;
    // invalidá-las por dia era uma acordada da API por página tocada. O
    // `'layout'` sob `/[locale]` as levava junto — era o que o cron fazia.
    const paths = DAILY_REVALIDATION_PATHS.map(([path]) => path);
    expect(paths).not.toContain('/[locale]/news/[id]');
    expect(DAILY_REVALIDATION_PATHS.some(([, type]) => type === 'layout')).toBe(false);
  });

  it('schedules the refresh cron at least two hours after the pipeline cron', () => {
    const { crons } = JSON.parse(readFileSync(join(WEB_DIR, 'vercel.json'), 'utf8')) as {
      crons: Array<{ path: string; schedule: string }>;
    };
    const hourOf = (path: string) => {
      const cron = crons.find((entry) => entry.path === path);
      expect(cron, `${path} no vercel.json`).toBeDefined();
      return Number(cron?.schedule.split(' ')[1]);
    };

    // O Hobby dispara em qualquer minuto da hora agendada, e o pipeline leva
    // ~1,5 min: com uma hora só de distância, o refresh podia cair antes de o
    // briefing existir.
    expect(hourOf('/api/cron/refresh') - hourOf('/api/cron/daily-news')).toBeGreaterThanOrEqual(2);
  });
});

describe('GET /api/cron/refresh', () => {
  const ORIGINAL_SECRET = process.env.CRON_SECRET;

  beforeEach(() => {
    process.env.CRON_SECRET = 'cron-secret';
    revalidatePathMock.mockClear();
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    if (ORIGINAL_SECRET === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = ORIGINAL_SECRET;
  });

  const request = (authorization?: string) =>
    new Request('http://localhost:3000/api/cron/refresh', {
      headers: authorization ? { authorization } : {},
    });

  it('invalidates the daily set without calling the API', async () => {
    const res = await refresh(request('Bearer cron-secret'));

    expect(res.status).toBe(200);
    expect(revalidatePathMock).toHaveBeenCalledTimes(DAILY_REVALIDATION_PATHS.length);
    for (const [path, type] of DAILY_REVALIDATION_PATHS) {
      if (type) expect(revalidatePathMock).toHaveBeenCalledWith(path, type);
      else expect(revalidatePathMock).toHaveBeenCalledWith(path);
    }
    // Uma rota que aquecesse a API aqui seria um despertar a mais por dia — o
    // oposto do motivo de ela existir.
    expect(fetch).not.toHaveBeenCalled();
  });

  it('returns 401 and invalidates nothing without the cron secret', async () => {
    const missing = await refresh(request());
    const wrong = await refresh(request('Bearer wrong'));

    expect(missing.status).toBe(401);
    expect(wrong.status).toBe(401);
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it('returns 401 when CRON_SECRET is not configured, even for "Bearer undefined"', async () => {
    delete process.env.CRON_SECRET;

    const res = await refresh(request('Bearer undefined'));

    expect(res.status).toBe(401);
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });
});
