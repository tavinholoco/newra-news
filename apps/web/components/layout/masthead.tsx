import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { Logo } from '@/components/layout/logo';
import { MastheadSearch } from '@/components/layout/masthead-search';
import { MobileNav } from '@/components/layout/mobile-nav';
import { AuthButton } from '@/components/auth/auth-button';
import { NAV_LINKS } from '@/lib/constants';

/**
 * Linha 2 do header (§10): logo + busca + ações.
 *
 * No desktop as ações de sistema já estão na top-bar, então esta linha fica
 * com a marca e a busca — que é o que a §10 pede ("logo alinhado à esquerda +
 * busca + ações"). Sobra espaço para a navegação secundária, que na V1 disputava
 * a barra única com tudo o mais.
 *
 * No mobile ela é o header compacto inteiro: menu, logo, e sessão. A busca
 * mora dentro do menu, porque um campo de texto nesta linha empurraria a marca
 * para fora em 375 px.
 */
export async function Masthead() {
  const t = await getTranslations('nav');

  // As categorias são a navegação primária e vivem na linha 3; `/` é a marca
  // ao lado; e `/news` já é o "Todas" da faixa. Sobra a navegação secundária.
  const secondary = NAV_LINKS.filter(
    (link) => link.href !== '/' && link.href !== '/news',
  );

  return (
    <div className='container-editorial flex h-14 items-center gap-3 md:h-16 md:gap-6'>
      <MobileNav />

      <Link
        href='/'
        className='shrink-0 rounded-md text-ink transition-colors duration-fast hover:text-link'
      >
        <Logo markClassName='h-6 md:h-7' wordmarkClassName='md:text-xl' />
      </Link>

      <nav
        aria-label={t('secondary')}
        className='hidden items-center gap-1 md:flex'
      >
        {secondary.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className='rounded-md px-2.5 py-1.5 text-body-sm font-medium text-ink-secondary transition-colors duration-fast hover:text-link'
          >
            {t(link.key)}
          </Link>
        ))}
      </nav>

      <div className='ml-auto flex items-center gap-2'>
        <MastheadSearch className='hidden w-56 lg:block xl:w-72' />
        {/* No desktop a sessão está na top-bar; aqui ela é só do mobile. */}
        <div className='md:hidden'>
          <AuthButton />
        </div>
      </div>
    </div>
  );
}
