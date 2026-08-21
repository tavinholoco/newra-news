import { Skeleton } from '@/components/ui/skeleton';
import { ArticleHistorySkeleton } from '@/components/article/article-history-skeleton';

export default function ArticleHistoryLoading() {
  return (
    <div className='container-editorial py-section'>
      <div className='border-b border-line-strong pb-6'>
        <Skeleton className='h-10 w-72' />
        <Skeleton className='mt-3 h-6 w-full max-w-prose' />
      </div>

      <div className='mt-8'>
        <ArticleHistorySkeleton />
      </div>
    </div>
  );
}
