import { Skeleton } from '@/components/ui/skeleton';

export default function ArticleDetailLoading() {
  return (
    <div className='mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8'>
      {/* Back link */}
      <Skeleton className='mb-6 h-5 w-36' />

      {/* Título */}
      <Skeleton className='mb-2 h-10 w-full' />
      <Skeleton className='mb-2 h-10 w-3/4' />

      {/* Meta */}
      <div className='mb-6 flex flex-wrap gap-4'>
        <Skeleton className='h-5 w-32' />
        <Skeleton className='h-5 w-40' />
      </div>

      <Skeleton className='mb-6 h-px w-full' />

      {/* Summary */}
      <Skeleton className='mb-2 h-6 w-full' />
      <Skeleton className='mb-2 h-6 w-full' />
      <Skeleton className='mb-6 h-6 w-2/3' />

      {/* Conteúdo */}
      <Skeleton className='mb-2 h-5 w-full' />
      <Skeleton className='mb-2 h-5 w-full' />
      <Skeleton className='mb-2 h-5 w-4/5' />
      <Skeleton className='mb-2 h-5 w-full' />
      <Skeleton className='h-5 w-3/5' />
    </div>
  );
}
