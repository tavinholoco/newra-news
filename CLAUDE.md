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
- Sem framework de teste no frontend por enquanto (futuro)

## Referência
- PRD completo: docs/PRD-NewraNews_V1_1.md
- Diagramas: docs/diagrams/

## Status Atual

- **Fase:** Fase 5 (Polish e Portfólio) — pendente
- **Último marco (2026-08-16):** Item 7 (Polish UI/UX) concluído — dark mode completo (toggle + anti-FOUC + brand colors tema-aware), animações/micro-interações (fade-in-up com reduced-motion, hover lift nos cards) e primeira bateria de testes no frontend (14 testes Vitest+RTL); Lighthouse do build local: 94/96/96/100
- **Próximos passos:** Item 8 (Pós-MVP: dashboard de métricas no frontend, newsletter, autenticação), depois item 9 (dashboard de logs dev-only)
- **Testes:** 247 testes em 25 suites (todos passando)
- **Plano de ação completo:** docs/progress.md — seção "Plano de Ação"
- **Progresso detalhado:** docs/progress.md

> Ao concluir qualquer milestone: (1) marcar `[x]` em docs/progress.md, (2) atualizar este bloco.