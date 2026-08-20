# Baseline visual da V2 — pós-Fase 1

39 capturas de `https://newra-news-web.vercel.app`, 20/08/2026, logo depois de
a Fase 1 (design tokens) entrar em produção. É a **referência das Fases 2–7**:
a partir daqui, toda mudança de shell, home, listagem ou artigo se compara
contra estas imagens.

```bash
BASE_URL=https://newra-news-web.vercel.app \
NEXT_PUBLIC_API_URL=https://newra-news-api.onrender.com/api \
OUT_DIR=../../docs/v2/baseline-v2 WIDTHS=375,768,1440 FORMAT=jpeg \
node scripts/capture-visual-baseline.mjs
```

12 rotas × 3 larguras (375/768/1440), mais dark em `home`, `news` e
`article-detail` nas larguras 375 e 1440. Manifesto com rota, status HTTP e
arquivo em [`manifest.json`](manifest.json).

## Diferenças em relação à `baseline-v1/`

Três coisas mudaram no método, e importam na hora de comparar as duas pastas.

**Capturada de produção, não do seed local.** A `baseline-v1/` saiu de um
ambiente local cujo seed não tem imagens de notícia — todos os cards caíam no
gradiente de marca, o que exagerava a saturação em relação ao site real. Estas
capturas têm o conteúdo de verdade: parte dos cards com foto, parte no
gradiente. Isso torna a V2 mais fiel ao que o leitor vê, e ao mesmo tempo
significa que **um diff pixel a pixel contra a V1 mistura mudança de estilo com
mudança de conteúdo**. Para julgar o redesign, compare composição e cor, não
pixels.

**São 39, não 42.** As três capturas de `dashboard` saíram: a rota virou
`/[locale]/admin/metrics`, exige sessão + role ADMIN e não pode ser fotografada
por um visitante anônimo (§30).

**O conteúdo muda todo dia.** O briefing e o feed são regerados pelo pipeline
diário, então recapturar em outra data produz imagens diferentes por natureza.
Estas registram 20/08/2026.

## O que continua não coberto

- **Estado autenticado.** `/favorites` aparece como tela de login e as métricas
  não aparecem — as duas exigem sessão, e o script roda anônimo.
- **1024 e 1920.** A §30 lista cinco larguras de verificação; o conjunto
  versionado usa três, pelo mesmo motivo da V1: peso no git. Rodar sem
  `WIDTHS=` captura as cinco.

## O que estas imagens já confirmam da Fase 1

- manchetes em **Newsreader**, interface em Inter;
- fundo `paper` no lugar do branco puro, e o callout do briefing em `brand-50`;
- rodapé em `brand-950` com títulos de seção sólidos — era `text-white/50` a
  4,04:1;
- badges de categoria em `brand-700` sobre branco (6,23:1) — era `brand-600` a
  3,27:1, que reprovava AA em 16 elementos;
- cards sem sombra e sem hover lift, separados por borda e espaço;
- raio de 12px como teto.
