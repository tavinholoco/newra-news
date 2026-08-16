const BAR_COLORS = [
  'bg-chart-1',
  'bg-chart-2',
  'bg-chart-3',
  'bg-chart-4',
  'bg-chart-5',
] as const;

interface CategoryBarsProps {
  data: Record<string, number>;
  labels?: Record<string, string>;
}

export function CategoryBars({ data, labels }: CategoryBarsProps) {
  const entries = Object.entries(data).sort((a, b) => b[1] - a[1]);

  if (entries.length === 0) {
    return (
      <p className='text-sm text-muted-foreground'>
        Sem dados no período.
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
              className={`h-full rounded-full ${BAR_COLORS[index % BAR_COLORS.length]}`}
              style={{ width: `${(count / max) * 100}%` }}
              role='img'
              aria-label={`${labels?.[key] ?? key}: ${count}`}
            />
          </div>
          <span className='w-14 shrink-0 text-right text-sm font-medium tabular-nums text-foreground'>
            {count.toLocaleString('pt-BR')}
          </span>
        </li>
      ))}
    </ul>
  );
}
