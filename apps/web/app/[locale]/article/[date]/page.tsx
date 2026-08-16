import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { getArticleByDate } from '@/lib/api';
import { ArticleDetail } from '@/components/article/article-detail';

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
  if (!article) return { title: t('notFoundTitle') };

  return {
    title: article.title,
    description: article.summary,
    alternates: {
      languages: {
        'pt-BR': `/pt-BR/article/${params.date}`,
        en: `/en/article/${params.date}`,
      },
    },
    openGraph: {
      title: article.title,
      description: article.summary,
      images: [{ url: '/opengraph-image.png', width: 1200, height: 630 }],
    },
    twitter: {
      card: 'summary_large_image',
      title: article.title,
      description: article.summary,
      images: ['/opengraph-image.png'],
    },
  };
}

export default async function ArticleDatePage({ params }: Props) {
  const { locale, date } = params;
  setRequestLocale(locale);

  const article = await getArticleByDate(date).catch(() => null);

  if (!article) notFound();

  return (
    <div className='mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8'>
      <ArticleDetail article={article} />
    </div>
  );
}
