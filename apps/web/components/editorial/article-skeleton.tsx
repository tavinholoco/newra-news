import { Skeleton } from '@/components/ui/skeleton';

interface ArticleSkeletonProps {
  /** Reserva a caixa da imagem do hero. O briefing não tem uma. */
  showImage?: boolean;
}

/**
 * A espera das duas telas de artigo.
 *
 * Espelha o `ArticleHero` seguido do corpo na medida de leitura. Um esqueleto de
 * forma diferente da tela que ele antecede troca a espera por um salto de
 * layout no momento em que o dado chega — que é o que ele existe para evitar.
 *
 * `aria-hidden`: quem usa leitor de tela não ganha nada com a descrição de
 * caixas cinza.
 */
export function ArticleSkeleton({ showImage = false }: ArticleSkeletonProps) {
  return (
    <div aria-hidden='true' className='mx-auto w-full max-w-narrow'>
      <Skeleton className='h-5 w-36' />

      <Skeleton className='mt-6 h-5 w-28 rounded-full' />
      <Skeleton className='mt-3 h-10 w-full' />
      <Skeleton className='mt-2 h-10 w-3/4' />

      <Skeleton className='mt-4 h-6 w-full' />
      <Skeleton className='mt-2 h-6 w-2/3' />

      <div className='mt-6 flex flex-wrap items-center justify-between gap-4 border-y border-line py-4'>
        <Skeleton className='h-5 w-56' />
        <Skeleton className='h-9 w-32' />
      </div>

      {showImage ? (
        <Skeleton className='mt-8 aspect-[16/9] w-full rounded-lg' />
      ) : null}

      <div className='mt-10 flex flex-col gap-3'>
        {Array.from({ length: 8 }).map((_, index) => (
          <Skeleton
            key={index}
            className={index % 4 === 3 ? 'h-5 w-3/5' : 'h-5 w-full'}
          />
        ))}
      </div>
    </div>
  );
}
