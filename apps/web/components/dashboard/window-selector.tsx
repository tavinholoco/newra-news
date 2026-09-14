'use client';

import { cn } from '@/lib/utils';

interface WindowSelectorProps<T extends string | number> {
  options: readonly T[];
  value: T;
  onChange: (value: T) => void;
  /** O rótulo de cada opção — `7 dias`, `24 h`. */
  optionLabel: (option: T) => string;
  /** O nome acessível do grupo: "Janela das métricas de produto". */
  label: string;
}

/**
 * O seletor de período **por painel** (§4.2 do plano de observabilidade, item
 * 2). Morava solto dentro do `product-metrics-client` desde a Fase 8; virou
 * componente quando a aba de segurança precisou de dois — um para a janela
 * dos erros (24 h / 7 d), outro para a da auditoria (dias) — e cada painel
 * escolhe a sua sem mexer no vizinho.
 *
 * Pílulas com `aria-pressed`, não `<select>`: são no máximo quatro opções, e
 * ver todas de uma vez é o que faz a janela escolhida ser legível na foto.
 */
export function WindowSelector<T extends string | number>({
  options,
  value,
  onChange,
  optionLabel,
  label,
}: WindowSelectorProps<T>) {
  return (
    <div role='group' aria-label={label} className='flex flex-wrap items-center gap-2'>
      {options.map((option) => (
        <button
          key={String(option)}
          type='button'
          onClick={() => onChange(option)}
          aria-pressed={value === option}
          className={cn(
            'rounded-full border px-3 py-1 text-sm transition-colors duration-fast',
            value === option
              ? 'border-line-strong bg-surface-accent font-semibold text-link'
              : 'border-line text-ink-secondary hover:text-link',
          )}
        >
          {optionLabel(option)}
        </button>
      ))}
    </div>
  );
}
