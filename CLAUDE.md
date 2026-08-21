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

- **Onde estamos:** V2.0 com as Fases 0, 0.5, 1, 2 e 3 concluídas e verificadas
  contra produção. **O próximo ciclo é a Fase 4 (News / Category).** O PRD da V1
  foi fechado em 2026-08-15; a V2 é o redesign editorial em cima dele.
- **Última entrega (2026-08-21):** Fase 3 (Home editorial) fechada contra
  produção — Lighthouse **95·100·100·100** na Home, acessibilidade 100 nas cinco
  rotas medidas com zero auditorias reprovando, baseline visual recapturada (42
  imagens em `docs/v2/baseline-v2/`) e as pendências do item 18 encerradas.
- **Testes:** 684 em 71 suites (478 API em 40 + 206 web em 31 — todos passando).

### O que a Fase 4 precisa saber antes de começar

- **Escopo:** `category-nav`, busca, `filter state`, paginação, estados vazios e
  skeletons. Especificação na **§7 e §28 do plano V2**, e a ficha da tela em
  `docs/v2/02-sitemap-telas.md`.
- **Os cards de `components/editorial/` são para reusar, não reconstruir.** Eles
  já nasceram client components de propósito exatamente para servirem à
  listagem CSR de `/news` — ver `apps/web/CLAUDE.md`.
- **`/news` hoje só *lê* `?category=` e `?search=` da URL.** *Escrever* a URL a
  cada clique de filtro e de página é o "filter state" da Fase 4.
- **`editorial-nav` ≠ `category-nav`.** O primeiro é a faixa de navegação do
  shell, entregue na Fase 2, e leva a `/news?category=X`. O segundo é o filtro
  do acervo dentro de `/news`, com estado selecionado — e é da Fase 4.
- **A categoria gravada acerta ~67%**, e isso é o teto do classificador por
  palavra-chave (medido em 21/08 com dez regras candidatas contra 3.688 linhas
  do acervo). A Fase 4 é interface sobre um campo que existe e é estável, então
  isso **não a bloqueia** — mas evita a surpresa de ver matéria fora de lugar
  navegando por categoria. Passar de 67% pede classificação por IA, que é
  trabalho próprio e ainda não foi feito.
- **O acervo se renormaliza sozinho** na etapa 8.5 do pipeline diário: qualquer
  correção nas regras de ingestão alcança as linhas já gravadas na execução
  seguinte. Não existe job manual a disparar.

### Armadilhas que já custaram caro

- **`cn` e a escala tipográfica.** `tailwind-merge` não distingue tamanho
  nomeado de cor nomeada; sem a configuração de `lib/utils.ts`, uma das duas
  some do HTML sem erro nenhum. Ao acrescentar um nome à escala em `tokens.css`,
  acrescente também em `TYPOGRAPHY_SCALE`. Detalhe em `apps/web/CLAUDE.md`.
- **Bloco sem dado devolve `null`, e o wrapper do grid também sai** — grid vazio
  tem altura zero mas ainda consome o `gap-section` do pai.
- **Nível de heading é prop, não valor fixo** nos cards editoriais. Heading fixo
  foi o que deixou `heading-order` reprovando em `/news` e `/article`.
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

### Onde ler o resto

- **Histórico fase a fase, com o que cada revisão achou:** `docs/progress.md`,
  itens 11 a 18. É lá que mora o detalhe — este bloco é orientação, não
  changelog.
- **Plano de ação e próximos itens:** `docs/progress.md`, seção "Plano de Ação".
- **Decisões de design da V2:** `docs/v2/` (tokens, sitemap, contratos,
  analytics e slots) e o plano `docs/Newra-News-V2-Frontend-Redesign-Plan.md`.

> Ao concluir qualquer milestone: (1) marcar `[x]` em docs/progress.md com o
> detalhe, (2) atualizar **só o topo** deste bloco. Se ele voltar a virar
> changelog, o detalhe está no arquivo errado.
