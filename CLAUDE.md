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

- **Fase:** Fase 5 (Polish e Portfólio) concluída em 2026-08-15 — checklist do PRD fechado
- **Último marco (2026-08-16):** Item 9 (observabilidade dev-only) concluído — modelo `PipelineEvent` + `PipelineLog` enriquecido (`errorStage`/`errorDetail`), endpoints `/api/dev/logs` (+`:pipelineId`) e página HTML `/dev/dashboard`, todos protegidos por `JOB_SECRET`; pipeline registra eventos por etapa (INFO/WARN/ERROR) substituindo os `console.warn/error` soltos. **P3 (painel admin) concluído** — `DELETE /api/news/:id` (JWT + role ADMIN) e página `/admin` com "Executar pipeline" (reusa o cron via proxy com sessão+role server-side) e remoção de notícias
- **Último marco (2026-08-19):** plano V2.0 (redesign editorial) instalado em `docs/Newra-News-V2-Frontend-Redesign-Plan.md` — versão 2.1 do documento + seção 40 (auditoria de prontidão do repositório) e seção 41 (convenções de execução com Opus 5). README reescrito no padrão open source e `CONTRIBUTING.md` criado
- **Bloqueadores da V2 resolvidos (2026-08-19):** migrations versionadas (saíram do `.gitignore`) + baseline `0_init` gerada; workflow `.github/workflows/migrate.yml` (`migrate status` + `migrate deploy`, no-op enquanto não houver secret `DATABASE_URL`); `LICENSE` MIT; repo git órfão em `apps/web/.git` removido; 14 divergências do plano corrigidas no corpo das seções (registro em §40.2)
- **Logo (2026-08-19):** asset recebido em PNG e **vetorizado** — `apps/web/public/logo/logo-mark.svg` (`#C94F22`, igual ao `brand-600` da V2) e `logo-mono.svg` (`currentColor`), 633/638 bytes, `viewBox="0 0 1184 1312"` justo. Reconstrução geométrica validada por diff de pixels (3 px de erro de forma). **Lockup decidido:** wordmark tipográfico na fonte de interface (§5), com o lockup desenhado adiado para reavaliação ao fim da Fase 2 — ver §40.3
- **Baseline do banco concluído (2026-08-19):** drift conferido (vazio), `migrate resolve --applied 0_init` aplicado no Neon, secret `DATABASE_URL` no GitHub com a string **direta** (sem `-pooler` — o Render segue com a pooled), senha do role rotacionada. Produção validada: `/api/health` e `/api/news` em 200
- **V2.0 Fase 0 concluída (2026-08-20):** discovery técnico entregue em **`docs/v2/`** — diagnóstico (rotas, componentes, consumo das APIs, Lighthouse por rota, acessibilidade, bundle), **design tokens fechados** (paleta em duas camadas + contraste medido + mapeamento das 31 variáveis do shadcn), sitemap de telas, contratos de `GET /api/home`/`/trending`/`/:id/related` e catálogo de analytics + slots de anúncio. **Tipografia decidida: Newsreader (manchetes) + Inter (interface)** — sai o Bricolage Grotesque. Baseline visual da V1 capturada (42 imagens, `pnpm --filter @newranews/web visual:baseline`). Checklist da §28 fechado
- **Correções que a Fase 0 fez (2026-08-20):** (a) a migration `0_init` **não replicava** — terminava com o banner do CLI do Prisma colado no SQL, invisível em produção porque lá foi aplicada com `migrate resolve` (que não executa o SQL); faltava também o `migration_lock.toml`, sem o qual não havia como checar drift. Ambos corrigidos e verificados em banco limpo; (b) o workflow do Lighthouse media **uma URL só, através de um redirect, uma vez por execução, e descartava os relatórios** — corrigido para 5 rotas × 3 execuções, com scores no summary e artifact de 90 dias; (c) o piso "96·96·96·100" da §26 era **só da home** — o critério de aceite passa a ser a tabela por rota do diagnóstico
- **V2.0 Fase 0.5 — auditoria do briefing (2026-08-20):** a revisão da Fase 0 expôs que **nenhuma fase do §28 comportava o trabalho de backend** — as Fases 1 e 2 são 100% frontend e a Fase 3 abre consumindo endpoints inexistentes. Criada a **Fase 0.5 (Backend editorial)** no plano + branch `feat/v2-editorial-api` na §29. **Migration `add_daily_briefing_metadata` entregue antes da Fase 1**, porque o dado só é capturado daqui pra frente: nada registrava quais notícias entravam no briefing (o Stage 5 logava só a contagem) e o cleanup apaga `News`/`PipelineLog` aos 30 dias enquanto `Article` vive 90 — cada dia de atraso era um briefing sem lista de fontes, sem backfill possível. O pipeline agora grava `generatedAt`, `promptVersion` (época + hash do conteúdo do prompt, para não depender de alguém lembrar de subir a versão), `modelVersion` (o modelo, não o provider) e a tabela `BriefingSource` (título/fonte/URL **desnormalizados** para sobreviver ao cleanup; `newsId` é ponteiro fraco nulável). Fontes substituídas em transação a cada run — o artigo é upsert por data
- **V2.0 Fase 1 — Foundation concluída (2026-08-20):** branch `feat/v2-design-foundation`. `apps/web/styles/tokens.css` em duas camadas, e a decisão que mais muda o dia a dia é que **a paleta não entra no `@theme`** — `bg-brand-600` deixou de ser classe válida, então consumir a camada semântica virou obrigatório por construção, não por convenção. 57 usos de classe de marca migrados (os 13 mapeados de `brand-400`/`brand-900` mais os 44 de `brand-600`/`brand-100`), Newsreader no lugar do Bricolage Grotesque, escala tipográfica por papel, radius/sombra/ritmo/motion/camadas. **As 16 falhas de AA de branco sobre laranja somem na origem** (`--primary` = `brand-700`) e o `text-white/50` do rodapé subiu de nível. `--sidebar-*` apagado, `--chart-*` com rampa de matiz variado, `components/editorial/` com `ArticleMeta`/`SourceBadge`/`ReadingTime`. Achados no caminho: dois `hover:text-brand-700` que **nunca funcionaram** porque o token não existia na V1, e — via `scripts/check-contrast.mjs`, que mede 53 pares lendo o próprio `tokens.css` — `danger-400` a **3,61:1** sobre o rodapé de marca, resolvido com um `danger-300` novo. 22 testes novos, incluindo `design-tokens.test.ts`, que varre `app/`+`components/` proibindo camada 1, opacidade sobre `--text-muted`, cor crua do Tailwind, radius e duração fora da escala, e sombra fora dos overlays. **A revisão da própria fase achou 4 defeitos que build, lint e 477 testes deixavam passar:** `??` no lugar de `||` em `ArticleMeta` (com `source: ''` a data e o tempo de leitura sumiam junto), ativo e hover com o mesmo fundo na nav mobile, `z-base` (0) num scrim, e `--radius-xl`/`--radius-2xl` aliasados para 12px em vez de as classes serem migradas. Detalhe em `docs/v2/01-design-tokens.md` §11.4
- **Em aberto da Fase 1 (não bloqueiam a Fase 2):** Lighthouse por rota contra a tabela do `00-diagnostico.md` §3.1 — aquela tabela saiu do runner do GitHub contra produção, e medir em laboratório local daria número não comparável — e a baseline visual da V2
- **Próximos passos:** (1) **Fase 2 do plano V2 (Shell)** — top bar, masthead, navegação de categorias, rodapé e a landing `/[locale]/newsletter`; (2) **`feat/v2-editorial-api`** — `GET /api/home`, `/api/trending` (etapa 1) e `/api/news/:id/related`; pode correr em paralelo às Fases 1–2, mas a Fase 3 não abre sem ela mergeada; (3) Item 8 — deploy da newsletter (domínio verificado no Resend)
- **Ambiente local (2026-08-20):** `./scripts/dev-bootstrap.sh` deixa tudo pronto do zero — Postgres (Docker se houver daemon, serviço nativo se não), envs locais, migrations, imagens de placeholder e seed com 30 dias de métricas. Idempotente. `test`/`lint`/`typecheck`/`build` **não precisam de banco**; só rodar o app e capturar screenshots precisa. **Gotcha:** o cache de `fetch` do Next (`.next/cache/fetch-cache`) sobrevive entre builds e serve dados velhos — limpar antes de recapturar a baseline depois de mudar o seed
- **Fix (2026-08-20):** `formatPipelineDuration` lia o valor como segundos, mas o backend grava milissegundos (`Date.now() - startedAt`) — a dashboard mostrava um run de 26,5s como "441m 40s". Os fixtures do teste codificavam o mesmo equívoco, por isso passava
- **Testes:** 480 testes em 52 suites (365 API em 32 suites + 115 web em 20 suites — todos passando)
- **Plano de ação completo:** docs/progress.md — seção "Plano de Ação"
- **Progresso detalhado:** docs/progress.md

> Ao concluir qualquer milestone: (1) marcar `[x]` em docs/progress.md, (2) atualizar este bloco.