/**
 * **A versão das regras que a etapa 8.5 reaplica ao acervo.**
 *
 * Plano de ação de 11/11/2026, P5. A etapa 8.5 levava **~49 s de um run de
 * ~75 s** varrendo ~10,5 mil linhas para **mudar zero**: a ingestão já grava o
 * que é novo com as regras atuais, e as antigas só mudam quando uma regra muda.
 * Os runs iam de 76 a 144 s, o cron da Vercel espera o run por 85 s
 * (`PIPELINE_SETTLE_MAX_MS` no web), e em 02/11 o run levou 85,05 s — a sonda
 * do login ficou com a véspera e o Heartbeat reprovou.
 *
 * Daí a versão: o evento da 8.5 a grava, e a etapa só varre o acervo inteiro
 * quando a versão gravada é outra; nos outros dias, só o que entrou desde a
 * última varredura. "A correção alcança o acervo" continua valendo **porque
 * mudar a regra muda a versão** — e isso não depende de ninguém lembrar:
 * `tests/services/renormalize-rules.test.ts` refaz a impressão digital dos
 * arquivos abaixo (sem os comentários) e reprova enquanto este valor não for
 * o dela, dizendo qual é.
 *
 * Mudar só comentário ou espaço não muda a versão. Mudar uma linha de código
 * de qualquer um deles muda — inclusive o que não altera o resultado, e aí o
 * custo é uma varredura completa a mais, uma vez.
 */
export const RENORMALIZE_RULES_VERSION = '61a7689df5df';

/**
 * O que a etapa 8.5 aplica, relativo a `apps/api/src`: os arquivos inteiros, e
 * de `ai-utils.ts` só as declarações do `decodeEntities` — o resto daquele
 * arquivo é o prompt, que muda por outros motivos.
 */
export const RENORMALIZE_RULE_SOURCES = {
  files: [
    'providers/news/feed-text.ts',
    'services/category-classifier.service.ts',
    'config/rss-sources.ts',
    'services/news-renormalizer.service.ts',
  ],
  declarations: {
    'providers/ai/ai-utils.ts': ['NAMED_ENTITIES', 'MAX_DECODE_PASSES', 'decodeOnce', 'decodeEntities'],
  },
} as const;
