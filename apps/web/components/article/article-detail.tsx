import { getLocale, getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import type { Article } from '@newranews/types';
import { ArrowLeft, Calendar, Newspaper } from 'lucide-react';
import { toDateFormatLocale } from '@/lib/i18n';
import { formatArticleDate } from '@/lib/format';

interface ArticleDetailProps {
  article: Article;
}

export async function ArticleDetail({ article }: ArticleDetailProps) {
  const t = await getTranslations('article');
  const tCommon = await getTranslations('common');
  const locale = await getLocale();

  return (
    <article>
      {/* Back link */}
      <div className='mb-6'>
        <Link
          href='/article'
          className='flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground'
        >
          <ArrowLeft className='h-4 w-4' />
          {t('backTo')}
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
          {formatArticleDate(article.date, toDateFormatLocale(locale))}
        </span>
        <span className='flex items-center gap-1.5'>
          <Newspaper className='h-4 w-4' />
          {tCommon('sourcesConsulted', { count: article.newsCount })}
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
