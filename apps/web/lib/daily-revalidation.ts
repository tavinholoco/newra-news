import { revalidatePath } from 'next/cache';
import { DEFAULT_LOCALE, LOCALES } from '@/lib/i18n';

/**
 * **O que muda quando sai um briefing — e só isso.** É o mecanismo que mantém
 * as páginas frescas: o `revalidate` de cada página passou a ser de um dia e
 * virou rede de segurança. Quem invalida é o cron (`app/api/cron/daily-news`),
 * quando o run do dia fecha em `SUCCESS` — pela rota irmã
 * `app/api/cron/daily-news/revalidate`, e depois ele pede cada página de
 * `dailyPages` e confere que ela traz o run (13.12, abaixo).
 *
 * **Por que isto existe — as horas do Render (01/10/2026).** Toda regeneração
 * da ISR chama a API, e a API dorme com ~15 min sem tráfego no plano free.
 * Com `revalidate = 3600` nas listagens, `900` no news sitemap e o cron
 * invalidando **tudo** sob `/[locale]` a cada dia, qualquer robô que passasse
 * por uma página velha acordava a API — e o acervo tem milhares de matérias.
 * A conta de setembro fechou o caso: 753,4 h no workspace em ~449 h de relógio
 * obrigam **cada um** dos dois serviços do workspace a ter ficado de pé ≥ 68 %
 * do tempo. O conteúdo muda **uma vez por dia**, no pipeline das 11:00 UTC;
 * o resto eram despertares que não traziam nada novo.
 *
 * **Fica de fora, de propósito, a `/news/[id]`.** A matéria não muda depois de
 * coletada, e é a rota com milhares de páginas que os robôs percorrem o dia
 * todo: invalidá-la diariamente era regenerar cada uma que um robô tocasse,
 * uma chamada à API por página. Ela revalida sozinha a cada sete dias (o
 * `revalidate` do arquivo) — o preço é a lista de relacionadas e uma
 * recategorização da etapa 8.5 chegarem à página com até uma semana de atraso.
 *
 * A `/article/[date]` entra: são poucas páginas (uma por dia retido), e uma
 * data pedida antes de o briefing existir fica guardada como "não encontrada"
 * — sem a invalidação, até o `revalidate` vencer.
 *
 * O Next grava as tags com o padrão literal da rota (`_N_T_/[locale]/news/page`),
 * então o padrão cobre os dois idiomas; `'page'` não desce para as filhas.
 *
 * ## `revalidatePath` num route handler só vale quando ele retorna
 *
 * **Lido no código do `next@14.2.35` em 07/10/2026, e há guarda**
 * (`tests/lib/daily-revalidation.test.ts`, "a premissa do Next"): a chamada só
 * **anota** a tag em `store.revalidatedTags`; o Next a aplica depois que o
 * handler resolve, no `waitUntil` da invocação. Até o 13.12 o cron chamava
 * `revalidateDailyContent()` no aceite e de novo no `SUCCESS`, e os
 * comentários diziam "duas invalidações" — **era uma, no fim**, porque a tag
 * repetida nem entra de novo na lista. E pela mesma regra, pedir as páginas na
 * mesma invocação depois de anotar leria o cache antigo, e a anotação aplicada
 * no fim desfaria o que o pedido regenerou. Daí a rota irmã.
 */
export const DAILY_REVALIDATION_PATHS: ReadonlyArray<
  readonly [path: string, type?: 'page' | 'layout']
> = [
  ['/[locale]', 'page'],
  ['/[locale]/news', 'page'],
  ['/[locale]/article', 'page'],
  ['/[locale]/article/[date]', 'page'],
  ['/sitemap.xml'],
  ['/news-sitemap.xml'],
];

/**
 * Anota a invalidação do conjunto do dia — ou só dos padrões pedidos — na
 * invocação corrente. **Vale quando ela retornar** (ver acima).
 */
export function revalidateDailyContent(
  paths: ReadonlyArray<string> = DAILY_REVALIDATION_PATHS.map(([path]) => path),
): void {
  for (const [path, type] of DAILY_REVALIDATION_PATHS) {
    if (!paths.includes(path)) continue;
    if (type) revalidatePath(path, type);
    else revalidatePath(path);
  }
}

/** Uma página concreta do conjunto do dia, e como reconhecer que ela traz o run. */
export interface DailyPage {
  /** O endereço que o leitor pede, sem a origem. */
  url: string;
  /** A entrada de `DAILY_REVALIDATION_PATHS` cuja tag guarda esta página. */
  pattern: string;
  /** Casa com o corpo **só** quando o documento já traz o run do dia. */
  marker: RegExp;
}

const literal = (text: string) => new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));

/**
 * **As páginas que o cron pede depois de invalidar, na ordem do dano ao leitor**
 * (13.12 do plano de observabilidade, 07/10/2026): a Home primeiro — foi ela que
 * passou a tarde de 07/10 com o briefing da véspera —, depois o briefing do dia
 * (o link da Home), o acervo, o histórico e os dois sitemaps.
 *
 * `runDate` é o dia UTC em que o run começou (`YYYY-MM-DD`) — o mesmo do
 * `Article.date` que ele grava (`startOfDay` no pipeline). Cada marca é algo que
 * **só** o documento regenerado depois do run carrega, medido no HTML de cada
 * página e cobrado pela guarda:
 *
 * - **Home e histórico:** o link para o briefing do dia, no idioma da página
 *   (`/pt-BR/article/2026-10-07`). O documento da véspera linka o da véspera.
 * - **O briefing do dia:** o `@id` do JSON-LD (`…/article/2026-10-07#article`).
 *   A data sozinha não serve — ela está no payload de **toda** página da rota,
 *   inclusive na "não encontrada" que um pedido antes do run deixa guardada.
 * - **O acervo:** uma matéria com `createdAt` no dia do run. É a data do
 *   **pipeline**, não a do veículo (`publishedAt` de hoje pode ter sido coletado
 *   ontem). O payload RSC vai no HTML como string JavaScript, com as aspas
 *   escapadas — a marca casa nas duas formas.
 * - **Os sitemaps:** a URL do briefing do dia, que os dois listam.
 */
export function dailyPages(runDate: string): DailyPage[] {
  const briefing = (locale: string) => `/${locale}/article/${runDate}`;
  const perLocale = (pattern: string, url: (locale: string) => string, marker: (locale: string) => RegExp) =>
    LOCALES.map((locale) => ({ url: url(locale), pattern, marker: marker(locale) }));

  return [
    ...perLocale('/[locale]', (locale) => `/${locale}`, (locale) => literal(briefing(locale))),
    ...perLocale('/[locale]/article/[date]', briefing, (locale) => literal(`${briefing(locale)}#article`)),
    ...perLocale(
      '/[locale]/news',
      (locale) => `/${locale}/news`,
      () => new RegExp(String.raw`createdAt\\?":\\?"` + literal(runDate).source),
    ),
    ...perLocale('/[locale]/article', (locale) => `/${locale}/article`, (locale) => literal(briefing(locale))),
    { url: '/sitemap.xml', pattern: '/sitemap.xml', marker: literal(briefing(DEFAULT_LOCALE)) },
    { url: '/news-sitemap.xml', pattern: '/news-sitemap.xml', marker: literal(briefing(DEFAULT_LOCALE)) },
  ];
}
