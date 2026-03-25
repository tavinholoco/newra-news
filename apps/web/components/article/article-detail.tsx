import Link from 'next/link';
import type { Article } from '@newranews/types';
import { ArrowLeft, Calendar, Newspaper } from 'lucide-react';
import { formatArticleDate } from '@/lib/format';

interface ArticleDetailProps {
  article: Article;
}

export function ArticleDetail({ article }: ArticleDetailProps) {
  return (
    <article>
      {/* Back link */}
      <div className='mb-6'>
        <Link
          href='/article'
          className='flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground'
        >
          <ArrowLeft className='h-4 w-4' />
          Voltar para Artigos
        </Link>
      </div>

      {/* Title */}
      <h1 className='font-display mb-4 text-3xl font-bold leading-tight text-foreground sm:text-4xl'>
        {article.title}
      </h1>

      {/* Meta */}
      <div className='mb-6 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground'>
        <span className='flex items-center gap-1.5'>
          <Calendar className='h-4 w-4' />
          {formatArticleDate(article.date)}
        </span>
        <span className='flex items-center gap-1.5'>
          <Newspaper className='h-4 w-4' />
          {article.newsCount} fontes consultadas
        </span>
      </div>

      <hr className='mb-6 border-border' />

      {/* Summary */}
      <p className='mb-6 text-lg leading-relaxed text-muted-foreground'>
        {article.summary}
      </p>

      {/* Content */}
      <div className='break-words text-foreground'>
        {article.content.split('\n').map((paragraph, index) =>
          paragraph.trim() ? (
            <p key={index} className='mb-4 leading-relaxed'>
              {paragraph}
            </p>
          ) : null,
        )}
      </div>
    </article>
  );
}
