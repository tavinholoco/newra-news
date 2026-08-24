# Newra News — Monorepo

## Estrutura
- Monorepo com Turborepo + pnpm workspaces
- apps/web → Frontend Next.js 14+ (App Router)
- apps/api → Backend Fastify + TypeScript
- packages/database → Prisma ORM (schema + client)
- packages/types → Types TypeScript compartilhados
- packages/eslint-config → ESLint configs
- packages/tsconfig → TSConfigs base

## Comandos
- `./scripts/dev-bootstrap.sh` — **ambiente pronto do zero**: Postgres, envs locais, migrations, imagens de placeholder e seed (idempotente; não sobrescreve `.env` existente). Use em container novo antes de rodar o app ou capturar screenshots
- `pnpm install` — instalar dependências
- `pnpm dev` — rodar todos os apps em dev
- `pnpm build` — build de produção
- `pnpm lint` — ESLint em todo o monorepo
- `pnpm test` — Vitest (backend + frontend). **Não precisa de banco** — assim como `lint`, `typecheck` e `build`
- `pnpm --filter @newranews/web visual:baseline` — capturas das rotas públicas (§30 do plano V2); exige app no ar. Em ambiente com Chromium pré-instalado, exportar `CHROMIUM_PATH`. **O conjunto versionado é capturado de produção**, não do local — ver "Fechar uma fase" abaixo
- `pnpm db:migrate` — rodar migrations Prisma
- `pnpm db:generate` — gerar Prisma Client
- `pnpm db:studio` — abrir Prisma Studio

## Fechar uma fase (o ritual, contra produção)

Roda **depois** do merge e do deploy — as duas medições são contra o site no ar,
e cada uma pega o que a outra não pega. Nas Fases 4 e 5 as duas acharam defeito.

**1. Lighthouse por rota.** Não espere a execução de segunda:

```bash
gh workflow run "Lighthouse CI" --ref main
```

Quando terminar, os scores saem no passo "Print scores" do log. Se alguma
categoria cair, o relatório completo vem por
`gh run download <run-id> -D <dir>` e o audit reprovado está em
`lhr-*.json` → `categories.<cat>.auditRefs` com `score < 1`.

> **O workflow aquece sozinho desde 23/08 — não aqueça à mão.** O passo "Warm
> production before measuring" bate duas vezes em cada URL do
> `.lighthouserc.json` antes do collect.
>
> **A causa é a API dormir, e só ficou clara na auditoria da Fase 8.** O plano
> free do Render hiberna com ~15 min sem tráfego; `/pt-BR` e `/en` chamam
> `getHome`, então a requisição que dispara a regeneração da ISR espera a API
> acordar — medido: **4,9 s na primeira passada contra 0,22 s na terceira**, e a
> performance cai para ~81. **O sintoma migra**: em duas execuções seguidas o 81
> saiu primeiro na `/en` e depois na `/pt-BR`, sempre na que estava fria. A
> `/pt-BR/about`, única rota medida que não chama a API, ficou em 97 nas duas.
>
> Com o aquecimento no workflow: **92 · 90 · 97 · 97 · 91**, gate verde.
>
> **A `/news` caiu, o audit foi lido, e não era o aquecimento** (24/08, run
> [32679047022](https://github.com/tavinholoco/newra-news/actions/runs/32679047022)).
> Medido na execução ruim: **56 requisições na página, zero para a API**, e a
> mais lenta é o próprio documento em **214 ms** — nenhuma chamada de API
> participa do carregamento da `/news`. O que a derruba é o **LCP de uma `<img>`
> de card, em 4.390 ms**, servida por `/_next/image` a partir de
> `s2-valor.glbimg.com`; os audits que caem são `uses-responsive-images` e
> `image-delivery-insight`. É **entrega de imagem** (§10.6), não hibernação.
>
> A lição de fluxo: o aquecimento resolveu o problema *dele*, e a partir daí
> vira a explicação preguiçosa para qualquer queda. As rotas que **não** chamam
> a API (`/about`, `/article`) medem 96–98 com variância de 2 pontos; as que
> chamam variam muito mais — mas variância não é a mesma coisa que causa, e o
> audit é quem diz qual das duas está em jogo.

> **O gate confere a mediana desde 24/08, e antes conferia a melhor amostra.**
> O padrão do LHCI é otimista: com 3 execuções por URL ele assertava a **melhor**
> delas, enquanto o passo "Print scores" imprime a **representativa**. Os dois
> números discordaram na cara — `/news` em `[89, 90, 81]`, relatório dizendo 81,
> gate passando verde com o 90. `aggregationMethod: median` no
> `.lighthouserc.json`. Se o gate voltar a passar com um número ruim impresso,
> é este campo que sumiu.

**2. Baseline visual** (§30) — de produção, com as mesmas larguras do conjunto
versionado, senão o diff vira ruído:

```bash
BASE_URL=https://newra-news-web.vercel.app NEXT_PUBLIC_API_URL=https://newra-news-api.onrender.com/api OUT_DIR=../../docs/v2/baseline-v2 WIDTHS=375,768,1440 FORMAT=jpeg node scripts/capture-visual-baseline.mjs
```

(a partir de `apps/web/`). A captura é determinística: **só as telas que mudaram
aparecem no `git status`** — se aparecer imagem que você não mexeu, ou o conteúdo
do dia mudou, ou há algo errado.

> **O deploy da Vercel e o do Render disparam juntos no merge, e não terminam
> juntos.** Se o build do web correr antes de a API subir uma rota nova, o
> prefetch falha e a página estática nasce sem o dado. Conferir que a mudança
> está no ar **antes** de medir — foi assim que a `/news` foi para produção com
> as oito categorias zeradas.

## Convenções de Código
- TypeScript estrito: sem `any`, sem `@ts-ignore`
- Imports absolutos com alias: `@newranews/database`, `@newranews/types`
- Validação com Zod em todas as rotas do backend
- Nomes de arquivo: kebab-case (news-card.tsx, pipeline.service.ts)
- Nomes de componentes: PascalCase
- Funções e variáveis: camelCase
- Enums: UPPER_SNAKE_CASE

## Regras Gerais
- Nunca instalar dependências com npm. Sempre usar pnpm.
- Nunca duplicar tipos entre apps — usar packages/types.
- Sempre adicionar testes ao implementar services no backend.
- Commits em inglês, seguindo Conventional Commits (feat:, fix:, chore:).
- Sempre validar schemas Zod antes de persistir dados.

## Stack de Testes
- Backend: Vitest + fastify.inject()
- Frontend: Vitest + React Testing Library (jsdom)

## Referência
- PRD completo: docs/PRD-NewraNews_V1.1.md (local-only, gitignored)
- Plano V2.0 (redesign editorial): docs/Newra-News-V2-Frontend-Redesign-Plan.md
- Discovery da V2 (Fase 0 — tokens, sitemap, contratos, baseline visual): docs/v2/
- **Regras de uso dos tokens da V2 no código: `apps/web/CLAUDE.md`** — tabela papel → classe, o que a suíte proíbe e por quê
- Diagramas: docs/diagrams/

## Status Atual

- **Onde estamos:** V2.0 com as **Fases 0 a 10 concluídas**. A **Fase 11
  (integração geral)** é a próxima e pode abrir — ela dependia de 9 e 10
  mergeadas, e as duas fecharam. A **12 (ajustes finos e release)** depois da 11
  — §28 do plano.
- **Última entrega (2026-08-24):** a **Fase 10 (frontend review)**, com os sete
  eixos da §28 fechados. Onze achados, e o mais visível é o mais antigo: **a 404
  do site ia ao ar sem uma linha de CSS** — fonte serifada do navegador, link
  azul, fundo branco no tema escuro — porque o `globals.css` era importado pelo
  layout de idioma, e a rota `_not-found` da raiz não passa por ele. Estava
  assim desde que a página existe, e estava na baseline versionada. Junto:
  **o site sem cabeçalho de defesa nenhum** (seis agora, com a CSP decidida
  medindo os 63 scripts inline da Home), **a CLI do `shadcn` na árvore de
  produção** (47 das 83 advisories eram só dela), **quatro telas confundindo "a
  API não respondeu" com "não existe"** — inclusive a Home, que guardava
  "sem notícias hoje" por uma hora na ISR — e o **`prefers-reduced-motion`
  declarado e desobedecido** nas duas listagens paginadas. **Advisories de
  produção do web: 83 → 36**, com aceite escrito para as 8 *high* do `next`.
  **451 testes em 50 suítes → 522 em 57.** Detalhe no item **35** do
  `docs/progress.md`.

- **Monetização é só planejamento** (§21): publicidade **cancelada**; newsletter
  patrocinada, Newra Plus e API B2B **adiados**. O gatilho é um número —
  **assinantes ativos e contas**, os dois persistentes.
- **Testes:** 1.250 em 111 suites (**728 API em 54** + **522 web em 57** — todos
  passando). Cobertura: API **98,71% stmts · 93,32% branch · 99,45% funcs**;
  web **72,35% stmts · 88,86% branch · 71,42% funcs** — com piso de 70% no CI
  desde a Fase 10, que antes media só a API.

### Por onde começar a Fase 11 (Integração geral)

**As Fases 9 e 10 estão fechadas.** Leia os itens **34** e **35** do
`docs/progress.md` — a 11 é a costura entre as duas metades, e cada um dos dois
registra o que deixou pendente para ela.

**O plano das quatro fases finais está na §28.** Antes de abrir a 11, leia de lá
as mesmas três coisas que a 9 e a 10 leram:

- **"Anatomia de uma fase de revisão"** — **todo achado sai como correção
  mergeada, guarda no CI, ou dívida com gatilho numérico**. Nunca como item de
  lista. E a fase abre com inventário fechado, senão não tem critério de parada.
- **"A camada de segurança e testes"** — os eixos **`S`** e **`T`** são
  obrigatórios e **não são adiáveis**. Achado de segurança **não vira dívida sem
  aceite de risco escrito**, e **sai sempre com o teste que o mantém fechado**.
- **A seção da Fase 11**, e só ela. Cada fase tem inventário próprio.

**A superfície da 11 é a costura**: em quem cada metade confia, e por quê —
sessão, token, CORS, ambiente. E a camada de testes dela é a única que entrega o
que nenhuma das outras consegue: **o fluxo ponta a ponta** (o Playwright está
instalado desde sempre, sem config e sem uma única spec — item 33).

**O que 9 e 10 deixaram explicitamente para a 11**, e é bom não redescobrir:

- **A sessão aponta para um usuário que a API pode não conhecer.** Quando o
  upsert de `lib/auth.ts` falha, `token.id` cai no id do **provedor**, que não é
  o id da API. O comportamento de hoje está **congelado em teste**
  (`tests/lib/auth.test.ts`) para que a decisão da 11 seja mudança visível.
- **o CORS declara PUT e DELETE**, mas toda mutação continua passando pelo BFF
  do Next, server-side. A dependência não declarada entre as metades é item da
  **11.S** — na 9 ela só deixou de estar quebrada por acidente.
- **o `x-request-id` é propagado pela API**, e o BFF ainda não o envia.
- **Nenhuma chamada `fetch` do web tem timeout**, com a API hibernando no plano
  free (item 33). O `ApiError` da Fase 10 já distingue "não respondeu" de "disse
  não" — falta quem decida em quanto tempo desistir.
- **A `Reuters` devolve zero itens** do feed configurado, medido em 24/08 ao
  mapear as 87 fontes do acervo. É config do `apps/api`, e a 9 já fechou.

**O que a Fase 10 deixou pronto e a 11 pode aproveitar:** quatro guardas
exaustivas novas no web, no mesmo formato da 9 — dependência de produção ⇒
consumidor declarado, rota ⇒ linha na matriz de estado, componente editorial com
heading fixo ⇒ razão escrita, e cada premissa do aceite de risco do `next` ⇒
teste que reprova quando ela deixar de valer.

**Duas dívidas compartilham o mesmo gatilho, e é o Next 15:** as 8 advisories
*high* do `next` (nenhuma alcança esta configuração hoje — a tabela está no item
35) e o **soft 404**, onde `notFound()` em rota com `revalidate` e
`not-found.tsx` aninhado responde **200**. Quem segura o segundo é o `noindex`
no caminho de falta, e essa linha tem guarda.

### Armadilhas que já custaram caro

- **Rota fora do layout de idioma não recebe o CSS, e nada acusa.** O Next
  prende o chunk de um `.css` à **entrada que o importa**, e o `_not-found` da
  raiz não passa por `app/[locale]/layout.tsx`. Resultado medido em produção: a
  404 — a página que **todo endereço errado alcança, inclusive com prefixo de
  idioma** — ia ao ar com folha de estilo nenhuma, Times New Roman e link azul.
  Importar o mesmo arquivo nos dois lugares **não resolve**: o Next deduplica e
  o chunk fica onde estava. O `globals.css` mora **só** em `app/layout.tsx`, e
  há guarda em `tests/lib/state-matrix.test.ts`. Corolário: caminho que não casa
  com arquivo de rota **não cai dentro de `[locale]`** — quem renderiza é o
  `not-found` da raiz, não o localizado.
- **`.catch(() => valor)` numa página confunde "a API disse não" com "a API não
  respondeu", e a ISR fixa a confusão.** A Home dizia "sem notícias hoje" e
  guardava a afirmação por uma hora; as telas de detalhe chamavam `notFound()`
  numa matéria que existe. Use `ApiError` (`lib/api.ts`): `status === null` é
  transporte, `isAboutTheRequest` é 404 **ou 400** — id fora do formato UUID
  devolve 400, e ele também é "não existe". `nullIfNotFound` é obrigatório em
  qualquer `catch` que alimente um `notFound()`, e há guarda.
- **"Build" não é uma coisa só, e confundir os dois reprova o CI.** O build da
  **Vercel** recebe `NEXT_PUBLIC_API_URL` e produz o que vai ao ar — ali, falhar
  quando a API não responde é o certo, porque ela preserva o deploy anterior. O
  build do **CI** roda **sem API de propósito** (`build` não precisa de banco,
  como `lint` e `typecheck`) e só confere que compila. `nullUnlessPublishing`
  (`lib/api.ts`) separa os dois pela variável `VERCEL`, que vale também em
  runtime — é ela que faz a revalidação da ISR manter a última página boa no ar.
  A primeira versão da correção da Home não fazia essa distinção e reprovou com
  `ECONNREFUSED`.
- **`scrollTo({ behavior: 'smooth' })` ignora `prefers-reduced-motion`.** O
  reset do `globals.css` cobre CSS e `scrollIntoView` sem `behavior` explícito —
  `behavior` no JavaScript vence `scroll-behavior: auto !important`. Rolagem
  programática mora em `lib/use-results-focus.ts`, que lê a preferência em tempo
  de execução e leva o foco junto (rolar sem mover o foco deixa viewport e
  cursor em lugares diferentes).
- **`notFound()` em rota com `revalidate` e `not-found.tsx` aninhado responde
  200.** Soft 404: a tela certa aparece, o status mente, e o buscador pode
  indexar. **Não é o middleware** — `/pt-BR/rota-que-nao-existe` passa pela mesma
  reescrita do `next-intl` e responde 404. Só o Next 15 corrige. O que segura o
  estrago é o `noindex` no `generateMetadata` do caminho de falta, e essa linha
  tem guarda.
- **Amostrar "100 por fonte" esconde a cauda longa do acervo.** O pipeline
  ingere a **NewsData.io** além dos 13 feeds RSS, e ela agrega centenas de
  veículos: são **87 fontes** e **95 hosts de imagem** distintos, das quais só 12
  estão em `rss-sources.ts`. Uma lista de hosts derivada das fontes cobria 77,6%
  e teria quebrado **22,4% das imagens** em silêncio (o `SafeImage` degrada sem
  gritar). Ao medir acervo, varra páginas — não filtre por fonte.
- **A varredura de cor crua exigia sufixo numérico**, então `bg-white`,
  `text-black` e os cinzas neutros passavam batido — as classes que somem no
  claro e ficam ilegíveis no escuro. Corrigida, com as quatro ocorrências de
  **véu sobre conteúdo** como exceção declarada.
- **Pacote do workspace importado em *runtime* precisa emitir JavaScript.** O
  `@newranews/types` tinha `"main": "./src/index.ts"` e `build: tsc --noEmit` —
  ou seja, **não emitia nada**. Enquanto a API só importava `type` dele, o import
  sumia na compilação e ninguém percebia. O primeiro import de **valor**
  (`PRODUCT_EVENT_RETENTION_DAYS`, no PR #122) virou `require()` no `dist`, e o
  servidor passou a morrer no boot com `ERR_MODULE_NOT_FOUND`. **`tsc` compila,
  a suíte passa, e nada acusa** — os testes rodam o fonte pelo resolvedor do
  Vitest, e só o Node puro executa o `dist`. Em produção o sintoma não parecia
  com a causa: o Render reprovava o health check, mantinha a build anterior no
  ar, e a rota nova respondia 404 num serviço que respondia 200 em todo o resto.
  A guarda é `apps/api/tests/build/runtime-deps.test.ts`.
- **Serviço no plano free do Render dorme, e `uptime` mente sobre deploy.** Ele
  hiberna com ~15 min sem tráfego; o primeiro `curl` o acorda. Concluir "o
  processo subiu na hora do merge, logo o deploy rodou" a partir do `uptime` é
  erro — o que subiu foi a própria sondagem. Para saber o que está no ar,
  **probe uma rota que só existe na versão nova**.
- **A metadata do Next não faz merge profundo.** O layout declara
  `openGraph: { type, siteName, locale }` e `twitter: { card }`; a página que
  declara os seus **substitui o objeto inteiro**. Nenhuma página tinha
  `og:type`, `og:site_name`, `og:locale` nem `og:image`, e cinco das sete
  compartilhavam com `twitter:card: summary` — porque as outras duas repetiam
  o valor à mão. O default vive em `pageMetadata` (`lib/seo.ts`); não o
  reescreva na página.
- **Rota de metadata gerada não tem extensão, e o middleware engolia.** O
  matcher exclui o que tem ponto (`sitemap.xml`, `icon.svg`, `robots.txt`);
  `opengraph-image` e `apple-icon` não têm, e viravam 307 para
  `/pt-BR/...` → 404. A imagem de compartilhamento do site e o ícone do iOS
  ficaram **inalcançáveis** desde que existem, e nada no build acusa.
  Rota de metadata nova entra no matcher de `middleware.ts`.
- **`Article.date` é data de calendário, não instante.** Gravada à meia-noite
  UTC, lida no fuso local ela vira a véspera em qualquer fuso negativo — o
  Brasil é um. A URL dizia `/article/2026-08-22` e a página dizia "21 de
  agosto"; e como a Vercel roda em UTC e o navegador não, os dois lados
  renderizavam diferente. `formatArticleDate` lê em UTC; para **instante**
  (`createdAt`, `generatedAt`) use `formatDate`/`formatDateTime`.
- **`cn` e a escala tipográfica.** `tailwind-merge` não distingue tamanho
  nomeado de cor nomeada; sem a configuração de `lib/utils.ts`, uma das duas
  some do HTML sem erro nenhum. Ao acrescentar um nome à escala em `tokens.css`,
  acrescente também em `TYPOGRAPHY_SCALE`. Detalhe em `apps/web/CLAUDE.md`.
- **Bloco sem dado devolve `null`, e o wrapper do grid também sai** — grid vazio
  tem altura zero mas ainda consome o `gap-section` do pai.
- **O nível do heading é decisão da página, nunca do componente nem do texto.**
  Nos cards é prop (`heading-level`); no corpo do briefing, o `###` que a IA
  escreve sai como `h2`, porque o `h1` é o título. Heading fixo já reprovou
  `heading-order` duas vezes neste projeto.
- **Número em controle de filtro tem de prometer o que o próprio clique
  devolve.** A pílula "Todas" da Fase 4 mostrava o total **já filtrado** por
  categoria: lia 594 e abria 2.373. Contagem de faceta ignora a própria
  dimensão; o total do recorte é o `meta.total` da listagem, e só ele.
- **Relógio dentro do render quebra página estática, e quebra em silêncio.** O
  HTML guarda o dia do *build* e o cliente compara com o dia de *agora*; toda
  meia-noite UTC os dois divergem e o React derruba a hidratação (#418/#422).
  Leia o relógio num efeito. Foi o que custou 4 pontos de best-practices em
  `/article`, e o teste que trava isso usa `renderToString`.
- **Duas utilities de mesma especificidade brigando são decididas pela ordem no
  CSS gerado**, que ninguém controla. O par `sr-only` / `focus:not-sr-only` é o
  caso clássico; o skip link usa `top` negativo + `focus:top-4`, onde o
  pseudo-seletor vence por especificidade. Ver `app/[locale]/layout.tsx`.
- **Com schema de resposta declarado, o schema é o contrato — não o `select` do
  serviço.** O `fastify-type-provider-zod` serializa pelo schema: campo que o
  serviço carrega e o schema não declara é buscado e descartado, sem erro. Foi
  assim que a auditoria do briefing e as 15 fontes por artigo ficaram invisíveis
  por um dia, com a `docs/api.md` documentando o comportamento certo.
- **`catch` com valor de fallback mente sobre "vazio" × "não deu" — e um
  `staleTime` torna a mentira permanente.** Prefetch de server component que
  vira `initialData` usa `prefetch` de `lib/api.ts`, que falha em `undefined`.
  Com um objeto vazio no lugar, a `/news` foi ao ar com as oito categorias
  zeradas ao lado de "5.783 notícias" e a query nunca buscou de novo. Onde o
  valor só é renderizado no servidor, `.catch(() => null)` continua certo.
- **O cache de `fetch` do Next (`.next/cache/fetch-cache`) sobrevive entre
  builds e serve dado velho.** Limpar antes de recapturar a baseline depois de
  mexer no seed ou nos dados.
- **O Postgres local foi baselinado com `migrate resolve`**, que marca a
  migration como aplicada sem executar o SQL — por isso falta o índice único de
  `News.sourceUrl` e há títulos duplicados no ambiente local. Não afeta
  produção. Há `pnpm --filter @newranews/database db:cleanup-news-duplicates`.
  O artigo mais recente do banco local também tem **auditoria e 12 fontes
  semeadas à mão** (21/08), para dar de ver a tela de briefing completa — não
  saiu do pipeline, e o resto do acervo local é anterior à migration.
- **`request.ip` do Fastify não é o cliente sem `trustProxy`** — é o peer do
  socket, e atrás do proxy do Render isso é o proxy. Medido em 23/08: três
  requisições com `X-Forwarded-For` diferentes consumiram o **mesmo** balde de
  rate limit. Corrigido com `trustProxy: 1` (e não `true`, que confia na ponta
  esquerda da cadeia, escrita pelo cliente). Guarda em
  `apps/api/tests/security/server-hardening.test.ts`.
- **O `env` da API é lido na carga do módulo, e `process.env` num `beforeAll`
  chega tarde.** O efeito é traiçoeiro: `AUTH_JWT_SECRET` vazio faz
  `verifyAuthJwt` recusar **todo** token por "auth não configurada", então um
  teste que só afirma 401 **passa pelo motivo errado**. Aconteceu com as guardas
  de escopo do `purpose` nesta fase. Em teste que envolve JWT, use
  `vi.mock('../../src/config/env', ...)` — como as suítes de rota já faziam — e
  inclua uma asserção de caminho feliz provando que o harness não é vazio.
- **Validação de schema responde antes da autorização.** A ordem de hooks do
  Fastify é `preValidation` → `validation` → `preHandler`, e o `authPlugin`
  está no `preHandler`: um POST anônimo com corpo inválido numa rota protegida
  devolve **400, não 401**. Não é vazamento sério (a forma do corpo está na
  `docs/api.md`), mas surpreende ao escrever teste de autorização — dê corpo
  válido, senão você mede a validação e acha que mediu a porta.
- **`turbo test` não constrói o `apps/api`, e agora também importa para SQL.**
  A suíte roda sem banco de propósito, então guarda sobre migration tem de ser
  **estática** (lê o `.sql`, não aplica). O replay de verdade é manual —
  `packages/database` + banco limpo + `prisma migrate diff`; foi feito em 23/08
  e o resultado está no item 34.
- **O gate do Lighthouse é real desde 21/08** (`configPath` nos inputs da
  action): a execução semanal de segunda 09:00 UTC falha se alguma categoria
  cair abaixo de 90.

### O que ficou em aberto

- **Trilha nas listagens** (`/news`, `/article`). Marcação de trilha pede
  trilha visível, e ali o segundo degrau seria a própria página — o
  `editorial-nav` já diz onde se está. Se um dia entrar, a lista de
  `BreadcrumbStep` é a mesma que o componente e o JSON-LD consomem.
- **Página na URL em `/article`** — a lista usa `useState`, ao contrário de
  `/news` e, desde a Fase 6, de `/favorites`. Dívida consciente: a ficha escopa a
  tela a ritmo visual, e ler a query string pediria uma fronteira de Suspense que
  a página estática precisa e a de conta não.
- **A categoria gravada acerta ~67%**, teto do classificador por palavra-chave.
  Não bloqueia tela nenhuma — o campo existe e é estável —, mas evita a surpresa
  de ver matéria fora de lugar navegando por categoria. Passar disso pede
  classificação por IA, que é trabalho próprio e ainda não foi feito. O acervo se
  renormaliza sozinho na etapa 8.5 do pipeline diário: não há job manual a
  disparar.
- **A `/api/favorites` resolve os salvos do usuário inteiros antes de paginar.**
  É o que faz o `meta.total` prometer o que a lista mostra. **O gatilho tem
  número desde a Fase 9: ~5.000 salvos numa conta** — aí o `IN` da hidratação
  carrega 5 mil ids para devolver 20 linhas. É observável sem instrumentação
  nova: `GET /api/account` já devolve `saved: { news, articles }`.
- **A `/api/metrics/product` agrega em memória a partir de uma consulta só.**
  **Gatilho: ~200.000 linhas na janela de 90 dias** (≈60 MB de objetos numa
  requisição, num plano de 512 MB), o que a ~4 eventos por pageview são **~550
  pageviews/dia**. Abaixo disso, uma consulta e uma agregação em memória custam
  menos que seis `groupBy`.
- **As métricas de HTTP não são persistidas** (`GET /api/metrics/http`). A
  janela zera a cada deploy e a cada hibernação, e com mais de uma instância
  cada uma responde a sua — por isso a resposta traz `since` e `uptimeSeconds`.
  **Gatilho para persistir:** mais de uma instância no Render, ou a primeira
  pergunta que exija comparar duas semanas.
- **Três advisories da `fastify@4` esperam a major**, que é dívida da Fase 12. A
  única **high** alcançável (bypass de validação por `content-type` com tab)
  está mitigada na porta, com guarda em
  `apps/api/tests/security/content-type-bypass.test.ts`. As outras três de
  `apps/api` têm alcance zero hoje: HTTP/2 que a API não serve, e
  `@fastify/static`, que só a UI do Swagger arrastava — e ela deixou de ser
  registrada em produção.

### Onde ler o resto

- **Histórico fase a fase, com o que cada revisão achou:** `docs/progress.md`,
  itens 11 a 24. É lá que mora o detalhe — este bloco é orientação, não
  changelog.
- **Plano de ação e próximos itens:** `docs/progress.md`, seção "Plano de Ação".
- **Decisões de design da V2:** `docs/v2/` (tokens, sitemap, contratos,
  analytics e slots) e o plano `docs/Newra-News-V2-Frontend-Redesign-Plan.md`.

> Ao concluir qualquer milestone: (1) marcar `[x]` em docs/progress.md com o
> detalhe, (2) atualizar **só o topo** deste bloco. Se ele voltar a virar
> changelog, o detalhe está no arquivo errado.
