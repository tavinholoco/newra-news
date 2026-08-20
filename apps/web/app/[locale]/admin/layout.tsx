import { redirect } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { Link } from '@/i18n/navigation';

// Segmento protegido (lê a sessão por request) — não pode ser prerenderizado
// como SSG: o redirect() seria "assado" no HTML estático e todos seriam
// redirecionados para o sign-in, mesmo logados (bug visto em dev com cache HIT).
// Declarado aqui, vale para todas as páginas de /admin.
export const dynamic = 'force-dynamic';

interface Props {
  children: React.ReactNode;
  params: { locale: string };
}

/**
 * O guard de sessão + role vive no layout, não em cada página: assim "tudo
 * sob /admin é só para ADMIN" é garantia estrutural, e uma página nova não
 * depende de alguém lembrar de repetir a verificação.
 */
export default async function AdminLayout({ children, params }: Props) {
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
          className='text-sm font-medium text-link hover:text-link-hover'
        >
          {t('backHome')}
        </Link>
      </div>
    );
  }

  return <>{children}</>;
}
