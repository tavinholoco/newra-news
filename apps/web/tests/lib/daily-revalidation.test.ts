import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { DAILY_REVALIDATION_PATHS } from '@/lib/daily-revalidation';

/**
 * **A ISR deixou de acordar a API do Render a cada hora (01/10/2026).**
 *
 * Toda regeneração de uma página guardada chama a API, e a API dorme com
 * ~15 min sem tráfego no plano free. O conteúdo muda **uma vez por dia**, no
 * pipeline; o que o mantém fresco é o cron diário invalidando o conjunto de
 * `lib/daily-revalidation.ts` (no aceite e no fim do run), e o `revalidate` de
 * cada arquivo é só a rede de segurança. As quatro guardas abaixo são o que impede a próxima página nova
 * de nascer com `revalidate = 3600` copiado da vizinha — que é como as horas
 * de setembro foram gastas sem ninguém escrever um keep-alive.
 */

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

  it('keeps a single cron in vercel.json — the Hobby plan refused the second one', () => {
    // Em 01/10/2026 um segundo cron (`/api/cron/refresh`, 13:00) derrubou o
    // deploy do preview em 22 s, antes do build: o Hobby limita os crons. Quem
    // conserta a página regenerada no meio do run é a espera do próprio cron
    // (`settleRun` em `app/api/cron/daily-news/route.ts`).
    const { crons } = JSON.parse(readFileSync(join(WEB_DIR, 'vercel.json'), 'utf8')) as {
      crons: Array<{ path: string; schedule: string }>;
    };
    expect(crons.map((cron) => cron.path)).toEqual(['/api/cron/daily-news']);
  });
});
