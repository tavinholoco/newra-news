import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { getArticleByDate, nullIfNotFound } from '@/lib/api';
import { ArticleDetail } from '@/components/article/article-detail';
import { JsonLd } from '@/components/seo/json-ld';
import { SITE_NAME, pageMetadata } from '@/lib/seo';
import { breadcrumbJsonLd, briefingJsonLd } from '@/lib/json-ld';
import type { BreadcrumbStep } from '@/lib/json-ld';
import { formatArticleDate } from '@/lib/format';
import { toDateFormatLocale } from '@/lib/i18n';
import { plainSummary, plainTitle } from '@/lib/markdown-text';

export const revalidate = 3600;

/**
 * Vazio, pelo mesmo motivo da `/news/[id]`: sem esta função o Next marca a rota
 * como `ƒ` e o `revalidate` acima não guarda nada — medido em produção, três
 * `MISS` seguidos na mesma URL.
 *
 * Aqui o conjunto **seria** enumerável (um briefing por dia, retenção de 90
 * dias), e mesmo assim a lista fica vazia: pré-renderizar noventa páginas no
 * build custaria noventa chamadas à API a cada deploy para assar conteúdo que a
 * primeira visita guarda de graça — e o briefing de hoje, que é o único muito
 * lido, nasce **depois** do build de qualquer forma.
 */
export function generateStaticParams() {
  return [];
}

interface Props {
  params: { locale: string; date: string };
}

export async function generateMetadata({
  params,
}: Props): Promise<Metadata> {
  const t = await getTranslations({
    locale: params.locale,
    namespace: 'article',
  });
  const article = await getArticleByDate(params.date).catch(nullIfNotFound);
  if (!article) {
    return { title: t('notFoundTitle'), robots: { index: false, follow: false } };
  }

  return pageMetadata({
    locale: params.locale,
    path: `/article/${params.date}`,
    title: plainTitle(article.title),
    description: plainSummary(article.summary),
    openGraph: {
      type: 'article',
      // `generatedAt` é quando o modelo escreveu; `date` é o dia que o briefing
      // cobre. Nos anteriores à migration de auditoria só existe o segundo.
      publishedTime: article.generatedAt ?? article.date,
      modifiedTime: article.updatedAt,
      // O briefing é nosso: quem o produziu é a redação automatizada do site.
      authors: [SITE_NAME],
      // A imagem é a do site, e vem do default de `pageMetadata`: o briefing
      // não tem foto própria — as fotos pertencem às matérias que o originaram.
    },
  });
}

export default async function ArticleDatePage({ params }: Props) {
  const { locale, date } = params;
  setRequestLocale(locale);

  const article = await getArticleByDate(date).catch(nullIfNotFound);

  if (!article) notFound();

  const tNav = await getTranslations({ locale, namespace: 'nav' });

  // O degrau atual é a data, não a manchete: o histórico lista os briefings por
  // dia, e é assim que quem chega aqui sabe onde está. A manchete já é o `h1`
  // logo abaixo — repeti-la na trilha seria a mesma informação duas vezes.
  const breadcrumb: BreadcrumbStep[] = [
    { name: tNav('home'), path: '' },
    { name: tNav('articles'), path: '/article' },
    { name: formatArticleDate(article.date, toDateFormatLocale(locale)) },
  ];

  return (
    <div className='container-editorial py-section'>
      <JsonLd
        data={[
          briefingJsonLd({ article, locale }),
          breadcrumbJsonLd(locale, breadcrumb),
        ]}
      />
      <ArticleDetail article={article} breadcrumb={breadcrumb} />
    </div>
  );
}
