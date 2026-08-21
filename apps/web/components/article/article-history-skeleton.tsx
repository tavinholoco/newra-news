import { Skeleton } from '@/components/ui/skeleton';

/**
 * A espera do histórico, com a forma da lista que ela antecede.
 *
 * `aria-hidden`: quem usa leitor de tela não ganha nada com a descrição de
 * caixas cinza.
 */
export function ArticleHistorySkeleton() {
  return (
    <div aria-hidden='true' className='flex flex-col gap-block'>
      {Array.from({ length: 2 }).map((_, group) => (
        <div key={group}>
          <div className='flex items-baseline justify-between border-b border-line-strong pb-2'>
            <Skeleton className='h-6 w-40' />
            <Skeleton className='h-3 w-20' />
          </div>

          <ul className='divide-y divide-line'>
            {Array.from({ length: 4 }).map((_, item) => (
              <li key={item} className='flex flex-col gap-2 py-5 sm:flex-row sm:gap-8'>
                <Skeleton className='h-3 w-32 shrink-0 sm:w-40' />
                <div className='flex min-w-0 flex-1 flex-col gap-2'>
                  <Skeleton className='h-5 w-11/12' />
                  <Skeleton className='h-4 w-full' />
                  <Skeleton className='h-3 w-24' />
                </div>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
