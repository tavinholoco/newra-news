import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { NAV_LINKS } from '@/lib/constants';
import { SubscribeForm } from '@/components/newsletter/subscribe-form';

export async function Footer() {
  const t = await getTranslations('footer');
  const tNav = await getTranslations('nav');
  const tNewsletter = await getTranslations('newsletter');

  return (
    <footer className='bg-surface-brand text-on-brand'>
      <div className='mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8'>
        <div className='grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-4'>
          {/* Brand */}
          <div className='space-y-4'>
            <Link href='/' className='flex items-center gap-2.5'>
              <span className='font-display text-lg font-bold tracking-tight'>
                Newra News
              </span>
            </Link>
            <p className='text-sm leading-relaxed text-on-brand/70'>
              {t('description')}
            </p>
          </div>

          {/* Quick links */}
          <div>
            <h3 className='font-display text-sm font-semibold uppercase tracking-wider text-on-brand'>
              {t('navigation')}
            </h3>
            <ul className='mt-4 space-y-2'>
              {NAV_LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className='text-sm text-on-brand/70 transition-colors hover:text-on-brand'
                  >
                    {tNav(link.key)}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* About */}
          <div>
            <h3 className='font-display text-sm font-semibold uppercase tracking-wider text-on-brand'>
              {t('aboutTitle')}
            </h3>
            <ul className='mt-4 space-y-2 text-sm text-on-brand/70'>
              <li>{t('items.stack')}</li>
              <li>{t('items.aiGenerated')}</li>
              <li>{t('items.updatedDaily')}</li>
            </ul>
          </div>

          {/* Newsletter */}
          <div>
            <h3 className='font-display text-sm font-semibold uppercase tracking-wider text-on-brand'>
              {tNewsletter('footerTitle')}
            </h3>
            <p className='mt-4 text-sm leading-relaxed text-on-brand/70'>
              {tNewsletter('footerDesc')}
            </p>
            <div className='mt-4'>
              <SubscribeForm />
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className='mt-10 border-t border-on-brand/20 pt-6'>
          <div className='flex flex-col items-center justify-between gap-2 text-xs text-on-brand/70 sm:flex-row'>
            <p>&copy; {new Date().getFullYear()} Newra News. {t('rights')}</p>
            <p>{t('poweredBy')}</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
