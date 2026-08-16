import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { SignInForm } from '@/components/auth/sign-in-form';

export const dynamic = 'force-dynamic';

interface Props {
  params: { locale: string };
  searchParams: { callbackUrl?: string | string[]; error?: string | string[] };
}

export async function generateMetadata({
  params: { locale },
}: Props): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: 'metadata.signin' });

  return {
    title: t('title'),
    robots: { index: false, follow: false },
    alternates: {
      languages: {
        'pt-BR': '/pt-BR/signin',
        en: '/en/signin',
      },
    },
  };
}

/**
 * Converte o callbackUrl da query num caminho relativo seguro (evita
 * javascript:, origens externas etc. — a validação final é do next-auth no
 * callback do OAuth). Aceita caminho relativo ou URL absoluta do próprio site.
 */
function safeCallbackUrl(raw: string | string[] | undefined, locale: string): string {
  const value = typeof raw === 'string' ? raw : undefined;
  if (!value || value.length === 0) return `/${locale}`;
  if (value.startsWith('/')) return value;
  try {
    const url = new URL(value);
    if (url.protocol === 'http:' || url.protocol === 'https:') {
      return url.pathname + url.search;
    }
  } catch {
    // valor não-URL — cai no default
  }
  return `/${locale}`;
}

export default async function SignInPage({ params, searchParams }: Props) {
  const { locale } = params;
  setRequestLocale(locale);

  const t = await getTranslations('signin');
  const session = await getServerSession(authOptions);

  const callbackUrl = safeCallbackUrl(searchParams.callbackUrl, locale);

  // Já logado: volta para o destino (ou home) em vez de mostrar o login
  if (session?.user) {
    redirect(callbackUrl);
  }

  return (
    <div className='mx-auto max-w-md px-4 py-16 sm:px-6'>
      <div className='rounded-xl border border-border bg-card p-8'>
        <h1 className='font-display mb-2 text-2xl font-bold text-foreground'>
          {t('title')}
        </h1>
        <SignInForm
          callbackUrl={callbackUrl}
          error={typeof searchParams.error === 'string' ? searchParams.error : undefined}
        />
      </div>
    </div>
  );
}
