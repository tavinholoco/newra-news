import { Skeleton } from '@/components/ui/skeleton';

interface NewsListSkeletonProps {
  /** Reserva o espaço do hero. Falso quando a lista já é uma página interna. */
  showLead?: boolean;
}

/**
 * O esqueleto da lista (§28, "skeletons").
 *
 * **Espelha o `NewsList`, não um grid genérico.** Um esqueleto com forma
 * diferente da tela que ele antecede troca a espera por um salto de layout no
 * momento em que o dado chega, que é justamente o que ele existe para evitar.
 *
 * `aria-hidden` e sem `role="status"`: quem usa leitor de tela não ganha nada
 * com a descrição de caixas cinza. O anúncio de "carregando" e o de "N
 * resultados" ficam na região viva da própria listagem.
 */
export function NewsListSkeleton({ showLead = true }: NewsListSkeletonProps) {
  return (
    <div aria-hidden='true' className='flex flex-col gap-section'>
      {showLead ? (
        <div className='grid gap-block lg:grid-cols-3'>
          <div className='flex flex-col gap-4 lg:col-span-2'>
            <Skeleton className='aspect-[16/9] w-full rounded-lg' />
            <Skeleton className='h-8 w-11/12' />
            <Skeleton className='h-5 w-full' />
            <Skeleton className='h-4 w-2/5' />
          </div>

          <ul className='flex flex-col divide-y divide-line'>
            {Array.from({ length: 3 }).map((_, index) => (
              <li key={index} className='flex gap-3 py-4 first:pt-0 last:pb-0'>
                <Skeleton className='aspect-[4/3] w-24 shrink-0 rounded-md' />
                <div className='flex min-w-0 flex-1 flex-col gap-2'>
                  <Skeleton className='h-3 w-16' />
                  <Skeleton className='h-4 w-full' />
                  <Skeleton className='h-4 w-3/4' />
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div>
        <Skeleton className='mb-6 h-6 w-32' />
        <ul className='grid grid-cols-1 gap-x-8 md:grid-cols-2'>
          {Array.from({ length: 6 }).map((_, index) => (
            <li key={index} className='flex gap-3 border-b border-line py-4'>
              <Skeleton className='aspect-[4/3] w-24 shrink-0 rounded-md' />
              <div className='flex min-w-0 flex-1 flex-col gap-2'>
                <Skeleton className='h-3 w-16' />
                <Skeleton className='h-4 w-full' />
                <Skeleton className='h-4 w-3/4' />
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
