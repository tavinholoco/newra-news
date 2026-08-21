import { Suspense } from 'react';
import type { Metadata } from 'next';
import type { News, NewsFacets } from '@newranews/types';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { getNews, getNewsFacets } from '@/lib/api';
import { NewsArchiveHeader } from '@/components/news/news-archive-header';
import { NewsListSkeleton } from '@/components/news/news-list-skeleton';
import { NewsPageClient } from '@/components/news/news-page-client';

export const revalidate = 3600;

interface Props {
  params: { locale: string };
}

export async function generateMetadata({
  params: { locale },
}: Props): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: 'metadata.news' });

  return {
    title: t('title'),
    description: t('description'),
    alternates: {
      languages: {
        'pt-BR': '/pt-BR/news',
        en: '/en/news',
      },
    },
    openGraph: {
      title: t('title'),
      description: t('description'),
    },
    twitter: {
      title: t('title'),
      description: t('description'),
    },
  };
}

const EMPTY_LIST = {
  data: [] as News[],
  meta: { total: 0, page: 1, limit: 20, totalPages: 0 },
};

const EMPTY_FACETS: NewsFacets = { total: 0, categories: [], sources: [] };

export default async function NewsPage({ params }: Props) {
  const { locale } = params;
  setRequestLocale(locale);

  // A primeira página sem filtro e as facetas dela vão no HTML estático: é o
  // que a maioria abre, e sem as facetas os chips de categoria nasceriam sem
  // contagem e ganhariam o número só depois da hidratação — a barra inteira
  // mudaria de largura na frente do leitor.
  const [initialData, initialFacets] = await Promise.all([
    getNews(1, 20).catch(() => EMPTY_LIST),
    getNewsFacets().catch(() => EMPTY_FACETS),
  ]);

  return (
    <div className='container-editorial py-section'>
      {/* `NewsPageClient` lê a URL inteira (`?category=`, `?search=`, `?page=`…),
          e numa página estática isso exige fronteira de Suspense. O fallback
          repete o cabeçalho de propósito: assim o HTML pré-renderizado sai com
          um `h1` de verdade, e não com um retângulo cinza. */}
      <Suspense
        fallback={
          <div className='flex flex-col gap-6'>
            <NewsArchiveHeader category={null} />
            <NewsListSkeleton />
          </div>
        }
      >
        <NewsPageClient
          initialData={initialData}
          initialFacets={initialFacets}
        />
      </Suspense>
    </div>
  );
}
