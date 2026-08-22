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

- **Onde estamos:** V2.0 com as Fases 0, 0.5, 1, 2, 3, 4 e 5 concluídas. **O
  próximo ciclo é a Fase 6 (Account ecosystem).** O PRD da V1 foi fechado em
  2026-08-15; a V2 é o redesign editorial em cima dele.
- **Última entrega (2026-08-21):** Fase 5 (Article) fechada contra produção — as
  três telas de leitura (`/news/[id]`, `/article/[date]` e o histórico
  `/article`) sobre uma camada editorial nova, com a transparência de IA **só**
  no briefing. Acessibilidade **100 nas cinco rotas**; a medição achou uma
  hidratação quebrada em `/article` e a baseline achou o dek repetido no corpo —
  os dois corrigidos e a baseline recapturada.
- **Nada pendente do ciclo anterior.** A Fase 6 abre limpa.
- **Testes:** 825 em 78 suites (502 API em 40 + 323 web em 38 — todos passando).

### Por onde começar a Fase 6

**As quatro decisões de banco já foram tomadas (21/08) — estão no item 23 do
`docs/progress.md`, com o plano de execução em três PRs.** O item 22 continua
sendo o levantamento que as motivou; leia o 23 primeiro.

O que ficou decidido:

1. **`Favorite` polimórfico** — `itemType` (`NEWS` | `ARTICLE`) + `itemId`,
   `@@unique([userId, itemType, itemId])`, migration renomeando `newsId` e
   fazendo backfill. É o que permite "Salvos" ser **uma** lista ordenada por
   data de salvamento. (`articleId` nullable caiu: no Postgres `NULL` não colide
   com `NULL`, e o mesmo briefing poderia ser salvo N vezes.)
2. **"Somente salvos" mora na `/api/favorites`**, que ganha as dimensões da
   listagem (`category`, `search`, `from`/`to`, `source`, `sort`); a `/news`
   troca de fonte de dados quando o filtro está ligado e segue cacheável.
3. **`UserPreference` (tabela própria) só com o que a tela honra hoje** —
   categorias favoritas, tema e opt-in de alerta. "Horário do briefing" fica de
   fora: o cron é único, e controle que o sistema não honra é a armadilha da
   pílula "Todas".
4. **`Subscriber.userId` nullable**, preenchido no sign-up logado e com backfill
   por e-mail; leitura por `userId` com fallback por e-mail.

A ordem: **um PR de backend** com as três migrations e as rotas (é o papel que a
Fase 0.5 teve para a Fase 3), depois as telas, depois o "somente salvos".

O que vale saber antes de escrever a primeira linha:

- **O browser nunca fala autenticado com a API.** `lib/api.ts` vai direto ao
  `NEXT_PUBLIC_API_URL` sem token; só as rotas proxy do Next assinam o JWT
  (`app/api/favorites/route.ts`). Toda tela de conta passa por proxy.
- **`useIsFavorite` baixa 100 favoritos e testa no cliente** — do 101º em diante
  o coração mente. A fase entrega `GET /api/favorites/ids`.
- **`upsertUser` sobrescreve `name` e `image` a cada login**, então nome
  editável no perfil seria desfeito no próximo sign-in. O perfil desta fase é de
  leitura.
- **Resposta por usuário não leva `Cache-Control`** — `utils/cache.ts` diz por
  quê. `/api/news` não usa o helper; o cache da `/news` vem da ISR da página.
- **Tela de conta não pode ser SSG.** `/favorites` é `force-dynamic` porque o
  `redirect()` de sessão foi assado no HTML estático e mandava todo mundo para o
  sign-in. Toda tela nova herda a restrição, e o guard de sessão do
  `app/[locale]/admin/layout.tsx` é o padrão a copiar para `/account`.
- **`favorites-list` é o último consumidor do `news-card` da V1** — migrando
  para `story-card-compact`, `news-card` (e provavelmente `news-grid`) sai do
  repositório.
- **A camada editorial é para reusar.** `article-hero` é casca com encaixes;
  `pagination`, `story-card*` e `article-meta` não sabem de domínio nenhum.
- **A migration de produção corre em paralelo com os deploys** (`migrate.yml`
  dispara no push para `main`): migration só aditiva, e confirmar que terminou
  antes de medir.

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

### O que ficou em aberto na Fase 5

- **Página na URL em `/article`** — a lista usa `useState`, ao contrário de
  `/news`. Dívida consciente: a ficha escopa a tela a ritmo visual, e ler a
  query string pediria uma fronteira de Suspense que a página não precisa.
- **"Salvar" no briefing e "somente salvos" no acervo** — os dois esperam a
  Fase 6, pelo mesmo motivo: `Favorite` referencia `newsId`.
- **A categoria gravada acerta ~67%**, teto do classificador por palavra-chave.
  Não bloqueia tela nenhuma — o campo existe e é estável —, mas evita a surpresa
  de ver matéria fora de lugar navegando por categoria. Passar disso pede
  classificação por IA, que é trabalho próprio e ainda não foi feito. O acervo se
  renormaliza sozinho na etapa 8.5 do pipeline diário: não há job manual a
  disparar.

### Onde ler o resto

- **Histórico fase a fase, com o que cada revisão achou:** `docs/progress.md`,
  itens 11 a 22. É lá que mora o detalhe — este bloco é orientação, não
  changelog.
- **Plano de ação e próximos itens:** `docs/progress.md`, seção "Plano de Ação".
- **Decisões de design da V2:** `docs/v2/` (tokens, sitemap, contratos,
  analytics e slots) e o plano `docs/Newra-News-V2-Frontend-Redesign-Plan.md`.

> Ao concluir qualquer milestone: (1) marcar `[x]` em docs/progress.md com o
> detalhe, (2) atualizar **só o topo** deste bloco. Se ele voltar a virar
> changelog, o detalhe está no arquivo errado.
