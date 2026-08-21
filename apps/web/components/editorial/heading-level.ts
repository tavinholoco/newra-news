/**
 * Nível de heading que um componente editorial emite.
 *
 * É prop e não valor fixo porque o mesmo card aparece em páginas com
 * hierarquias diferentes: na Home ele é `h3` (abaixo do `h2` da seção), e numa
 * listagem cujo `h1` é o título da página ele pode ser `h2`. Heading fixo no
 * componente foi o que deixou `heading-order` reprovando em `/news` e
 * `/article` na medição da Fase 1.
 */
export type HeadingLevel = 'h2' | 'h3' | 'h4';
