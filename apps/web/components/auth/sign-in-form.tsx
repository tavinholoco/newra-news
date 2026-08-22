'use client';

import { signIn } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import { ArrowLeft, Chrome, Github } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';

interface SignInFormProps {
  callbackUrl: string;
  error?: string;
}

export function SignInForm({ callbackUrl, error }: SignInFormProps) {
  const t = useTranslations('signin');

  return (
    <div className='space-y-4'>
      {error && (
        <p
          role='alert'
          className='rounded-md border border-line px-3 py-2 text-body-sm text-danger'
        >
          {t('error')}
        </p>
      )}
      <p className='text-body-sm text-ink-secondary'>{t('hint')}</p>

      <div className='flex flex-col gap-3'>
        <Button
          variant='outline'
          size='lg'
          className='w-full'
          onClick={() => void signIn('google', { callbackUrl })}
        >
          <Chrome className='mr-2 h-5 w-5' />
          {t('google')}
        </Button>
        <Button
          variant='outline'
          size='lg'
          className='w-full'
          onClick={() => void signIn('github', { callbackUrl })}
        >
          <Github className='mr-2 h-5 w-5' />
          {t('github')}
        </Button>
      </div>

      <Link
        href='/'
        className='inline-flex items-center gap-1.5 font-display text-body-sm font-semibold text-link transition-colors duration-base hover:text-link-hover'
      >
        <ArrowLeft className='h-4 w-4' />
        {t('backHome')}
      </Link>
    </div>
  );
}
