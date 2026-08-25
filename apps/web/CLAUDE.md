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
  `<html>`) e **importa o `globals.css`, que mora só ali**; **não criar
  `loading.tsx`/`error.tsx` na raiz** (seus boundaries caem fora do `<html>` e
  quebram a hidratação — ``Only one element on document allowed``). Eles vivem
  em `app/[locale]/`; o `not-found.tsx` raiz renderiza `<html>`/`<body>` e
  `ThemeInit` próprios (fora de qualquer layout de idioma) — e **é ele que
  atende todo endereço errado**, inclusive os com prefixo de idioma, porque
  caminho sem arquivo de rota não cai dentro de `[locale]`
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
- **O teste tira só o *primeiro* segmento da chave para procurar no código.**
  Então `useTranslations('account.preferences')` + `t('save')` faz
  `account.preferences.save` parecer órfã: o que ele procura é
  `'preferences.save'`. Namespace aninhado, portanto, não: pegue o de primeiro
  nível e escreva a chave com ponto (`useTranslations('account')` +
  `t('preferences.save')`)
- **Chave montada em runtime também parece órfã** — interpolar o nome dentro do
  `t(...)` não deixa o literal escrito em lugar nenhum. Use um mapa com as
  chaves por extenso (`THEME_LABEL` em `account/preferences-form.tsx`)

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
  um total do recorte ali** — foi o defeito que a revisão da Fase 4 achou. Pela
  mesma razão, **"somente salvos" desliga a contagem** (`showCounts={false}` na
  `category-nav` e na `news-filter-bar`): as facetas contam o acervo, e ali a
  lista vem de outra fonte.
- **"Somente salvos" troca a fonte de dados, não o `where`.** O acervo é público
  e cacheável; a lista de salvos é por usuário e vem de `/api/favorites`, que
  aceita as mesmas dimensões. As duas consultas nunca correm juntas — `enabled`
  desliga a que não está valendo. E ele **não** entra em `toApiFilters`: a rota
  pública não sabe quem está pedindo.
- **`?saved=1` sem sessão mostra o acervo.** Mesma regra de `?category=BANANA`:
  valor que a tela não consegue honrar cai no default em silêncio.
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
- **Ter `content` não é ter corpo.** A tela deduplica o parágrafo de abertura
  contra o dek exibido acima, e em 23,2% do acervo o que sobrava era nada — o
  rótulo "Trecho" sobre uma caixa vazia. Quem decide é `hasReadableBody`, sobre
  os **blocos**, nunca sobre o campo.
- **O dek pode ser prefixo do corpo, e o corte só vale em fronteira de frase.**
  Quando o feed manda a matéria num parágrafo só, a ingestão corta o dek no
  último fim de frase que cabe em 320 caracteres — então o corpo **começa** com
  ele. Cortar um dek que para no meio de uma oração deixaria a matéria abrindo
  por "com um panorama complexo".
- **`parseArticleBody` tira tag antes de classificar a linha, e não é
  redundância.** A limpeza é da ingestão, mas a etapa 8.5 roda uma vez por dia;
  esta linha cobre a janela até lá, e o dia em que um veículo novo inventar um
  formato. Sem ela, o React escapa a tag e ela aparece **como texto**.
- **`article-body` não é renderizador de Markdown, e não deve virar um** — mas
  **entende o que o modelo escreve, e essa lista é medida.** Recontada em
  25/08/2026 sobre os 89 briefings retidos: **60% usam `**negrito**`, 42% `###`,
  29% `##`, 20% `---`, 8% listas e 3% `*ênfase*`** — a nota anterior dizia "só
  `###`, sem negrito nem listas", e tinha vencido. Link, tabela, citação, código
  e lista numerada deram **zero** e continuam não reconhecidos, com teste
  afirmando isso. **Medição sobre saída de modelo tem prazo de validade:**
  reconte antes de confiar numa nota dessas.
- **O nível do subtítulo é relativo, e mapeado por posição.** As profundidades
  presentes no documento viram `h2`, `h3`, `h4` na ordem — nunca por subtração,
  que daria `h2` e `h4` num documento com `##` e `####` e reprovaria
  `heading-order`. 39% dos briefings usam `###` sem nenhum `##`, e ali `###`
  **é** o `h2`.
- **`article-hero` é casca com encaixes**, não um componente com `variant`. As
  duas telas compartilham a composição da §8 e quase nada do conteúdo.
- **A imagem vem depois da metadata** (ordem da §8): numa tela de leitura entra-se
  pelo título e pela procedência, e a imagem antes empurraria o `h1` para fora
  da dobra no mobile.
- **Hero e corpo ficam em `max-w-narrow`; relacionadas e CTA usam o contêiner
  cheio.** Uma grade de quatro colunas dentro de 720px vira quatro tiras.
- **A trilha substituiu o “← voltar”, e não se somou a ele.** Dois controles de
  volta na mesma linha seriam a mesma ação duas vezes. As chaves `news.backTo`
  e `article.backTo` saíram dos dois JSONs junto com o link.
- **As duas telas são `<article>`.** Vieram da auditoria de leitor de tela da
  Fase 7: a tela **é** um artigo e nada dizia isso — era uma pilha de `div` com
  um `h1` no meio. Marcado, o leitor de tela ganha navegação por artigo e o
  `header` do `ArticleHero` vira o cabeçalho **daquele** artigo.
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
- /[locale]/account → Conta: perfil (leitura), atalhos e saída
- /[locale]/account/preferences → Assuntos e tema (grava em `UserPreference`)
- /[locale]/account/newsletter → Inscrição no briefing diário (`Subscriber`)
- /[locale]/favorites → Salvos: notícias e briefings numa lista só
  - o guard de sessão vive em `app/[locale]/account/layout.tsx` e vale para
    todo o segmento; `/favorites` é a exceção fora dele, com o guard próprio
- /[locale]/admin → Painel admin (force-dynamic, noindex, role ADMIN)
- /[locale]/admin/metrics → Métricas do pipeline (CSR via proxy `/api/admin/metrics`)
  - o guard de sessão + role vive em `app/[locale]/admin/layout.tsx` e vale
    para todo o segmento — página nova sob `/admin` já nasce protegida
  - **a casca do painel vive no mesmo layout**: contêiner e faixa de abas
    (`components/admin/admin-nav.tsx`), como em `/account`. Tela nova de admin
    entra como aba e herda a casca, em vez de trazer o próprio `max-w-*` e o
    próprio link de canto — eram dois contêineres diferentes até a Fase 12, e a
    largura da página mudava ao trocar de tela
  - **a faixa só é renderizada depois do guard**: oferecer as abas a quem não é
    ADMIN seria anunciar o que a pessoa não pode abrir

## SEO (Fase 7)

**Nenhuma página escreve metadata à mão.** `lib/seo.ts` tem os dois helpers e
`tests/lib/seo.test.ts` falha se alguma `generateMetadata` não passar por um
deles.

| Peça | Papel |
|---|---|
| `lib/seo.ts` → `pageMetadata` | a metadata inteira de uma página pública |
| `lib/seo.ts` → `alternatesFor` | canonical + hreflang, para as `noindex` |
| `lib/json-ld.ts` | os nós de dado estruturado |
| `components/seo/json-ld.tsx` | serializa um nó (ou `@graph`) num `<script>` |
| `components/editorial/breadcrumb.tsx` | a trilha visível |
| `app/news-sitemap.xml/route.ts` | o sitemap do Google Notícias |

Regras que não são óbvias no código:

- **A metadata do Next não faz merge profundo.** O layout declara
  `openGraph: { type, siteName, locale }` e `twitter: { card }`; a página que
  declara os seus **substitui o objeto inteiro**. Medido no HTML de produção da
  Fase 6: nenhuma página tinha `og:type`, `og:site_name`, `og:locale` nem
  `og:image`, e cinco compartilhavam com `twitter:card: summary`. É `pageMetadata`
  quem repõe os defaults — não repita os quatro campos na página.
- **O caminho sem prefixo de idioma é escrito uma vez por página.** `pageMetadata`
  deriva dele o `canonical`, os três `hreflang` (incluindo `x-default`) e o
  `og:url`. Eram quinze cópias de `{ 'pt-BR': '/pt-BR/x', en: '/en/x' }`.
- **`canonical` é auto-referente.** Canonizar `/en` para `/pt-BR` tiraria do
  índice justamente a versão que serve quem busca em inglês. Auto-canonical +
  hreflang recíproco é o par certo para conjunto de idioma.
- **Rota de metadata gerada não tem extensão, e o middleware precisa saber.** O
  matcher exclui o que tem ponto (`sitemap.xml`, `icon.svg`); `opengraph-image` e
  `apple-icon` não têm, e eram redirecionados para `/pt-BR/...` → 404. A imagem
  de compartilhamento e o ícone do iOS ficaram inalcançáveis até a Fase 7. Rota
  de metadata nova entra no matcher.
- **A URL da imagem OG é `SITE_OG_IMAGE`, sem `.png`.** O `/opengraph-image.png`
  que a tela do briefing usava desde a Fase 5 nunca existiu.
- **Autoria no JSON-LD segue quem escreveu.** Em `/news/[id]` o `author` é o
  veículo e o `publisher` é o Newra News, com `isBasedOn` na matéria original;
  no briefing o `author` é o site e as fontes viram `citation`. Carimbar texto de
  terceiro como nosso é o mesmo erro que a §8 evita na interface.
- **A trilha visível e o `BreadcrumbList` recebem a mesma lista.** A página monta
  `BreadcrumbStep[]` uma vez e passa às duas pontas — o Google pede que o dado
  estruturado descreva a trilha visível, e duas listas paralelas divergem no
  primeiro degrau renomeado. Degrau sem `path` é a página atual: não vira link e
  leva `aria-current`.
- **A trilha é uma linha só.** Com `flex-wrap` o degrau atual pedia a largura
  inteira antes de truncar e caía para a segunda linha.
- **O news sitemap só leva as URLs `pt-BR`, e é decisão sobre o conteúdo.** As
  fontes RSS são brasileiras: o corpo é o mesmo texto em português nas duas URLs,
  e o que `/en` traduz é a moldura. `news:language` é ISO 639 (`pt`), não o
  BCP-47 da rota. Janela de 48h e teto de 1.000 URLs são do formato.
- **Dois sitemaps no `robots.txt`.** O geral descreve o acervo; o de notícias, a
  janela. O cron diário invalida os dois.
- **`formatArticleDate` lê em UTC; `formatDate`/`formatDateTime`, no fuso local.**
  `Article.date` é data de calendário gravada à meia-noite UTC — lida no fuso
  local, num fuso negativo ela vira a véspera. Era assim que `/article/2026-08-22`
  exibia "21 de agosto", e o servidor (UTC) e o navegador renderizavam diferente.
  Para um **instante** (`createdAt`, `generatedAt`) o fuso de quem lê é o certo.

## Analytics (Fase 8, PR 2)

A camada de eventos da parte 1 de `docs/v2/04-analytics-e-slots.md`. **Nenhum
componente importa provider** — só `track`.

| Peça | Papel |
|---|---|
| `lib/analytics/index.ts` | `track()`, a fila e o transporte |
| `lib/analytics/consent.ts` | a decisão, DNT e GPC |
| `lib/analytics/session.ts` | o `sessionId`, em `sessionStorage` |
| `lib/analytics/sanitize.ts` | a higiene do termo de busca |
| `components/analytics/page-view.tsx` | `homepage_view`/`category_view` de dentro de uma página server |
| `app/api/events/route.ts` | o repasse same-origin para a API |

Regras que não são óbvias no código:

- **O destino é `/api/events` do próprio Next, e não a API direto.** `sendBeacon`
  é o único transporte que o navegador promete entregar durante uma navegação —
  que é justamente quando o evento mais interessante acontece — e ele **não sabe
  fazer preflight**. Um POST `application/json` para outra origem exigiria
  preflight e o beacon falharia em silêncio. Same-origin, não há preflight.
- **O `sessionId` mora em `sessionStorage`, nunca em `localStorage`.** Em
  `localStorage` ele viraria identificador estável entre visitas, e é essa linha
  que separa medição anônima de dado pessoal.
- **Mede por padrão, e o único opt-out é o do navegador.** A camada é
  *cookieless*, sem identificador entre sessões e sem terceiro: o tratamento se
  apoia em legítimo interesse, não em consentimento. `isTrackingAllowed()`
  respeita **DNT e Global Privacy Control**, e mais nada — a máquina de decisão
  (`granted`/`denied`) existiu para o banner que foi removido com os anúncios, e
  sem quem escrevesse a decisão ela lia uma chave que ninguém gravava. Controle
  explícito de opt-out na interface é item em aberto.
- **`source` e `position` são props obrigatórias nos cards.** Opcionais, um uso
  novo nasceria sem atribuição e a falta só apareceria na hora de ler a métrica.
  O compilador é quem cobra.
- **Os cards de briefing não têm `position`**, e não é esquecimento: o payload
  de `briefing_open` não tem esse campo. Prop que não chega a lugar nenhum é a
  armadilha do controle sem consequência, em forma de prop.
- **`favorite_add` só sai ao salvar, e só para `NEWS`.** Não há evento de
  remoção no catálogo, e medir o desfazer com o mesmo evento inflaria "saves por
  usuário". Briefing não tem categoria, e o payload exige uma — salvar briefing
  fica sem medição até o catálogo ganhar evento próprio.
- **`share` mede os dois canais que existem** (`native-share`, `copy-link`), e
  só **depois** do `await`: cancelar a folha de compartilhamento rejeita a
  promessa, e medir antes contaria intenção como compartilhamento. Os outros
  três canais do vocabulário não têm botão — vocabulário maior que a interface
  é contrato de dado, não controle prometido.
- **`newsletter_signup` leva `origin`** porque o mesmo formulário aparece no
  rodapé e no CTA editorial, e somar os dois num número só esconde qual
  converte.
- **`search` dispara quando a consulta resolve, não a cada tecla**, e o termo
  passa por `sanitizeSearchQuery`. Descartado, o evento inteiro não sai: um
  `search` sem termo diria "alguém buscou algo e achou zero", que não responde a
  pergunta que o evento existe para responder.
- **`PageView` é um componente que renderiza `null`.** Evento só sai de client
  component, e transformar a Home inteira em client component por causa de uma
  chamada é o que a §17 proíbe. O `useRef` guarda a montagem dupla do
  StrictMode — sem ele, a contagem de sessões sairia dobrada de todo ambiente
  de desenvolvimento.
- **Profundidade de leitura mede o corpo do texto, não a página.** A tela
  termina em relacionadas e num CTA; incluí-los faria "90% da página" ser
  alcançável sem ler o último terço da matéria. Daí o `id` no `ArticleBody`.
- **O guard do `requestAnimationFrame` é um booleano, não o id do frame.**
  Zerar o id dentro do callback só funciona porque o rAF do navegador é
  assíncrono: a atribuição acontece **depois** dele, e uma implementação
  síncrona reescreveria o `null` e travaria o agendamento para sempre.
- **`track()` nunca lança e nunca bloqueia**, e a fila é esvaziada **antes** do
  envio: falha de transporte perde o lote em vez de acumular memória presa.

## Segurança do navegador e estado de falha (Fase 10)

| Peça | Papel |
|---|---|
| `lib/security-headers.js` | os seis cabeçalhos de defesa e a CSP — **a mesma fonte que o `next.config.js` lê** |
| `lib/api.ts` → `ApiError` | a falha **com o status**: `null` é transporte, 404/400 é sobre o pedido |
| `lib/api.ts` → `nullIfNotFound` | o que separa "não encontrada" de "deu erro" |
| `lib/use-results-focus.ts` | foco + rolagem ao virar página, respeitando `prefers-reduced-motion` |
| `tests/security/` | três suítes: cabeçalhos, superfície do navegador, otimizador de imagem |
| `tests/lib/state-matrix.test.ts` | a matriz de 15 rotas × 4 estados, como asserção |

Regras que não são óbvias no código:

- **O `globals.css` mora em `app/layout.tsx`, e só lá.** O Next prende o chunk
  do CSS à entrada que o importa; a rota `_not-found` da raiz não passa pelo
  layout de idioma e ia ao ar **sem folha de estilo nenhuma**. Importar nos dois
  lugares não resolve — o Next deduplica e o chunk fica onde estava.
- **`.catch(() => valor)` numa página é proibido, e há guarda.** Ele confunde "a
  API disse não" com "a API não respondeu", e a ISR fixa a confusão por uma
  hora. Em `catch` que alimente `notFound()`, use `nullIfNotFound`. Onde o valor
  vira `initialData`, continua sendo `prefetch` (que falha em `undefined`).
- **A Home usa `nullUnlessPublishing`, e "build" não é uma coisa só.** Onde o
  resultado é **publicado** — build da Vercel e revalidação da ISR — a exceção
  sobe: o deploy anterior fica no ar, ou a última página boa fica. Onde nada é
  publicado (o build do CI, que roda sem API de propósito, e o local) ela
  devolve `null` e a tela desenha o estado vazio. A primeira versão simplesmente
  não capturava, e o job Build reprovou com `ECONNREFUSED` — foi o CI que
  ensinou a distinção.
- **Id fora do formato UUID devolve 400, não 404**, e os dois significam "não
  existe" para quem lê. `isAboutTheRequest` cobre os dois; tratar só o 404
  mandaria URL digitada errada para a página de erro.
- **Nada de `window.scrollTo` solto.** `behavior: 'smooth'` explícito vence o
  reset de `prefers-reduced-motion` do CSS. Rolagem programática passa por
  `useResultsFocus`, que também leva o foco — rolar sem mover o foco deixa
  viewport e cursor em lugares diferentes, e não anuncia nada.
- **Alvo de foco por programa precisa de `tabIndex={-1}` e de nome acessível.**
  A região de resultados é nomeada por `aria-labelledby` apontando para a
  contagem, e **a contagem nunca desmonta** — `aria-labelledby` para um id
  ausente deixa a região sem nome, e o foco pousa num contêiner mudo.
- **Erro de formulário precisa de `role='alert'` *e* `aria-describedby`.** O
  primeiro anuncia uma vez; o segundo é o que faz a mensagem ser lida de novo ao
  voltar ao campo. O id é por instância (`useId`): o formulário da newsletter
  aparece duas vezes na mesma página.
- **A CSP carrega `'unsafe-inline'` no `script-src`, e está escrito por quê.** A
  Home tem 63 scripts inline, 61 deles chunks de Flight que mudam por rota e por
  regeneração. Nonce exigiria cabeçalho por requisição e tornaria as 15 páginas
  dinâmicas.
- **`connect-src` precisa da origem da API.** O navegador fala com ela direto
  (`lib/api.ts`); só o que passa pelo BFF é same-origin. Sem isso, a tela trava
  no esqueleto — em produção e só lá.
- **O otimizador de imagem aceita qualquer host, com aceite de risco escrito.**
  Lista de hosts derivada das fontes **não funciona**: a NewsData.io agrega
  centenas de veículos (87 fontes, 95 hosts no acervo). O que limita o abuso é o
  teto de `deviceSizes`, um formato só e `minimumCacheTTL` — mexer neles reprova
  a suíte.
- **Todo `sizes` termina em largura fixa acima do breakpoint do contêiner.**
  `66vw` num monitor de 2560 px pede 1.690 px para desenhar 790. O hero usa
  `62vw`, medido nas duas pontas da faixa fluida.
- **A baseline cobre as 12 rotas nos dois temas.** Escuro é onde token errado
  aparece; `bg-white` é invisível no claro e ilegível no escuro, e a suíte
  proíbe cor fixa fora dos quatro véus declarados.

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

> ⚠️ **Um token do `@theme` pode sombrear uma utility do core, e nada avisa.**
> No Tailwind v4 um `--spacing-<nome>` gera o eixo de espaço inteiro, e
> `inline-<valor>` ali é `inline-size`. Como o projeto declara
> `--spacing-block`, a folha ganha **dois** `.inline-block` — o de display e o
> do token — na mesma especificidade, e vence o último. Resultado medido na
> `/pt-BR/account`: os quatro links da faixa com **33 px** cada
> (`clamp(1.5rem, 1.25rem + 1vw, 2.5rem)` a 1280 px = 32,80 px), o texto vazando
> da caixa, e as abas escritas umas sobre as outras. **Use `inline-flex`.**
>
> A guarda em `tests/lib/design-tokens.test.ts` **deriva a lista dos tokens**,
> então declarar `--spacing-flex` amanhã põe `inline-flex` nela sozinho — e esse
> é o caso que dói, porque `inline-flex` está em uso por todo o projeto.

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
| `save-button` · `briefing-card-compact` | salvar qualquer item · o briefing na forma do card compacto (Fase 6) |
| `breadcrumb` | a trilha das telas de leitura, espelhada no `BreadcrumbList` (Fase 7) |

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
- **Notícia sem foto é card de texto, não card com placeholder.** Medido em
  25/08/2026: **1.703 das 6.669 (25,5%) não têm imagem em lugar nenhum do
  feed**. `StoryCard`, `HeroStory` e `StoryCardHorizontal` **não renderizam a
  caixa** quando `imageUrl` é nulo — a manchete sobe um degrau da escala, o dek
  ganha linhas, e um filete da categoria segura a coluna. A célula mantém a
  altura das vizinhas (medido: 387 px a 1280), que era a única coisa que o
  retângulo laranja resolvia. O `StoryImage` continua existindo para o caso em
  que sempre foi certo: a foto que **existe e não carrega**.
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

### Monetização — **o site não exibe anúncio**

Decisão de 22/08/2026. `AdSlot`, `lib/ads.ts`, o banner de consentimento e o hook
de viewability **foram removidos** — ~750 linhas que nunca iriam ao ar. O que
resta em `editorial/newsletter-cta.tsx` é CTA da própria newsletter, que é
conteúdo, não inventário (por isso saiu de `monetization/`, pasta que deixou de
existir).

**Ao considerar reintroduzir espaço pago**, leia primeiro a §21 do plano e o item
29 do `docs/progress.md`: patrocínio de newsletter e Newra Plus estão adiados com
gatilho num número, não numa data, e publicidade está **cancelada por decisão**.

### Outras regras de estilo
- Mobile-first com Tailwind
- Sem CSS modules ou styled-components
- `components/ui/` é shadcn: alterar só o que os tokens exigem (radius,
  superfície), nunca a API dos componentes

## Ecossistema de conta (Fase 6)

Quatro telas atrás de sessão — `/account`, `/account/preferences`,
`/account/newsletter` e `/favorites` — sobre `GET /api/account` e
`/api/favorites`.

| Peça | Papel |
|---|---|
| `account/account-nav` | as quatro abas; `/favorites` entra como a quarta |
| `admin/admin-nav` | as duas abas do painel: Painel e Métricas |
| `account/profile-card` | identidade, quanto foi salvo, e a saída |
| `account/preferences-form` | assuntos e tema |
| `account/newsletter-settings` | inscrição no briefing diário |
| `favorites/favorites-list` | a lista única de salvos |

Regras que não são óbvias no código:

- **O perfil é de leitura, e é decisão.** `upsertUser` reescreve `name` e
  `image` a cada sign-in: um campo editável ali seria desfeito no login
  seguinte, sem aviso. Nome próprio pede coluna própria.
- **Só entra controle que muda alguma coisa.** "Horário do briefing" (§19) não
  existe porque o pipeline roda num cron único — a mesma armadilha da pílula de
  contagem da Fase 4, agora em forma de seletor. E "receber por e-mail" é a
  inscrição da newsletter, não uma preferência: duas fontes de verdade para a
  mesma resposta discordariam no dia seguinte.
- **O tema é aplicado quando o servidor confirma**, a partir do que ele
  devolveu — aplicar no clique deixaria a tela escura com a escolha não gravada
  se o `PUT` falhasse. Quem escreve a chave `theme` do `localStorage` é
  `lib/theme.ts`, e só ele: são dois controles (o botão do cabeçalho e as
  preferências) mexendo no mesmo lugar. `SYSTEM` **apaga** a chave em vez de
  gravar o valor atual — gravado, o tema deixaria de acompanhar o aparelho.
- **A lista de salvos é uma só.** Notícia e briefing na ordem em que foram
  salvos, cada um com o seu card (`story-card-compact` e
  `briefing-card-compact`) e o mesmo `save-button` no estado preenchido — o
  gesto de remover é o mesmo de salvar.
- **`useIsFavorite` lê só ids** (`GET /api/favorites/ids`), uma consulta por
  sessão para todos os botões da página. Antes, a tela baixava 100 salvos com
  conteúdo e procurava no cliente: do 101º em diante o ícone mentia.
- **Tela de conta não pode ser SSG**, como `/favorites` e `/admin` já pagavam:
  o `redirect()` de sessão seria assado no HTML estático. O `force-dynamic`
  fica no layout do segmento.
- **`/favorites` continua em `/favorites`.** É a URL da V1, está no menu e na
  baseline visual; movê-la para dentro de `/account` pediria um redirect
  permanente para não ganhar nada.
