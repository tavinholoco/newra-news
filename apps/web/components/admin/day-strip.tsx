'use client';

import { cn } from '@/lib/utils';

/**
 * Um quadrado da faixa: o dia, o preenchimento e o texto que o descreve.
 *
 * `fill` é a classe de preenchimento **e de forma** — cheio, contorno com
 * miolo fraco, vazado. Quem mapeia estado → classe é o chamador, porque cada
 * série tem o seu conjunto de estados: o desfecho do run
 * (`SUCCESS` · `SUCCESS_DEGRADED` · `FAILED` · `RUNNING` · `NEVER_RAN`) e o
 * desfecho de uma fonte (`OK` · `EMPTY` · `FAILED` · não tentada) não são o
 * mesmo tipo, e a casca é o que os dois têm em comum.
 */
export interface DayStripDay {
  /** A chave do dia (`YYYY-MM-DD`) — única na faixa. */
  key: string;
  /** Classe(s) Tailwind de preenchimento e forma. */
  fill: string;
  /** O texto completo — para leitor de tela e para o `title`. */
  label: string;
}

export interface DayStripLegendItem {
  key: string;
  fill: string;
  label: string;
}

interface DayStripProps {
  days: DayStripDay[];
  /** O nome acessível da lista. */
  label: string;
  /**
   * Os rótulos das pontas (o primeiro e o último dia), já formatados. Sem
   * eles a faixa sai só com os quadrados — é a forma **compacta**, para uma
   * linha de tabela em que a coluna vizinha já diz o dia.
   */
  ends?: { first: string; last: string };
  /** A legenda, uma vez por painel; numa tabela com treze faixas ela mora fora. */
  legend?: DayStripLegendItem[];
  /** Altura dos quadrados. A compacta é a de linha de tabela. */
  size?: 'default' | 'compact';
  className?: string;
}

/**
 * A casca da faixa de 30 dias — um quadrado por dia. (§12 e §15 do plano de
 * observabilidade; extraída da `OutcomeStrip` da Fase 8 na Fase 11)
 *
 * É o painel de maior densidade de informação por pixel do plano inteiro:
 * três semanas de saúde num relance, e o buraco de 29–31/08 (a API suspensa
 * por horas do plano) aparece como três quadrados vazados. **A forma carrega
 * o estado junto com a cor** (armadilha 35): no tema escuro o laranja do
 * degradado e o vermelho do falhou eram a mesma cor a olho num quadrado de
 * 20 px, e dois estados em cinza seriam um só — daí cheio, contorno com miolo
 * fraco, e vazado.
 *
 * Sem biblioteca, como o resto dos gráficos de admin (§4.3): são `<li>` de
 * largura fluida, para caberem em 375 px sem rolagem. Cada um leva o dia e o
 * estado num texto só para leitor de tela — trinta rótulos visíveis não
 * caberiam — e o mesmo texto em `title`, para quem passa o mouse.
 */
export function DayStrip({ days, label, ends, legend, size = 'default', className }: DayStripProps) {
  return (
    // `max-w-narrow` (45rem): trinta quadrados de ~20 px em tela larga, e a
    // largura inteira em 375 px. Sem o teto, a faixa esticaria até 80rem e cada
    // quadrado viraria uma barra.
    <div className={cn('max-w-narrow', className)}>
      <ol aria-label={label} className='flex gap-1'>
        {days.map((day) => (
          <li key={day.key} className='min-w-0 flex-1'>
            <span className='sr-only'>{day.label}</span>
            <div
              aria-hidden='true'
              title={day.label}
              className={cn('w-full rounded-sm', size === 'compact' ? 'h-3' : 'h-4', day.fill)}
            />
          </li>
        ))}
      </ol>
      {ends && (
        <div aria-hidden='true' className='mt-1 flex justify-between text-xs text-ink-muted'>
          <span>{ends.first}</span>
          {days.length > 1 && <span>{ends.last}</span>}
        </div>
      )}
      {legend && legend.length > 0 && (
        <ul className='mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-secondary'>
          {legend.map((item) => (
            <li key={item.key} className='inline-flex items-center gap-1.5'>
              <span aria-hidden='true' className={cn('h-2.5 w-2.5 rounded-sm', item.fill)} />
              {item.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
