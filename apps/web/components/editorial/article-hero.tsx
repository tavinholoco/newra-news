import type { ReactNode } from 'react';
import { StoryImage } from '@/components/editorial/story-image';
import { cn } from '@/lib/utils';

interface ArticleHeroProps {
  /** Linha acima da manchete: a categoria, na notícia; o selo, no briefing. */
  kicker: ReactNode;
  title: string;
  /** Subtítulo — `description` na notícia, `summary` no briefing. */
  dek?: string | null;
  /** A linha de metadata. Cada tela monta a sua: as duas não têm os mesmos campos. */
  meta: ReactNode;
  /** Compartilhar, favoritar, ler na fonte. */
  actions?: ReactNode;
  /**
   * Só a notícia tem imagem; o briefing não tem uma para chamar de sua.
   *
   * **`src` nulo desenha nada**, e não o placeholder de marca. Um quarto do
   * acervo não tem foto (1.703 das 6.669, medido em 25/08), e essas telas
   * abriam com um retângulo laranja de largura cheia entre a metadata e o
   * texto. Jornal com matéria sem foto não desenha uma moldura vazia — ele
   * começa pelo texto.
   */
  image?: { src: string | null; alt: string } | null;
  className?: string;
}

/**
 * A abertura das duas telas de artigo, na ordem da §8: categoria, manchete,
 * subtítulo, metadata, ações, imagem.
 *
 * **É uma casca com encaixes, não um componente com um `variant`.** As duas
 * telas compartilham a composição e quase nada do conteúdo: a notícia tem
 * categoria, fonte externa e favoritar; o briefing tem selo de IA, contagem de
 * fontes e nenhuma imagem. Um `variant='news' | 'briefing'` acabaria como dois
 * componentes dentro de um `if`, com a assinatura de ambos somada.
 *
 * **A imagem vem depois da metadata**, e é a ordem da §8. Numa tela de leitura o
 * leitor decide se entra pelo título e pela procedência, não pela foto — e a
 * imagem antes empurraria o `h1` para fora da dobra no mobile.
 */
export function ArticleHero({
  kicker,
  title,
  dek,
  meta,
  actions,
  image,
  className,
}: ArticleHeroProps) {
  return (
    <header className={cn('flex flex-col', className)}>
      {kicker}

      <h1 className='mt-3 max-w-prose font-display text-h1 font-bold text-ink'>
        {title}
      </h1>

      {dek ? (
        <p className='mt-4 max-w-prose text-body-lg text-ink-secondary'>{dek}</p>
      ) : null}

      {/* `gap-y-3` e `flex-wrap`: no mobile as ações caem para a linha de baixo
          em vez de espremerem a metadata até quebrar dentro da palavra. */}
      <div className='mt-6 flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-y border-line py-4'>
        {meta}
        {actions ? (
          <div className='flex shrink-0 items-center gap-2'>{actions}</div>
        ) : null}
      </div>

      {image?.src ? (
        <StoryImage
          src={image.src}
          alt={image.alt}
          sizes='(max-width: 1024px) 100vw, 768px'
          priority
          placeholderSize='lg'
          zoomOnHover={false}
          className='mt-8 rounded-lg'
        />
      ) : null}
    </header>
  );
}
