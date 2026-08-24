import { getTranslations } from 'next-intl/server';
import type { EventSource } from '@newranews/types';
import { Mail } from 'lucide-react';
import { SubscribeForm } from '@/components/newsletter/subscribe-form';
import { cn } from '@/lib/utils';

interface NewsletterCtaProps {
  /**
   * `band` é a faixa de largura total para o fim da Home (§20); `panel` é o
   * bloco contido, para dentro de uma coluna.
   */
  variant?: 'band' | 'panel';
  /**
   * De onde veio a inscrição, para o `newsletter_signup`.
   *
   * **Era fixo em `'article-cta'`, inclusive na `/newsletter`** — a página cuja
   * razão de existir é converter. O vocabulário tem o valor para ela
   * (`newsletter-landing`) e ele nunca foi emitido: toda inscrição da landing
   * entrava na conta do CTA de fim de matéria.
   *
   * O `origin` existe exatamente para não somar canais diferentes num número
   * só; misturar a landing com o CTA esconde justamente o que a métrica
   * responde, que é **qual canal converte**.
   */
  origin?: Extract<EventSource, 'article-cta' | 'newsletter-landing'>;
  className?: string;
}

/**
 * A newsletter como peça de aquisição, não como formulário de rodapé (§20).
 *
 * Vive em `monetization/` porque é isso que ela é no plano: um canal próprio,
 * que não depende de busca nem de rede social. O rodapé continua tendo o
 * formulário — este componente é o convite, com a proposta de valor junto.
 */
export async function NewsletterCta({
  variant = 'band',
  origin = 'article-cta',
  className,
}: NewsletterCtaProps) {
  const t = await getTranslations('newsletter');

  return (
    <section
      className={cn('rounded-lg bg-surface-brand text-on-brand', className)}
    >
      <div
        className={cn(
          'flex flex-col gap-block',
          variant === 'band'
            ? 'px-gutter py-section lg:flex-row lg:items-center lg:justify-between'
            : 'p-6',
        )}
      >
        <div className='max-w-prose'>
          <p className='inline-flex items-center gap-2 text-overline uppercase text-on-brand/70'>
            <Mail className='size-3.5' aria-hidden='true' />
            {t('footerTitle')}
          </p>
          {/* A manchete da §20 tem duas linhas por construção — a quebra é o
              ritmo da frase, não acaso de largura. */}
          <h2 className='mt-3 font-display text-h2 font-bold leading-tight'>
            {t('ctaHeadline')}
          </h2>
          <p className='mt-3 text-body text-on-brand/70'>{t('ctaDescription')}</p>
        </div>

        <div className={cn('w-full', variant === 'band' && 'lg:max-w-md')}>
          <SubscribeForm origin={origin} />
          <p className='mt-3 text-meta text-on-brand/70'>{t('ctaPrivacy')}</p>
        </div>
      </div>
    </section>
  );
}
