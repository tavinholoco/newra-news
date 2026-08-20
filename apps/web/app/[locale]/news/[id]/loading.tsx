import { Skeleton } from '@/components/ui/skeleton';

export default function NewsDetailLoading() {
  return (
    <div className='mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8'>
      {/* Back + badge */}
      <div className='mb-6 flex items-center justify-between'>
        <Skeleton className='h-5 w-40' />
        <Skeleton className='h-6 w-24 rounded-full' />
      </div>

      {/* Hero image */}
      <Skeleton className='mb-8 aspect-[16/9] w-full rounded-lg' />

      {/* Title */}
      <Skeleton className='mb-2 h-10 w-full' />
      <Skeleton className='mb-4 h-10 w-3/4' />

      {/* Meta */}
      <div className='mb-6 flex gap-4'>
        <Skeleton className='h-5 w-32' />
        <Skeleton className='h-5 w-28' />
        <Skeleton className='ml-auto h-5 w-28' />
      </div>

      <Skeleton className='mb-6 h-px w-full' />

      {/* Description */}
      <Skeleton className='mb-2 h-6 w-full' />
      <Skeleton className='mb-2 h-6 w-full' />
      <Skeleton className='mb-6 h-6 w-2/3' />

      {/* Content */}
      <Skeleton className='mb-2 h-5 w-full' />
      <Skeleton className='mb-2 h-5 w-full' />
      <Skeleton className='mb-2 h-5 w-full' />
      <Skeleton className='mb-2 h-5 w-4/5' />
      <Skeleton className='mb-2 h-5 w-full' />
      <Skeleton className='h-5 w-3/5' />
    </div>
  );
}
