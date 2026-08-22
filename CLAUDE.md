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

> **Aqueça o site antes de medir, ou você mede o deploy.** Rodado minutos após o
> merge, o Lighthouse pega a **regeneração da ISR**: na Fase 6 a `/pt-BR` deu 83
> de performance (execuções 0,64 · 0,83 · 0,83) enquanto a `/en` — a mesma
> página — deu 94. Dois `curl` na rota e uma segunda execução devolveram 94, sem
> mudar uma linha. Um `curl` em cada rota medida resolve.

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

- **Onde estamos:** V2.0 com as Fases 0, 0.5, 1, 2, 3, 4, 5, 6 e **7**
  concluídas. **O próximo ciclo é a Fase 8 (Monetização).** O PRD da V1 foi
  fechado em 2026-08-15; a V2 é o redesign editorial em cima dele.
- **Última entrega (2026-08-22):** Fase 7 (SEO/performance/acessibilidade), em
  um PR. `lib/seo.ts` virou a fonte única de URL e de metadata; nasceram o
  JSON-LD (`Organization`, `WebSite`, `NewsArticle`, `BreadcrumbList`), a trilha
  visível e `/news-sitemap.xml`. **A medição contra produção achou quatro
  defeitos que o checklist não previa** — ver abaixo.
- **Nada pendente do ciclo anterior.**
- **Testes:** 953 em 90 suites (537 API em 41 + 416 web em 49 — todos passando).

### Por onde começar a Fase 8

**Leia o item 25 do `docs/progress.md`** — é o fechamento da Fase 7. O checklist
da Fase 8 está na §28 do plano: abstração de `AdSlot`, inventário reservado,
camada de privacidade/consentimento, patrocínio da newsletter e o framework de
experimento de preço.

Duas coisas que a Fase 7 deixa prontas para ela:

- **O `AdSlot` já existe e já reserva altura** (`lib/ads.ts`, §9 de
  `docs/v2/04-analytics-e-slots.md`), e **não renderiza nada sem inventário**.
  O que falta é o inventário e o `track()` — `ad_view`/`ad_click` estão
  escritos como pendência desde a Fase 3, porque medir impressão sem ter onde
  gravar o evento seria código morto.
- **Consentimento é o que trava o resto.** Sem ele não há como servir anúncio
  personalizado na UE, e a camada mexe em toda página — vale desenhá-la antes
  de qualquer criativo.

O que a Fase 7 entregou, em uma linha cada:

1. **`pageMetadata`** — a metadata inteira de uma página pública num lugar só:
   canonical auto-referente, os três `hreflang` (com `x-default`), `og:url` e os
   defaults de OG/Twitter que **o Next não herda do layout**.
2. **JSON-LD** — `Organization` + `WebSite` no layout; `NewsArticle` +
   `BreadcrumbList` nas telas de leitura, com a autoria seguindo quem escreveu.
3. **A trilha visível**, que recebe **a mesma lista** que o `BreadcrumbList` — e
   que substituiu o "← voltar".
4. **`/news-sitemap.xml`** — janela de 48h, só as URLs `pt-BR`, `news:language`
   em ISO 639.
5. **As cinco auditorias**, com a de imagem virando guarda em
   `tests/lib/images.test.ts` em vez de passada manual.

O que ela **não** fez, de propósito:

- **Trilha nas listagens** (`/news`, `/article`). Marcação de trilha pede trilha
  visível, e ali o segundo degrau seria a própria página — o `editorial-nav` já
  diz onde se está.
- **Página na URL em `/article`** — continua em `useState`. Ver "o que ficou em
  aberto".

### Armadilhas que já custaram caro

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
