import { getNews, getArticles } from '@/lib/api';
import { plainTitle } from '@/lib/markdown-text';
import { toDateSlug } from '@/lib/format';
import { SITE_NAME, absoluteUrl, type LocalelessPath } from '@/lib/seo';
import { DEFAULT_LOCALE } from '@/lib/i18n';

// 15 minutos. O `sitemap.ts` geral revalida de hora em hora porque descreve o
// acervo inteiro; este descreve uma janela de 48h e existe para ser lido logo
// depois de a matéria entrar. O pipeline diário também o invalida sob demanda
// (`app/api/cron/daily-news/route.ts`), então isto é o piso, não o mecanismo.
export const revalidate = 900;

/** A janela que o Google News lê. Fonte: sitemap-news, "últimos dois dias". */
const WINDOW_MS = 48 * 60 * 60 * 1000;

/** Teto do formato: 1.000 URLs por news sitemap. */
const MAX_URLS = 1000;

/** O `limit` máximo que `GET /api/news` aceita. */
const PAGE_SIZE = 100;

/**
 * `news:language` é código ISO 639, **não** BCP-47 — `pt`, não `pt-BR`. A
 * exceção documentada é o chinês (`zh-cn`/`zh-tw`), que não é o caso aqui.
 */
const PUBLICATION_LANGUAGE = DEFAULT_LOCALE.split('-')[0];

interface NewsEntry {
  path: LocalelessPath;
  title: string;
  publishedAt: string;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function toEntryXml(entry: NewsEntry): string {
  return [
    '  <url>',
    `    <loc>${escapeXml(absoluteUrl(DEFAULT_LOCALE, entry.path))}</loc>`,
    '    <news:news>',
    '      <news:publication>',
    `        <news:name>${escapeXml(SITE_NAME)}</news:name>`,
    `        <news:language>${PUBLICATION_LANGUAGE}</news:language>`,
    '      </news:publication>',
    `      <news:publication_date>${new Date(entry.publishedAt).toISOString()}</news:publication_date>`,
    `      <news:title>${escapeXml(entry.title)}</news:title>`,
    '    </news:news>',
    '  </url>',
  ].join('\n');
}

/** Matérias publicadas dentro da janela, paginando até o teto do formato. */
async function collectNews(since: Date): Promise<NewsEntry[]> {
  const filters = { from: since.toISOString() };
  const entries: NewsEntry[] = [];

  const first = await getNews(1, PAGE_SIZE, filters);
  const pages = Math.min(
    first.meta.totalPages,
    Math.ceil(MAX_URLS / PAGE_SIZE),
  );

  const rest =
    pages > 1
      ? await Promise.all(
          Array.from({ length: pages - 1 }, (_, index) =>
            getNews(index + 2, PAGE_SIZE, filters),
          ),
        )
      : [];

  for (const item of [first, ...rest].flatMap((res) => res.data)) {
    entries.push({
      path: `/news/${item.id}`,
      title: item.title,
      publishedAt: item.publishedAt,
    });
  }

  return entries;
}

/** Os briefings da janela. São poucos por definição — um por dia. */
async function collectBriefings(since: Date): Promise<NewsEntry[]> {
  const { data } = await getArticles(1, 10);

  return data
    .filter((article) => new Date(article.date).getTime() >= since.getTime())
    .map((article) => ({
      path: `/article/${toDateSlug(article.date)}` as LocalelessPath,
      title: plainTitle(article.title),
      publishedAt: article.generatedAt ?? article.date,
    }));
}

/**
 * O sitemap do Google Notícias (§16).
 *
 * **É um route handler e não um `sitemap.ts` porque o `MetadataRoute.Sitemap`
 * do Next não emite o namespace `news:`** — ele conhece `loc`, `lastmod`,
 * `changefreq`, `priority` e alternates de idioma, e nada mais. Um news sitemap
 * sem `<news:news>` é um sitemap comum com outro nome.
 *
 * **Só as URLs `pt-BR`, e isso é uma decisão sobre o conteúdo, não sobre a
 * interface.** As fontes RSS são brasileiras: o corpo da matéria é o mesmo
 * texto em português nas duas URLs, e o que `/en` traduz é a moldura. Declarar
 * `/en/news/{id}` com `news:language` inglês diria ao Google que ali há uma
 * matéria em inglês que não existe; declarar com `pt` seria a mesma matéria
 * duas vezes. As duas URLs continuam no `sitemap.xml` geral, com o `hreflang`
 * dizendo o que elas são.
 *
 * **Só a janela de 48h**, que é o que a documentação do formato pede — sitemap
 * de notícias não é arquivo, é o que acabou de sair.
 *
 * Falha de rede devolve um documento **válido e vazio**, nunca 500: um sitemap
 * que responde erro sai do rodízio de leitura do buscador, e um vazio só diz
 * "nada novo agora".
 */
export async function GET(): Promise<Response> {
  const since = new Date(Date.now() - WINDOW_MS);

  const [news, briefings] = await Promise.all([
    collectNews(since).catch(() => [] as NewsEntry[]),
    collectBriefings(since).catch(() => [] as NewsEntry[]),
  ]);

  const entries = [...briefings, ...news]
    .sort(
      (a, b) =>
        new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
    )
    .slice(0, MAX_URLS);

  const body = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">',
    ...entries.map(toEntryXml),
    '</urlset>',
  ].join('\n');

  return new Response(body, {
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': `public, max-age=0, s-maxage=${revalidate}, stale-while-revalidate`,
    },
  });
}
