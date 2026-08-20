import { getLocale, getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import type { Article } from '@newranews/types';
import { Newspaper, Calendar, ArrowRight } from 'lucide-react';
import { toDateFormatLocale } from '@/lib/i18n';
import { formatArticleDate, toDateSlug } from '@/lib/format';

interface ArticleCardProps {
  article: Article;
}

export async function ArticleCard({ article }: ArticleCardProps) {
  const t = await getTranslations('home');
  const tCommon = await getTranslations('common');
  const tArticle = await getTranslations('article');
  const locale = await getLocale();

  return (
    <section className='animate-fade-in-up motion-reduce:animate-none rounded-lg bg-surface-accent p-6 sm:p-8 lg:p-10'>
      {/* `text-link`, não `text-brand-accent`: a linha tem texto, e laranja
          em texto é brand-700 (§4). O ícone acompanha sem prejuízo. */}
      <div className='flex items-center gap-2 text-link'>
        <Newspaper className='h-5 w-5' />
        <span className='font-display text-sm font-semibold uppercase tracking-wider'>
          {t('dailyArticle')}
        </span>
      </div>

      <h2 className='mt-4 font-display text-2xl font-bold leading-tight text-foreground md:text-3xl'>
        {article.title}
      </h2>

      <p className='mt-3 text-base leading-relaxed text-foreground/80 sm:text-lg'>
        {article.summary}
      </p>

      <div className='mt-4 flex flex-wrap items-center gap-4 text-sm text-foreground/60'>
        <span className='flex items-center gap-1.5'>
          <Calendar className='h-4 w-4' />
          {formatArticleDate(article.date, toDateFormatLocale(locale))}
        </span>
        <span>
          {tCommon('sourcesConsulted', { count: article.newsCount })}
        </span>
      </div>

      <Link
        href={`/article/${toDateSlug(article.date)}`}
        className='mt-6 inline-flex items-center gap-1.5 font-display text-sm font-semibold text-link transition-colors hover:text-link-hover'
      >
        {tArticle('readFull')}
        <ArrowRight className='h-4 w-4' />
      </Link>
    </section>
  );
}
