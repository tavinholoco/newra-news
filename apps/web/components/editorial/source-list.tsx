'use client';

import { useId } from 'react';
import { useTranslations } from 'next-intl';
import { ExternalLink } from 'lucide-react';
import type { BriefingSource } from '@newranews/types';
import { SectionHeading } from '@/components/editorial/section-heading';

interface SourceListProps {
  sources: BriefingSource[];
}

/**
 * As notícias que originaram o briefing (§8, "fontes consultadas").
 *
 * **Cada item leva para a fonte original, não para `/news/[id]`.** Duas razões,
 * e a segunda é decisiva:
 *
 * 1. a §8 pede explicitamente que o leitor possa consultar a fonte original
 *    para o contexto completo — é isso que a seção existe para permitir;
 * 2. `newsId` é ponteiro fraco. O cleanup apaga `News` aos 30 dias e o briefing
 *    vive 90, então em dois terços dos artigos retidos o link interno daria
 *    404 — vindo justamente da seção cuja função é sustentar confiança.
 *
 * Devolve `null` com lista vazia: os briefings anteriores à migration de
 * auditoria (20/08/2026) não têm fontes registradas, e não havia como
 * preenchê-las retroativamente. Seção com título e nada dentro é pior que seção
 * nenhuma.
 */
export function SourceList({ sources }: SourceListProps) {
  const t = useTranslations('article');
  const headingId = useId();

  if (sources.length === 0) return null;

  return (
    <section aria-labelledby={headingId}>
      <SectionHeading id={headingId} title={t('sourcesTitle')} />

      {/* `<ol>` porque a ordem é dado: é a sequência em que as matérias foram
          enviadas à IA, e `position` a preserva. */}
      <ol className='flex flex-col divide-y divide-line'>
        {sources.map((source) => (
          <li key={source.id} className='py-3 first:pt-0 last:pb-0'>
            <a
              href={source.sourceUrl}
              target='_blank'
              rel='noopener noreferrer'
              className='group flex items-start gap-3'
            >
              {/* `aria-hidden`: a posição já é semântica pelo `<ol>`, e ouvir
                  "3" antes da manchete é a mesma informação duas vezes. */}
              <span
                aria-hidden='true'
                className='mt-0.5 w-6 shrink-0 font-display text-meta font-bold tabular-nums text-ink-muted'
              >
                {source.position + 1}
              </span>

              <span className='min-w-0 flex-1'>
                <span className='block font-display text-body font-semibold leading-snug text-ink transition-colors duration-base group-hover:text-link'>
                  {source.title}
                </span>
                <span className='mt-1 block text-meta text-ink-muted'>
                  {source.source}
                </span>
              </span>

              <ExternalLink
                className='mt-1 size-3.5 shrink-0 text-ink-muted transition-colors duration-base group-hover:text-link'
                aria-hidden='true'
              />
            </a>
          </li>
        ))}
      </ol>
    </section>
  );
}
