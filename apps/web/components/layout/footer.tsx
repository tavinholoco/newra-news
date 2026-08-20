import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { NAV_LINKS } from '@/lib/constants';
import { SubscribeForm } from '@/components/newsletter/subscribe-form';
import { Logo } from '@/components/layout/logo';

export async function Footer() {
  const t = await getTranslations('footer');
  const tNav = await getTranslations('nav');
  const tNewsletter = await getTranslations('newsletter');

  return (
    // `surface-brand` é escura nos dois temas — daí `on-brand` e não `ink`.
    <footer className='bg-surface-brand text-on-brand'>
      <div className='container-editorial py-section'>
        <div className='grid grid-cols-1 gap-block md:grid-cols-2 lg:grid-cols-4'>
          <div className='space-y-4'>
            <Link
              href='/'
              className='inline-flex rounded-md transition-colors duration-fast hover:text-on-brand/70'
            >
              {/* `tone='inherit'`: sobre o marrom escuro do rodapé a marca em
                  `brand-mark` some. Aqui ela herda o branco do contexto. */}
              <Logo variant='full' tone='inherit' />
            </Link>
            <p className='max-w-prose text-body-sm leading-relaxed text-on-brand/70'>
              {t('description')}
            </p>
          </div>

          <div>
            <h2 className='font-display text-overline uppercase text-on-brand'>
              {t('navigation')}
            </h2>
            <ul className='mt-4 space-y-2'>
              {NAV_LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className='text-body-sm text-on-brand/70 transition-colors duration-fast hover:text-on-brand'
                  >
                    {tNav(link.key)}
                  </Link>
                </li>
              ))}
              <li>
                <Link
                  href='/newsletter'
                  className='text-body-sm text-on-brand/70 transition-colors duration-fast hover:text-on-brand'
                >
                  {tNewsletter('footerTitle')}
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h2 className='font-display text-overline uppercase text-on-brand'>
              {t('aboutTitle')}
            </h2>
            <ul className='mt-4 space-y-2 text-body-sm text-on-brand/70'>
              <li>{t('items.stack')}</li>
              <li>{t('items.aiGenerated')}</li>
              <li>{t('items.updatedDaily')}</li>
            </ul>
          </div>

          <div>
            <h2 className='font-display text-overline uppercase text-on-brand'>
              {tNewsletter('footerTitle')}
            </h2>
            <p className='mt-4 text-body-sm leading-relaxed text-on-brand/70'>
              {tNewsletter('footerDesc')}
            </p>
            <div className='mt-4'>
              <SubscribeForm />
            </div>
          </div>
        </div>

        <div className='mt-section border-t border-on-brand/20 pt-6'>
          <div className='flex flex-col items-center justify-between gap-2 text-meta text-on-brand/70 sm:flex-row'>
            <p>
              &copy; {new Date().getFullYear()} Newra News. {t('rights')}
            </p>
            <p>{t('poweredBy')}</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
