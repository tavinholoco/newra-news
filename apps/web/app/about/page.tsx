import type { Metadata } from 'next';
import {
  Newspaper,
  Sparkles,
  BookOpen,
  Github,
  ExternalLink,
} from 'lucide-react';

export const metadata: Metadata = {
  title: 'Sobre',
  description:
    'Conheça o Newra News, portal de notícias com artigo diário gerado por IA.',
  openGraph: {
    title: 'Sobre',
    description:
      'Conheça o Newra News, portal de notícias com artigo diário gerado por IA.',
  },
  twitter: {
    title: 'Sobre',
    description:
      'Conheça o Newra News, portal de notícias com artigo diário gerado por IA.',
  },
};

const techStack = [
  'Next.js',
  'React',
  'Tailwind CSS',
  'Fastify',
  'PostgreSQL',
  'Prisma',
  'Gemini AI',
  'TypeScript',
] as const;

export default function AboutPage() {
  return (
    <div className='mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8'>
      {/* Hero */}
      <div className='mb-12'>
        <h1 className='font-display text-3xl font-bold text-foreground sm:text-4xl'>
          Sobre o Newra News
        </h1>
        <p className='mt-4 text-lg leading-relaxed text-muted-foreground'>
          O Newra News é um portal de notícias inteligente que agrega as
          principais notícias do mundo e gera automaticamente um artigo diário
          com o resumo dos acontecimentos mais relevantes — tudo com ajuda de
          inteligência artificial.
        </p>
      </div>

      {/* O que é */}
      <section className='mb-12'>
        <h2 className='font-display mb-4 text-2xl font-bold text-foreground'>
          O que é o Newra News?
        </h2>
        <p className='leading-relaxed text-muted-foreground'>
          Consumidores de notícias enfrentam sobrecarga informacional. São
          dezenas de portais, centenas de manchetes e pouco tempo para absorver
          tudo. O Newra News resolve isso ao oferecer duas experiências: um feed
          de notícias atualizado diariamente para quem quer navegar, e um
          artigo-resumo do dia para quem quer entender o cenário geral em poucos
          minutos.
        </p>
      </section>

      {/* Como funciona */}
      <section className='mb-12'>
        <h2 className='font-display mb-6 text-2xl font-bold text-foreground'>
          Como funciona?
        </h2>
        <div className='grid grid-cols-1 gap-6 sm:grid-cols-3'>
          <div className='flex flex-col items-center rounded-xl bg-card px-4 py-6 text-center ring-1 ring-foreground/10'>
            <div className='mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-brand-100 text-brand-600'>
              <Newspaper className='h-6 w-6' />
            </div>
            <h3 className='font-display mb-1 text-base font-medium text-foreground'>
              Coleta de Notícias
            </h3>
            <p className='text-sm text-muted-foreground'>
              Múltiplas fontes são consultadas diariamente para reunir as
              notícias mais relevantes do dia.
            </p>
          </div>

          <div className='flex flex-col items-center rounded-xl bg-card px-4 py-6 text-center ring-1 ring-foreground/10'>
            <div className='mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-brand-100 text-brand-600'>
              <Sparkles className='h-6 w-6' />
            </div>
            <h3 className='font-display mb-1 text-base font-medium text-foreground'>
              Análise por IA
            </h3>
            <p className='text-sm text-muted-foreground'>
              Inteligência artificial analisa, cruza e sintetiza as informações
              coletadas em um artigo coeso.
            </p>
          </div>

          <div className='flex flex-col items-center rounded-xl bg-card px-4 py-6 text-center ring-1 ring-foreground/10'>
            <div className='mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-brand-100 text-brand-600'>
              <BookOpen className='h-6 w-6' />
            </div>
            <h3 className='font-display mb-1 text-base font-medium text-foreground'>
              Artigo Diário
            </h3>
            <p className='text-sm text-muted-foreground'>
              Um artigo-resumo é publicado automaticamente, permitindo que você
              entenda o dia em poucos minutos.
            </p>
          </div>
        </div>
      </section>

      {/* Stack tecnológica */}
      <section className='mb-12'>
        <h2 className='font-display mb-4 text-2xl font-bold text-foreground'>
          Stack Tecnológica
        </h2>
        <p className='mb-4 text-muted-foreground'>
          Construído com tecnologias modernas focadas em performance, tipagem e
          experiência de desenvolvimento.
        </p>
        <div className='flex flex-wrap gap-2'>
          {techStack.map((tech) => (
            <span
              key={tech}
              className='inline-flex items-center rounded-full bg-secondary px-3 py-1 text-sm font-medium text-secondary-foreground'
            >
              {tech}
            </span>
          ))}
        </div>
      </section>

      {/* Open Source */}
      <section className='rounded-xl border border-border bg-muted/30 px-6 py-8 text-center'>
        <Github className='mx-auto mb-4 h-10 w-10 text-foreground' />
        <h2 className='font-display mb-2 text-xl font-bold text-foreground'>
          Projeto Open Source
        </h2>
        <p className='mb-4 text-sm text-muted-foreground'>
          O código-fonte do Newra News está disponível no GitHub.
        </p>
        <a
          href='https://github.com/tavinholoco/newra-news'
          target='_blank'
          rel='noopener noreferrer'
          className='inline-flex items-center gap-1.5 text-sm font-medium text-brand-600 transition-colors hover:text-brand-400'
        >
          Ver no GitHub
          <ExternalLink className='h-3.5 w-3.5' />
        </a>
      </section>
    </div>
  );
}
