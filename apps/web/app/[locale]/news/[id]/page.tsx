import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { getNewsById, getRelatedNews } from '@/lib/api';
import { NewsDetail } from '@/components/news/news-detail';

export const revalidate = 3600;

interface Props {
  params: { locale: string; id: string };
}

export async function generateMetadata({
  params,
}: Props): Promise<Metadata> {
  const t = await getTranslations({ locale: params.locale, namespace: 'news' });
  const news = await getNewsById(params.id).catch(() => null);
  if (!news) return { title: t('notFoundTitle') };

  return {
    title: news.title,
    description: news.description,
    alternates: {
      languages: {
        'pt-BR': `/pt-BR/news/${params.id}`,
        en: `/en/news/${params.id}`,
      },
    },
    openGraph: {
      title: news.title,
      description: news.description,
      images: news.imageUrl ? [{ url: news.imageUrl }] : [],
    },
    twitter: {
      card: 'summary_large_image',
      title: news.title,
      description: news.description,
      images: news.imageUrl ? [news.imageUrl] : [],
    },
  };
}

export default async function NewsDetailPage({ params }: Props) {
  const { locale, id } = params;
  setRequestLocale(locale);

  const news = await getNewsById(id).catch(() => null);

  if (!news) notFound();

  // Em sequência, e não em `Promise.all` com o anterior: as relacionadas
  // dependem de a notícia existir, e disparar as duas juntas gastaria uma
  // consulta toda vez que o id não existe.
  const related = await getRelatedNews(id);

  return (
    <div className='container-editorial py-section'>
      <NewsDetail news={news} related={related} />
    </div>
  );
}
