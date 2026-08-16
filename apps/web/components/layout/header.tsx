import Link from 'next/link';
import Image from 'next/image';
import { Navbar } from './navbar';
import { ThemeToggle } from '@/components/theme/theme-toggle';
import { AuthButton } from '@/components/auth/auth-button';
import { NAV_LINKS } from '@/lib/constants';

export function Header() {
  return (
    <header className='sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80'>
      <div className='mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8'>
        <Link href='/' className='flex items-center gap-2.5'>
          <Image
            src='/logo.svg'
            alt='Newra News'
            width={36}
            height={36}
            className='h-9 w-9'
            priority
          />
          <span className='font-display text-xl font-bold tracking-tight text-foreground'>
            Newra News
          </span>
        </Link>

        <div className='flex items-center gap-1'>
          <ThemeToggle />
          <AuthButton />
          <Navbar links={NAV_LINKS} />
        </div>
      </div>
    </header>
  );
}
