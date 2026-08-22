import type { JsonLdNode } from '@/lib/json-ld';

interface JsonLdProps {
  /** Um nó ou vários — vários viram um `@graph`, num `<script>` só. */
  data: JsonLdNode | readonly JsonLdNode[];
}

/**
 * Escapa o que fecharia o `<script>` de dentro do JSON.
 *
 * **Não é paranoia teórica: o conteúdo aqui vem de feed RSS de terceiro.** Uma
 * manchete com `</script>` encerraria o bloco no meio do JSON, e o resto do
 * documento passaria a ser interpretado como HTML. `JSON.stringify` não escapa
 * `<`, porque para o JSON ele não tem significado nenhum — quem tem de escapar
 * é quem embute JSON dentro de HTML.
 *
 * Os cinco escapes são a mesma string depois do parse, então o dado estruturado
 * que o buscador lê continua idêntico. `&` entra por causa das entidades HTML;
 * `U+2028` e `U+2029` porque são quebra de linha para o parser de JavaScript e
 * não para o de JSON.
 */
function serialize(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

/**
 * Um bloco `application/ld+json`.
 *
 * **Vários blocos na mesma página são válidos, e é assim que a Fase 7 os
 * distribui**: o layout de idioma declara a marca e o site; cada página declara
 * o que só ela sabe (a matéria, a trilha). O buscador junta tudo num grafo só, e
 * os `@id` de `lib/json-ld.ts` são o que costura os dois lados.
 *
 * É server component: nada aqui precisa do navegador, e um `'use client'`
 * mandaria o JSON duas vezes — no HTML e no payload de hidratação.
 */
export function JsonLd({ data }: JsonLdProps) {
  const nodes: readonly JsonLdNode[] = Array.isArray(data) ? data : [data];
  const payload =
    nodes.length === 1
      ? { '@context': 'https://schema.org', ...nodes[0] }
      : { '@context': 'https://schema.org', '@graph': nodes };

  return (
    <script
      type='application/ld+json'
      // O conteúdo é montado por `lib/json-ld.ts` a partir de dados da API e
      // serializado com o escape acima — não é HTML de origem externa.
      dangerouslySetInnerHTML={{ __html: serialize(payload) }}
    />
  );
}
