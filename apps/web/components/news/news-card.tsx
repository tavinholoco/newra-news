import Link from 'next/link';
import Image from 'next/image';
import type { News } from '@newranews/types';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, ExternalLink } from 'lucide-react';
import { CATEGORY_LABELS, formatDate } from '@/lib/format';

interface NewsCardProps {
  news: News;
}

export function NewsCard({ news }: NewsCardProps) {
  return (
    <Link href={`/news/${news.id}`} className='group block'>
      <Card className='h-full transition-shadow duration-200 group-hover:shadow-md'>
        {/* Image */}
        <div className='relative aspect-[16/9] w-full overflow-hidden rounded-t-xl'>
          {news.imageUrl ? (
            <Image
              src={news.imageUrl}
              alt={news.title}
              fill
              sizes='(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw'
              className='object-cover transition-transform duration-300 group-hover:scale-105'
            />
          ) : (
            <div className='flex h-full w-full items-center justify-center bg-gradient-to-br from-brand-600 to-brand-400'>
              <span className='font-display text-2xl font-bold text-white/80'>N</span>
            </div>
          )}
          <div className='absolute left-3 top-3'>
            <Badge className='bg-brand-600 text-white hover:bg-brand-600'>
              {CATEGORY_LABELS[news.category]}
            </Badge>
          </div>
        </div>

        {/* Content */}
        <CardHeader>
          <CardTitle className='font-display line-clamp-2 text-base leading-snug group-hover:text-brand-600'>
            {news.title}
          </CardTitle>
          <CardDescription className='line-clamp-3'>
            {news.description}
          </CardDescription>
        </CardHeader>

        {/* Footer */}
        <CardFooter className='mt-auto gap-3 text-xs text-muted-foreground'>
          <span className='truncate font-medium'>{news.source}</span>
          <span className='flex items-center gap-1'>
            <Calendar className='h-3 w-3' />
            {formatDate(news.publishedAt)}
          </span>
          <ExternalLink className='ml-auto h-3 w-3 shrink-0 opacity-0 transition-opacity group-hover:opacity-100' />
        </CardFooter>
      </Card>
    </Link>
  );
}
