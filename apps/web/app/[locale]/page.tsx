import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { getHome } from '@/lib/api';
import { HeroStory } from '@/components/editorial/hero-story';
import { TopStories } from '@/components/editorial/top-stories';
import { BriefingCard } from '@/components/editorial/briefing-card';
import { LatestStories } from '@/components/editorial/latest-stories';
import { TrendingList } from '@/components/editorial/trending-list';
import { CategorySection } from '@/components/editorial/category-section';
import { NewsletterCta } from '@/components/editorial/newsletter-cta';
import { SITE_NAME, pageMetadata } from '@/lib/seo';
import { PageView } from '@/components/analytics/page-view';

export const revalidate = 3600;

interface Props {
  params: { locale: string };
}

export async function generateMetadata({
  params: { locale },
}: Props): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: 'site' });

  return pageMetadata({
    locale,
    path: '',
    title: SITE_NAME,
    description: t('description'),
    absoluteTitle: true,
  });
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
 * quem abre a página vê a manchete do dia, não a palavra "Home" — mas o
 * documento precisa de uma raiz de outline para quem navega por heading, e sem
 * ela a página abriria direto num `h2`.
 *
 * **Não é o Lighthouse que pede isto.** O `heading-order` reprova salto de
 * nível, não ausência de `h1`, e `page-has-heading-one` não existe no conjunto
 * auditado — conferido no relatório de 21/08. É acessibilidade real, não
 * pontuação: é a WCAG 2.4.6 e o modo de navegação por headings do leitor de
 * tela.
 */
export default async function HomePage({ params }: Props) {
  const { locale } = params;
  setRequestLocale(locale);

  const t = await getTranslations('home');
  /**
   * **Sem `catch` — e é a correção mais cara da revisão 10.4.**
   *
   * Havia `.catch(() => null)` aqui, e o efeito não era "a Home degrada": era
   * a Home **afirmando** que não houve notícia. Com `revalidate = 3600`, essa
   * afirmação virava a página estática guardada por uma hora, servida a todo
   * mundo — a mesma classe de defeito que pôs as oito categorias zeradas na
   * `/news` ao lado de "5.783 notícias", agora na tela mais vista do produto.
   *
   * Deixando a exceção subir, os dois momentos passam a fazer a coisa certa:
   * na **revalidação**, o Next mantém a página boa anterior no ar e tenta de
   * novo na requisição seguinte; no **build**, ele falha — e falhar é o que se
   * quer, porque a Vercel preserva o deploy anterior e o `CLAUDE.md` já
   * registra que os deploys do web e da API disparam juntos e não terminam
   * juntos. Antes, esse desencontro nascia como Home vazia em produção; agora
   * nasce como build vermelho.
   *
   * O que sobrevive é o `isEmpty` **honesto**: a API respondeu 200 e não havia
   * conteúdo. Dia sem briefing é estado normal do produto (o acervo tem 89
   * artigos em 90 dias) e continua desenhando esta tela.
   */
  const home = await getHome();

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
        {/* A Home vazia continua sendo uma visita à Home: sem isto, a métrica
            de sessões contaria só os dias em que o pipeline rodou. */}
        <PageView event='homepage_view' />
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
      <PageView event='homepage_view' />
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
              <HeroStory
                story={home.hero}
                source='hero'
                position={0}
                className='lg:col-span-2'
              />
            ) : null}
            <TopStories
              stories={home.topStories}
              className={home.hero ? undefined : 'lg:col-span-3'}
            />
          </div>
        ) : null}


        {home.briefing ? (
          <BriefingCard briefing={home.briefing} source='briefing' />
        ) : null}

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


        {home.categories.map((section) => (
          <CategorySection key={section.category} section={section} />
        ))}

        <NewsletterCta />
      </div>
    </div>
  );
}
