import Link from 'next/link';
import Image from 'next/image';
import { NAV_LINKS } from '@/lib/constants';
import { SubscribeForm } from '@/components/newsletter/subscribe-form';

export function Footer() {
  return (
    <footer className='bg-brand-900 text-white'>
      <div className='mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8'>
        <div className='grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-4'>
          {/* Brand */}
          <div className='space-y-4'>
            <Link href='/' className='flex items-center gap-2.5'>
              <Image
                src='/logo-dark.svg'
                alt='Newra News'
                width={32}
                height={32}
                className='h-8 w-8'
              />
              <span className='font-display text-lg font-bold tracking-tight'>
                Newra News
              </span>
            </Link>
            <p className='text-sm leading-relaxed text-white/70'>
              Portal de notícias inteligente com artigos diários gerados por IA,
              reunindo as principais notícias do dia em um único lugar.
            </p>
          </div>

          {/* Quick links */}
          <div>
            <h3 className='font-display text-sm font-semibold uppercase tracking-wider text-white/50'>
              Navegação
            </h3>
            <ul className='mt-4 space-y-2'>
              {NAV_LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className='text-sm text-white/70 transition-colors hover:text-brand-400'
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* About */}
          <div>
            <h3 className='font-display text-sm font-semibold uppercase tracking-wider text-white/50'>
              Sobre o Projeto
            </h3>
            <ul className='mt-4 space-y-2 text-sm text-white/70'>
              <li>Next.js + Fastify</li>
              <li>Artigos gerados por IA</li>
              <li>Atualizado diariamente</li>
            </ul>
          </div>

          {/* Newsletter */}
          <div>
            <h3 className='font-display text-sm font-semibold uppercase tracking-wider text-white/50'>
              Newsletter
            </h3>
            <p className='mt-4 text-sm leading-relaxed text-white/70'>
              Receba o artigo do dia no seu e-mail, direto das principais
              notícias.
            </p>
            <div className='mt-4'>
              <SubscribeForm />
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className='mt-10 border-t border-white/10 pt-6'>
          <div className='flex flex-col items-center justify-between gap-2 text-xs text-white/50 sm:flex-row'>
            <p>&copy; {new Date().getFullYear()} Newra News. Todos os direitos reservados.</p>
            <p>Powered by AI</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
