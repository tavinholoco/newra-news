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
 * Existe porque cerca de 30% do acervo não tem imagem — limitação conhecida
 * dos feeds RSS, registrada nos contratos (§3). Sem um lugar só para essa
 * decisão, cada card reescreve o mesmo IIFE com o mesmo gradiente e o mesmo
 * "N", que foi o que aconteceu na V1.
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
