'use client';

import { Calendar } from 'lucide-react';
import { useLocale } from 'next-intl';
import { cn } from '@/lib/utils';
import { formatDate } from '@/lib/format';
import { toDateFormatLocale } from '@/lib/i18n';
import { ReadingTime } from '@/components/editorial/reading-time';
import { SourceBadge } from '@/components/editorial/source-badge';

interface ArticleMetaProps {
  source?: string;
  /** Link externo do veículo. Omita dentro de cards clicáveis (âncora aninhada). */
  sourceHref?: string;
  /** ISO string. Renderizada em `<time dateTime>` para máquinas lerem também. */
  publishedAt?: string;
  readingTimeMinutes?: number;
  /** `meta` nos cards, `body-sm` na página da matéria. */
  size?: 'meta' | 'body-sm';
  className?: string;
}

/**
 * A linha de metadata de uma matéria: veículo, data e tempo de leitura (§11).
 *
 * Existe para que Home, listagem e página de matéria não escrevam três
 * versões da mesma linha — é o que acontece hoje entre `news-card` e
 * `news-detail`. Cada peça é opcional: o componente só emite o que recebeu.
 */
export function ArticleMeta({
  source,
  sourceHref,
  publishedAt,
  readingTimeMinutes,
  size = 'meta',
  className,
}: ArticleMetaProps) {
  const locale = useLocale();
  const hasContent = Boolean(source || publishedAt || readingTimeMinutes);

  if (!hasContent) return null;

  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-x-4 gap-y-1 text-ink-muted',
        size === 'meta' ? 'text-meta' : 'text-body-sm',
        className,
      )}
    >
      {source ? <SourceBadge source={source} href={sourceHref} /> : null}

      {publishedAt ? (
        <time
          dateTime={publishedAt}
          className='inline-flex items-center gap-1.5'
        >
          <Calendar className='size-3.5 shrink-0' aria-hidden='true' />
          {formatDate(publishedAt, toDateFormatLocale(locale))}
        </time>
      ) : null}

      {readingTimeMinutes ? <ReadingTime minutes={readingTimeMinutes} /> : null}
    </div>
  );
}
