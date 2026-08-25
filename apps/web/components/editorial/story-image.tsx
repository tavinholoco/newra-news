'use client';

import { SafeImage } from '@/components/ui/safe-image';
import { cn } from '@/lib/utils';

interface StoryImageProps {
  /** `imageUrl` da matéria; `null` cai no placeholder de marca. */
  src: string | null;
  alt: string;
  /** Obrigatório: `fill` sem `sizes` faz o Next baixar a maior variante. */
  sizes: string;
  /** Só para a imagem do hero — é o LCP da Home. */
  priority?: boolean;
  /** Proporção da caixa. O hero usa 16/9; os cards horizontais, 4/3. */
  aspect?: 'video' | 'photo';
  /** Escala da letra do placeholder: `lg` no hero, `sm` nos cards. */
  placeholderSize?: 'sm' | 'md' | 'lg';
  /** Zoom no hover — depende de um `group` no ancestral clicável. */
  zoomOnHover?: boolean;
  className?: string;
}

const ASPECT: Record<NonNullable<StoryImageProps['aspect']>, string> = {
  video: 'aspect-[16/9]',
  photo: 'aspect-[4/3]',
};

const PLACEHOLDER_TEXT: Record<
  NonNullable<StoryImageProps['placeholderSize']>,
  string
> = {
  sm: 'text-h4',
  md: 'text-h2',
  lg: 'text-display',
};

/**
 * A caixa de imagem de uma matéria, com o placeholder de marca embutido.
 *
 * Existe para que a decisão de fallback more num lugar só — sem ele, cada card
 * reescreve o mesmo IIFE com o mesmo gradiente e o mesmo "N", que foi o que
 * aconteceu na V1.
 *
 * **O placeholder mudou de papel na Fase 12, e o `src` nulo quase não chega
 * mais aqui.** Ele nasceu para cobrir o acervo sem foto — cerca de 30%,
 * registrado nos contratos (§3) e medido em 25,5% agora que a ingestão
 * recupera a imagem escondida no corpo. Só que anunciar ausência de foto com um
 * retângulo laranja e um "N", repetido a cada quatro células da grade, gasta o
 * elemento mais pesado da composição para não dizer nada. Quem não tem foto
 * agora é **card de texto**, e nem chama este componente.
 *
 * O que sobra para o placeholder é o caso em que ele sempre foi certo: a foto
 * que **existe e não carrega** — host fora do ar, imagem removida pelo veículo,
 * `next/image` recusando o domínio. Aí a caixa já ocupa espaço no layout e
 * sumir com ela seria salto; o `fallback` do `SafeImage` a preenche.
 *
 * O ramo de `src` nulo continua aqui porque o componente é público e nada
 * impede um uso novo de passar nulo — mas nenhum card do produto passa.
 */
export function StoryImage({
  src,
  alt,
  sizes,
  priority = false,
  aspect = 'video',
  placeholderSize = 'md',
  zoomOnHover = true,
  className,
}: StoryImageProps) {
  const placeholder = (
    <div
      role='img'
      aria-label='Newra News'
      className='flex h-full w-full items-center justify-center bg-gradient-to-br from-brand-mark to-brand-mark-soft'
    >
      <span
        className={cn(
          'font-display font-bold text-on-brand/80',
          PLACEHOLDER_TEXT[placeholderSize],
        )}
      >
        N
      </span>
    </div>
  );

  return (
    <div
      className={cn(
        'relative w-full overflow-hidden bg-surface',
        ASPECT[aspect],
        className,
      )}
    >
      {src ? (
        <SafeImage
          src={src}
          alt={alt}
          fill
          sizes={sizes}
          priority={priority}
          className={cn(
            'object-cover',
            zoomOnHover &&
              'transition-transform duration-slow ease-standard group-hover:scale-105 motion-reduce:transform-none motion-reduce:transition-none',
          )}
          fallback={placeholder}
        />
      ) : (
        placeholder
      )}
    </div>
  );
}
