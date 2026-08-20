import { cn } from '@/lib/utils';

/**
 * Geometria da marca, em `currentColor`. É a mesma de
 * `public/logo/logo-mono.svg` — aqui inline porque o masthead precisa que a
 * cor herde do contexto (rodapé escuro, tema escuro, hover) e um `<img>` não
 * herda `color`.
 *
 * O `viewBox` é justo, sem padding: o espaçamento é do CSS, o que maximiza a
 * área visual a 24 px (§40.3).
 */
const MARK_PATH =
  'M0 112L0 1200A112 112 0 0 0 224 1200L224 112A112 112 0 0 0 0 112ZM30.44 188.76L286.44 460.76A112 112 0 0 0 449.56 307.24L193.56 35.24A112 112 0 0 0 30.44 188.76ZM960 112L960 1200A112 112 0 0 0 1184 1200L1184 112A112 112 0 0 0 960 112ZM1153.56 1123.24L897.56 851.24A112 112 0 0 0 734.44 1004.76L990.44 1276.76A112 112 0 0 0 1153.56 1123.24ZM592 362C592 541.34 706.66 656 886 656C706.66 656 592 770.66 592 950C592 770.66 477.34 656 298 656C477.34 656 592 541.34 592 362Z';

/**
 * A marca sozinha. Decorativa por padrão: quem a acompanha de um wordmark em
 * texto não deve anunciar o nome duas vezes ao leitor de tela.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox='0 0 1184 1312'
      fill='none'
      aria-hidden='true'
      focusable='false'
      className={cn('h-6 w-auto shrink-0', className)}
    >
      <path fill='currentColor' fillRule='evenodd' d={MARK_PATH} />
    </svg>
  );
}

interface LogoProps {
  /**
   * `full` mostra o wordmark ao lado da marca; `mark` mostra só a marca.
   * `responsive` esconde o wordmark abaixo de `sm` — é o comportamento do
   * masthead mobile da §10: "o wordmark some, a marca fica".
   */
  variant?: 'full' | 'mark' | 'responsive';
  /** Cor da marca. `brand` a fixa em `--brand-mark`; `inherit` herda. */
  tone?: 'brand' | 'inherit';
  className?: string;
  markClassName?: string;
  wordmarkClassName?: string;
}

/**
 * Lockup do Newra News: marca + wordmark **tipográfico** (§40.3-A).
 *
 * O wordmark é texto de verdade na fonte de interface, não um SVG com o nome
 * em curvas. Isso o mantém selecionável, encontrável no Ctrl+F e lido por
 * leitor de tela sem depender de `aria-label`, e faz o responsivo sair de
 * graça — o texto some no mobile por media query, sem um segundo arquivo.
 *
 * O lockup desenhado (§40.3-B) foi adiado, não descartado: trocar é substituir
 * este `<span>` por um SVG inline, aqui dentro e em mais lugar nenhum.
 */
export function Logo({
  variant = 'responsive',
  tone = 'brand',
  className,
  markClassName,
  wordmarkClassName,
}: LogoProps) {
  const showWordmark = variant !== 'mark';

  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <LogoMark
        className={cn(tone === 'brand' && 'text-brand-mark', markClassName)}
      />
      {showWordmark ? (
        <span
          className={cn(
            // Sans, não a serif das manchetes: a §5 põe navegação em sans, e a
            // §40.3 fixa o wordmark na fonte de interface.
            'font-sans text-lg font-bold leading-none tracking-tight',
            variant === 'responsive' && 'hidden sm:inline',
            wordmarkClassName,
          )}
        >
          Newra News
        </span>
      ) : null}
      {/* No mobile o wordmark some e sobra só a marca, que é `aria-hidden`.
          Sem isso o link do masthead ficaria sem nome acessível. */}
      {variant === 'responsive' ? (
        <span className='sr-only sm:hidden'>Newra News</span>
      ) : null}
      {variant === 'mark' ? <span className='sr-only'>Newra News</span> : null}
    </span>
  );
}
