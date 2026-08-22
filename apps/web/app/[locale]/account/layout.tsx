import { redirect } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { AccountNav } from '@/components/account/account-nav';

// Segmento protegido (lê a sessão por request) — não pode ser prerenderizado
// como SSG: o redirect() seria "assado" no HTML estático e todos seriam
// mandados para o sign-in, mesmo logados. É a mesma conta que /favorites e
// /admin já pagam desde a V1. Declarado aqui, vale para todo o segmento.
export const dynamic = 'force-dynamic';

interface Props {
  children: React.ReactNode;
  params: { locale: string };
}

/**
 * O guard de sessão vive no layout, não em cada página: assim "tudo sob
 * /account exige sessão" é garantia estrutural, e uma tela nova não depende de
 * alguém lembrar de repetir a verificação — o mesmo padrão de
 * `app/[locale]/admin/layout.tsx`, sem a checagem de role.
 */
export default async function AccountLayout({ children, params }: Props) {
  const { locale } = params;
  setRequestLocale(locale);

  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect(`/signin?callbackUrl=/${locale}/account`);
  }

  return (
    <div className='container-editorial py-section'>
      <AccountNav />
      <div className='mt-8'>{children}</div>
    </div>
  );
}
