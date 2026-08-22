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

- **Onde estamos:** V2.0 com as Fases 0, 0.5, 1, 2, 3, 4, 5 e **6** concluídas.
  **O próximo ciclo é a Fase 7 (SEO/performance/acessibilidade).** O PRD da V1
  foi fechado em 2026-08-15; a V2 é o redesign editorial em cima dele.
- **Última entrega (2026-08-22):** Fase 6 (Account ecosystem) fechada contra
  produção, em três PRs — banco e API (#116), telas de conta (#117) e "somente
  salvos" no acervo (#118). `Favorite` passou a alcançar o briefing
  (`itemType` + `itemId`), nasceram `/account`, `/account/preferences` e
  `/account/newsletter`, e o `news-card` da V1 saiu do repositório.
  Acessibilidade **100 nas cinco rotas**, gate verde.
- **Nada pendente do ciclo anterior.** Os dois itens que as Fases 4 e 5 adiaram
  ("somente salvos" e "salvar" no briefing) foram entregues na 6.
- **Testes:** 905 em 84 suites (537 API em 41 + 368 web em 43 — todos passando).

### Por onde começar a Fase 7

**Leia o item 24 do `docs/progress.md`** — é o fechamento da Fase 6, com o que
ficou entregue e o que ela deixou para trás. O checklist da Fase 7 está na §28
do plano: JSON-LD de `NewsArticle`, `BreadcrumbList`, news sitemap, canonical,
metadata, e as quatro auditorias (imagem, teclado, contraste, leitor de tela)
mais Core Web Vitals.

Três coisas que a Fase 6 deixa prontas para ela:

- **A acessibilidade está em 100 nas cinco rotas medidas**, e o gate do
  Lighthouse é real desde 21/08. A Fase 7 é para ir além do que a métrica
  sintética alcança — teclado e leitor de tela de verdade —, não para consertar
  o que ela já cobre.
- **Toda tela de conta é `noindex`** e fica fora do `sitemap.ts`. O que a Fase 7
  audita é o conteúdo público: Home, acervo, notícia, briefing e histórico.
- **A performance da Home oscila entre 83 e 94 conforme o aquecimento** (ver o
  aviso no ritual de fechar fase). Antes de tratar isso como regressão, meça com
  o site quente.

O que a Fase 6 entregou, em uma linha cada:

1. **`Favorite` polimórfico** — `itemType` (`NEWS` | `ARTICLE`) + `itemId`, com
   `@@unique([userId, itemType, itemId])`; é o que permite salvar o briefing e
   ter "Salvos" como **uma** lista.
2. **`/api/favorites` aceita as dimensões do acervo** (o mesmo schema Zod da
   `/api/news`), e é a fonte do "somente salvos" — que por isso compõe com
   categoria, busca, fonte, período e ordem.
3. **`/api/account/*`** monta a tela de conta numa chamada, e **nenhuma rota de
   conta leva `Cache-Control`**.
4. **`UserPreference`** guarda só o que a interface honra: assuntos e tema.
   "Horário do briefing" ficou de fora (cron único) e "receber por e-mail" é a
   inscrição, que é `Subscriber`.
5. **As telas** `/account`, `/account/preferences`, `/account/newsletter` e
   `/favorites` na camada editorial — e o `news-card` da V1 saiu do repositório.

O que ela **não** fez, de propósito:

- **Nome editável no perfil.** `upsertUser` reescreve `name` e `image` a cada
  sign-in; um campo ali seria desfeito no login seguinte. Pede coluna própria.
- **Temas, fontes e horário do briefing** (§19) — não há quem os consuma, e
  controle que o sistema ignora é a armadilha da pílula de contagem da Fase 4.
- **Excluir a conta.** Ninguém pediu, e é fluxo com consequência jurídica.

### Armadilhas que já custaram caro

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
