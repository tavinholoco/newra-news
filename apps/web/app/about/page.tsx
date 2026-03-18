import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Sobre - Newra News',
  description:
    'Conheça o Newra News, portal de notícias com artigo diário gerado por IA',
};

export default function AboutPage() {
  return (
    <div className='mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8'>
      <h1 className='font-display text-3xl font-bold text-foreground'>
        Sobre o Newra News
      </h1>
      <p className='mt-4 text-muted-foreground'>
        O Newra News é um portal de notícias que agrega notícias gerais do mundo
        e tem como diferencial a geração automática de um artigo diário que
        resume e explica as principais notícias do dia.
      </p>
    </div>
  );
}
