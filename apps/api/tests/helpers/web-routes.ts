import { readdirSync, statSync } from 'node:fs';
import path from 'node:path';

/**
 * Toda `page.tsx` sob `apps/web/app/[locale]`, como rota: `/`, `/about`,
 * `/news/[id]`, `/article/[date]`, …
 *
 * Morava dentro de `docs/diagram-drift.test.ts` (o mapa de rotas do frontend
 * tem de desenhar toda página); virou helper quando o **normalizador de rota
 * do erro do cliente** (`utils/web-route.ts`, Fase 7c) passou a perguntar
 * sobre a mesma superfície — o conjunto de saída dele tem de ser exatamente
 * este, e um segundo parser seria um segundo lugar para quebrar em silêncio.
 * Mesmo motivo do `registered-routes.ts`.
 *
 * É a lista **derivada da árvore**, nunca digitada: página nova no web muda
 * o que este helper devolve, e as duas guardas que o leem reprovam até a
 * outra ponta acompanhar.
 */
export const WEB_LOCALE_APP_DIR = path.resolve(__dirname, '../../../web/app/[locale]');

export function webPageRoutes(base: string = WEB_LOCALE_APP_DIR): string[] {
  const pages: string[] = [];

  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir)) {
      const full = path.join(dir, entry);
      if (statSync(full).isDirectory()) walk(full);
      else if (entry === 'page.tsx') pages.push(full);
    }
  };
  walk(base);

  return pages
    .map((file) => path.relative(base, file).replace(/\\/g, '/').replace(/\/?page\.tsx$/, ''))
    .map((route) => `/${route}`)
    .sort();
}
