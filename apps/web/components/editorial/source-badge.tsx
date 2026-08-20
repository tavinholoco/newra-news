'use client';

import { Globe } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';

interface SourceBadgeProps {
  /** Nome do veículo, como veio da API (`news.source`). */
  source: string;
  /**
   * URL da matéria original. Quando presente, o veículo vira link externo.
   *
   * **Não passe `href` dentro de um card que já é um link** — âncora aninhada
   * é HTML inválido e o Next quebra a navegação. Nos cards use só `source`.
   */
  href?: string;
  showIcon?: boolean;
  className?: string;
}

/**
 * Atribuição de fonte de uma matéria (§11 do plano V2).
 *
 * Não é um `Badge` do shadcn: o veículo é crédito editorial, não rótulo de
 * status. O `Badge` sólido continua sendo da categoria.
 */
export function SourceBadge({
  source,
  href,
  showIcon = true,
  className,
}: SourceBadgeProps) {
  const t = useTranslations('editorial');
  const content = (
    <>
      {showIcon ? <Globe className='size-3.5 shrink-0' aria-hidden='true' /> : null}
      <span className='truncate'>{source}</span>
    </>
  );

  if (!href) {
    return (
      <span className={cn('inline-flex min-w-0 items-center gap-1.5 font-medium', className)}>
        {content}
      </span>
    );
  }

  return (
    <a
      href={href}
      target='_blank'
      rel='noopener noreferrer'
      aria-label={t('sourceLabel', { source })}
      title={t('sourceLabel', { source })}
      className={cn(
        'inline-flex min-w-0 items-center gap-1.5 font-medium transition-colors duration-fast hover:text-link-hover',
        className,
      )}
    >
      {content}
    </a>
  );
}
