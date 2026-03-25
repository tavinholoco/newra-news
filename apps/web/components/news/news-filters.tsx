'use client';

import type { Category } from '@newranews/types';
import { cn } from '@/lib/utils';
import { CATEGORY_LABELS } from '@/lib/format';

interface NewsFiltersProps {
  selected: Category | null;
  onChange: (category: Category | null) => void;
}

export function NewsFilters({ selected, onChange }: NewsFiltersProps) {
  return (
    <div className='flex flex-wrap gap-2'>
      <button
        onClick={() => onChange(null)}
        className={cn(
          'rounded-full px-4 py-1.5 text-sm font-medium transition-colors',
          selected === null
            ? 'bg-primary text-primary-foreground'
            : 'bg-muted text-muted-foreground hover:bg-muted/80',
        )}
      >
        Todas
      </button>
      {(Object.entries(CATEGORY_LABELS) as [Category, string][]).map(
        ([key, label]) => (
          <button
            key={key}
            onClick={() => onChange(key)}
            className={cn(
              'rounded-full px-4 py-1.5 text-sm font-medium transition-colors',
              selected === key
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80',
            )}
          >
            {label}
          </button>
        ),
      )}
    </div>
  );
}
