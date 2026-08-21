# Baseline visual da V2 — estado corrente

42 capturas de `https://newra-news-web.vercel.app`, **21/08/2026 (20:5x UTC)**,
depois de a Fase 4 (News / Category) entrar em produção. É a referência contra a
qual as fases seguintes se comparam.

```bash
BASE_URL=https://newra-news-web.vercel.app \
NEXT_PUBLIC_API_URL=https://newra-news-api.onrender.com/api \
OUT_DIR=../../docs/v2/baseline-v2 WIDTHS=375,768,1440 FORMAT=jpeg \
node scripts/capture-visual-baseline.mjs
```

12 rotas × 3 larguras (375/768/1440), mais dark em `home`, `news` e
`article-detail` nas larguras 375 e 1440. Manifesto com rota, status HTTP e
arquivo em [`manifest.json`](manifest.json).

## Este diretório é reescrito a cada fase

A §30 pede regressão visual **após cada etapa relevante**, e é isto que a
cumpre. As imagens são substituídas no lugar em vez de acumular um diretório
por fase: o valor de uma baseline é responder "como estava antes da minha
mudança", e para quem trabalha na Fase 3 a resposta é o estado da Fase 2 — o da
Fase 1 não tem mais uso corrente, e cada conjunto pesa ~15 MB.

Os estados anteriores continuam recuperáveis pelo git; o PR de cada fase mostra
o antes e o depois no próprio diff das imagens.

| Captura | Estado |
|---|---|
| 21/08, 20:5x | **atual** — Fase 4 fechada: `/news` como acervo, Lighthouse 97 na rota |
| 21/08, 14:26 | Fase 3: Home editorial, dek do hero com clamp |
| 20/08, 23:05 | Fase 2: masthead de três linhas, faixa de categorias, rodapé no ritmo dos tokens |
| 20/08, 21:29 | Fase 1: tokens novos, shell ainda o da V1 |

> **Foi esta recaptura que achou um defeito em produção**, e vale saber disso ao
> comparar com o histórico do git. A primeira rodada de 21/08 fotografou as oito
> pílulas de categoria com **0** ao lado do nome, logo acima de "5.783
> notícias": o build da Vercel correu antes de o deploy da API subir a rota de
> facetas, o `catch` da página transformou a falha num resultado vazio, e o
> `staleTime` de 5 minutos do TanStack Query fez a query considerá-lo fresco e
> nunca buscar de novo.
>
> Corrigido (`prefetch` em `lib/api.ts`: falha vira `undefined`, que a tela sabe
> desenhar, e não um resultado vazio, que ela apresenta como verdade) e as cinco
> `news--*` foram recapturadas depois do deploy. As contagens agora somam o
> total: 639 + 248 + 838 + 331 + 243 + 119 + 3.106 + 259 = 5.783.

## Diferenças em relação à `baseline-v1/`

Três coisas mudaram no método, e importam na hora de comparar as duas pastas.

**Capturada de produção, não do seed local.** A `baseline-v1/` saiu de um
ambiente local cujo seed não tem imagens de notícia — todos os cards caíam no
gradiente de marca, o que exagerava a saturação em relação ao site real. Estas
capturas têm o conteúdo de verdade. Isso torna a V2 mais fiel ao que o leitor
vê, e ao mesmo tempo significa que **um diff pixel a pixel contra a V1 mistura
mudança de estilo com mudança de conteúdo**. Para julgar o redesign, compare
composição e cor, não pixels.

**A rota de métricas saiu; a landing entrou.** `/[locale]/dashboard` virou
`/[locale]/admin/metrics`, exige sessão + role ADMIN e não pode ser fotografada
por um visitante anônimo (§30). No lugar entrou `/[locale]/newsletter`, criada
na Fase 2.

**O conteúdo muda todo dia.** O briefing e o feed são regerados pelo pipeline
diário, então recapturar em outra data produz imagens diferentes por natureza.

## O que continua não coberto

- **Estado autenticado.** `/favorites` aparece como tela de login e as métricas
  não aparecem — as duas exigem sessão, e o script roda anônimo.
- **1024 e 1920.** A §30 lista cinco larguras de verificação; o conjunto
  versionado usa três, pelo mesmo motivo da V1: peso no git. Rodar sem
  `WIDTHS=` captura as cinco.

## O que estas imagens confirmam da Fase 4

- `/news` abre com **título e descrição da editoria** ("Acervo" + a linha de
  apoio), não mais com um `h1` solto sobre uma grade;
- hero da categoria à esquerda e três matérias na coluna da direita, com
  "ÚLTIMAS" em duas colunas abaixo — a composição da §7, não a grade uniforme;
- pílulas de categoria com estado preenchido, distintas do sublinhado da
  `editorial-nav` logo acima;
- período e ordenação como `<select>` nativo, no raio e na borda dos tokens;
- paginação numerada com corte (`1 2 … 290`);
- contagem em cada pílula, e o seletor de **Fonte** ao lado de período e ordem;
- o coração de favoritar sobreposto no hero e à direita de cada item da lista.

## O que estas imagens confirmam das Fases 1 e 2

- masthead em **três linhas** (§10): sistema, marca e busca, assuntos;
- no mobile o wordmark some e a marca fica (§40.3), com a faixa de categorias
  em scroll horizontal;
- manchetes em **Newsreader**, interface em Inter;
- fundo `paper` no lugar do branco puro, callout do briefing em `brand-50`;
- rodapé em `brand-950` com títulos de seção sólidos — era `text-white/50` a
  4,04:1;
- badges de categoria em `brand-700` sobre branco (6,23:1) — era `brand-600` a
  3,27:1, que reprovava AA em 16 elementos;
- cards sem sombra e sem hover lift, separados por borda e espaço;
- `/about` na medida de 68ch e raio de 12px como teto.
