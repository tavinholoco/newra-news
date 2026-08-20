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
          className='rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive'
        >
          {t('error')}
        </p>
      )}
      <p className='text-muted-foreground'>{t('hint')}</p>

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
        className='inline-flex items-center gap-1.5 text-sm font-medium text-link hover:text-link-hover'
      >
        <ArrowLeft className='h-4 w-4' />
        {t('backHome')}
      </Link>
    </div>
  );
}
