'use client';

import { useState } from 'react';
import { Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { subscribeToNewsletter } from '@/lib/api';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Status = 'idle' | 'submitting' | 'success' | 'error';

export function SubscribeForm() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [message, setMessage] = useState('');

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = email.trim().toLowerCase();

    if (!EMAIL_REGEX.test(normalized)) {
      setStatus('error');
      setMessage('Informe um e-mail válido.');
      return;
    }

    setStatus('submitting');
    setMessage('');

    try {
      await subscribeToNewsletter(normalized);
      setStatus('success');
      setMessage('Você receberá o artigo do dia no seu e-mail!');
      setEmail('');
    } catch {
      setStatus('error');
      setMessage('Não foi possível assinar agora. Tente novamente.');
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className='flex flex-col gap-2'>
      <div className='flex gap-2'>
        <Input
          type='email'
          placeholder='seu@email.com'
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-label='Seu e-mail'
          aria-invalid={status === 'error'}
          disabled={status === 'submitting'}
          className='h-9 border-white/20 bg-white/10 text-white placeholder:text-white/40 focus-visible:border-white/50 focus-visible:ring-white/20'
        />
        <Button
          type='submit'
          disabled={status === 'submitting'}
          size='lg'
          className='shrink-0'
        >
          <Send className='size-4' />
          Assinar
        </Button>
      </div>

      {status === 'success' && (
        <p role='status' className='text-xs text-green-300'>
          {message}
        </p>
      )}
      {status === 'error' && (
        <p role='alert' className='text-xs text-red-300'>
          {message}
        </p>
      )}
    </form>
  );
}
