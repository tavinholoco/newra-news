import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { getHome } from '@/lib/api';
import { HeroStory } from '@/components/editorial/hero-story';
import { TopStories } from '@/components/editorial/top-stories';
import { BriefingCard } from '@/components/editorial/briefing-card';
import { LatestStories } from '@/components/editorial/latest-stories';
import { TrendingList } from '@/components/editorial/trending-list';
import { CategorySection } from '@/components/editorial/category-section';
import { NewsletterCta } from '@/components/monetization/newsletter-cta';
import { AdSlot } from '@/components/monetization/ad-slot';
import { SITE_NAME } from '@/lib/seo';

export const revalidate = 3600;

interface Props {
  params: { locale: string };
}

export async function generateMetadata({
  params: { locale },
}: Props): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: 'site' });

  return {
    title: { absolute: SITE_NAME },
    description: t('description'),
    alternates: {
      languages: {
        'pt-BR': '/pt-BR',
        en: '/en',
      },
    },
    openGraph: {
      title: SITE_NAME,
      description: t('description'),
    },
    twitter: {
      title: SITE_NAME,
      description: t('description'),
    },
  };
}

/**
 * A Home editorial da V2 (§6 do plano, Fase 3).
 *
 * **Uma chamada de rede, não seis.** `GET /api/home` traz hero, briefing, top
 * stories, trending, categorias e latest numa resposta só, e é ela que garante
 * que nenhuma matéria aparece em dois blocos — a precedência é do servidor.
 * Compor bloco a bloco daqui seriam 6+ requisições em sequência a partir de um
 * Server Component.
 *
 * **Todo bloco se omite sozinho quando não tem dado.** Hero sem imagem no
 * acervo, briefing antes de o pipeline do dia rodar, trending sem publicação
 * nas últimas 24h: os três são estados normais, e seção com título e nada
 * dentro é pior que seção nenhuma.
 *
 * O `h1` é `sr-only` de propósito. A Home não tem um título visível próprio —
 * quem abre a página vê a manchete do dia, não a palavra "Home" — mas uma
 * página sem `h1` reprova `heading-order` no Lighthouse, que é exatamente a
 * auditoria que sobrou de pé nas medições da Fase 1.
 */
export default async function HomePage({ params }: Props) {
  const { locale } = params;
  setRequestLocale(locale);

  const t = await getTranslations('home');
  const home = await getHome().catch(() => null);

  const isEmpty =
    !home ||
    (!home.hero &&
      !home.briefing &&
      home.topStories.length === 0 &&
      home.trending.length === 0 &&
      home.latest.length === 0 &&
      home.categories.length === 0);

  if (isEmpty) {
    return (
      <div className='container-editorial py-section'>
        <h1 className='font-display text-h2 font-bold text-ink'>
          {t('emptyTitle')}
        </h1>
        <p className='mt-3 max-w-prose text-body text-ink-secondary'>
          {t('emptyDesc')}
        </p>
      </div>
    );
  }

  const hasLeadRow = Boolean(home.hero) || home.topStories.length > 0;
  const hasFeedRow = home.latest.length > 0 || home.trending.length > 0;

  return (
    <div className='container-editorial py-section'>
      <h1 className='sr-only'>{t('srHeading')}</h1>

      <div className='flex flex-col gap-section'>
        {/* Hero + principais notícias (§6.1).
            As duas faixas abaixo são grids de três colunas onde cada lado pode
            faltar, e os dois casos precisam de tratamento explícito: o wrapper
            só é emitido se **algum** dos lados tem conteúdo — um grid vazio
            tem altura zero mas ainda consome o `gap-section` do pai, abrindo
            um buraco no meio da página —, e o lado que sobrou ocupa a faixa
            inteira em vez de deixar dois terços em branco. */}
        {hasLeadRow ? (
          <div className='grid gap-block lg:grid-cols-3'>
            {home.hero ? (
              <HeroStory story={home.hero} className='lg:col-span-2' />
            ) : null}
            <TopStories
              stories={home.topStories}
              className={home.hero ? undefined : 'lg:col-span-3'}
            />
          </div>
        ) : null}

        <AdSlot placement='home-after-hero' format='leaderboard' />

        {home.briefing ? <BriefingCard briefing={home.briefing} /> : null}

        {/* Mais notícias + em alta (§6.1). */}
        {hasFeedRow ? (
          <div className='grid gap-block lg:grid-cols-3'>
            <LatestStories
              stories={home.latest}
              className={
                home.trending.length > 0 ? 'lg:col-span-2' : 'lg:col-span-3'
              }
            />
            <TrendingList
              stories={home.trending}
              className={home.latest.length > 0 ? undefined : 'lg:col-span-3'}
            />
          </div>
        ) : null}

        <AdSlot placement='home-between-sections' format='leaderboard' />

        {home.categories.map((section) => (
          <CategorySection key={section.category} section={section} />
        ))}

        <NewsletterCta />
      </div>
    </div>
  );
}
