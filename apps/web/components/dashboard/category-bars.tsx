'use client';

import { useLocale, useTranslations } from 'next-intl';
import { toDateFormatLocale } from '@/lib/i18n';
import { chartColor } from './chart-colors';

interface CategoryBarsProps {
  data: Record<string, number>;
  labels?: Record<string, string>;
}

/**
 * Barras horizontais **ordenadas por valor** — a maior em cima.
 *
 * A ordenação é a razão de o componente existir, e por isso ele **não** ganhou
 * um parâmetro para preservá-la: série temporal, que precisa da ordem dada, é o
 * `SeriesBars` (§9 do plano de observabilidade).
 */
export function CategoryBars({ data, labels }: CategoryBarsProps) {
  const t = useTranslations('dashboard');
  const locale = useLocale();
  const entries = Object.entries(data).sort((a, b) => b[1] - a[1]);

  if (entries.length === 0) {
    return (
      <p className='text-sm text-muted-foreground'>
        {t('noData')}
      </p>
    );
  }

  const max = Math.max(...entries.map(([, count]) => count));

  return (
    <ul className='flex flex-col gap-3'>
      {entries.map(([key, count], index) => (
        <li key={key} className='flex items-center gap-3'>
          <span className='w-28 shrink-0 truncate text-sm text-muted-foreground'>
            {labels?.[key] ?? key}
          </span>
          <div className='h-2.5 flex-1 overflow-hidden rounded-full bg-muted'>
            <div
              className={`h-full rounded-full ${chartColor(index).bg}`}
              style={{ width: `${(count / max) * 100}%` }}
              role='img'
              aria-label={`${labels?.[key] ?? key}: ${count}`}
            />
          </div>
          <span className='w-14 shrink-0 text-right text-sm font-medium tabular-nums text-foreground'>
            {count.toLocaleString(toDateFormatLocale(locale))}
          </span>
        </li>
      ))}
    </ul>
  );
}
