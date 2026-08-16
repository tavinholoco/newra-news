import Link from 'next/link';
import type { Article } from '@newranews/types';
import { Newspaper, Calendar, ArrowRight } from 'lucide-react';
import { formatArticleDate, toDateSlug } from '@/lib/format';

interface ArticleCardProps {
  article: Article;
}

export function ArticleCard({ article }: ArticleCardProps) {
  return (
    <section className='animate-fade-in-up motion-reduce:animate-none rounded-2xl bg-brand-100 p-6 sm:p-8 lg:p-10'>
      <div className='flex items-center gap-2 text-brand-600'>
        <Newspaper className='h-5 w-5' />
        <span className='font-display text-sm font-semibold uppercase tracking-wider'>
          Artigo do Dia
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
          {formatArticleDate(article.date)}
        </span>
        <span>{article.newsCount} fontes consultadas</span>
      </div>

      <Link
        href={`/article/${toDateSlug(article.date)}`}
        className='mt-6 inline-flex items-center gap-1.5 font-display text-sm font-semibold text-brand-600 transition-colors hover:text-brand-400'
      >
        Ler artigo completo
        <ArrowRight className='h-4 w-4' />
      </Link>
    </section>
  );
}
