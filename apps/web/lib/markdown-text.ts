/**
 * Os campos do briefing que o produto consome como **texto puro**.
 *
 * `Article.title` e `Article.summary` sao derivados do Markdown que a IA
 * escreve (`parseMarkdownResponse`, na API): o titulo e a linha `# `, e o
 * subtitulo e a primeira linha que nao e heading. Nenhum dos dois passa por
 * renderizador — vao direto para `<h1>`, `<meta name="description">`,
 * `og:title`, o JSON-LD, os cards e o assunto do e-mail da newsletter. **O que
 * o modelo escreveu como formatacao chega neles como caractere.**
 *
 * A Fase 12 ensinou o **corpo** a renderizar enfase (`article-body`) e deixou
 * os dois de fora. O sintoma apareceu no briefing de 01/09/2026:
 *
 *     ** no dek?         true
 *     <strong> no dek?   false
 *     <strong> no corpo? true
 *
 * ## O que foi medido, nos 88 briefings retidos (01/09/2026)
 *
 * | | |
 * |---|---|
 * | subtitulo com marcador de enfase | **19 (21,6%)** |
 * | titulo com marcador de enfase | **30 (34,1%)** |
 * | titulo abrindo com o rotulo `TITULO:` | **17 (19,3%)** |
 * | subtitulo que e so um rotulo (`Introducao:`) ou uma regua (`---`) | **15 (17,0%)** |
 *
 * **O titulo e o campo mais afetado, e nao era o que se procurava.** Ele
 * aparece no `h1`, na aba do navegador, no card de cada mes do historico e no
 * cartao de compartilhamento — quatro lugares onde `**TITULO:** "Bracos de
 * Incendio..."` estava sendo lido por quem visita.
 *
 * ## Por que tirar, e nao renderizar
 *
 * Metadata e texto puro por definicao, o e-mail escapa HTML antes de enviar, e
 * um `<strong>` dentro do subtitulo competiria com o `h1` logo acima.
 * Renderizar consertaria uma tela e deixaria cinco lugares com asterisco.
 *
 * ## Por que aqui **e** na API
 *
 * `parseMarkdownResponse` passou a limpar os dois campos na gravacao, o que
 * conserta os briefings **novos** em todo consumidor de uma vez — inclusive o
 * e-mail da newsletter, que nao passa por aqui. Este modulo cobre os **90 dias
 * ja gravados**. E a mesma divisao de trabalho da higiene de texto da Fase 12:
 * a ingestao conserta o que entra, a tela cobre o que ja esta la.
 *
 * ## O que o prompt ja resolveu, e o que nao resolveu
 *
 * Separando por epoca: as 30 ocorrencias de titulo e as 15 de subtitulo
 * degenerado estao **todas** na epoca `null`, anterior ao versionamento — o
 * prompt as encerrou. **A enfase no subtitulo nao**: ela aparece em 2 dos 5
 * briefings da epoca `v2`, que e a atual. Por isso o remedio nao pode ser
 * "ajusta o prompt e espera".
 */

/**
 * `**forte**` e `*enfase*`, na regra do Markdown: o delimitador cola no texto.
 *
 * O `\S` das duas pontas e o que impede `3 * 4 = 12` de virar enfase — sem ele,
 * qualquer multiplicacao escrita com asterisco perderia o sinal.
 *
 * **E a mesma expressao que o `article-body` usa para renderizar**, e mora aqui
 * para ser uma so: tirar e renderizar precisam concordar sobre o que e enfase,
 * senao o dek some de um jeito e o corpo aparece de outro.
 */
export const EMPHASIS = /(\*\*)(\S(?:[^*]*\S)?)\1|(\*)(\S(?:[^*]*\S)?)\3/g;

/**
 * O texto sem os marcadores de enfase, com o conteudo deles preservado.
 *
 * `**Ibovespa**` vira `Ibovespa`. O que nao e enfase pela regra acima fica como
 * esta — um asterisco solto, uma multiplicacao, um `*` no meio de palavra.
 */
export function stripInlineMarkdown(text: string): string {
  return text.replace(EMPHASIS, (_, __, forte: string, ___, enfase: string) =>
    forte ?? enfase,
  );
}

/** `TITULO:`, `Titulo:`, `Title:` — o rotulo do campo, impresso como valor. */
const FIELD_LABEL = /^\s*(t[íi]tulo|title|introdu[çc][ãa]o)\s*:\s*/i;

/** O titulo inteiro entre aspas, que e o modelo delimitando o valor do rotulo. */
const WRAPPING_QUOTES = /^["“']([\s\S]+)["”']$/;

/**
 * O `title` do briefing pronto para ser exibido, indexado ou compartilhado.
 *
 * Faz tres coisas, nesta ordem, e cada uma tem um motivo diferente:
 *
 * 1. **tira a enfase** — 34,1% dos retidos;
 * 2. **tira o rotulo `TITULO:`** — 19,3%. O modelo imprimiu o nome do campo
 *    junto com o valor. Nenhuma manchete comeca por "TITULO:", entao a regra
 *    nao tem como comer texto legitimo;
 * 3. **tira as aspas em volta — mas so quando o rotulo estava la.** `TITULO:
 *    "Bracos de Incendio"` sao aspas delimitando o valor do rotulo, e saem
 *    junto com ele. Sem rotulo, aspas em volta ficam: uma manchete **pode** ser
 *    inteira uma citacao, e desfazer isso seria adivinhar.
 */
export function plainTitle(title: string): string {
  const semEnfase = stripInlineMarkdown(title).trim();
  const semRotulo = semEnfase.replace(FIELD_LABEL, '').trim();
  if (semRotulo === semEnfase) return semEnfase;
  return semRotulo.replace(WRAPPING_QUOTES, '$1').trim();
}

/**
 * O `summary` do briefing pronto para ser exibido ou indexado.
 *
 * So enfase: um subtitulo degenerado (`Introducao:`, `---`) nao tem conserto
 * daqui — o texto certo nao esta no campo. Quem o impede de nascer e o
 * `deriveSummary` da API, e os 15 retidos envelhecem junto com a retencao de 90
 * dias. **Trocar o subtitulo pela primeira linha do corpo aqui seria pior:** e
 * ele que a deduplicacao do `article-body` usa como chave, e um dek que nao
 * casa com o corpo faz o paragrafo de abertura aparecer duas vezes.
 */
export function plainSummary(summary: string): string {
  return stripInlineMarkdown(summary).trim();
}
