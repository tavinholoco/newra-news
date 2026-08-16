import { Skeleton } from '@/components/ui/skeleton';

export default function NewsLoading() {
  return (
    <div className='mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8'>
      {/* Cabeçalho */}
      <div className='mb-8'>
        <Skeleton className='h-9 w-44' />
        <Skeleton className='mt-3 h-5 w-72' />
      </div>

      {/* Busca */}
      <Skeleton className='mb-4 h-10 w-full rounded-lg' />

      {/* Filtros por categoria */}
      <div className='mb-6 flex flex-wrap gap-2'>
        <Skeleton className='h-8 w-20 rounded-full' />
        <Skeleton className='h-8 w-24 rounded-full' />
        <Skeleton className='h-8 w-28 rounded-full' />
        <Skeleton className='h-8 w-20 rounded-full' />
        <Skeleton className='h-8 w-24 rounded-full' />
        <Skeleton className='h-8 w-28 rounded-full' />
      </div>

      {/* Grid de notícias */}
      <div className='grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3'>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className='flex flex-col gap-3'>
            <Skeleton className='aspect-video w-full rounded-xl' />
            <Skeleton className='h-4 w-1/4' />
            <Skeleton className='h-5 w-full' />
            <Skeleton className='h-5 w-3/4' />
            <Skeleton className='h-4 w-1/2' />
          </div>
        ))}
      </div>
    </div>
  );
}
