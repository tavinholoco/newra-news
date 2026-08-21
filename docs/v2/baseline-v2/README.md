# Baseline visual da V2 — estado corrente

42 capturas de `https://newra-news-web.vercel.app`, **21/08/2026**, depois de a
Fase 3 (Home) entrar em produção. É a referência contra a qual as fases
seguintes se comparam.

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
| 21/08 | **atual** — Fase 3 fechada: Home editorial, dek do hero com clamp, Lighthouse 95·100·100·100 |
| 20/08, 23:05 | Fase 2: masthead de três linhas, faixa de categorias, rodapé no ritmo dos tokens |
| 20/08, 21:29 | Fase 1: tokens novos, shell ainda o da V1 |

> **Duas coisas ainda vão mexer nestas imagens, e é esperado.** A captura é de
> antes da primeira execução da etapa 8.5 do pipeline, que higieniza o texto já
> gravado — hoje o dek do hero em produção ainda abre repetindo a manchete e
> mostrando o crédito da foto, e isso some na próxima rodada. E a seção de
> categoria com uma matéria só ainda aparece com metade da faixa vazia, o que
> foi corrigido depois desta captura. Recapturar quando as duas tiverem subido.

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
