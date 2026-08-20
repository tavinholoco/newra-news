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
- **Métricas restritas a ADMIN (2026-08-20):** `/[locale]/dashboard` era **pública e indexada**. Métrica de pipeline (volume coletado, provider de IA, duração, dias com falha) é operação do projeto, não conteúdo editorial. Passou para `/[locale]/admin/metrics` e **`GET /api/metrics/dashboard` passou a exigir JWT com role ADMIN** — esconder só a página deixaria o dado a um `curl` de distância; o browser chega nele pela rota proxy `/api/admin/metrics`. O guard de sessão+role mudou de `admin/page.tsx` para **`admin/layout.tsx`**, junto do `force-dynamic`: página nova sob `/admin` já nasce protegida (conferido no `prerender-manifest.json` — nenhuma rota de `/admin` é prerenderizada, então o bug histórico do `redirect()` assado no HTML estático não volta). `/weekly` e `/monthly` seguem públicas. Redirect 308 da URL antiga. Achado no caminho: o `isActive` da navbar usava `startsWith` e marcava "Admin" e "Métricas" ao mesmo tempo em `/admin/metrics`
- **Pendências da Fase 1 fechadas (2026-08-20):** (a) **Lighthouse por rota** medido contra produção pelo mesmo workflow da §3.1 — **a acessibilidade sobe nas cinco rotas**: `/pt-BR` 96→**100**, `/en` 96→**100**, `/about` 96→**100**, `/news` 95→98, `/article` 94→98. As três de 100 não têm **nenhuma** auditoria reprovando; nas outras duas sobra só o `heading-order`, que é da Fase 3. **`color-contrast` desapareceu do site inteiro** — era ele que segurava os scores em 94–96 na V1. Performance de pé (`/news` +3; duas rotas 1 ponto abaixo, dentro do ruído). Tabela em `docs/v2/01-design-tokens.md` §12. (b) **Baseline visual da V2** — 39 capturas de produção em `docs/v2/baseline-v2/`, a referência das Fases 2–7
- **A medição achou um erro da Fase 1:** o kicker do `article-card` foi migrado para `text-brand-accent` (= `brand-600`), que sobre `surface-accent` dá 4,21:1 — passa os 3:1 de ícone e reprova os 4,5:1 de texto, porque a linha tinha ícone **e** texto. Eu havia classificado o par como ícone, inclusive no `check-contrast.mjs`. Corrigido para `text-link` (5,77:1). **Regra para as Fases 2–7: `--brand-accent` é preenchimento, ícone e borda; havendo texto na linha, o token é `--link`**
- **V2.0 Fase 2 — Shell concluída (2026-08-20):** branch `feat/v2-header`. Masthead nas três linhas da §10 (`top-bar`, `masthead`, `editorial-nav`) mais `mobile-nav`, rodapé no ritmo dos tokens, `monetization/newsletter-cta` e a landing `/[locale]/newsletter` — a única rota nova da V2. `layout/logo.tsx` com marca inline em `currentColor` e wordmark tipográfico (§40.3-A), mais os derivados que a §40.3 pedia: `icon.svg`, `apple-icon.tsx` e a imagem OG, que era um gradiente slate fora da marca. **A altura do header saiu do código**: era `64px` repetido em três lugares, e virou coluna flex + `absolute top-full` no menu — nada mais precisa saber quanto o header mede. **As categorias viraram URL** (`/news?category=X`), porque uma faixa presente em todas as telas precisa levar a algum lugar compartilhável; o `/news` lê o parâmetro, e escrever a URL a cada clique continua sendo a Fase 4. **Acessibilidade 100 com zero auditorias reprovando** no shell novo, home ainda em 157 kB
- **A revisão da Fase 2 achou 4 defeitos** que build, lint e tipos deixavam passar: navegar de `?category=A` para `?category=B` não remonta o componente, então a URL mudava e a lista ficava na categoria anterior (teste de regressão escrito antes da correção); `id` fixo num componente renderizado duas vezes; `AuthButton` duplicado no mobile; e o `renderWithIntl` perdia o provider no `rerender` — corrigido com a opção `wrapper` do RTL, o que vale para toda a suíte
- **Próximos passos:** (1) **`feat/v2-editorial-api`** — `GET /api/home`, `/api/trending` (etapa 1) e `/api/news/:id/related`. **A Fase 3 está bloqueada nela**: abre com `HeroStory`/`DailyBrief`/`TrendingList`, que consomem esses endpoints; (2) **Fase 3 (Home)** depois disso; (3) reavaliar o lockup desenhado (§40.3-B) e recapturar a baseline visual, que é anterior ao shell novo; (4) Item 8 — deploy da newsletter (domínio verificado no Resend)
- **Ambiente local (2026-08-20):** `./scripts/dev-bootstrap.sh` deixa tudo pronto do zero — Postgres (Docker se houver daemon, serviço nativo se não), envs locais, migrations, imagens de placeholder e seed com 30 dias de métricas. Idempotente. `test`/`lint`/`typecheck`/`build` **não precisam de banco**; só rodar o app e capturar screenshots precisa. **Gotcha:** o cache de `fetch` do Next (`.next/cache/fetch-cache`) sobrevive entre builds e serve dados velhos — limpar antes de recapturar a baseline depois de mudar o seed
- **Fix (2026-08-20):** `formatPipelineDuration` lia o valor como segundos, mas o backend grava milissegundos (`Date.now() - startedAt`) — a dashboard mostrava um run de 26,5s como "441m 40s". Os fixtures do teste codificavam o mesmo equívoco, por isso passava
- **Testes:** 522 testes em 58 suites (368 API em 32 suites + 154 web em 26 suites — todos passando)
- **Plano de ação completo:** docs/progress.md — seção "Plano de Ação"
- **Progresso detalhado:** docs/progress.md

> Ao concluir qualquer milestone: (1) marcar `[x]` em docs/progress.md, (2) atualizar este bloco.