# Contribuindo com o Newra News

Obrigado pelo interesse. Este guia cobre o fluxo de trabalho, as convenções de código e o que é esperado em um PR.

## Ambiente

O passo a passo completo (env vars, Docker, seed, troubleshooting) está em [`docs/setup.md`](docs/setup.md). Versão curta:

```bash
pnpm install
docker compose up -d
pnpm db:generate && pnpm db:migrate
pnpm dev
```

Requisitos: Node >= 22, pnpm 9, Docker. **Nunca use `npm install`** — o monorepo depende de pnpm workspaces.

## Branches

Trabalhe sempre em uma branch a partir de `main`:

```
feat/<escopo>     nova funcionalidade
fix/<escopo>      correção de bug
chore/<escopo>    build, deps, config
docs/<escopo>     documentação
```

## Commits

Commits em **inglês**, seguindo [Conventional Commits](https://www.conventionalcommits.org/):

```
feat(web): add editorial hero to home
fix(api): retry transient AI provider errors with backoff
docs: record live validation of pipeline hardening
```

## Convenções de código

- TypeScript estrito — sem `any`, sem `@ts-ignore`
- Imports absolutos por alias: `@newranews/database`, `@newranews/types`
- Validação com Zod em **todas** as rotas do backend
- Nomes de arquivo em kebab-case (`news-card.tsx`, `pipeline.service.ts`)
- Componentes React em PascalCase; funções e variáveis em camelCase; enums em UPPER_SNAKE_CASE
- Nunca duplicar tipos entre apps — o lugar deles é `packages/types`
- Toda string de UI sai de `apps/web/messages/{pt-BR,en}.json` — as duas precisam ser atualizadas juntas

## Testes

Todo service novo no backend exige testes. Stack: Vitest + `fastify.inject()` na API, Vitest + React Testing Library (jsdom) no web.

```bash
pnpm test                                      # tudo
pnpm --filter @newranews/api test              # só backend
pnpm --filter @newranews/web test              # só frontend
pnpm --filter @newranews/api test:coverage     # cobertura (threshold 70%)
```

## Migrations

Mudanças de schema passam por `packages/database/prisma/schema.prisma` seguidas de uma migration gerada — nunca por alteração manual no banco:

```bash
pnpm db:migrate -- --name add_briefing_metadata
```

Revise o SQL gerado em `packages/database/prisma/migrations/` antes de commitar. A estratégia completa (baseline, deploy, expand-and-contract) está na seção 37 do [plano V2](docs/Newra-News-V2-Frontend-Redesign-Plan.md).

## Checklist de PR

Antes de abrir, confirme:

- [ ] `pnpm lint` e `pnpm turbo typecheck` limpos
- [ ] `pnpm test` verde
- [ ] Screenshots (antes/depois) quando a mudança for visual
- [ ] Impacto em performance descrito quando a mudança for acima da dobra
- [ ] Acessibilidade: foco visível, navegação por teclado, contraste
- [ ] Strings novas presentes em **pt-BR e en**
- [ ] **README/docs atualizados** quando a mudança afetar comandos, env vars ou estrutura de pastas
- [ ] Alterações de API refletidas em `docs/api.md`

O CI roda lint, typecheck, testes e cobertura em cada PR — o PR só é mergeável com tudo verde.
