import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { getNewsById, getRelatedNews, nullIfNotFound } from '@/lib/api';
import { NewsDetail } from '@/components/news/news-detail';
import { JsonLd } from '@/components/seo/json-ld';
import { pageMetadata } from '@/lib/seo';
import { breadcrumbJsonLd, newsArticleJsonLd } from '@/lib/json-ld';
import type { BreadcrumbStep } from '@/lib/json-ld';

export const revalidate = 3600;

/**
 * **Vazio, e é o que liga a ISR nesta rota.**
 *
 * Sem `generateStaticParams`, o Next 14 marca uma rota de segmento dinâmico como
 * `ƒ` — renderizada sob demanda **e não guardada**. Medido em produção em
 * 24/08/2026, três requisições seguidas à mesma matéria: `x-vercel-cache: MISS`
 * nas três, com `Cache-Control: private, no-cache, no-store`. Ou seja, o
 * `revalidate = 3600` acima estava declarado e **não fazia nada**, enquanto a
 * `/pt-BR` respondia `HIT` com `Age: 1491` ao lado.
 *
 * Com a função presente, ainda que devolvendo lista vazia, a rota passa a `●`:
 * nada é pré-renderizado no build (não faria sentido assar 6.441 matérias, e o
 * acervo cresce 513 por dia), o primeiro pedido de cada id é renderizado sob
 * demanda, e **o resultado fica guardado**. Quem paga o render passa a ser o
 * primeiro leitor de cada matéria, uma vez, em vez de todos eles, sempre.
 *
 * Isso importa mais aqui do que em qualquer outra rota: **página de detalhe é o
 * que se compartilha**, então é por ela que se chega ao site vindo de busca ou
 * de rede social — e era a única do produto sem cache nenhum.
 *
 * O cron diário já invalida tudo sob `/[locale]` (`revalidatePath` no
 * `app/api/cron/daily-news/route.ts`), então a cópia guardada não sobrevive a
 * uma renormalização do acervo.
 */
export function generateStaticParams() {
  return [];
}

interface Props {
  params: { locale: string; id: string };
}

export async function generateMetadata({
  params,
}: Props): Promise<Metadata> {
  const t = await getTranslations({ locale: params.locale, namespace: 'news' });
  const news = await getNewsById(params.id).catch(nullIfNotFound);
  // `noindex` no caminho de 404: sem ele o buscador indexaria a página de "não
  // encontrada" sob a URL que alguém digitou errado.
  if (!news) {
    return { title: t('notFoundTitle'), robots: { index: false, follow: false } };
  }

  const tCategories = await getTranslations({
    locale: params.locale,
    namespace: 'categories',
  });
  return pageMetadata({
    locale: params.locale,
    path: `/news/${params.id}`,
    title: news.title,
    description: news.description,
    openGraph: {
      // `article` e não `website`: é o que faz o compartilhamento carregar data
      // e seção em vez de só título e imagem.
      type: 'article',
      publishedTime: news.publishedAt,
      modifiedTime: news.updatedAt,
      section: tCategories(news.category),
      // A redação que escreveu a matéria — não o Newra News, que a coletou.
      authors: [news.source],
      // Só sobrescreve quando há foto: ~30% do acervo não tem, e um `images:
      // []` apagaria a imagem do site que `pageMetadata` põe por padrão —
      // trocando um cartão de marca por um cartão sem imagem nenhuma.
      ...(news.imageUrl
        ? { images: [{ url: news.imageUrl, alt: news.title }] }
        : {}),
    },
    ...(news.imageUrl ? { twitter: { images: [news.imageUrl] } } : {}),
  });
}

export default async function NewsDetailPage({ params }: Props) {
  const { locale, id } = params;
  setRequestLocale(locale);

  const news = await getNewsById(id).catch(nullIfNotFound);

  if (!news) notFound();

  // Em sequência, e não em `Promise.all` com o anterior: as relacionadas
  // dependem de a notícia existir, e disparar as duas juntas gastaria uma
  // consulta toda vez que o id não existe.
  const related = await getRelatedNews(id);

  const tNav = await getTranslations({ locale, namespace: 'nav' });
  const tCategories = await getTranslations({ locale, namespace: 'categories' });

  // Uma lista, dois consumidores: a trilha que o leitor vê e o `BreadcrumbList`
  // que o buscador lê. Montá-las separadamente é como as duas divergem.
  const breadcrumb: BreadcrumbStep[] = [
    { name: tNav('home'), path: '' },
    { name: tNav('news'), path: '/news' },
    // O degrau da categoria leva ao recorte real do acervo — a mesma URL que a
    // `editorial-nav` aponta.
    { name: tCategories(news.category), path: `/news?category=${news.category}` },
    { name: news.title },
  ];

  return (
    <div className='container-editorial py-section'>
      <JsonLd
        data={[
          newsArticleJsonLd({
            news,
            locale,
            sectionLabel: tCategories(news.category),
          }),
          breadcrumbJsonLd(locale, breadcrumb),
        ]}
      />
      <NewsDetail news={news} related={related} breadcrumb={breadcrumb} />
    </div>
  );
}
