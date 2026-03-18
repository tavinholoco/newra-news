import type { News } from '@newranews/types';
import { NewsCard } from './news-card';

interface NewsGridProps {
  news: News[];
}

export function NewsGrid({ news }: NewsGridProps) {
  if (news.length === 0) {
    return (
      <div className='flex flex-col items-center justify-center rounded-xl border border-dashed border-border px-6 py-16 text-center'>
        <p className='font-display text-lg font-semibold text-foreground'>
          Nenhuma notícia encontrada
        </p>
        <p className='mt-1 text-sm text-muted-foreground'>
          As notícias aparecerão aqui assim que forem coletadas.
        </p>
      </div>
    );
  }

  return (
    <div className='grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3'>
      {news.map((item) => (
        <NewsCard key={item.id} news={item} />
      ))}
    </div>
  );
}
