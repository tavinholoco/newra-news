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

**O trabalho integra na `dev`. A `main` é o que está no ar e recebe `dev → main`
por promoção deliberada** — é esse merge que publica, dispara as migrations e
roda o smoke contra produção.

Ramifique da `dev` atualizada, e abra o PR com base `dev`:

```
feat/<escopo>     nova funcionalidade
fix/<escopo>      correção de bug
chore/<escopo>    build, deps, config
docs/<escopo>     documentação
```

```bash
git fetch origin && git checkout -b feat/<escopo> origin/dev
gh pr create --base dev
```

**As duas são base de primeira classe no CI** — `ci.yml` e `codeql.yml` disparam
nas duas, então um PR para a `dev` roda lint, typecheck, testes, cobertura,
`pnpm audit` e CodeQL igual. PR empilhado sobre outra **feature branch**, não:
ali só Gitleaks e Vercel aparecem, e já aconteceu de uma mudança nunca chegar na
`main` por causa disso.

Se a `dev` tiver ficado para trás da `main`, alinhe antes de ramificar — enquanto
ela não tiver commit próprio, é fast-forward:

```bash
git push origin origin/main:refs/heads/dev
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
pnpm --filter @newranews/web test:coverage     # idem, no web
pnpm guard:mutations                           # cada guarda vista reprovando
```

**Defeito corrigido vira guarda, e guarda se vê reprovando antes de valer.**
Escreva o teste, quebre o código de propósito, confirme que ele reprova — e
registre a quebra em `scripts/guard-mutations.mjs`, que o `pnpm
guard:mutations` reaplica (só sobre arquivo commitado). Guarda que nunca foi
vista falhando já passou verde, neste projeto, sobre o defeito que existia para
achar. O ritual completo está no §19 do
[plano de observabilidade](docs/Newra-News-Observability-Plan.md).

Onde a guarda pergunta sobre a **estrutura** do código (quem chama o quê, que
literal chega onde), use o parser (`ts.createSourceFile`), não regex: uma aspa
dentro de um literal de regex já apagou 481 linhas de uma varredura.

**Contagem escrita em prosa tem dono.** Número de feeds, de workflows, de dias
de retenção e de fluxos do smoke estão sob guarda nos documentos vivos (os dois
READMEs, os `CLAUDE.md`, `docs/architecture.md`, os diagramas): ao mudar a
coleção, a suíte aponta cada frase que ficou velha.

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
- [ ] Guarda nova vista reprovando, com a mutação registrada em `scripts/guard-mutations.mjs`
- [ ] Screenshots (antes/depois) quando a mudança for visual
- [ ] Impacto em performance descrito quando a mudança for acima da dobra
- [ ] Acessibilidade: foco visível, navegação por teclado, contraste
- [ ] Strings novas presentes em **pt-BR e en**
- [ ] **README/docs atualizados** quando a mudança afetar comandos, env vars ou estrutura de pastas
- [ ] Alterações de API refletidas em `docs/api.md` (há guarda: rota sem linha lá reprova)
- [ ] Rota de admin nova sob `/api/admin` na API e com `requireRole: 'ADMIN'` no BFF — os dois têm guarda
- [ ] Falha nova com `code` literal do conjunto fechado em `apps/api/src/utils/errors.ts` — nunca interpolado

O CI roda lint, typecheck, testes, cobertura, `pnpm audit --prod`, CodeQL e Gitleaks em cada PR — o PR só é mergeável com tudo verde. O Smoke E2E e as migrations rodam só no push da `main`, ou seja, na promoção.
