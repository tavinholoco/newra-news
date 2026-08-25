'use client';

import { signIn, signOut, useSession } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import { LogIn, LogOut, ShieldCheck, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';
import { sessionNavLinks } from '@/lib/nav';

/**
 * A sessão na linha 1 do masthead (§10).
 *
 * **Carrega o link de admin, e não é enfeite.** O painel é a única rota do
 * produto que a barra do desktop não citava desde o masthead de três linhas:
 * quem tem role ADMIN via `/admin` no menu do mobile e em lugar nenhum acima
 * de 768 px. Ele entra aqui, e não na navegação secundária do masthead, porque
 * a linha 1 é onde mora informação de sistema — a navegação secundária é
 * editorial, e ADMIN não é editoria.
 *
 * `hidden md:inline-flex` pelo mesmo motivo que o nome da conta ao lado: no
 * mobile este componente aparece no masthead compacto, e o menu já lista os
 * dois. Repetir ali seria o defeito que a Fase 3 já corrigiu uma vez.
 */
export function AuthButton() {
  const { data: session, status } = useSession();
  const t = useTranslations('auth');
  const tNav = useTranslations('nav');

  if (status === 'loading') {
    return (
      <Button variant='ghost' size='sm' disabled aria-label={t('loading')}>
        <span className='h-4 w-4 animate-pulse rounded-full bg-muted' />
      </Button>
    );
  }

  if (!session?.user) {
    return (
      <Button
        variant='ghost'
        size='sm'
        onClick={() => void signIn()}
        aria-label={t('signIn')}
      >
        <LogIn className='h-4 w-4' />
        <span className='hidden sm:inline'>{t('signIn')}</span>
      </Button>
    );
  }

  const name =
    session.user.name?.split(' ')[0] ?? session.user.email ?? t('guest');

  // Da mesma lista que o menu do mobile monta, para as duas não divergirem.
  const admin = sessionNavLinks(status, session.user.role).find(
    (link) => link.href === '/admin',
  );

  return (
    <div className='flex items-center gap-1'>
      {admin ? (
        <Link
          href={admin.href}
          className='hidden items-center gap-1.5 rounded-md px-2 py-1 text-sm font-medium text-ink-secondary transition-colors duration-base hover:text-link md:inline-flex'
        >
          <ShieldCheck className='h-4 w-4' aria-hidden='true' />
          {tNav(admin.key)}
        </Link>
      ) : null}
      {/* O nome é a porta da conta: é onde quem está logado procura, e evita
          um item a mais na barra que já tem seis. */}
      <Link
        href='/account'
        className='hidden items-center gap-1.5 text-sm text-muted-foreground transition-colors duration-base hover:text-link md:flex'
      >
        <User className='h-4 w-4' />
        <span className='max-w-28 truncate' title={session.user.email ?? name}>
          {name}
        </span>
      </Link>
      <Button
        variant='ghost'
        size='sm'
        onClick={() => void signOut()}
        aria-label={t('signOut')}
      >
        <LogOut className='h-4 w-4' />
      </Button>
    </div>
  );
}
