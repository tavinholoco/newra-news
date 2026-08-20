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
- `pnpm install` — instalar dependências
- `pnpm dev` — rodar todos os apps em dev
- `pnpm build` — build de produção
- `pnpm lint` — ESLint em todo o monorepo
- `pnpm test` — Vitest (backend + frontend)
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
- **Próximos passos:** (1) **Fase 1 do plano V2 (Foundation)** — copiar `docs/v2/01-design-tokens.md` para `apps/web/styles/tokens.css`; (2) Item 8 — deploy da newsletter (domínio verificado no Resend)
- **Testes:** 448 testes em 50 suites (356 API em 32 suites + 92 web em 18 suites — todos passando)
- **Plano de ação completo:** docs/progress.md — seção "Plano de Ação"
- **Progresso detalhado:** docs/progress.md

> Ao concluir qualquer milestone: (1) marcar `[x]` em docs/progress.md, (2) atualizar este bloco.