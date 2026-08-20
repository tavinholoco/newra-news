import { Skeleton } from '@/components/ui/skeleton';

export default function ArticleHistoryLoading() {
  return (
    <div className='mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8'>
      {/* Cabeçalho */}
      <div className='mb-8'>
        <Skeleton className='h-9 w-64' />
        <Skeleton className='mt-3 h-5 w-96' />
      </div>

      {/* Grid de artigos */}
      <div className='grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3'>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className='flex flex-col gap-3 rounded-lg border p-4'>
            <Skeleton className='h-5 w-3/4' />
            <Skeleton className='h-4 w-full' />
            <Skeleton className='h-4 w-full' />
            <Skeleton className='h-4 w-2/3' />
            <Skeleton className='mt-auto h-3 w-1/2' />
          </div>
        ))}
      </div>
    </div>
  );
}
