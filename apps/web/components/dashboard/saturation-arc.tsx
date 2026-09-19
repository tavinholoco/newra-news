'use client';

import { useLocale } from 'next-intl';
import { formatRatio } from '@/lib/format';
import { toDateFormatLocale } from '@/lib/i18n';
import { saturationTone, type SaturationTone } from '@/lib/saturation';
import { cn } from '@/lib/utils';

interface SaturationArcProps {
  /** A razão medida sobre o teto. **`null` é "indisponível"**, nunca zero. */
  ratio: number | null;
  /** O nome da medida: "Horas do plano", "Memória". */
  label: string;
  /** O que vai debaixo do percentual: `305 h / 750 h`. */
  value: string | null;
  /** O texto do estado indisponível — a tela decide o que dizer. */
  unavailableText: string;
  size?: 'lg' | 'sm';
}

/** Três quartos de volta: o arco começa às 7h30 do relógio e termina às 4h30. */
const RADIUS = 40;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const SWEEP = 0.75;
const TRACK = CIRCUMFERENCE * SWEEP;

/**
 * O acento da §4.2, e só ele: neutro até 80%, laranja de atenção até o teto,
 * vermelho de estado quando passa. O laranja é `--brand-accent` porque aqui
 * ele é traço, não texto (o aviso dos tokens vale para texto).
 */
const STROKE: Record<SaturationTone, string> = {
  neutral: 'stroke-chart-4',
  attention: 'stroke-brand-accent',
  exceeded: 'stroke-danger',
};

const TEXT: Record<SaturationTone, string> = {
  neutral: 'text-ink',
  attention: 'text-link',
  exceeded: 'text-danger',
};

/**
 * O arco único da §4.3 — o medidor que faltava em 29/08/2026.
 *
 * Um `<circle>` com `stroke-dasharray` recortado a três quartos de volta, o
 * preenchimento por cima na mesma geometria, e o número no meio. **Sem
 * animação de entrada** — não há transição a respeitar, então não há
 * `prefers-reduced-motion` a consultar.
 *
 * **`ratio` nulo desenha o trilho vazio e escreve "indisponível".** É o caso
 * das horas do plano com o banco fora (a única medida que sai do banco), e a
 * verificação pós-merge do 5b foi explícita: a tela desenha indisponível,
 * **nunca zero** — zero diria que o mês está folgado justamente quando não há
 * como saber.
 */
export function SaturationArc({ ratio, label, value, unavailableText, size = 'lg' }: SaturationArcProps) {
  const locale = toDateFormatLocale(useLocale());
  const tone = ratio === null ? 'neutral' : saturationTone(ratio);
  const filled = ratio === null ? 0 : Math.min(Math.max(ratio, 0), 1) * TRACK;
  const percentText = ratio === null ? '—' : formatRatio(ratio, locale);

  return (
    <figure className={cn('flex flex-col items-center', size === 'lg' ? 'gap-2' : 'gap-1')}>
      <svg
        viewBox='0 0 100 100'
        role='img'
        aria-label={`${label}: ${ratio === null ? unavailableText : `${percentText}${value ? ` (${value})` : ''}`}`}
        className={cn('shrink-0', size === 'lg' ? 'h-40 w-40' : 'h-24 w-24')}
      >
        <circle
          cx='50'
          cy='50'
          r={RADIUS}
          fill='none'
          strokeWidth='10'
          strokeLinecap='round'
          strokeDasharray={`${TRACK} ${CIRCUMFERENCE}`}
          transform='rotate(135 50 50)'
          className='stroke-line'
        />
        {filled > 0 && (
          <circle
            cx='50'
            cy='50'
            r={RADIUS}
            fill='none'
            strokeWidth='10'
            strokeLinecap='round'
            strokeDasharray={`${filled} ${CIRCUMFERENCE}`}
            transform='rotate(135 50 50)'
            className={STROKE[tone]}
          />
        )}
        <text
          x='50'
          y='50'
          textAnchor='middle'
          dominantBaseline='central'
          className={cn(
            'font-display font-bold',
            size === 'lg' ? 'text-[22px]' : 'text-[18px]',
            ratio === null ? 'fill-ink-muted' : `fill-current ${TEXT[tone]}`,
          )}
        >
          {percentText}
        </text>
      </svg>
      <figcaption className='text-center'>
        <p className='text-xs font-medium uppercase tracking-wider text-muted-foreground'>{label}</p>
        <p className={cn('mt-0.5 tabular-nums', size === 'lg' ? 'text-sm text-ink' : 'text-xs text-ink-secondary')}>
          {ratio === null ? unavailableText : value}
        </p>
      </figcaption>
    </figure>
  );
}
