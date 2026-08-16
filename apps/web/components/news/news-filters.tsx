'use client';

import { useTranslations } from 'next-intl';
import { Category } from '@newranews/types';
import { cn } from '@/lib/utils';

interface NewsFiltersProps {
  selected: Category | null;
  onChange: (category: Category | null) => void;
}

export function NewsFilters({ selected, onChange }: NewsFiltersProps) {
  const t = useTranslations('categories');
  const tCommon = useTranslations('common');

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
        {tCommon('all')}
      </button>
      {Object.values(Category).map((key) => (
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
          {t(key)}
        </button>
      ))}
    </div>
  );
}
