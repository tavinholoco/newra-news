'use client';

import { useId, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { subscribeToNewsletter } from '@/lib/api';
import { track } from '@/lib/analytics';
import type { EventSource } from '@newranews/types';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Status = 'idle' | 'submitting' | 'success' | 'error';

interface SubscribeFormProps {
  /**
   * Onde este formulário está. O mesmo componente aparece no rodapé e no CTA
   * editorial, e a taxa de inscrição dos dois não é a mesma coisa — sem isto o
   * número somaria dois lugares diferentes num só.
   */
  origin: EventSource;
}

export function SubscribeForm({ origin }: SubscribeFormProps) {
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
      // Depois do `await`, e só no caminho de sucesso: a métrica é "taxa de
      // inscrição", não "taxa de tentativa".
      track('newsletter_signup', { origin });
      setStatus('success');
      setMessage(t('success'));
      setEmail('');
    } catch {
      setStatus('error');
      setMessage(t('error'));
    }
  }

  // O formulário aparece duas vezes na mesma página (rodapé e CTA editorial):
  // um id fixo daria dois elementos com o mesmo id e o `aria-describedby`
  // do segundo apontaria para a mensagem do primeiro.
  const messageId = useId();

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
          /**
           * **O erro era anunciado uma vez e depois ficava órfão do campo.**
           * O `role='alert'` abaixo dispara quando a mensagem aparece — e é
           * isso que a auditoria da Fase 7 conferiu. Mas quem volta ao campo
           * para corrigir ouve só "e-mail, entrada inválida", sem o motivo:
           * `aria-invalid` diz *que* está errado, e nada dizia *o quê*.
           * `aria-describedby` amarra a mensagem ao campo, e aí ela é lida
           * toda vez que o foco entra ali.
           */
          aria-describedby={status === 'error' ? messageId : undefined}
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
        <p id={messageId} role='status' className='text-xs text-success-on-brand'>
          {message}
        </p>
      )}
      {status === 'error' && (
        <p id={messageId} role='alert' className='text-xs text-danger-on-brand'>
          {message}
        </p>
      )}
    </form>
  );
}
