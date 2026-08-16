import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import {
  Newspaper,
  Sparkles,
  BookOpen,
  Github,
  ExternalLink,
} from 'lucide-react';

interface Props {
  params: { locale: string };
}

export async function generateMetadata({
  params: { locale },
}: Props): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: 'metadata.about' });

  return {
    title: t('title'),
    description: t('description'),
    alternates: {
      languages: {
        'pt-BR': '/pt-BR/about',
        en: '/en/about',
      },
    },
    openGraph: {
      title: t('title'),
      description: t('description'),
    },
    twitter: {
      title: t('title'),
      description: t('description'),
    },
  };
}

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

export default async function AboutPage({ params }: Props) {
  const { locale } = params;
  setRequestLocale(locale);

  const t = await getTranslations('about');

  return (
    <div className='mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8'>
      {/* Hero */}
      <div className='mb-12'>
        <h1 className='font-display text-3xl font-bold text-foreground sm:text-4xl'>
          {t('heroTitle')}
        </h1>
        <p className='mt-4 text-lg leading-relaxed text-muted-foreground'>
          {t('heroDesc')}
        </p>
      </div>

      {/* O que é */}
      <section className='mb-12'>
        <h2 className='font-display mb-4 text-2xl font-bold text-foreground'>
          {t('whatIsTitle')}
        </h2>
        <p className='leading-relaxed text-muted-foreground'>
          {t('whatIsDesc')}
        </p>
      </section>

      {/* Como funciona */}
      <section className='mb-12'>
        <h2 className='font-display mb-6 text-2xl font-bold text-foreground'>
          {t('howItWorks')}
        </h2>
        <div className='grid grid-cols-1 gap-6 sm:grid-cols-3'>
          <div className='flex flex-col items-center rounded-xl bg-card px-4 py-6 text-center ring-1 ring-foreground/10'>
            <div className='mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-brand-100 text-brand-600'>
              <Newspaper className='h-6 w-6' />
            </div>
            <h3 className='font-display mb-1 text-base font-medium text-foreground'>
              {t('steps.collectionTitle')}
            </h3>
            <p className='text-sm text-muted-foreground'>
              {t('steps.collectionDesc')}
            </p>
          </div>

          <div className='flex flex-col items-center rounded-xl bg-card px-4 py-6 text-center ring-1 ring-foreground/10'>
            <div className='mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-brand-100 text-brand-600'>
              <Sparkles className='h-6 w-6' />
            </div>
            <h3 className='font-display mb-1 text-base font-medium text-foreground'>
              {t('steps.aiTitle')}
            </h3>
            <p className='text-sm text-muted-foreground'>
              {t('steps.aiDesc')}
            </p>
          </div>

          <div className='flex flex-col items-center rounded-xl bg-card px-4 py-6 text-center ring-1 ring-foreground/10'>
            <div className='mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-brand-100 text-brand-600'>
              <BookOpen className='h-6 w-6' />
            </div>
            <h3 className='font-display mb-1 text-base font-medium text-foreground'>
              {t('steps.dailyTitle')}
            </h3>
            <p className='text-sm text-muted-foreground'>
              {t('steps.dailyDesc')}
            </p>
          </div>
        </div>
      </section>

      {/* Stack tecnológica */}
      <section className='mb-12'>
        <h2 className='font-display mb-4 text-2xl font-bold text-foreground'>
          {t('stackTitle')}
        </h2>
        <p className='mb-4 text-muted-foreground'>
          {t('stackDesc')}
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
          {t('openSourceTitle')}
        </h2>
        <p className='mb-4 text-sm text-muted-foreground'>
          {t('openSourceDesc')}
        </p>
        <a
          href='https://github.com/tavinholoco/newra-news'
          target='_blank'
          rel='noopener noreferrer'
          className='inline-flex items-center gap-1.5 text-sm font-medium text-brand-600 transition-colors hover:text-brand-400'
        >
          {t('viewOnGithub')}
          <ExternalLink className='h-3.5 w-3.5' />
        </a>
      </section>
    </div>
  );
}
