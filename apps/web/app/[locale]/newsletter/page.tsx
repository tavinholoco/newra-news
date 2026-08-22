import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { FileText, Quote, CalendarClock } from 'lucide-react';
import { NewsletterCta } from '@/components/editorial/newsletter-cta';
import { pageMetadata } from '@/lib/seo';

interface Props {
  params: { locale: string };
}

export async function generateMetadata({
  params: { locale },
}: Props): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: 'metadata.newsletter' });

  return pageMetadata({
    locale,
    path: '/newsletter',
    title: t('title'),
    description: t('description'),
  });
}

/**
 * Landing da newsletter — a única rota nova da V2 (§23).
 *
 * Existe porque a §20 trata a newsletter como peça de **aquisição**, e até
 * aqui ela era um formulário no rodapé: um campo sem proposta de valor, sem
 * frequência declarada e sem dizer o que acontece com o e-mail. Nada disso
 * cabia no rodapé, e é o que faz alguém assinar.
 */
export default async function NewsletterPage({ params }: Props) {
  const { locale } = params;
  setRequestLocale(locale);

  const t = await getTranslations('newsletter');

  const benefits = [
    { icon: FileText, title: t('benefitBriefTitle'), desc: t('benefitBriefDesc') },
    { icon: Quote, title: t('benefitSourcesTitle'), desc: t('benefitSourcesDesc') },
    { icon: CalendarClock, title: t('benefitRhythmTitle'), desc: t('benefitRhythmDesc') },
  ];

  const faq = [
    { q: t('faqFrequencyQ'), a: t('faqFrequencyA') },
    { q: t('faqDataQ'), a: t('faqDataA') },
    { q: t('faqCancelQ'), a: t('faqCancelA') },
    { q: t('faqAiQ'), a: t('faqAiA') },
  ];

  return (
    <div className='container-editorial py-section'>
      <header className='max-w-prose'>
        <p className='text-overline uppercase text-brand-accent'>
          {t('footerTitle')}
        </p>
        <h1 className='mt-3 font-display text-display font-bold text-ink'>
          {t('landingTitle')}
        </h1>
        <p className='mt-block text-body-lg text-ink-secondary'>
          {t('landingLede')}
        </p>
      </header>

      <div className='mt-section'>
        <NewsletterCta />
      </div>

      <section className='mt-section'>
        <h2 className='font-display text-h2 font-bold text-ink'>
          {t('whatYouGet')}
        </h2>
        <ul className='mt-block grid grid-cols-1 gap-block md:grid-cols-3'>
          {benefits.map(({ icon: Icon, title, desc }) => (
            <li
              key={title}
              className='rounded-lg border border-line bg-surface p-6'
            >
              <span className='inline-flex size-10 items-center justify-center rounded-full bg-surface-accent text-brand-accent'>
                <Icon className='size-5' aria-hidden='true' />
              </span>
              <h3 className='mt-4 font-display text-h4 font-semibold text-ink'>
                {title}
              </h3>
              <p className='mt-2 text-body-sm text-ink-secondary'>{desc}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className='mt-section max-w-prose'>
        <h2 className='font-display text-h2 font-bold text-ink'>
          {t('faqTitle')}
        </h2>
        {/* `<dl>` e não acordeão: são quatro respostas curtas, e esconder cada
            uma atrás de um clique só acrescentaria trabalho para o leitor. */}
        <dl className='mt-block divide-y divide-line border-y border-line'>
          {faq.map(({ q, a }) => (
            <div key={q} className='py-block'>
              <dt className='font-display text-h4 font-semibold text-ink'>{q}</dt>
              <dd className='mt-2 text-body text-ink-secondary'>{a}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
