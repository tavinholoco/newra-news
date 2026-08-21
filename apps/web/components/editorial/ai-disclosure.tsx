'use client';

import { useId } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Sparkles } from 'lucide-react';
import { formatDateTime } from '@/lib/format';
import { toDateFormatLocale } from '@/lib/i18n';

interface AiDisclosureProps {
  /** Quantas notícias entraram no briefing. */
  sourceCount: number;
  /** Quando a IA gerou o texto. Nulo nos briefings anteriores à migration. */
  generatedAt: string | null;
  /** Modelo que de fato gerou (ex.: `gemini-2.5-flash`). */
  modelVersion: string | null;
  /** Época do prompt + impressão digital do conteúdo. */
  promptVersion: string | null;
}

/**
 * "Como este briefing foi produzido" (§8, transparência de IA).
 *
 * **É o texto que sustenta a promessa do produto**, então mora numa superfície
 * própria e em corpo de leitura — não num rodapé cinza minúsculo. Um produto
 * jornalístico com IA que esconde o fato de usar IA gasta exatamente a confiança
 * que a seção existe para construir.
 *
 * **Só o briefing tem esta seção.** A `/news/[id]` é notícia coletada de RSS,
 * escrita por uma redação humana; carimbá-la como produzida por IA seria mentir
 * — e mentir na direção que mais custa aqui.
 *
 * Os três campos de auditoria são **nulos** nos briefings anteriores à migration
 * de 20/08/2026: nada os registrava e não havia backfill possível. Cada linha se
 * omite sozinha, e a declaração de IA — que não depende de coluna nenhuma —
 * continua aparecendo, porque ela vale para todo briefing.
 */
export function AiDisclosure({
  sourceCount,
  generatedAt,
  modelVersion,
  promptVersion,
}: AiDisclosureProps) {
  const t = useTranslations('article');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const headingId = useId();

  return (
    <section
      aria-labelledby={headingId}
      className='rounded-lg bg-surface-accent p-6 sm:p-8'
    >
      {/* `text-link` e não `text-brand-accent`: a linha tem texto, e laranja em
          texto é `brand-700` (§4 dos tokens). O ícone acompanha sem prejuízo. */}
      <p className='inline-flex items-center gap-2 text-link'>
        <Sparkles className='size-4 shrink-0' aria-hidden='true' />
        <span
          id={headingId}
          className='font-display text-overline font-semibold uppercase'
        >
          {t('aiDisclosureTitle')}
        </span>
      </p>

      <p className='mt-4 max-w-prose text-body text-ink'>
        {t('aiDisclosureBody', { count: sourceCount })}
      </p>

      <dl className='mt-5 grid gap-x-8 gap-y-3 sm:grid-cols-2'>
        {generatedAt ? (
          <Detail
            label={t('generatedAtLabel')}
            value={formatDateTime(generatedAt, toDateFormatLocale(locale))}
          />
        ) : null}
        {modelVersion ? (
          <Detail label={t('modelLabel')} value={modelVersion} />
        ) : null}
        {promptVersion ? (
          <Detail label={t('promptLabel')} value={promptVersion} />
        ) : null}
        <Detail
          label={t('sourcesLabel')}
          value={tCommon('sources', { count: sourceCount })}
        />
      </dl>

      <p className='mt-5 max-w-prose text-body-sm text-ink-secondary'>
        {t('aiDisclosureCaveat')}
      </p>
    </section>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className='text-meta uppercase tracking-wide text-ink-muted'>
        {label}
      </dt>
      {/* `break-words`: `promptVersion` é um identificador sem espaços e
          estouraria a coluna no mobile. */}
      <dd className='mt-0.5 break-words text-body-sm text-ink'>{value}</dd>
    </div>
  );
}
