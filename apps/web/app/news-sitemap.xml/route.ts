import { getNews, getArticles, nullUnlessPublishing } from '@/lib/api';
import { logServerError } from '@/lib/log-server-error';
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
 * **Falha da API sobe, e é isso que mantém o documento anterior no ar.** Esta
 * rota dizia o contrário até 19/09/2026 — "um sitemap que responde erro sai do
 * rodízio; um vazio só diz 'nada novo'" — e a frase estava certa para um render
 * por requisição e **invertida para ISR**: aqui a Vercel trata 5xx na
 * revalidação como *falha*, e falha **preserva o que estava guardado**, com
 * nova tentativa em 30 s; um 200 vazio é uma revalidação *bem-sucedida*, e
 * substitui o documento bom. Medido com a API suspensa: este sitemap regenerou
 * de **612 URLs para zero**, com 200 e `HIT`, e ficaria assim até a API
 * voltar — foi o "news sitemap com zero URLs" da suspensão de 29/08, que
 * ninguém tinha ligado ao `catch`.
 */
export async function GET(): Promise<Response> {
  const since = new Date(Date.now() - WINDOW_MS);

  /**
   * **A linha de log fica; o que muda é o desfecho.**
   *
   * A Fase 7a pôs a linha porque um sitemap vazio e um que não conseguiu
   * perguntar eram bit a bit iguais para quem olha a resposta. Hoje os dois
   * deixaram de ser iguais também na resposta — mas a linha continua sendo o
   * único lugar onde a causa (`ECONNREFUSED`, timeout, 503) sobrevive, porque
   * o que o Next devolve depois do `throw` é a 500 genérica com `digest`.
   *
   * `nullUnlessPublishing` é a mesma peça da Home e do `sitemap.ts`: relança
   * onde o resultado é publicado — o build da Vercel, que preserva o deploy
   * anterior, e a revalidação em runtime, que preserva o documento anterior —
   * e cede no build do CI, que roda sem API de propósito e não publica nada;
   * ali o documento sai válido e vazio, como antes.
   *
   * Esta rota escapou da Fase 7a por um detalhe de caminho: ela é a única
   * `route.ts` **fora de `app/api`**, e a guarda só varria aquele diretório.
   */
  const logged = <T>(collection: string, promise: Promise<T>): Promise<T> =>
    promise.catch((error: unknown) => {
      logServerError('bff.news-sitemap', error, { collection });
      throw error;
    });

  const [news, briefings] = await Promise.all([
    nullUnlessPublishing(logged('news', collectNews(since))),
    nullUnlessPublishing(logged('briefings', collectBriefings(since))),
  ]);

  const entries = [...(briefings ?? []), ...(news ?? [])]
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
