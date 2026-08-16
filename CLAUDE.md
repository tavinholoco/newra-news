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
- `pnpm test` — Vitest (backend)
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
- PRD completo: docs/PRD-NewraNews_V1_1.md
- Diagramas: docs/diagrams/

## Status Atual

- **Fase:** Fase 5 (Polish e Portfólio) concluída em 2026-08-15 — checklist do PRD fechado
- **Último marco (2026-08-16):** Item 9 (observabilidade dev-only) concluído — modelo `PipelineEvent` + `PipelineLog` enriquecido (`errorStage`/`errorDetail`), endpoints `/api/dev/logs` (+`:pipelineId`) e página HTML `/dev/dashboard`, todos protegidos por `JOB_SECRET`; pipeline registra eventos por etapa (INFO/WARN/ERROR) substituindo os `console.warn/error` soltos. **P3 (painel admin) concluído** — `DELETE /api/news/:id` (JWT + role ADMIN) e página `/admin` com "Executar pipeline" (reusa o cron via proxy com sessão+role server-side) e remoção de notícias
- **Próximos passos:** Item 8 — deploy da newsletter (envs `RESEND_API_KEY`/`SITE_URL`/`NEWSLETTER_FROM` no Render + domínio verificado no Resend)
- **Testes:** 419 testes em 48 suites (330 API em 31 suites + 89 web em 17 suites — todos passando)
- **Plano de ação completo:** docs/progress.md — seção "Plano de Ação"
- **Progresso detalhado:** docs/progress.md

> Ao concluir qualquer milestone: (1) marcar `[x]` em docs/progress.md, (2) atualizar este bloco.