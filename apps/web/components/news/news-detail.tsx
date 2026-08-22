import { getTranslations } from 'next-intl/server';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import type { EditorialStory, News } from '@newranews/types';
import { Link } from '@/i18n/navigation';
import { Badge } from '@/components/ui/badge';
import { ArticleBody } from '@/components/editorial/article-body';
import { ArticleHero } from '@/components/editorial/article-hero';
import { ArticleMeta } from '@/components/editorial/article-meta';
import { RelatedStories } from '@/components/editorial/related-stories';
import { ShareButton } from '@/components/editorial/share-button';
import { SaveButton } from '@/components/editorial/save-button';
import { NewsletterCta } from '@/components/monetization/newsletter-cta';
import { readingTimeFromText } from '@/lib/format';

interface NewsDetailProps {
  news: News;
  related: EditorialStory[];
}

/**
 * A tela da notícia coletada (§8 e §9).
 *
 * **Continua server component**, e é o que permite renderizar o `NewsletterCta`
 * — que é `async` e não pode ser filho de um client component. Os controles que
 * precisam do navegador (`SaveButton`, `ShareButton`) entram como elementos
 * nas props do hero; a fronteira fica neles, não na tela inteira.
 *
 * **Não tem seção de transparência de IA, e é de propósito.** Esta matéria foi
 * escrita por uma redação humana e coletada por RSS; o que a IA produz é o
 * briefing diário, em `/article/[date]`. Carimbar "produzido por IA" aqui
 * mentiria na direção que mais custa a um produto jornalístico. O que a tela
 * declara é a outra coisa: que o texto é do veículo e que o Newra News coletou.
 *
 * **O `content` do RSS é quase sempre um trecho, não a matéria.** Por isso o
 * corpo vem rotulado como trecho e o caminho para a fonte aparece duas vezes —
 * no topo, junto das ações, e no fim do texto. Fingir que a página tem a matéria
 * inteira faria o leitor rolar até o fim para descobrir que não tem.
 */
export async function NewsDetail({ news, related }: NewsDetailProps) {
  const t = await getTranslations('news');
  const tCategories = await getTranslations('categories');

  const readingTime = readingTimeFromText(news.content);

  return (
    <div className='flex flex-col gap-section'>
      {/* A medida de leitura vale para o hero e o corpo; as relacionadas e o
          CTA ocupam a largura cheia — uma grade de 4 colunas dentro de 720px
          viraria quatro tiras. */}
      <div className='mx-auto w-full max-w-narrow'>
        <Link
          href='/news'
          className='inline-flex items-center gap-1.5 text-body-sm font-medium text-ink-secondary transition-colors duration-fast hover:text-link'
        >
          <ArrowLeft className='size-4' aria-hidden='true' />
          {t('backTo')}
        </Link>

        <ArticleHero
          className='mt-6'
          kicker={
            <Badge className='self-start'>{tCategories(news.category)}</Badge>
          }
          title={news.title}
          dek={news.description}
          image={{ src: news.imageUrl, alt: news.title }}
          meta={
            <ArticleMeta
              source={news.source}
              publishedAt={news.publishedAt}
              readingTimeMinutes={readingTime ?? undefined}
              size='body-sm'
              className='min-w-0'
            />
          }
          actions={
            <>
              <SaveButton itemId={news.id} />
              <ShareButton title={news.title} text={news.description} />
            </>
          }
        />
      </div>

      <div className='mx-auto w-full max-w-narrow'>
        {news.content ? (
          <>
            <p className='text-overline uppercase tracking-wide text-ink-muted'>
              {t('excerptLabel')}
            </p>
            <ArticleBody
              content={news.content}
              lede={news.description}
              className='mt-3'
            />
          </>
        ) : (
          <p className='text-body-lg text-ink-secondary'>
            {t('fullContentHint')}
          </p>
        )}

        <a
          href={news.sourceUrl}
          target='_blank'
          rel='noopener noreferrer'
          className='mt-8 inline-flex items-center gap-1.5 font-display text-body font-semibold text-link transition-colors duration-base hover:text-link-hover'
        >
          {t('readAtSource')}
          <ExternalLink className='size-4' aria-hidden='true' />
        </a>

        <p className='mt-6 border-t border-line pt-4 text-body-sm text-ink-muted'>
          {t('collectedNotice', { source: news.source })}
        </p>
      </div>

      <RelatedStories stories={related} />

      <NewsletterCta />
    </div>
  );
}
