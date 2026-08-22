import { getLocale, getTranslations } from 'next-intl/server';
import { ArrowLeft, Sparkles } from 'lucide-react';
import type { ArticleWithSources } from '@newranews/types';
import { Link } from '@/i18n/navigation';
import { AiDisclosure } from '@/components/editorial/ai-disclosure';
import { ArticleBody } from '@/components/editorial/article-body';
import { ArticleHero } from '@/components/editorial/article-hero';
import { ReadingTime } from '@/components/editorial/reading-time';
import { SaveButton } from '@/components/editorial/save-button';
import { ShareButton } from '@/components/editorial/share-button';
import { SourceList } from '@/components/editorial/source-list';
import { NewsletterCta } from '@/components/monetization/newsletter-cta';
import { formatArticleDate, readingTimeFromText } from '@/lib/format';
import { toDateFormatLocale } from '@/lib/i18n';

interface ArticleDetailProps {
  article: ArticleWithSources;
}

/**
 * O briefing do dia (§8).
 *
 * **É a tela onde a transparência de IA acontece.** Ao contrário de
 * `/news/[id]`, este texto foi mesmo escrito por um modelo — e a §8 é explícita:
 * um produto jornalístico com IA precisa dizer como o texto foi produzido, com
 * quantas fontes, quando e por qual modelo. Daí a `AiDisclosure` vir **antes**
 * da lista de fontes: primeiro a declaração, depois a evidência.
 *
 * **Sem imagem de hero.** O briefing não tem uma para chamar de sua — as fotos
 * pertencem às matérias que o originaram. Pegar a imagem de uma delas
 * atribuiria ao briefing uma foto de terceiro e sugeriria que ele é sobre
 * aquele assunto.
 *
 * `sources` vazio e os campos de auditoria nulos são o estado normal dos
 * briefings anteriores a 20/08/2026: nada os registrava e não houve backfill
 * possível. A `SourceList` se omite sozinha; a declaração de IA fica, porque
 * vale para todo briefing.
 */
export async function ArticleDetail({ article }: ArticleDetailProps) {
  const t = await getTranslations('article');
  const tCommon = await getTranslations('common');
  const locale = await getLocale();

  const sourceCount = article.sources.length || article.newsCount;

  return (
    <div className='flex flex-col gap-section'>
      <div className='mx-auto w-full max-w-narrow'>
        <Link
          href='/article'
          className='inline-flex items-center gap-1.5 text-body-sm font-medium text-ink-secondary transition-colors duration-fast hover:text-link'
        >
          <ArrowLeft className='size-4' aria-hidden='true' />
          {t('backTo')}
        </Link>

        <ArticleHero
          className='mt-6'
          kicker={
            // `text-link` e não `text-brand-accent`: a linha tem texto, e
            // laranja em texto é `brand-700` (§4 dos tokens).
            <p className='inline-flex items-center gap-2 text-link'>
              <Sparkles className='size-4 shrink-0' aria-hidden='true' />
              <span className='font-display text-overline font-semibold uppercase'>
                {t('briefKicker')}
              </span>
            </p>
          }
          title={article.title}
          dek={article.summary}
          meta={
            <div className='flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1 text-body-sm text-ink-muted'>
              <time dateTime={article.date}>
                {formatArticleDate(article.date, toDateFormatLocale(locale))}
              </time>
              <span>{tCommon('sourcesConsulted', { count: sourceCount })}</span>
              <ReadingTime
                minutes={readingTimeFromText(article.content) ?? 1}
              />
            </div>
          }
          actions={
            <>
              {/* O "salvar" que a Fase 5 registrou como fora de alcance: o
                  `Favorite` só chegava a notícia, e o briefing não podia ser
                  salvo. Com `itemType`, chega. */}
              <SaveButton itemId={article.id} itemType='ARTICLE' />
              <ShareButton title={article.title} text={article.summary} />
            </>
          }
        />
      </div>

      <div className='mx-auto w-full max-w-narrow'>
        <ArticleBody content={article.content} lede={article.summary} />
      </div>

      <div className='mx-auto flex w-full max-w-narrow flex-col gap-block'>
        <AiDisclosure
          sourceCount={sourceCount}
          generatedAt={article.generatedAt}
          modelVersion={article.modelVersion}
          promptVersion={article.promptVersion}
        />

        <SourceList sources={article.sources} />
      </div>

      <NewsletterCta />
    </div>
  );
}
