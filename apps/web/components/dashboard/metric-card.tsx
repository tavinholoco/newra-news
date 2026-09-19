import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import type { KpiDelta } from '@/lib/kpi';
import { cn } from '@/lib/utils';

interface MetricCardProps {
  label: string;
  value: string | number;
  hint?: string;
  /**
   * A variação (§4.2 do plano de observabilidade). `null` é cartão sem chip —
   * o caso em que não há linha de base honesta —, e é decisão do chamador,
   * via `kpiDelta`.
   */
  delta?: KpiDelta | null;
}

const DELTA_ICON = {
  up: ArrowUpRight,
  down: ArrowDownRight,
  flat: Minus,
} as const;

/**
 * A cor diz se a direção é boa, não para onde ela aponta: duração do pipeline
 * subindo é vermelho com seta para cima. `neutral` fica no texto secundário
 * pela mesma razão do `RUNNING` do `StatusPill` — verde afirmaria melhora.
 */
const DELTA_TONE = {
  better: 'text-success',
  worse: 'text-danger',
  neutral: 'text-ink-secondary',
} as const;

/**
 * O chip da variação, sozinho — seta e número no tom da direção. Extraído do
 * cartão na Fase 11, quando a tabela de fontes passou a mostrar a mesma
 * variação por linha; `period` é opcional porque numa coluna o cabeçalho já
 * diz contra o quê.
 */
export function DeltaChip({ delta, withPeriod = true }: { delta: KpiDelta; withPeriod?: boolean }) {
  const Icon = DELTA_ICON[delta.direction];
  return (
    <span className='inline-flex flex-wrap items-center gap-x-1 text-xs'>
      <span
        className={cn(
          'inline-flex items-center gap-0.5 font-semibold tabular-nums',
          DELTA_TONE[delta.tone],
        )}
      >
        <Icon aria-hidden='true' className='h-3 w-3' />
        {delta.text}
      </span>
      {withPeriod && <span className='text-muted-foreground'>{delta.period}</span>}
    </span>
  );
}

export function MetricCard({ label, value, hint, delta }: MetricCardProps) {
  return (
    <Card className='h-full gap-2'>
      <CardContent>
        <p className='text-xs font-medium uppercase tracking-wider text-muted-foreground'>
          {label}
        </p>
        <p className='font-display mt-1 text-2xl font-bold text-foreground sm:text-3xl'>
          {value}
        </p>
        {delta && (
          <p className='mt-1'>
            <DeltaChip delta={delta} />
          </p>
        )}
        {hint && <p className='mt-1 text-xs text-muted-foreground'>{hint}</p>}
      </CardContent>
    </Card>
  );
}
