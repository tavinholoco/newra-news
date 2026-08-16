import { Skeleton } from '@/components/ui/skeleton';

export function DashboardSkeleton() {
  return (
    <div className='flex flex-col gap-10'>
      {/* Hoje */}
      <section>
        <Skeleton className='mb-4 h-7 w-28' />
        <div className='grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5'>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className='flex flex-col gap-2 rounded-xl border p-4'>
              <Skeleton className='h-3 w-24' />
              <Skeleton className='h-8 w-16' />
            </div>
          ))}
        </div>
      </section>

      {/* Últimos 7 dias */}
      <section>
        <Skeleton className='mb-4 h-7 w-36' />
        <div className='grid grid-cols-2 gap-4 md:grid-cols-4'>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className='flex flex-col gap-2 rounded-xl border p-4'>
              <Skeleton className='h-3 w-24' />
              <Skeleton className='h-8 w-16' />
            </div>
          ))}
        </div>
      </section>

      {/* Por categoria */}
      <section>
        <Skeleton className='mb-4 h-7 w-56' />
        <div className='flex flex-col gap-3'>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className='flex items-center gap-3'>
              <Skeleton className='h-4 w-28' />
              <Skeleton className='h-2.5 flex-1 rounded-full' />
              <Skeleton className='h-4 w-14' />
            </div>
          ))}
        </div>
      </section>

      {/* Últimos 30 dias */}
      <section>
        <Skeleton className='mb-4 h-7 w-36' />
        <div className='grid grid-cols-2 gap-4 md:grid-cols-4'>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className='flex flex-col gap-2 rounded-xl border p-4'>
              <Skeleton className='h-3 w-24' />
              <Skeleton className='h-8 w-16' />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
