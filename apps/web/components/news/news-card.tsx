'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import type { News } from '@newranews/types';
import { SafeImage } from '@/components/ui/safe-image';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ExternalLink } from 'lucide-react';
import { FavoriteButton } from '@/components/news/favorite-button';
import { ArticleMeta } from '@/components/editorial/article-meta';

interface NewsCardProps {
  news: News;
}

export function NewsCard({ news }: NewsCardProps) {
  const t = useTranslations('categories');

  return (
    <div className='group relative h-full'>
      <Link href={`/news/${news.id}`} className='block h-full'>
        <Card className='h-full'>
        {/* Image */}
        <div className='relative aspect-[16/9] w-full overflow-hidden rounded-t-lg'>
          {(() => {
            const placeholder = (
              <div role='img' aria-label='Newra News' className='flex h-full w-full items-center justify-center bg-gradient-to-br from-brand-mark to-brand-mark-soft'>
                <span className='font-display text-2xl font-bold text-on-brand/80'>N</span>
              </div>
            );
            return news.imageUrl ? (
              <SafeImage
                src={news.imageUrl}
                alt={news.title}
                fill
                sizes='(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw'
                className='object-cover transition-transform duration-slow group-hover:scale-105'
                fallback={placeholder}
              />
            ) : (
              placeholder
            );
          })()}
          <div className='absolute left-3 top-3'>
            <Badge>
              {t(news.category)}
            </Badge>
          </div>
        </div>

        {/* Content */}
        <CardHeader>
          <CardTitle className='font-display line-clamp-2 text-base leading-snug transition-colors duration-base group-hover:text-link'>
            {news.title}
          </CardTitle>
          <CardDescription className='line-clamp-3'>
            {news.description}
          </CardDescription>
        </CardHeader>

        {/* Footer */}
        <CardFooter className='mt-auto gap-3'>
          {/* sem sourceHref: o card inteiro já é um link (âncora aninhada) */}
          <ArticleMeta
            source={news.source}
            publishedAt={news.publishedAt}
            className='min-w-0'
          />
          <ExternalLink className='ml-auto size-3 shrink-0 text-ink-muted opacity-0 transition-opacity duration-base group-hover:opacity-100' />
        </CardFooter>
        </Card>
      </Link>
      <FavoriteButton
        itemId={news.id}
        overlay
        className='absolute right-3 top-3 z-10'
      />
    </div>
  );
}
