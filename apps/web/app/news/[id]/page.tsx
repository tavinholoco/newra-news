import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getNewsById } from '@/lib/api';
import { NewsDetail } from '@/components/news/news-detail';

export const revalidate = 3600;

interface Props {
  params: { id: string };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const news = await getNewsById(params.id).catch(() => null);
  if (!news) return { title: 'Notícia não encontrada' };

  return {
    title: news.title,
    description: news.description,
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
  const news = await getNewsById(params.id).catch(() => null);

  if (!news) notFound();

  return (
    <div className='mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8'>
      <NewsDetail news={news} />
    </div>
  );
}
