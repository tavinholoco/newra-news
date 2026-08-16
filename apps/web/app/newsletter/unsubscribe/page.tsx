import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, CheckCircle2, XCircle } from 'lucide-react';
import { unsubscribeFromNewsletter } from '@/lib/api';

export const metadata: Metadata = {
  title: 'Cancelar inscrição',
  description: 'Cancele sua assinatura da newsletter do Newra News.',
  robots: { index: false, follow: false },
};

interface Props {
  searchParams: { token?: string };
}

export default async function UnsubscribePage({ searchParams }: Props) {
  const token = searchParams.token;

  const unsubscribed = token
    ? await unsubscribeFromNewsletter(token).catch(() => ({ unsubscribed: false }))
    : { unsubscribed: false };

  return (
    <div className='mx-auto flex max-w-2xl flex-col items-center px-4 py-24 text-center sm:px-6 lg:px-8'>
      {unsubscribed.unsubscribed ? (
        <>
          <CheckCircle2 className='mb-6 h-16 w-16 text-green-600' />
          <h1 className='font-display mb-3 text-2xl font-bold text-foreground'>
            Inscrição cancelada
          </h1>
          <p className='mb-8 text-muted-foreground'>
            Você não receberá mais o artigo diário no seu e-mail. Se mudar de
            ideia, basta assinar novamente pelo rodapé do site.
          </p>
        </>
      ) : (
        <>
          <XCircle className='mb-6 h-16 w-16 text-destructive/70' />
          <h1 className='font-display mb-3 text-2xl font-bold text-foreground'>
            Link inválido ou já utilizado
          </h1>
          <p className='mb-8 text-muted-foreground'>
            Não foi possível cancelar a inscrição com este link. Verifique o
            e-mail recebido ou tente novamente.
          </p>
        </>
      )}
      <Link
        href='/'
        className='flex items-center gap-2 text-sm font-medium text-brand-600 transition-colors hover:text-brand-400'
      >
        <ArrowLeft className='h-4 w-4' />
        Voltar para a Home
      </Link>
    </div>
  );
}
