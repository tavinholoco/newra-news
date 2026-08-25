import { redirect } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { Link } from '@/i18n/navigation';
import { AdminNav } from '@/components/admin/admin-nav';

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
 *
 * **A casca do painel também vive aqui**, pelo mesmo argumento: com a faixa de
 * abas no layout, uma tela nova de admin entra como aba e herda o contêiner,
 * em vez de trazer o seu próprio `max-w-*` e o seu próprio link de volta. Eram
 * dois contêineres diferentes antes desta fase — `max-w-5xl` no painel e
 * `max-w-7xl` nas métricas — e a largura da página mudava ao trocar de aba.
 *
 * A faixa só é renderizada depois do guard: quem não é ADMIN vê a tela de
 * acesso restrito, e oferecer as abas ali seria anunciar o que a pessoa não
 * pode abrir.
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

  return (
    <div className='container-editorial py-section'>
      <AdminNav />
      <div className='mt-8'>{children}</div>
    </div>
  );
}
