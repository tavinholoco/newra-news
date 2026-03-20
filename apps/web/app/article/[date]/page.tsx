import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getArticleByDate } from '@/lib/api';
import { ArticleDetail } from '@/components/article/article-detail';

export const revalidate = 3600;

interface Props {
  params: { date: string };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const article = await getArticleByDate(params.date).catch(() => null);
  if (!article) return { title: 'Artigo não encontrado — Newra News' };

  return {
    title: `${article.title} — Newra News`,
    description: article.summary,
    openGraph: {
      title: article.title,
      description: article.summary,
    },
  };
}

export default async function ArticleDatePage({ params }: Props) {
  const article = await getArticleByDate(params.date).catch(() => null);

  if (!article) notFound();

  return (
    <div className='mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8'>
      <ArticleDetail article={article} />
    </div>
  );
}
