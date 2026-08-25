import { getTranslations } from 'next-intl/server';
import { ExternalLink } from 'lucide-react';
import type { EditorialStory, News } from '@newranews/types';
import { Badge } from '@/components/ui/badge';
import { Breadcrumb } from '@/components/editorial/breadcrumb';
import type { BreadcrumbStep } from '@/lib/json-ld';
import {
  ArticleBody,
  hasReadableBody,
  parseArticleBody,
} from '@/components/editorial/article-body';
import { ArticleHero } from '@/components/editorial/article-hero';
import { ArticleMeta } from '@/components/editorial/article-meta';
import { RelatedStories } from '@/components/editorial/related-stories';
import { ShareButton } from '@/components/editorial/share-button';
import { SaveButton } from '@/components/editorial/save-button';
import { NewsletterCta } from '@/components/editorial/newsletter-cta';
import { readingTimeFromText } from '@/lib/format';
import { ScrollDepth } from '@/components/analytics/scroll-depth';

/** `id` do corpo, para a `ScrollDepth` medir o texto e não a página. */
const BODY_ID = 'news-body';

interface NewsDetailProps {
  news: News;
  related: EditorialStory[];
  /**
   * A trilha, montada pela página — que é quem também a manda para o
   * `BreadcrumbList`. Uma lista só serve as duas pontas: marcação de trilha que
   * não descreve a trilha visível é dado estruturado errado.
   */
  breadcrumb: readonly BreadcrumbStep[];
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
export async function NewsDetail({
  news,
  related,
  breadcrumb,
}: NewsDetailProps) {
  const t = await getTranslations('news');
  const tCategories = await getTranslations('categories');
  const tShell = await getTranslations('shell');

  /**
   * O corpo quando existe, o dek quando não — o mesmo par que o
   * `editorial.mapper` da API usa para o card.
   *
   * **Só o `content` deixaria 40% das telas sem o dado**, agora que a ingestão
   * devolve `null` para a matéria que veio só com resumo. O card continuaria
   * mostrando "3 min" e a tela de leitura da mesma matéria, nada — dois números
   * diferentes para a mesma coisa, o defeito que a pílula de contagem da Fase 4
   * já custou uma vez.
   */
  const readingTime = readingTimeFromText(news.content || news.description);

  /**
   * **O rótulo "Trecho" só aparece quando há trecho.**
   *
   * Ter `content` não é ter corpo: a tela deduplica o parágrafo de abertura
   * contra o dek exibido acima, e em 23,2% do acervo o que sobrava era nada —
   * o rótulo em cima de uma caixa vazia. Perguntar aos blocos, e não ao campo,
   * é o que faz a tela dizer a verdade: a ingestão da Fase 12 já devolve `null`
   * nesse caso, mas a decisão de desenhar é de quem desenha.
   */
  const bodyBlocks = news.content
    ? parseArticleBody(news.content, news.description)
    : [];
  const showExcerpt = hasReadableBody(bodyBlocks);

  // `article` e não `div`: veio da auditoria de leitor de tela da Fase 7.
  // A tela **é** um artigo, e não havia elemento nenhum dizendo isso — o
  // documento era uma pilha de `div` com um `h1` no meio. Marcado, o leitor
  // de tela ganha a navegação por artigo, o modo leitura do navegador
  // reconhece o corpo, e o `header` do `ArticleHero` passa a ser o cabeçalho
  // **daquele** artigo em vez de um `header` solto. Nenhuma classe mudou.
  return (
    <article className='flex flex-col gap-section'>
      {/* A medida de leitura vale para o hero e o corpo; as relacionadas e o
          CTA ocupam a largura cheia — uma grade de 4 colunas dentro de 720px
          viraria quatro tiras. */}
      <div className='mx-auto w-full max-w-narrow'>
        <Breadcrumb steps={breadcrumb} ariaLabel={tShell('breadcrumb')} />

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
              <SaveButton
                itemId={news.id}
                category={news.category}
                origin='search'
              />
              <ShareButton
                title={news.title}
                text={news.description}
                contentId={news.id}
                contentType='story'
              />
            </>
          }
        />
      </div>

      <div className='mx-auto w-full max-w-narrow'>
        {showExcerpt && news.content ? (
          <>
            <p className='text-overline uppercase tracking-wide text-ink-muted'>
              {t('excerptLabel')}
            </p>
            <ArticleBody
              id={BODY_ID}
              content={news.content}
              lede={news.description}
              className='mt-3'
            />
            <ScrollDepth
              contentId={news.id}
              contentType='story'
              targetId={BODY_ID}
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
    </article>
  );
}
