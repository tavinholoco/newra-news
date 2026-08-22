import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { getArticleByDate } from '@/lib/api';
import { ArticleDetail } from '@/components/article/article-detail';
import { JsonLd } from '@/components/seo/json-ld';
import { SITE_NAME, pageMetadata } from '@/lib/seo';
import { breadcrumbJsonLd, briefingJsonLd } from '@/lib/json-ld';
import type { BreadcrumbStep } from '@/lib/json-ld';
import { formatArticleDate } from '@/lib/format';
import { toDateFormatLocale } from '@/lib/i18n';

export const revalidate = 3600;

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
  const article = await getArticleByDate(params.date).catch(() => null);
  if (!article) {
    return { title: t('notFoundTitle'), robots: { index: false, follow: false } };
  }

  return pageMetadata({
    locale: params.locale,
    path: `/article/${params.date}`,
    title: article.title,
    description: article.summary,
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

  const article = await getArticleByDate(date).catch(() => null);

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
