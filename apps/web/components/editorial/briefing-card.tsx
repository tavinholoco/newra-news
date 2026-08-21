'use client';

import { useId } from 'react';
import { useTranslations } from 'next-intl';
import { ArrowRight, Sparkles } from 'lucide-react';
import type { DailyBriefing } from '@newranews/types';
import { Link } from '@/i18n/navigation';
import { ReadingTime } from '@/components/editorial/reading-time';
import { toDateSlug } from '@/lib/format';
import { cn } from '@/lib/utils';

interface BriefingCardProps {
  briefing: DailyBriefing;
  className?: string;
}

/**
 * O "Newra Daily Brief" como peça editorial própria (§6.3).
 *
 * A §6.3 é explícita sobre o que ele **não** deve ser: "um card colorido". O
 * briefing é o diferencial do produto, então ganha superfície própria
 * (`surface-accent`), selo, manchete em escala de seção e a linha de
 * transparência — não a mesma caixa branca das outras matérias.
 *
 * A transparência de IA (§8 do plano, §15 de acessibilidade) é texto normal e
 * não um rodapé cinza minúsculo: `aiDisclosure` vem `true` em todo briefing
 * justamente porque a promessa do produto depende de dizê-lo.
 *
 * `sources` e `generatedAt` são nulos/vazios nos briefings anteriores à
 * migration `add_daily_briefing_metadata` — a contagem cai para
 * `sourceCount`, que sempre existe.
 */
export function BriefingCard({ briefing, className }: BriefingCardProps) {
  const t = useTranslations('home');
  // `useId`: um `id` literal duplica se o bloco for reusado noutra tela.
  const headingId = useId();
  const tCommon = useTranslations('common');

  return (
    <section
      aria-labelledby={headingId}
      className={cn(
        'rounded-lg bg-surface-accent p-6 sm:p-8 lg:p-10',
        className,
      )}
    >
      {/* `text-link`, não `text-brand-accent`: a linha tem texto, e laranja em
          texto é `brand-700` (§4 dos tokens). O ícone acompanha sem prejuízo. */}
      <p className='inline-flex items-center gap-2 text-link'>
        <Sparkles className='size-4 shrink-0' aria-hidden='true' />
        <span className='font-display text-overline font-semibold uppercase'>
          {t('briefKicker')}
        </span>
      </p>

      <h2
        id={headingId}
        className='mt-4 max-w-prose font-display text-h2 font-bold text-ink'
      >
        {briefing.title}
      </h2>

      <p className='mt-3 max-w-prose text-body-lg text-ink-secondary line-clamp-3'>
        {briefing.summary}
      </p>

      <div className='mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-meta text-ink-muted'>
        <span>{tCommon('sourcesConsulted', { count: briefing.sourceCount })}</span>
        <ReadingTime minutes={briefing.readingTimeMinutes} />
      </div>

      <p className='mt-4 max-w-prose text-body-sm text-ink-secondary'>
        {t('briefAiDisclosure')}
      </p>

      <Link
        href={`/article/${toDateSlug(briefing.date)}`}
        className='mt-6 inline-flex items-center gap-1.5 font-display text-body-sm font-semibold text-link transition-colors duration-base hover:text-link-hover'
      >
        {t('briefCta')}
        <ArrowRight className='size-4' aria-hidden='true' />
      </Link>
    </section>
  );
}
