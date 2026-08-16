import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { AdminPanel } from '@/components/admin/admin-panel';
import { Link } from '@/i18n/navigation';

// Página protegida (lê a sessão por request) — não pode ser prerenderizada
// como SSG: o redirect() seria "assado" no HTML estático e todos seriam
// redirecionados para o sign-in, mesmo logados (bug visto em dev com cache HIT).
export const dynamic = 'force-dynamic';

interface Props {
  params: { locale: string };
}

export async function generateMetadata({
  params: { locale },
}: Props): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: 'metadata.admin' });

  return {
    title: t('title'),
    robots: { index: false, follow: false },
    alternates: {
      languages: {
        'pt-BR': '/pt-BR/admin',
        en: '/en/admin',
      },
    },
  };
}

export default async function AdminPage({ params }: Props) {
  const { locale } = params;
  setRequestLocale(locale);

  const t = await getTranslations('admin');
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    // Página de sign-in própria (app/[locale]/signin) — o middleware do
    // next-intl adiciona o prefixo de locale e preserva o callbackUrl.
    redirect(`/signin?callbackUrl=/${locale}/admin`);
  }

  if (session.user.role !== 'ADMIN') {
    return (
      <div className='mx-auto max-w-2xl px-4 py-16 text-center sm:px-6'>
        <h1 className='font-display mb-3 text-3xl font-bold text-foreground'>
          {t('restrictedTitle')}
        </h1>
        <p className='mb-6 text-muted-foreground'>{t('restrictedDesc')}</p>
        <Link
          href='/'
          className='text-sm font-medium text-brand-600 hover:text-brand-700'
        >
          {t('backHome')}
        </Link>
      </div>
    );
  }

  return (
    <div className='mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8'>
      <h1 className='font-display mb-6 text-3xl font-bold text-foreground'>
        {t('title')}
      </h1>
      <AdminPanel />
    </div>
  );
}
