import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Sobre - Newra News',
  description: 'Conheça o Newra News, portal de notícias com artigo diário gerado por IA',
};

export default function AboutPage() {
  return (
    <main className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold">Sobre o Newra News</h1>
      <p className="mt-4 text-gray-600">
        O Newra News é um portal de notícias que agrega notícias gerais do mundo e tem como
        diferencial a geração automática de um artigo diário que resume e explica as principais
        notícias do dia.
      </p>
    </main>
  );
}
