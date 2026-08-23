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
> A `/news` em 90 raspa o piso — se ela cair, olhe o audit antes de culpar o
> aquecimento.

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

- **Onde estamos:** V2.0 com as **Fases 0 a 8 concluídas**; a Fase 8 foi
  auditada em 23/08. **A próxima é a Fase 9 (Backend review).** A antiga "Fase 9
  — Release" foi reescrita em 23/08 e virou **quatro**: **9 (backend review)**,
  **10 (frontend review)**, **11 (integração geral)** e **12 (ajustes finos e
  release final)** — §28 do plano.
- **Última entrega (2026-08-23):** a **auditoria de fechamento da Fase 8**, que
  achou o gate do Lighthouse medindo *cold start* e não página — o workflow
  passou a aquecer sozinho. Antes dela, **a tela de métricas de produto** fechou
  a **Fase 8**. `GET /api/metrics/product` (admin) e um bloco novo no
  `/admin/metrics`: audiência, leitura, cliques por origem, categorias e buscas
  sem resultado. Antes dela, o anúncio foi cancelado (item 29) e o `/api/events`
  foi consertado (item 30) — **a ingestão está no ar**, respondendo 201 em
  produção.
- **Monetização é só planejamento** (§21): publicidade **cancelada**; newsletter
  patrocinada, Newra Plus e API B2B **adiados**. O gatilho é um número —
  **assinantes ativos e contas**, os dois persistentes.
- **Testes:** 1.026 em 95 suites (575 API em 45 + 451 web em 50 — todos
  passando).

### Por onde começar a Fase 9 (Backend review)

**A Fase 8 está fechada.** Leia os itens **26 a 32** do `docs/progress.md` — a
camada de analytics, o cancelamento do anúncio, o conserto do empacotamento, a
tela de métricas e a auditoria de fechamento.

**O plano das quatro fases finais está na §28**, com inventário fechado,
checklist por eixo e critério de saída para cada uma. Antes de abrir a 9, leia
duas coisas de lá:

- **"Anatomia de uma fase de revisão"** — a regra que vale para as três de
  revisão: **todo achado sai como correção mergeada, guarda no CI, ou dívida com
  gatilho numérico**. Nunca como item de lista. E cada fase abre com inventário
  fechado, senão não tem critério de parada.
- **"A camada de segurança e testes"** — os eixos **`S`** e **`T`** são
  obrigatórios nas quatro fases e **não são adiáveis para a seguinte**. Achado de
  segurança **não vira dívida sem aceite de risco escrito**, e **sai sempre com o
  teste que o mantém fechado**. Os dois eixos saem em PR próprio.
- **A ordem:** 9 e 10 correm **em paralelo** (apps diferentes, sem conflito de
  arquivo); a 11 só abre com as duas mergeadas; a 12 só depois da 11.

**Três achados de segurança já verificados** esperam a fase que os cobre — estão
no item **33** do `docs/progress.md` com o método de verificação: o **site não
tem nenhum cabeçalho de segurança** (a API tem o conjunto do helmet); o **feed
RSS escreve no mesmo canal das instruções da IA**, e a saída é publicada sem
revisão humana; e **40 advisories high em dependências de produção**, dois deles
só corrigíveis em major (`next` 14→15, `fastify` 4→5).

**Boa parte dos oito itens da antiga Fase 9 já existe** — a baseline visual
(§30), o gate do Lighthouse e a validação de SEO da Fase 7. O que **não** existe
e a §28 nomeia: o smoke E2E (o Playwright está instalado sem config e sem uma
única spec), o limiar de cobertura do web, a guarda de deriva da `docs/api.md`,
e a extensão do `SchemaMatchesSharedType` para além da rota de eventos.

Três coisas a saber:

- **A tela de métricas nasce mostrando quase zero**, e zero é honesto: a
  ingestão entrou no ar em 22/08. O número começa a significar algo depois de
  alguns dias de tráfego.
- **A tabela de agregado diário fica para ~90 dias depois** — é quando o expurgo
  começa a apagar evento cru e a comparação entre meses deixa de existir. Entra
  sem retrabalho.
- **Não reintroduza espaço de anúncio** sem ler a §21: publicidade está
  **cancelada por decisão**, não esquecida. `subscription_intent` segue sem call
  site e `premium-cta` não deve existir antes de haver plano pago.

### Armadilhas que já custaram caro

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
  É o que faz o `meta.total` prometer o que a lista mostra, e o conjunto é
  limitado pela conta. Com dezenas de milhares de salvos por pessoa, vira
  consulta a otimizar — não é o caso hoje, e está documentado no serviço.

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
