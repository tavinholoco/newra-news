import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ArrowLeft, CheckCircle2, XCircle } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { unsubscribeFromNewsletter } from '@/lib/api';

interface Props {
  params: { locale: string };
  searchParams: { token?: string };
}

export async function generateMetadata({
  params: { locale },
}: Props): Promise<Metadata> {
  const t = await getTranslations({
    locale,
    namespace: 'metadata.newsletterUnsubscribe',
  });

  return {
    title: t('title'),
    description: t('description'),
    robots: { index: false, follow: false },
    alternates: {
      languages: {
        'pt-BR': '/pt-BR/newsletter/unsubscribe',
        en: '/en/newsletter/unsubscribe',
      },
    },
  };
}

/**
 * Cancelamento da newsletter (§2 de `docs/v2/02-sitemap-telas.md`).
 *
 * Dois estados: cancelado e token inválido. Eles diferem em ícone, cor e
 * texto — nada de estrutura —, então são um objeto e não dois blocos de JSX
 * quase idênticos. Duplicar a marcação é como uma das duas metades sai do
 * lugar quando alguém mexe só numa.
 */
export default async function UnsubscribePage({ params, searchParams }: Props) {
  const { locale } = params;
  setRequestLocale(locale);

  const t = await getTranslations('newsletter');
  const tCommon = await getTranslations('common');
  const token = searchParams.token;

  const result = token
    ? await unsubscribeFromNewsletter(token).catch(() => ({
        unsubscribed: false,
      }))
    : { unsubscribed: false };

  const state = result.unsubscribed
    ? {
        Icon: CheckCircle2,
        tone: 'text-success',
        title: t('unsubscribedTitle'),
        description: t('unsubscribedDesc'),
      }
    : {
        Icon: XCircle,
        tone: 'text-danger',
        title: t('invalidTitle'),
        description: t('invalidDesc'),
      };

  const { Icon } = state;

  return (
    <div className='container-editorial py-section'>
      <div className='mx-auto flex max-w-narrow flex-col items-center py-section text-center'>
        {/* Decorativo: o título logo abaixo já diz o que o ícone ilustra. */}
        <Icon className={`size-16 ${state.tone}`} aria-hidden='true' />
        <h1 className='mt-block font-display text-h2 font-bold text-ink'>
          {state.title}
        </h1>
        <p className='mt-3 max-w-prose text-body text-ink-secondary'>
          {state.description}
        </p>
        <Link
          href='/'
          className='mt-section inline-flex items-center gap-2 text-body-sm font-medium text-link transition-colors duration-fast hover:text-link-hover'
        >
          <ArrowLeft className='size-4' aria-hidden='true' />
          {tCommon('backToHome')}
        </Link>
      </div>
    </div>
  );
}
