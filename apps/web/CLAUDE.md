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
  `/news?category=X`; o `category-nav` da Fase 4 é o filtro do acervo dentro de
  `/news`, com estado selecionado e contagem.
- **`/news` lê `?category=` e `?search=` da URL e ressincroniza quando eles
  mudam.** Navegar dentro da mesma rota não remonta o componente, então um
  `useState(inicial)` sozinho deixa o filtro velho e a URL passa a mentir.
- **Componentes do shell aparecem duas vezes** (desktop e dentro do menu). Se
  algum precisar de `id`, use `useId()`.
- **`Logo`** tem a marca em SVG inline com `currentColor` — é o que a deixa
  herdar a cor no rodapé escuro, coisa que um `<img>` não faz. O wordmark é
  texto (§40.3-A); trocar pelo lockup desenhado é substituir um `<span>` ali
  dentro e em mais lugar nenhum.

## Páginas
- / → redireciona (307) para /pt-BR ou /en (middleware)
- /[locale]/ → Home editorial (SSG + ISR) — **uma** chamada, `GET /api/home`,
  que já devolve hero, briefing, top stories, trending, categorias e latest sem
  repetir matéria entre blocos. Não montar a Home bloco a bloco
- /[locale]/news → Listagem com filtros (CSR para filtros)
- /[locale]/news/[id] → Notícia individual (dinâmica)
- /[locale]/article → Histórico de artigos
- /[locale]/article/[date] → Artigo diário (dinâmica)
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