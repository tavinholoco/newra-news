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
- `pnpm --filter @newranews/web visual:baseline` — capturas das rotas públicas (§30 do plano V2); exige app no ar. Em ambiente com Chromium pré-instalado, exportar `CHROMIUM_PATH`
- `pnpm db:migrate` — rodar migrations Prisma
- `pnpm db:generate` — gerar Prisma Client
- `pnpm db:studio` — abrir Prisma Studio

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

- **Onde estamos:** V2.0 com as Fases 0, 0.5, 1, 2, 3 e 4 concluídas. **O
  próximo ciclo é a Fase 5 (Article).** O PRD da V1 foi fechado em 2026-08-15;
  a V2 é o redesign editorial em cima dele.
- **Última entrega (2026-08-21):** Fase 4 (News / Category) fechada contra
  produção — a `/news` virou o acervo da §7 (contagem no `category-nav`, busca
  com histórico local, filtros de fonte/período/ordem, hero, lista e paginação),
  o **estado da tela saiu do componente e foi para a URL**, Lighthouse **97** na
  rota (era 93) com acessibilidade 100 nas cinco medidas, e baseline visual
  recapturada (42 imagens).
- **Testes:** 791 em 75 suites (502 API em 40 + 289 web em 35 — todos passando).

### O que a Fase 5 precisa saber antes de começar

- **Escopo:** `article hero`, tipografia do corpo, lista de fontes,
  transparência de IA, share/save, relacionadas e o CTA da newsletter.
  Especificação nas **§8 e §9 do plano V2**, e as fichas das telas em
  `docs/v2/02-sitemap-telas.md`.
- **`GET /api/news/:id/related` já existe** desde a Fase 0.5 e nunca foi
  consumido — a tela de notícia ainda não mostra relacionadas.
- **O payload do artigo já traz a auditoria e as fontes** (21/08). Antes disso o
  serviço as lia e o schema de resposta as descartava; ver item 20 do
  `progress.md`. `sources` só nos endpoints de detalhe, `position` 0-based, e os
  três campos de auditoria são **nulos** nos artigos anteriores a 20/08.
- **Falta decidir de quem é a `/news/[id]`.** A ficha da tela diz Fase 4, o §28
  diz Fase 5, e ela continua com o visual da V1. A recomendação registrada é
  tratá-la como Fase 5 — item 20.2.
- **Duas telas, não uma.** `/news/[id]` é a notícia coletada; `/article/[date]`
  é o briefing diário gerado por IA. A §8 fala das duas, e a transparência de
  IA (`sources`, `generatedAt`) só existe na segunda.
- **Os cards editoriais continuam sendo para reusar.** Depois da Fase 4 eles
  aceitam `highlight` e um slot `action` — ver `apps/web/CLAUDE.md`.

### Armadilhas que já custaram caro

- **`cn` e a escala tipográfica.** `tailwind-merge` não distingue tamanho
  nomeado de cor nomeada; sem a configuração de `lib/utils.ts`, uma das duas
  some do HTML sem erro nenhum. Ao acrescentar um nome à escala em `tokens.css`,
  acrescente também em `TYPOGRAPHY_SCALE`. Detalhe em `apps/web/CLAUDE.md`.
- **Bloco sem dado devolve `null`, e o wrapper do grid também sai** — grid vazio
  tem altura zero mas ainda consome o `gap-section` do pai.
- **Nível de heading é prop, não valor fixo** nos cards editoriais. Heading fixo
  foi o que deixou `heading-order` reprovando em `/news` e `/article`.
- **Número em controle de filtro tem de prometer o que o próprio clique
  devolve.** A pílula "Todas" da Fase 4 mostrava o total **já filtrado** por
  categoria: lia 594 e abria 2.373. Contagem de faceta ignora a própria
  dimensão; o total do recorte é o `meta.total` da listagem, e só ele.
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
- **O gate do Lighthouse é real desde 21/08** (`configPath` nos inputs da
  action): a execução semanal de segunda 09:00 UTC falha se alguma categoria
  cair abaixo de 90.

### O que ficou em aberto na Fase 4

- **"Somente salvos" da §7** — filtrar por favoritos exige juntar `Favorite` e
  `News` e uma resposta por usuário, que não pode ser cacheada no CDN como o
  resto da rota é. É trabalho da **Fase 6**.
- **Nada mais.** As `news--*` da baseline foram recapturadas depois do conserto
  do prefetch, e as contagens somam o total do acervo.
- **A categoria gravada acerta ~67%**, e isso é o teto do classificador por
  palavra-chave. A Fase 4 é interface sobre um campo que existe e é estável, mas
  evita a surpresa de ver matéria fora de lugar navegando por categoria. Passar
  de 67% pede classificação por IA, que é trabalho próprio e ainda não foi
  feito. O acervo se renormaliza sozinho na etapa 8.5 do pipeline diário — não
  existe job manual a disparar.

### Onde ler o resto

- **Histórico fase a fase, com o que cada revisão achou:** `docs/progress.md`,
  itens 11 a 19. É lá que mora o detalhe — este bloco é orientação, não
  changelog.
- **Plano de ação e próximos itens:** `docs/progress.md`, seção "Plano de Ação".
- **Decisões de design da V2:** `docs/v2/` (tokens, sitemap, contratos,
  analytics e slots) e o plano `docs/Newra-News-V2-Frontend-Redesign-Plan.md`.

> Ao concluir qualquer milestone: (1) marcar `[x]` em docs/progress.md com o
> detalhe, (2) atualizar **só o topo** deste bloco. Se ele voltar a virar
> changelog, o detalhe está no arquivo errado.
