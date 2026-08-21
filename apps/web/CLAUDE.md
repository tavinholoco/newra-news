# Frontend — Next.js

## Arquitetura
- Next.js 14+ com App Router
- Tailwind CSS + shadcn/ui para componentes
- TanStack Query para data fetching client-side
- **i18n com next-intl v3 (roteamento por prefixo)** — URLs `/pt-BR/...` e
  `/en/...` (`localePrefix: 'always'`); o middleware redireciona URLs sem
  prefixo para o locale negociado (cookie `NEXT_LOCALE` → accept-language →
  default `pt-BR`); `i18n/request.ts` resolve o locale do segmento `[locale]`,
  `messages/{pt-BR,en}.json` têm as strings; server components usam
  `getTranslations`/`setRequestLocale`, client components usam
  `useTranslations`/`useLocale`; navegação via `@/i18n/navigation` (Link/
  `usePathname`/`useRouter` aplicam o prefixo automaticamente)
- **Renderização estática + ISR por idioma** — com `generateStaticParams` +
  `setRequestLocale`, cada página é SSG (`revalidate: 3600`) para pt-BR e en
- **Restrição importante** — o `app/layout.tsx` raiz é pass-through (sem
  `<html>`); **não criar `loading.tsx`/`error.tsx` na raiz** (seus boundaries
  caem fora do `<html>` e quebram a hidratação — ``Only one element on
  document allowed``). Eles vivem em `app/[locale]/`; o `not-found.tsx` raiz
  deve renderizar `<html>`/`<body>` próprios (fora de qualquer layout)
- **Revalidação on-demand** — `app/api/cron/daily-news/route.ts` chama
  `revalidatePath('/[locale]', 'layout')` + `revalidatePath('/sitemap.xml')`
  após o trigger do pipeline. **Gotcha:** o cache do Next grava as tags com o
  padrão literal da rota (`_N_T_/[locale]/layout`), então revalidar por
  caminho resolvido (`/pt-BR`, `/en`) **não invalida nada** — use sempre o
  padrão `/[...]`

## i18n (regras rápidas)
- Toda string de UI deve sair de `messages/{locale}.json` (nunca hardcoded)
- Componentes importados por client components **devem** ser `'use client'` e
  usar `useTranslations` (nunca `getTranslations`, que é server-only)
- Datas/números: passar o locale para `formatDate`/`formatArticleDate`/
  `formatCount` via `toDateFormatLocale()` de `lib/i18n.ts`
- Adicionar/renomear chaves exige atualizar **os dois** JSONs — o teste
  `tests/lib/i18n-messages.test.ts` falha se houver divergência
- **Chave que ninguém lê também falha o teste.** Reescrever uma tela leva o
  `t('...')` embora e deixa a string para trás; a Fase 5 achou sete de uma vez.
  Namespaces resolvidos dinamicamente (`categories`, `categoryDescriptions`,
  `newsPeriod`, `newsSort`) e `metadata` estão isentos — os filhos deste último
  são namespaces, não chaves

## Padrões
- Componentes em components/ organizados por domínio
- shadcn/ui em components/ui/ (não modificar diretamente)
- Hooks customizados em lib/queries.ts (TanStack Query)
- Client HTTP configurado em lib/api.ts
- Utilitários em lib/utils.ts

## Shell (Fase 2)

O topo são **três linhas** (§10 do plano), compostas em `layout/header.tsx`:

| Componente | Linha | Papel |
|---|---|---|
| `top-bar` | 1 | data, edição, newsletter, idioma, tema, sessão — some no mobile |
| `masthead` | 2 | marca, navegação secundária, busca; no mobile é o header compacto |
| `editorial-nav` | 3 | faixa de assuntos, em todas as telas, scroll horizontal no mobile |
| `mobile-nav` | — | painel do header compacto; **não** repete as categorias (§10) |

Regras que não são óbvias no código:

- **Ninguém sabe a altura do header.** O `<main>` cresce por `flex-1` dentro de
  um `<body>` em coluna, e o menu mobile se ancora por `absolute top-full`. Não
  reintroduza `h-16`/`top-16`/`calc(100vh-…)` — era assim antes, e um masthead
  de três linhas quebrava os três de uma vez.
- **`editorial-nav` ≠ `category-nav`.** Este é navegação e leva a
  `/news?category=X`; o `category-nav` (Fase 4) é o filtro do acervo dentro de
  `/news`, com estado selecionado e contagem. São componentes diferentes de
  propósito: um sublinha, o outro preenche.
- **O `MastheadSearch` submete para `/news?search=…` e descarta os demais
  filtros.** É busca nova a partir do shell, não refinamento da tela — quem
  refina usa o campo da própria `/news`.
- **Componentes do shell aparecem duas vezes** (desktop e dentro do menu). Se
  algum precisar de `id`, use `useId()`.
- **O skip link é o primeiro filho dentro dos providers**, e aponta para
  `main#conteudo`. Ele se desloca por `top` negativo, não pelo par `sr-only` /
  `focus:not-sr-only`: aquele par põe duas utilities de mesma especificidade
  disputando `position`/`width`/`height`, decidido pela ordem no CSS gerado.
  Com `top`, o `:focus` vence por especificidade.
- **`Logo`** tem a marca em SVG inline com `currentColor` — é o que a deixa
  herdar a cor no rodapé escuro, coisa que um `<img>` não faz. O wordmark é
  texto (§40.3-A); trocar pelo lockup desenhado é substituir um `<span>` ali
  dentro e em mais lugar nenhum.

## Acervo — `/news` (Fase 4)

O estado da tela **mora na URL**, não em `useState`. `lib/news-filters.ts` é a
parte pura (ler, escrever, contar filtros ativos, resolver o período em data) e
`lib/use-news-filters.ts` é o hook que navega.

| Peça | Papel |
|---|---|
| `news-archive-header` | `h1` + descrição curta, genérica ou da categoria |
| `news-search` | campo, debounce e histórico local |
| `category-nav` | pílulas com estado e contagem |
| `news-filter-bar` | fonte, período, ordem e "limpar filtros" |
| `news-list` | hero + lista, compondo os cards editoriais |
| `news-pagination` · `news-empty-state` · `news-list-skeleton` | os três estados da lista |

Regras que não são óbvias no código:

- **Escolha escreve com `push`; a busca, com `replace`.** Cada clique é uma
  decisão que o botão Voltar deve desfazer. A busca é debounced e escreveria uma
  entrada de histórico por pausa de digitação.
- **Qualquer filtro zera a página.** Ficar na página 7 de uma busca que agora
  tem duas devolve uma tela vazia que parece defeito.
- **Valor desconhecido na URL cai no default em silêncio.** A query string é
  editável por qualquer um: `?category=BANANA` mostra o acervo, não uma tela
  quebrada.
- **`/news` limpa tem de ser `/news`.** `writeNewsFilters` omite tudo que é
  default — é a URL que a `editorial-nav` aponta e a que entra no sitemap.
- **O período viaja como rótulo (`?period=7d`) e vira data na consulta,
  ancorada na meia-noite UTC.** Ancorado no instante, o `from` mudaria a cada
  render — e ele entra na chave do TanStack Query e na URL da API.
- **A contagem da pílula é o que o clique dela devolve.** As facetas ignoram a
  própria dimensão, e a pílula "Todas" soma as facetas de categoria. **Não use
  um total do recorte ali** — foi o defeito que a revisão da Fase 4 achou.
- **O `Suspense` da página repete o `NewsArchiveHeader` no fallback.** A rota é
  estática: sem isso o HTML pré-renderizado sairia com um retângulo cinza no
  lugar do `h1`.
- **O histórico de busca é `localStorage`**, e toda leitura é defensiva —
  `localStorage` lança em modo privativo e o conteúdo é editável à mão.
  Histórico corrompido volta vazio e nunca derruba a busca.
- **`newsToStory` (`lib/story.ts`) é a ponte** entre o `News` que `/api/news`
  devolve e o `EditorialStory` que os cards falam. É a contraparte de
  `toEditorialStory` do backend, com a mesma regra de tempo de leitura.

## Telas de leitura (Fase 5)

São **três**, e as diferenças entre elas não são cosméticas.

| Tela | O texto é | Tem `ai-disclosure` | Tem `source-list` | Tem `related-stories` |
|---|---|---|---|---|
| `/news/[id]` | de uma redação, coletado por RSS | **não** | não (a fonte é uma só, e cabe na metadata) | sim |
| `/article/[date]` | escrito por um modelo | **sim** | sim (quinze fontes) | não (as relacionadas *são* as fontes) |
| `/article` | — | — | — | — |

Regras que não são óbvias no código:

- **Transparência de IA só no briefing.** A notícia foi escrita por uma redação;
  carimbá-la como produzida por IA mentiria na direção que mais custa aqui. O
  que ela declara é a outra coisa — que o texto é do veículo.
- **`source-list` leva ao `sourceUrl` externo, nunca a `/news/[id]`.** `newsId`
  é ponteiro fraco: o cleanup apaga `News` aos 30 dias e o briefing vive 90.
- **`article-body` não é renderizador de Markdown, e não deve virar um.** O
  corpo de produção foi medido: só `###`, sem negrito nem listas. Os `###` saem
  como **`h2`** — o nível é decisão da página, e o `h1` é o título.
- **`article-hero` é casca com encaixes**, não um componente com `variant`. As
  duas telas compartilham a composição da §8 e quase nada do conteúdo.
- **A imagem vem depois da metadata** (ordem da §8): numa tela de leitura entra-se
  pelo título e pela procedência, e a imagem antes empurraria o `h1` para fora
  da dobra no mobile.
- **Hero e corpo ficam em `max-w-narrow`; relacionadas e CTA usam o contêiner
  cheio.** Uma grade de quatro colunas dentro de 720px vira quatro tiras.
- **`ShareButton` tem um rótulo só para os dois caminhos.** `navigator.share` só
  existe depois da hidratação; trocar o texto a partir dele daria markup
  diferente no servidor e no cliente.

## Páginas
- / → redireciona (307) para /pt-BR ou /en (middleware)
- /[locale]/ → Home editorial (SSG + ISR) — **uma** chamada, `GET /api/home`,
  que já devolve hero, briefing, top stories, trending, categorias e latest sem
  repetir matéria entre blocos. Não montar a Home bloco a bloco
- /[locale]/news → Acervo: busca, filtros e paginação (SSG + ISR; o estado
  vive na query string e a listagem filtrada é CSR)
- /[locale]/news/[id] → Notícia individual (dinâmica) — hero, corpo,
  relacionadas, favoritar e compartilhar
- /[locale]/article → Histórico de briefings, agrupado por mês (o do dia
  marcado); página em estado local, não na URL
- /[locale]/article/[date] → Briefing do dia (dinâmica) — é a tela da
  transparência de IA: declaração, depois a lista de fontes
- /[locale]/newsletter → Landing de aquisição (estática, no sitemap)
- /[locale]/about → Sobre o projeto
- /[locale]/admin → Painel admin (force-dynamic, noindex, role ADMIN)
- /[locale]/admin/metrics → Métricas do pipeline (CSR via proxy `/api/admin/metrics`)
  - o guard de sessão + role vive em `app/[locale]/admin/layout.tsx` e vale
    para todo o segmento — página nova sob `/admin` já nasce protegida

## SEO
- Meta tags dinâmicas via generateMetadata() em cada page
- Open Graph tags para compartilhamento social
- Hreflang: `alternates.languages` ({ 'pt-BR': '/pt-BR/...', en: '/en/...' }) em
  **todas** as generateMetadata — inclusive nas dinâmicas (`news/[id]`,
  `article/[date]`), com o id/date interpolado no path
- Sitemap gerado automaticamente (entradas duplicadas por idioma)

## Estilo — design tokens da V2 (Fase 1)

Os tokens vivem em `styles/tokens.css`, importado pelo `globals.css` **antes de
qualquer regra**. Valores fechados em `docs/v2/01-design-tokens.md`; não decidir
cor, fonte ou espaçamento fora de lá.

### Duas camadas — e por que só uma existe como classe

- **Camada 1 (paleta)** — `--brand-600`, `--ink-950`, `--night-800`… Fixa, não
  muda com o tema e **não entra no `@theme`**. Ou seja: `bg-brand-600` não é uma
  classe válida. Não gera erro de build, só não pinta nada.
- **Camada 2 (semântica)** — é o que os componentes escrevem. Só ela é
  redeclarada no `.dark`.

| Papel | Classe |
|---|---|
| fundo da página / superfície / superfície elevada | `bg-bg`, `bg-surface`, `bg-surface-raised` |
| destaque editorial (callout, item ativo de nav) | `bg-surface-accent` |
| superfície de marca — escura **nos dois temas** (rodapé) | `bg-surface-brand` + `text-on-brand` |
| texto: principal / secundário / metadata | `text-ink`, `text-ink-secondary`, `text-ink-muted` |
| link e hover | `text-link`, `hover:text-link-hover` |
| laranja de preenchimento, ícone, borda | `text-brand-accent`, `bg-brand-accent` |
| laranja em **texto** (inclusive kicker) | `text-link` — ver aviso abaixo |
| botão sólido laranja (não inverte) | `bg-brand-solid` + `text-on-brand` |
| divisória decorativa / borda de controle | `border-line` / `border-line-strong` |
| estado | `text-danger`, `text-success` (e `-on-brand` sobre `bg-surface-brand`) |
| marca genuína (logo, placeholder) — fixa | `text-brand-mark`, `from-brand-mark` |

Os nomes do shadcn (`bg-card`, `text-muted-foreground`, `bg-primary`…) continuam
válidos e apontam para a mesma camada 2 — use-os dentro de `components/ui/`.

> ⚠️ **`--brand-accent` não vai em texto.** É `brand-600`: sobre
> `surface-accent` dá 4,21:1, o que passa os 3:1 de ícone e **reprova** os
> 4,5:1 de texto. Havendo texto na linha, o token é `--link` (`brand-700`,
> 5,77:1). A armadilha é a linha que mistura ícone e texto e herda a cor pelos
> dois — foi assim que o kicker do `article-card` passou por build, lint,
> testes e pelo `check-contrast.mjs`, e só caiu no Lighthouse de produção.

### Regras que a suíte cobre

`tests/lib/design-tokens.test.ts` falha se alguma delas for quebrada:

- **nada de camada 1 em componente** — `bg-brand-600`, `text-ink-950`, etc.;
- **nada de opacidade sobre `--text-muted`** — já é o nível mais claro que passa
  AA sólido; `/70` cai para 2,70:1. Opacidade sobre `--text-primary` vai até
  `/60`. Para enfraquecer um **ornamento** (o "404"), use `text-line-strong`;
- **nada de cor crua do Tailwind** (`text-green-600`, `text-red-300`…);
- **nada de sombra em conteúdo editorial** — só `shadow-overlay` (dropdown, menu
  mobile) e `shadow-modal`. Separação vem de borda, superfície e espaço;
- **nada de `rounded-xl`/`2xl`/`3xl`/`4xl`** — a escala tem 5 níveis e esses
  quatro ficaram fora dela;
- **nada de `duration-<número>`** — use `duration-fast|base|slow`.

Ao introduzir combinação de cor nova, rode `pnpm --filter @newranews/web
contrast:check` — ele lê o `tokens.css` e mede, inclusive as composições de
opacidade.

> ⚠️ **`cn` precisa conhecer a escala tipográfica — e conhece.** O
> `tailwind-merge` resolve `text-<valor>` por heurística: sabe que `text-sm` é
> tamanho e `text-red-500` é cor, e joga **todo o resto num grupo só**. Como a
> V2 nomeia a escala por papel, `cn('text-meta', 'text-ink-muted')` devolvia só
> `text-meta` — a cor sumia do HTML sem erro de build, lint ou tipo, e o
> elemento herdava a cor do pai. Foi assim que a metadata dos cards renderizou
> em `--ink` cheio da Fase 1 até a Fase 3 (passava no contraste, então o
> Lighthouse nunca reclamou; o que se perdia era hierarquia). `lib/utils.ts`
> declara a escala como `font-size` e `tests/lib/cn.test.ts` é a guarda —
> **ao acrescentar um nome novo à escala em `tokens.css`, acrescente também
> em `TYPOGRAPHY_SCALE`.**
>
> Efeito colateral correto disso: `leading-*` junto de um tamanho nomeado
> dentro de `cn` é descartado, porque a escala já carrega a própria entrelinha.

### Tipografia, forma e ritmo

- `font-display` = **Newsreader** (serif, manchetes) · `font-sans` = **Inter**
  (interface). Ambas por `next/font/google` no `app/[locale]/layout.tsx`.
- Escala por papel, não por tamanho: `text-display`, `text-h1`…`text-h4`,
  `text-body-lg`, `text-body`, `text-body-sm`, `text-meta`, `text-overline`.
- Radius, 5 níveis e só: `rounded-none`, `rounded-sm` (4px), `rounded-md` (8px,
  botão e input), `rounded-lg` (12px, card), `rounded-full` (badge, avatar).
  0 e 12px são os extremos — `rounded-xl` e acima estão fora da escala.
- Ritmo: `py-section`, `gap-block`, `px-gutter`; larguras `max-w-prose` (68ch),
  `max-w-narrow`, `max-w-wide`; `container-editorial` faz os três de uma vez.
- Motion: `duration-fast|base|slow` + `ease-standard`/`ease-exit`. O
  `prefers-reduced-motion` é regra global no `globals.css`.
- Camadas: `z-base|dropdown|header|overlay|modal|toast`. Um `z-10` local dentro
  de um componente (o botão de favoritar sobre o card) não é camada de página e
  fica de fora da tabela.

> A escala tipográfica e os tokens de ritmo existem mas quase não são usados
> ainda — trocar contêiner e hierarquia é trabalho da Fase 2/3. O Tailwind v4 só
> emite a utility quando alguém a escreve, então elas não aparecem no CSS gerado
> até serem adotadas.

### Componentes editoriais

`components/editorial/` é a camada acima dos primitivos do shadcn (§11 do
plano).

| Peça | Papel |
|---|---|
| `article-meta` · `source-badge` · `reading-time` | a linha de metadata (Fase 1) |
| `story-card` · `story-card-horizontal` · `story-card-compact` | vertical com imagem · miniatura + manchete · só manchete |
| `story-image` | caixa de imagem + placeholder de marca |
| `section-heading` | filete + título + "ver tudo" |
| `hero-story` · `briefing-card` · `top-stories` · `trending-list` · `latest-stories` · `category-section` | os blocos da Home (Fase 3) |
| `highlight-term` | envolve em `<mark>` o termo buscado (Fase 4) |
| `pagination` | paginação numerada — do acervo **e** do histórico (Fase 4/5) |
| `article-hero` · `article-body` · `article-skeleton` | a abertura, o corpo e a espera das telas de leitura (Fase 5) |
| `ai-disclosure` · `source-list` · `share-button` · `related-stories` | as peças da §8 e §9 (Fase 5) |

Regras que não são óbvias no código:

- **Os cards são client components de propósito.** Precisam de
  `useTranslations` para o rótulo da categoria, e um server component
  assíncrono **não pode** ser renderizado de dentro de um client component —
  o que quebraria o reuso na listagem CSR de `/news`. Continuam renderizando
  no servidor: a Home é SSG/ISR.
- **Não passe `sourceHref` dentro de um card que já é um link** — âncora
  aninhada.
- **Bloco sem dado devolve `null`, e o wrapper do grid também sai.** Um grid
  vazio tem altura zero mas ainda consome o `gap-section` do pai, e o buraco no
  meio da página não tem explicação para quem olha. `hero` nulo, `briefing`
  nulo, `trending` vazio e categoria sem matéria são estados **normais** — o
  endpoint está certo, a tela é que precisa desenhar sem eles.
- **`heading-level` é prop, não valor fixo.** O mesmo card é `h3` na Home
  (abaixo do `h2` da seção) e pode ser `h2` numa listagem. Heading fixo foi o
  que deixou `heading-order` reprovando em `/news` e `/article`.
- **O numeral do ranking é `aria-hidden`** — a posição já é semântica pelo
  `<ol>`, e ouvir "3" antes da manchete é a mesma informação duas vezes.
- **A Home tem `h1` `sr-only`.** Não há título visível próprio (quem abre vê a
  manchete do dia), mas página sem `h1` reprova `heading-order`.
- **`action` é slot, e fica fora da âncora.** `hero-story` e
  `story-card-horizontal` aceitam um `ReactNode` no canto — hoje só o favoritar
  da `/news`. Dentro do `<Link>` seria botão aninhado em link, e um clique
  dispararia os dois.
- **`highlight` é opcional e vazio não faz nada.** `HighlightTerm` casa pelo
  literal, com escape de regex: `C++` como padrão é quantificador inválido, e
  casar de forma mais esperta destacaria trecho que não foi o motivo do
  resultado.

### Monetização

`monetization/` tem `newsletter-cta` (Fase 2) e `ad-slot` (Fase 3). O inventário
— placements, formatos e alturas da §9 de `docs/v2/04-analytics-e-slots.md` —
vive em `lib/ads.ts`.

- **Sem inventário o `AdSlot` não renderiza nada**: nem caixa vazia, nem a
  palavra "Publicidade". Hoje é sempre esse o caso (`NEXT_PUBLIC_ADS_ENABLED`).
- **A altura é reservada antes de o criativo chegar**, e vai em `style` porque
  é dado: uma classe `min-h-[90px]` teria de existir literal no código para o
  Tailwind emitir a regra, o que duplicaria a tabela de alturas.
- `ad_view`/`ad_click` entram com o `track()` da Fase 8 — medir impressão sem
  ter onde gravar o evento seria código morto.

### Outras regras de estilo
- Mobile-first com Tailwind
- Sem CSS modules ou styled-components
- `components/ui/` é shadcn: alterar só o que os tokens exigem (radius,
  superfície), nunca a API dos componentes