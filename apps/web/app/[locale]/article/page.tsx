import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { getArticles, prefetch } from '@/lib/api';
import { ArticlePageClient } from '@/components/article/article-page-client';
import { pageMetadata } from '@/lib/seo';

export const revalidate = 3600;

interface Props {
  params: { locale: string };
}

export async function generateMetadata({
  params: { locale },
}: Props): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: 'metadata.articles' });

  return pageMetadata({
    locale,
    path: '/article',
    title: t('title'),
    description: t('description'),
  });
}

export default async function ArticleHistoryPage({ params }: Props) {
  const { locale } = params;
  setRequestLocale(locale);

  const t = await getTranslations('article');
  // `prefetch` e não um `catch` com lista vazia: vazio é uma afirmação, e ela
  // iria para o `initialData` de uma query com `staleTime` de 5 minutos — que
  // não buscaria de novo. Ver o comentário em `lib/api.ts`.
  const initialData = await prefetch(getArticles(1, 9));

  return (
    <div className='container-editorial py-section'>
      <header className='border-b border-line-strong pb-6'>
        <h1 className='font-display text-h1 font-bold text-ink'>{t('title')}</h1>
        <p className='mt-2 max-w-prose text-body-lg text-ink-secondary'>
          {t('historyIntro')}
        </p>
      </header>

      <div className='mt-8'>
        <ArticlePageClient initialData={initialData} />
      </div>
    </div>
  );
}
