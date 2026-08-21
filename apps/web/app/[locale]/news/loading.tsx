import { Skeleton } from '@/components/ui/skeleton';
import { NewsListSkeleton } from '@/components/news/news-list-skeleton';

/**
 * Espera da navegação para `/news`.
 *
 * Reusa o `NewsListSkeleton` — o mesmo que o Suspense da página usa — para que
 * a forma da espera seja a mesma nas duas fronteiras. Duas versões do esqueleto
 * é como uma delas para de acompanhar a tela e ninguém percebe.
 */
export default function NewsLoading() {
  return (
    <div className='container-editorial py-section'>
      <div className='flex flex-col gap-6'>
        <div className='border-b border-line-strong pb-6'>
          <Skeleton className='h-10 w-56' />
          <Skeleton className='mt-3 h-6 w-full max-w-prose' />
        </div>

        {/* Busca */}
        <Skeleton className='h-11 w-full rounded-md' />

        {/* Filtro por categoria */}
        <div className='flex gap-2 overflow-hidden'>
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className='h-8 w-24 shrink-0 rounded-full' />
          ))}
        </div>

        <NewsListSkeleton />
      </div>
    </div>
  );
}
