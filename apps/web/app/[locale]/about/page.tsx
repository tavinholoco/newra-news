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

/**
 * Página de texto (§2 de `docs/v2/02-sitemap-telas.md`).
 *
 * O corrido fica em `max-w-prose` — os 68ch da §8 — enquanto a grade de etapas
 * e os chips usam a largura editorial inteira. Medida de leitura é regra de
 * **texto corrido**: aplicá-la à grade espremeria três cartões numa coluna de
 * 620 px sem melhorar leitura nenhuma.
 */
export default async function AboutPage({ params }: Props) {
  const { locale } = params;
  setRequestLocale(locale);

  const t = await getTranslations('about');

  const steps = [
    {
      icon: Newspaper,
      title: t('steps.collectionTitle'),
      desc: t('steps.collectionDesc'),
    },
    { icon: Sparkles, title: t('steps.aiTitle'), desc: t('steps.aiDesc') },
    { icon: BookOpen, title: t('steps.dailyTitle'), desc: t('steps.dailyDesc') },
  ];

  return (
    <div className='container-editorial py-section'>
      <header className='max-w-prose'>
        <h1 className='font-display text-h1 font-bold text-ink'>
          {t('heroTitle')}
        </h1>
        <p className='mt-block text-body-lg text-ink-secondary'>
          {t('heroDesc')}
        </p>
      </header>

      <section className='mt-section max-w-prose'>
        <h2 className='font-display text-h2 font-bold text-ink'>
          {t('whatIsTitle')}
        </h2>
        <p className='mt-block text-body text-ink-secondary'>
          {t('whatIsDesc')}
        </p>
      </section>

      <section className='mt-section'>
        <h2 className='font-display text-h2 font-bold text-ink'>
          {t('howItWorks')}
        </h2>
        <ol className='mt-block grid grid-cols-1 gap-block sm:grid-cols-3'>
          {steps.map(({ icon: Icon, title, desc }) => (
            <li
              key={title}
              className='flex flex-col items-center rounded-lg border border-line bg-surface p-6 text-center'
            >
              <span className='inline-flex size-12 items-center justify-center rounded-full bg-surface-accent text-brand-accent'>
                <Icon className='size-6' aria-hidden='true' />
              </span>
              <h3 className='mt-4 font-display text-h4 font-semibold text-ink'>
                {title}
              </h3>
              <p className='mt-2 text-body-sm text-ink-secondary'>{desc}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className='mt-section'>
        <h2 className='font-display text-h2 font-bold text-ink'>
          {t('stackTitle')}
        </h2>
        <p className='mt-block max-w-prose text-body text-ink-secondary'>
          {t('stackDesc')}
        </p>
        <ul className='mt-block flex flex-wrap gap-2'>
          {techStack.map((tech) => (
            <li
              key={tech}
              className='inline-flex items-center rounded-full bg-surface-accent px-3 py-1 text-body-sm font-medium text-ink-secondary'
            >
              {tech}
            </li>
          ))}
        </ul>
      </section>

      <section className='mt-section rounded-lg border border-line bg-surface-accent px-gutter py-block text-center'>
        <Github className='mx-auto size-10 text-ink' aria-hidden='true' />
        <h2 className='mt-4 font-display text-h3 font-bold text-ink'>
          {t('openSourceTitle')}
        </h2>
        <p className='mx-auto mt-2 max-w-prose text-body-sm text-ink-secondary'>
          {t('openSourceDesc')}
        </p>
        <a
          href='https://github.com/tavinholoco/newra-news'
          target='_blank'
          rel='noopener noreferrer'
          className='mt-block inline-flex items-center gap-1.5 text-body-sm font-medium text-link transition-colors duration-fast hover:text-link-hover'
        >
          {t('viewOnGithub')}
          <ExternalLink className='size-3.5' aria-hidden='true' />
        </a>
      </section>
    </div>
  );
}
