import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { AlertTriangle, ArrowLeft, CheckCircle2, XCircle } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { ApiError, unsubscribeFromNewsletter } from '@/lib/api';
import { alternatesFor } from '@/lib/seo';

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
    alternates: alternatesFor(locale, '/newsletter/unsubscribe'),
  };
}

/**
 * Cancelamento da newsletter (§2 de `docs/v2/02-sitemap-telas.md`).
 *
 * **Eram dois estados, e a revisão 10.4 achou que faltava o terceiro.** O
 * `.catch(() => ({ unsubscribed: false }))` transformava *"não consegui falar
 * com a API"* em *"link inválido ou já utilizado"* — ou seja, a tela dizia à
 * pessoa que o link de descadastro dela não presta quando o único problema era
 * a API dormindo no plano free do Render. É a mensagem mais cara que este
 * produto poderia dar errada: quem chega aqui quer sair, e receber "link
 * inválido" é ser mandado embora sem sair.
 *
 * Agora são três, e a diferença vem do `status` do `ApiError`: a API respondeu
 * que o token não serve (`invalid`), a API não respondeu (`unavailable`), ou
 * deu certo. Os três diferem em ícone, cor e texto — nada de estrutura —,
 * então continuam sendo um objeto e não três blocos de JSX quase idênticos.
 */
export default async function UnsubscribePage({ params, searchParams }: Props) {
  const { locale } = params;
  setRequestLocale(locale);

  const t = await getTranslations('newsletter');
  const tCommon = await getTranslations('common');
  const token = searchParams.token;

  // Sem token não há o que perguntar: o link é que está incompleto.
  const outcome: 'unsubscribed' | 'invalid' | 'unavailable' = !token
    ? 'invalid'
    : await unsubscribeFromNewsletter(token).then(
        (result) => (result.unsubscribed ? 'unsubscribed' : 'invalid'),
        (error: unknown) =>
          error instanceof ApiError && error.isUnreachable ? 'unavailable' : 'invalid',
      );

  const STATES = {
    unsubscribed: {
      Icon: CheckCircle2,
      tone: 'text-success',
      title: t('unsubscribedTitle'),
      description: t('unsubscribedDesc'),
    },
    invalid: {
      Icon: XCircle,
      tone: 'text-danger',
      title: t('invalidTitle'),
      description: t('invalidDesc'),
    },
    unavailable: {
      Icon: AlertTriangle,
      tone: 'text-danger',
      title: t('unavailableTitle'),
      description: t('unavailableDesc'),
    },
  } as const;

  const state = STATES[outcome];

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
