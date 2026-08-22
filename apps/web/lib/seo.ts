import type { Metadata } from 'next';
import { LOCALES, DEFAULT_LOCALE } from '@/lib/i18n';

// Resolve a URL pública do site:
// 1. NEXT_PUBLIC_SITE_URL (explicita — usada quando houver domínio customizado)
// 2. VERCEL_PROJECT_PRODUCTION_URL (injetada automaticamente pela Vercel)
// 3. localhost:3000 (apenas desenvolvimento local)
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : 'http://localhost:3000');

export const SITE_NAME = 'Newra News';

export const SITE_DESCRIPTION =
  'Portal de notícias inteligente com artigos diários gerados por IA, reunindo as principais notícias do dia em um único lugar.';

/**
 * A imagem de compartilhamento do site — a rota que `app/opengraph-image.tsx`
 * gera, 1200×630.
 *
 * **Sem extensão, e isso não é descuido.** A rota gerada por um
 * `opengraph-image.tsx` é servida em `/opengraph-image`; o `.png` que a tela do
 * briefing usava desde a Fase 5 nunca existiu, e todo compartilhamento dela
 * carregava um 404. (A rota também estava inalcançável por outro motivo — ver
 * o comentário do matcher em `middleware.ts`.)
 */
export const SITE_OG_IMAGE = '/opengraph-image';

/**
 * Caminho sem o prefixo de idioma — `''` para a Home, `/news`, `/news/abc123`.
 *
 * Existe como tipo próprio para deixar explícito o que as funções abaixo
 * esperam: quem passar `/pt-BR/news` ganha `/pt-BR/pt-BR/news`, e o erro só
 * apareceria no HTML de produção.
 */
export type LocalelessPath = '' | `/${string}`;

/** Caminho absoluto de uma rota num idioma (`/pt-BR/news/abc`). */
export function localePath(locale: string, path: LocalelessPath = ''): string {
  return `/${locale}${path}`;
}

/** URL absoluta de uma rota num idioma — para JSON-LD e sitemaps, que exigem. */
export function absoluteUrl(locale: string, path: LocalelessPath = ''): string {
  return `${SITE_URL}${localePath(locale, path)}`;
}

/**
 * `canonical` + `hreflang` de uma rota pública, num lugar só.
 *
 * **Toda página pública precisa das duas coisas, e antes da Fase 7 nenhuma
 * declarava a primeira.** Cada `generateMetadata` reescrevia à mão o mapa
 * `{ 'pt-BR': '/pt-BR/news', en: '/en/news' }` — oito cópias do mesmo literal,
 * nenhuma com `canonical`, nenhuma com `x-default`. Um caminho digitado errado
 * ali não quebra build, teste nem tipo: sai no `<head>` de produção apontando
 * para uma URL que não existe.
 *
 * **`canonical` é auto-referente, e é a resposta certa aqui.** As duas URLs de
 * uma matéria servem o mesmo corpo em português (as fontes RSS são brasileiras;
 * o que `/en` traduz é a moldura), e a tentação é canonizar `/en` para
 * `/pt-BR`. Seria errado: canonical entre alternates de idioma **remove** a
 * versão em inglês do índice, e é justamente ela que serve quem busca em
 * inglês. O par correto é auto-canonical + `hreflang` recíproco — que é o que
 * o Google documenta para conjuntos de idioma.
 *
 * **`x-default` aponta para o `defaultLocale`**, que é para onde o middleware
 * manda quem chega sem prefixo.
 */
export function alternatesFor(
  locale: string,
  path: LocalelessPath = '',
): NonNullable<Metadata['alternates']> {
  const languages: Record<string, string> = {};
  for (const supported of LOCALES) {
    languages[supported] = localePath(supported, path);
  }
  languages['x-default'] = localePath(DEFAULT_LOCALE, path);

  return {
    canonical: localePath(locale, path),
    languages,
  };
}

/** BCP-47 da rota → o formato que o Open Graph pede (`pt-BR` → `pt_BR`). */
export function toOgLocale(locale: string): string {
  return locale.replace('-', '_');
}

interface PageMetadataInput {
  locale: string;
  /** Caminho sem prefixo de idioma. É o único lugar onde ele é escrito. */
  path: LocalelessPath;
  title: string;
  description?: string;
  /**
   * `true` na Home: o template do layout é `%s | Newra News`, e sem isto o
   * título dela sairia "Newra News | Newra News".
   */
  absoluteTitle?: boolean;
  /** O que só esta página sabe: `type: 'article'`, datas, imagens. */
  openGraph?: Metadata['openGraph'];
  twitter?: Metadata['twitter'];
}

/**
 * A metadata de uma página pública inteira, num lugar só.
 *
 * **Existe porque a metadata do Next não faz merge profundo, e isso custou
 * quatro tags em toda página.** O layout de idioma declara
 * `openGraph: { type, siteName, locale }` e `twitter: { card }`; qualquer
 * página que declare o seu próprio `openGraph` **substitui o objeto inteiro** —
 * não o completa. O resultado, medido no HTML de produção da Fase 6: nenhuma
 * página tinha `og:type`, `og:site_name` nem `og:locale`, e a Home, a `/news`,
 * o histórico, a `/about` e a `/newsletter` compartilhavam com
 * `twitter:card: summary` em vez de `summary_large_image` — porque as duas
 * telas de leitura repetiam o valor à mão e as outras cinco não.
 *
 * Repetir os quatro campos em sete `generateMetadata` resolveria hoje e
 * quebraria na oitava página. Aqui o default é um só, e o que a página tem de
 * próprio entra por cima.
 *
 * **A imagem entra pela mesma razão.** O `app/opengraph-image.tsx` é convenção
 * de arquivo do Next, que a aplica ao segmento onde mora — e, medido, **não**
 * aos filhos que declaram `openGraph` próprio. Com o arquivo na raiz e todas as
 * páginas em `app/[locale]/`, nenhuma delas tinha `og:image`: compartilhar a
 * Home, a `/news`, o histórico, a `/about` ou a `/newsletter` produzia um cartão
 * de texto puro. Declarar aqui resolve para todas de uma vez, e a matéria — que
 * tem foto própria — continua sobrescrevendo.
 */
export function pageMetadata({
  locale,
  path,
  title,
  description,
  absoluteTitle = false,
  openGraph,
  twitter,
}: PageMetadataInput): Metadata {
  return {
    title: absoluteTitle ? { absolute: title } : title,
    description,
    alternates: alternatesFor(locale, path),
    openGraph: {
      type: 'website',
      siteName: SITE_NAME,
      locale: toOgLocale(locale),
      url: localePath(locale, path),
      title,
      description,
      images: [
        { url: SITE_OG_IMAGE, width: 1200, height: 630, alt: SITE_NAME },
      ],
      ...openGraph,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [SITE_OG_IMAGE],
      ...twitter,
    },
  };
}
