import type { ArticleWithSources, News } from '@newranews/types';
import {
  SITE_NAME,
  SITE_URL,
  SITE_OG_IMAGE,
  absoluteUrl,
  type LocalelessPath,
} from '@/lib/seo';
import { toDateSlug } from '@/lib/format';

/**
 * Um nó de dado estruturado. `unknown` e não `any`: quem monta o nó já sabe o
 * formato, e quem o recebe só serializa.
 */
export type JsonLdNode = Record<string, unknown>;

/**
 * `@id` estáveis. São o que permite a `NewsArticle` de uma página apontar para
 * a mesma organização que o layout declarou, em vez de dois grafos soltos que
 * o buscador tem de adivinhar que são a mesma entidade.
 */
export const ORGANIZATION_ID = `${SITE_URL}/#organization`;
export const WEBSITE_ID = `${SITE_URL}/#website`;

/**
 * A marca. Vale para o site inteiro e sai no layout de idioma.
 *
 * O logo é o SVG de `public/logo/` — o mesmo vetor do `icon.svg` e do
 * `opengraph-image`. Não existe PNG versionado de propósito (§40.3: uma fonte
 * só para a marca, e nada de binário no git), e o SVG está entre os formatos
 * que o Google lê. `width`/`height` saem do `viewBox`: sem eles um SVG não
 * declara tamanho nenhum, e o requisito de logo é dimensional.
 */
export function organizationJsonLd(): JsonLdNode {
  return {
    '@type': 'Organization',
    '@id': ORGANIZATION_ID,
    name: SITE_NAME,
    url: SITE_URL,
    logo: {
      '@type': 'ImageObject',
      url: `${SITE_URL}/logo/logo-mark.svg`,
      width: 1184,
      height: 1312,
    },
  };
}

/**
 * O site, com a busca do acervo declarada como ação.
 *
 * `SearchAction` aponta para `/news?search=`, que é a busca real — a mesma URL
 * que o campo do masthead submete. Declarar uma que a tela não atende seria a
 * armadilha da pílula de contagem em outra forma.
 */
export function webSiteJsonLd(locale: string, description: string): JsonLdNode {
  return {
    '@type': 'WebSite',
    '@id': WEBSITE_ID,
    url: absoluteUrl(locale),
    name: SITE_NAME,
    description,
    inLanguage: locale,
    publisher: { '@id': ORGANIZATION_ID },
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${absoluteUrl(locale, '/news')}?search={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  };
}

interface NewsArticleInput {
  news: News;
  locale: string;
  /** Rótulo traduzido da categoria — `articleSection` é texto para humano. */
  sectionLabel: string;
}

/**
 * A matéria coletada, em `NewsArticle`.
 *
 * **Quem escreveu não é quem publicou esta página, e a marcação diz isso.**
 * O texto é de uma redação (`author` = o veículo); a página é do Newra News
 * (`publisher`). Carimbar o Newra News como autor de matéria de terceiro é
 * exatamente o erro que a §8 evita na interface — não faz sentido cometê-lo no
 * dado estruturado, que é onde o buscador acredita.
 *
 * **`isBasedOn` aponta para a matéria original.** É o par honesto de
 * `articleBody` ser um trecho: a página declara que deriva de outra URL em vez
 * de se apresentar como o texto completo.
 *
 * `description` no lugar de `articleBody` pela mesma razão — publicar como
 * corpo o que é um extrato do RSS prometeria uma matéria que a página não tem.
 */
export function newsArticleJsonLd({
  news,
  locale,
  sectionLabel,
}: NewsArticleInput): JsonLdNode {
  const url = absoluteUrl(locale, `/news/${news.id}`);

  return {
    '@type': 'NewsArticle',
    '@id': `${url}#article`,
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    url,
    headline: news.title,
    description: news.description,
    articleSection: sectionLabel,
    inLanguage: locale,
    datePublished: news.publishedAt,
    dateModified: news.updatedAt,
    author: { '@type': 'Organization', name: news.source },
    publisher: organizationJsonLd(),
    isBasedOn: news.sourceUrl,
    ...(news.imageUrl ? { image: [news.imageUrl] } : {}),
  };
}

interface BriefingJsonLdInput {
  article: ArticleWithSources;
  locale: string;
}

/**
 * O briefing diário, em `NewsArticle`.
 *
 * Aqui o autor **é** o site: o texto foi produzido pela redação automatizada, e
 * é a tela que já declara isso ao leitor pela `AiDisclosure`. As notícias que
 * o originaram entram como `citation` — que é a contraparte estruturada da
 * `SourceList`, e a mesma lista.
 *
 * `datePublished` prefere `generatedAt` (quando o modelo escreveu) e cai em
 * `date` (o dia coberto) nos briefings anteriores à migration de auditoria,
 * que não têm o primeiro.
 */
export function briefingJsonLd({
  article,
  locale,
}: BriefingJsonLdInput): JsonLdNode {
  const url = absoluteUrl(locale, `/article/${toDateSlug(article.date)}`);

  return {
    '@type': 'NewsArticle',
    '@id': `${url}#article`,
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    url,
    headline: article.title,
    description: article.summary,
    inLanguage: locale,
    datePublished: article.generatedAt ?? article.date,
    dateModified: article.updatedAt,
    author: { '@id': ORGANIZATION_ID },
    publisher: organizationJsonLd(),
    image: [`${SITE_URL}${SITE_OG_IMAGE}`],
    ...(article.sources.length > 0
      ? {
          citation: article.sources.map((source) => ({
            '@type': 'CreativeWork',
            name: source.title,
            url: source.sourceUrl,
            publisher: { '@type': 'Organization', name: source.source },
          })),
        }
      : {}),
  };
}

/**
 * Um degrau da trilha: o rótulo visível e o caminho sem prefixo de idioma.
 *
 * **Sem `path` é a página atual** — o último degrau. É o mesmo tipo que o
 * componente `Breadcrumb` consome, e é a mesma lista que as duas pontas
 * recebem: o Google pede que o dado estruturado descreva a trilha visível, e
 * duas listas paralelas divergem no primeiro degrau que alguém renomear.
 */
export interface BreadcrumbStep {
  name: string;
  path?: LocalelessPath;
}

/**
 * A trilha, na mesma ordem em que a `Breadcrumb` a desenha.
 *
 * **O degrau atual não leva `item`.** Dar-lhe URL própria faria a trilha
 * apontar para si mesma, e a documentação do Google trata o último elemento
 * como opcionalmente sem `item` justamente por isso.
 *
 * A Home é o primeiro degrau sempre — uma trilha que começa no meio não diz
 * onde a página está.
 */
export function breadcrumbJsonLd(
  locale: string,
  steps: readonly BreadcrumbStep[],
): JsonLdNode {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: steps.map((step, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: step.name,
      ...(step.path === undefined
        ? {}
        : { item: absoluteUrl(locale, step.path) }),
    })),
  };
}
