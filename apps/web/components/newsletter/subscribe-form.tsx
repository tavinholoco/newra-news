'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { subscribeToNewsletter } from '@/lib/api';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Status = 'idle' | 'submitting' | 'success' | 'error';

export function SubscribeForm() {
  const t = useTranslations('newsletter');
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [message, setMessage] = useState('');

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = email.trim().toLowerCase();

    if (!EMAIL_REGEX.test(normalized)) {
      setStatus('error');
      setMessage(t('invalidEmail'));
      return;
    }

    setStatus('submitting');
    setMessage('');

    try {
      await subscribeToNewsletter(normalized);
      setStatus('success');
      setMessage(t('success'));
      setEmail('');
    } catch {
      setStatus('error');
      setMessage(t('error'));
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className='flex flex-col gap-2'>
      <div className='flex gap-2'>
        <Input
          type='email'
          placeholder={t('emailPlaceholder')}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-label={t('emailLabel')}
          aria-invalid={status === 'error'}
          disabled={status === 'submitting'}
          className='h-9 border-on-brand/50 bg-on-brand/10 text-on-brand placeholder:text-on-brand/70 focus-visible:border-on-brand/70 focus-visible:ring-on-brand/30'
        />
        <Button
          type='submit'
          disabled={status === 'submitting'}
          size='lg'
          className='shrink-0'
        >
          <Send className='size-4' />
          {t('subscribe')}
        </Button>
      </div>

      {status === 'success' && (
        <p role='status' className='text-xs text-success-on-brand'>
          {message}
        </p>
      )}
      {status === 'error' && (
        <p role='alert' className='text-xs text-danger-on-brand'>
          {message}
        </p>
      )}
    </form>
  );
}
