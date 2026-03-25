import Link from 'next/link';
import Image from 'next/image';
import type { News } from '@newranews/types';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Calendar, ExternalLink, Globe } from 'lucide-react';
import { CATEGORY_LABELS, formatDate } from '@/lib/format';

interface NewsDetailProps {
  news: News;
}

export function NewsDetail({ news }: NewsDetailProps) {
  return (
    <article>
      {/* Back link + category */}
      <div className='mb-6 flex items-center justify-between gap-4'>
        <Link
          href='/news'
          className='flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground'
        >
          <ArrowLeft className='h-4 w-4' />
          Voltar para Notícias
        </Link>
        <Badge className='bg-brand-600 text-white hover:bg-brand-600'>
          {CATEGORY_LABELS[news.category]}
        </Badge>
      </div>

      {/* Hero image */}
      <div className='relative mb-8 aspect-[16/9] w-full overflow-hidden rounded-2xl'>
        {news.imageUrl ? (
          <Image
            src={news.imageUrl}
            alt={news.title}
            fill
            priority
            sizes='(max-width: 896px) 100vw, 896px'
            className='object-cover'
          />
        ) : (
          <div role='img' aria-label='Newra News' className='flex h-full w-full items-center justify-center bg-gradient-to-br from-brand-600 to-brand-400'>
            <span className='font-display text-6xl font-bold text-white/80'>N</span>
          </div>
        )}
      </div>

      {/* Title */}
      <h1 className='font-display mb-4 text-3xl font-bold leading-tight text-foreground sm:text-4xl'>
        {news.title}
      </h1>

      {/* Meta */}
      <div className='mb-6 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground'>
        <span className='flex items-center gap-1.5 font-medium'>
          <Globe className='h-4 w-4' />
          {news.source}
        </span>
        <span className='flex items-center gap-1.5'>
          <Calendar className='h-4 w-4' />
          {formatDate(news.publishedAt)}
        </span>
        <a
          href={news.sourceUrl}
          target='_blank'
          rel='noopener noreferrer'
          className='ml-auto flex items-center gap-1 transition-colors hover:text-brand-600'
        >
          Fonte original
          <ExternalLink className='h-3.5 w-3.5' />
        </a>
      </div>

      <hr className='mb-6 border-border' />

      {/* Description */}
      <p className='mb-6 text-lg leading-relaxed text-muted-foreground'>
        {news.description}
      </p>

      {/* Content */}
      {news.content ? (
        <div className='break-words text-foreground'>
          {news.content.split('\n').map((paragraph, index) =>
            paragraph.trim() ? (
              <p key={index} className='mb-4 leading-relaxed'>
                {paragraph}
              </p>
            ) : null,
          )}
        </div>
      ) : (
        <div className='rounded-xl border border-dashed border-border bg-muted/30 px-6 py-8 text-center text-muted-foreground'>
          <p className='mb-3 text-sm'>Conteúdo completo disponível na fonte original.</p>
          <a
            href={news.sourceUrl}
            target='_blank'
            rel='noopener noreferrer'
            className='inline-flex items-center gap-1.5 text-sm font-medium text-brand-600 transition-colors hover:text-brand-900'
          >
            Leia na fonte
            <ExternalLink className='h-3.5 w-3.5' />
          </a>
        </div>
      )}
    </article>
  );
}
