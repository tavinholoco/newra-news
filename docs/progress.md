# Progresso do Projeto — Newra News

> Este arquivo é a fonte de verdade do progresso de desenvolvimento.
> Atualizar ao concluir cada milestone. Referenciar o commit correspondente.

---

## Fase Atual

> **Onde estamos, em uma linha (24/08/2026):** V2.0 com as **Fases 0 a 11
> concluídas**; a **12 (ajustes finos e release final)** é a última e pode abrir.
> O detalhe de cada uma está nos itens numerados abaixo — as quatro finais são
> **34** (backend review), **35** (frontend review) e **36** (integração geral).
>
> **O que segue nesta seção é um log de anexação, não uma ordem.** As entradas
> foram acrescentadas conforme cada fase fechou e não estão em ordem
> cronológica — a de baixo não é a mais recente. Para o estado atual, leia a
> linha acima ou o bloco "Status Atual" do `CLAUDE.md`; para o detalhe, o item
> numerado.

**Fase 5 — Polish e Portfólio** ✅ Concluída em 2026-08-15

> Fases 1–4 concluídas. Pipeline validado em produção: 89 artigos em 90 dias (17/mai → 14/ago), 1 gap, 0 falhas no último mês.
> NewsAPI substituída pela NewsData.io — provider ativo em produção desde 2026-08-16: 3 chaves ok (NewsData/Gemini/Groq), 8 categorias preenchidas, 491 notícias/dia.
> Checklist completo da Fase 5 fechado: UI/UX (item 7), code review geral, loading states + error boundaries e apresentação de portfólio (`docs/presentation.md`); typecheck adicionado ao CI.

**Newra News V2.0 — Fase 9 (Backend review)** ✅ Concluída em 2026-08-23 — **os seis eixos da §28 fechados**

> `review/v2-backend`. O balde de rate limit era **um só para a internet inteira** (medido em produção), o feed RSS escrevia no mesmo canal das instruções da IA, e o 500 devolvia a mensagem interna de qualquer erro. Sete achados de segurança, cada um com a guarda que o mantém fechado. Advisories de produção da API 21 → 6; 575 testes em 45 suítes → **728 em 54**. Ver **item 34**.

**Newra News V2.0 — Fase 0 (Discovery técnico)** ✅ Concluída em 2026-08-20

> Entregáveis em `docs/v2/` (5 documentos + baseline visual). Checklist da §28 do plano fechado. Ver **item 11**.

**Newra News V2.0 — Fase 0.5 (Backend editorial)** 🔶 Parcial em 2026-08-20

> Migration de auditoria do briefing entregue; os três endpoints editoriais ficam para a branch `feat/v2-editorial-api`, que precisa ser mergeada **antes** de a Fase 3 abrir. Ver **item 12**.

**Newra News V2.0 — Fase 1 (Foundation)** ✅ Concluída em 2026-08-20

> `apps/web/styles/tokens.css` implementa a paleta, a tipografia e o ritmo fechados na Fase 0; 480 testes verdes. Branch `feat/v2-design-foundation`. Ver **item 13**.

**Métricas restritas a ADMIN** ✅ 2026-08-20

> `/[locale]/dashboard` (pública, indexada, ISR) virou `/[locale]/admin/metrics`, e `GET /api/metrics/dashboard` passou a exigir JWT com role ADMIN. Ver **item 14**.

**Newra News V2.0 — Fase 2 (Shell)** ✅ Concluída em 2026-08-20 — **checklist da §28 fechado**

> Masthead em três linhas (§10), faixa de categorias, menu mobile, rodapé no ritmo dos tokens, `newsletter-cta`, a landing `/[locale]/newsletter` e as duas telas de texto (`/about`, `/newsletter/unsubscribe`). Lockup reavaliado e baseline recapturada. 522 testes verdes; acessibilidade 100 em todas as telas medidas. Ver **item 15**.

**Newra News V2.0 — Fase 0.5 (Backend editorial)** ✅ Concluída em 2026-08-20

> Os três endpoints entregues: `GET /api/home`, `/api/trending` (etapa 1) e `/api/news/:id/related`. 422 testes na API. Branch `feat/v2-editorial-api`. Ver **item 16**.

**Newra News V2.0 — Fase 3 (Home)** ✅ Concluída em 2026-08-21 — **checklist da §28 fechado**

> A Home editorial da §6: `HeroStory`, `DailyBrief`, `TopStories`, `TrendingList`, `CategorySections`, `AdSlot` e os layouts responsivos, mais a camada de cards da §11 que os alimenta. **Uma chamada de rede** (`GET /api/home`) no lugar de duas que montavam bem menos página. 625 testes verdes. Ver **item 17**.

**Newra News V2.0 — Fase 4 (News / Category)** ✅ Concluída em 2026-08-21 — **checklist da §28 fechado, verificada contra produção**

> A `/news` virou o acervo da §7: `category-nav` com contagem, busca com histórico local e destaque do termo, filtros de fonte/período/ordem, hero, lista editorial e paginação numerada. O **estado saiu do componente e foi para a URL** — até a Fase 3 ela só era lida. A contagem por categoria pediu um endpoint aditivo, `GET /api/news/facets`. Lighthouse **97·100·100·100** na rota (era 93), baseline recapturada, 786 testes verdes. Ver **item 19**.

**Pré-requisitos da Fase 5** ✅ Concluídos em 2026-08-21

> O artigo era buscado com a auditoria e as fontes e **servido sem elas** — o schema de resposta era o da V1 e o `fastify-type-provider-zod` serializa pelo schema. Corrigido; três itens do checklist da Fase 5 dependiam disso. Ver **item 20**.

**Newra News V2.0 — Fase 5 (Article)** ✅ Concluída em 2026-08-21 — **checklist da §28 fechado**

> As três telas de leitura: `/news/[id]`, `/article/[date]` e o histórico `/article`. Camada editorial nova (`article-hero`, `article-body`, `ai-disclosure`, `source-list`, `share-button`, `related-stories`) e a `pagination` promovida de `news/` para `editorial/`. A transparência de IA fica **só** no briefing; a notícia coletada declara a outra coisa. 820 testes verdes. Ver **item 21**.

**Newra News V2.0 — Fase 6 (Account ecosystem)** ✅ Concluída em 2026-08-22 — **checklist da §28 fechado, verificada contra produção**

> O ecossistema de conta em três PRs: banco e API (#116), telas (#117) e "somente salvos" no acervo (#118). `Favorite` virou polimórfico (`itemType` + `itemId`) e passou a alcançar o briefing; nasceram `/account`, `/account/preferences` e `/account/newsletter`; `/favorites` migrou para a camada editorial e o `news-card` da V1 saiu do repositório. **Acessibilidade 100 nas cinco rotas**, gate verde, 905 testes. Decisões no **item 23**, fechamento no **item 24**.

**Newra News V2.0 — Fase 7 (SEO / performance / acessibilidade)** ✅ Concluída em 2026-08-22 — **checklist da §28 fechado**

> `lib/seo.ts` virou a fonte única de URL e de metadata (canonical, `x-default`, `og:url` e os defaults que o Next **não** herda do layout); `lib/json-ld.ts` + `components/seo/json-ld.tsx` levam `Organization`, `WebSite`, `NewsArticle` e `BreadcrumbList`; a trilha visível nasceu espelhando o dado estruturado; e `/news-sitemap.xml` publica a janela de 48h do Google Notícias. A medição contra produção achou quatro defeitos que o checklist não previa — a imagem OG e o ícone do iOS inalcançáveis, `og:image`/`og:type`/`og:site_name` ausentes em toda página, e o briefing exibindo a véspera. 416 testes no web. Ver **item 25**.

**Newra News V2.0 — Fase 8 (Medição de produto)** ✅ **Concluída em 2026-08-22**, auditada em 23/08

> A fase se chamava **Monetização** e foi reescrita em 22/08/2026: **o site não exibe anúncio**. A camada de analytics saiu em três PRs (itens **26**, **27** e **28**) e ficou; o aparato de anúncio foi **removido** (item **29**). O que resta é a **tela de métricas de produto** — hoje o `ProductEvent` recebe evento e ninguém o lê.
>
> **Monetização virou planejamento** (§21 do plano): publicidade **cancelada**; newsletter patrocinada, Newra Plus e API B2B **adiados** para lançamento futuro e indeterminado. O gatilho para retomá-los é um número — **assinantes ativos e contas**, os dois persistentes —, e é a tela de métricas que o mostra.
>
> **A ingestão está no ar** desde 22/08: `POST /api/events` responde 201 em produção. O 404 anterior não era o deploy — era o `@newranews/types` não emitir JavaScript (item **30**). A tela de métricas fecha a fase no item **31**.

**Newra News V2.0 — Fase 10 (Frontend review)** ✅ Concluída em 2026-08-24 — **os sete eixos da §28 fechados**

> `review/v2-frontend`. **A 404 do site ia ao ar sem uma linha de CSS** — o `globals.css` era importado pelo layout de idioma e a rota `_not-found` da raiz não passa por ele; estava assim desde que a página existe, e estava na baseline versionada. Junto: o site **sem cabeçalho de defesa nenhum** (seis agora), a CLI do `shadcn` na árvore de produção, e quatro telas confundindo "a API não respondeu" com "não existe". Advisories de produção do web 83 → 36; 451 testes em 50 suítes → **522 em 57**. Ver **item 35**.

**Newra News V2.0 — Fase 11 (Integração geral)** ✅ Concluída em 2026-08-24 — **os oito eixos da §28 fechados**

> `review/v2-integration`, PR #135. **Quinze achados, e nenhum tem sintoma de erro** — a costura não quebra, ela combina errado e a tela continua desenhando. O maior estava à vista: **`revalidate = 3600` nas duas telas de leitura não fazia nada** (`x-vercel-cache: MISS` nas três tentativas). Junto: nenhuma chamada `fetch` do web tinha prazo, a sessão apontava para um usuário que a API não conhece, o balde de ingestão de eventos é um só para todos os leitores, e um log guardava e-mail de assinante. **O smoke E2E existe pela primeira vez** — 29 specs contra produção. 1.250 testes em 111 suítes → **1.314 em 122**. Ver **item 36**.

**Newra News V2.0 — as fases finais replanejadas** ✅ **2026-08-23**

> A "Fase 9 — Release" da §28 virou **quatro**: **9 (backend review)**, **10 (frontend review)**, **11 (integração geral)** e **12 (ajustes finos e release final)**, cada uma com inventário fechado, eixos de **segurança (`S`)** e **testes (`T`)** obrigatórios, e critério de saída. O planejamento achou quinze coisas verificadas antes de qualquer código — entre elas o site **sem nenhum cabeçalho de segurança**, o feed RSS escrevendo **no mesmo canal das instruções da IA**, e **40 advisories high** em dependências de produção. Suíte, build e produção conferidos: a Fase 9 pode abrir. Ver **item 33**.

---

## Plano de Ação — Continuar o Desenvolvimento (atualizado 2026-08-16)

> Checklist vivo do que falta. Marcar `[x]` ao concluir (referenciar commit).

### 1. Publicar o provider NewsData.io ✅

- [x] Merge dev → main + deploy no Render — main em `0bbe811` (2026-08-16), deploy automático confirmado (endpoint novo `/api/health/providers` respondendo)
- [x] Confirmar boot com `NEWSDATA_API_KEY` — validado: `GET /api/health/providers` → `{ newsdata: "ok", gemini: "ok", groq: "ok" }`

> Correção incluída neste item: provider NewsData agora trata `source_name` ausente (fallback para `source_id`/`Unknown source`) e remove o placeholder `ONLY AVAILABLE IN PAID PLANS` do tier free — commit `0bbe811`. Sem isso o `prisma.news.createMany` falhava (`Argument source is missing`) e o pipeline abortava.

### 2. Validar NewsData em produção (comparar com RSS) ✅

- [x] Dashboard após execução (2026-08-16, pipeline `06fbe642`): 491 notícias, artigo gerado (Gemini), 26,5s, 0 erros; mensal: `newsApiCount` 67 vs `rssCount` 4321 e `newsByCategory` com **as 8 categorias preenchidas** (WORLD 3484, TECHNOLOGY 345, ECONOMY 128, HEALTH 98, SCIENCE 61, SPORTS 57, POLITICS 40, ENTERTAINMENT 17)
- [x] Qualidade: pt-BR, sem duplicatas (dedup por URL no pipeline), imagens presentes. Observação: o tier free da NewsData tem ruído de bucket (alguns artigos chegam em categoria não-condizente, ex.: notícia de eleição no bucket technology) — aceitável para portfólio; possível refino futuro no pipeline
- [x] **Validação diária 2026-08-17 (pipeline automático):** o dia teve **2 execuções** — cron Vercel 08:00 BRT (news persistidas 11:00:09Z) e 2º run 08:48 BRT (news 11:48:27Z). O 1º run persistiu as notícias (Stage 4) mas **não gerou o artigo** (criado só no 2º run, 11:48:57Z — falhou entre Stages 5–7, provável Stage 6 IA; causa exata só visível nos PipelineLogs em produção, protegidos). Run final (dailyMetric): **509 notícias coletadas, artigo Gemini, 34.953ms, 0 erros**; artigo 2026-08-17 publicado no frontend (HTTP 200, conteúdo pt-BR coeso citando 15 notícias); **8 categorias preenchidas** no dia; dedup intra-run ok (509 únicas por run). Mês (ago): 4739 notícias (dedup), 17 artigos, 0 dias de falha, 8 categorias. **Qualidade:** itens da ESPN com `description`/`content` = literal `"null"` (vem do próprio feed — `<description><![CDATA[null]]></description>`); ~30% sem `imageUrl` (ESPN, InfoMoney, Olhar Digital, Folha não expõem media no RSS) — mesmo nível aceitável já documentado acima.
- [x] **Fix de duplicatas (2026-08-17):** `News.sourceUrl` agora é `@unique` no schema + `prisma.news.createMany` usa `skipDuplicates: true` (evento do Stage 4 registra quantos foram pulados); script `packages/database/prisma/cleanup-news-duplicates.ts` (com dry-run via `DRY_RUN=true`) para remover linhas duplicadas pré-existentes **antes** do `prisma db push` (a constraint falha se ainda houver duplicatas); docs em `docs/setup.md` (seção 4 + troubleshooting); 1 teste novo no pipeline (suíte API: 333 → **334**); typecheck limpo (turbo + database). **Aplicado em produção (2026-08-17):** commit `24ba329` push na `main` → deploy Render concluído; cleanup no Neon removeu **3737 linhas duplicadas** (8597 → 4860 notícias, 1202 URLs com duplicata — acumuladas de runs duplos) e `prisma db push --accept-data-loss` aplicou a constraint única — verificado via API: **0 URLs duplicadas** no feed.
- [x] **Root cause do run 1 de 17/08 (investigado via `/api/dev/logs`):** run `2797f6ab` (11:00:00Z, cron 08:00 BRT) falhou no **Stage 6** com `Groq API error: 404 Not Found` (errorStage 6, provider groq). Sequência: coletou 611 (rss 543 + newsdata 68) → dedup 599 → persistiu 599 → selecionou 15 → **Gemini falhou (erro transitório não persistido — o `ai.service` só loga no console) → fallback Groq deu 404**. Causa do 404: o Groq **deprecou `llama-3.1-8b-instant` com shutdown em 16/08/2026** (substituto oficial: `openai/gpt-oss-20b` — fonte: console.groq.com/docs/deprecations) — o fallback estava morto desde ontem. Run 2 (`29e5a221`, 11:48:22Z / 08:48 BRT — sem gatilho agendado nesse horário, retry manual via painel admin/curl) rodou com Gemini OK: 521 → 509, artigo 11:48:57Z, newsletter 1/1, 35s, SUCCESS. **Ações recomendadas:** (a) trocar `GROQ_MODEL` para `openai/gpt-oss-20b` em `render.yaml`/env.example/docs/.env — sem isso o fallback continua 404; (b) persistir o erro primário da Gemini no fallback (observabilidade); (c) opcional: retry/backoff na Gemini p/ erros transitórios (429/5xx). O PipelineLog não registra a origem do trigger (cron vs admin) — possível melhoria futura.
- [x] **Fix do fallback Groq (2026-08-17):** `GROQ_MODEL` trocado de `llama-3.1-8b-instant` para **`openai/gpt-oss-20b`** (substituto oficial após o shutdown do Groq em 16/08/2026) em todos os pontos: default do código (`apps/api/src/config/env.ts`), `apps/api/.env.example`, `render.yaml` (produção — aplica no próximo deploy do Render), `docs/setup.md`, `.env` local e stubs de testes (9 arquivos). Sem isso o fallback retornava 404 e qualquer falha transitória da Gemini derrubava o pipeline. Suíte API + typecheck verdes. **Em produção:** deployado junto do commit `24ba329` (render.yaml). **Confirmado (2026-08-17):** dashboard do Render sem `GROQ_MODEL` manual (só a `GROQ_API_KEY`, que é `sync: false` no render.yaml) → vale o `value: openai/gpt-oss-20b` do blueprint; e mesmo que a env não existisse, o default do código (`env.ts`) já é o modelo novo — dupla garantia, sem ação manual necessária. **Validado ao vivo (2026-08-17):** chave Groq de produção + `openai/gpt-oss-20b` → HTTP 200 (resposta OK); `llama-3.1-8b-instant` → HTTP 404 (confirmando o shutdown); idempotência OK (trigger manual retornou o run das 11:48 sem 3º run); `createMany` com `skipDuplicates` → count 0 e sem skip → P2002 no Neon.
- [x] **Observabilidade do fallback de IA (2026-08-17):** agora o `ai.service` carrega o erro primário da Gemini no erro final do Groq (`withPrimaryError`), e o pipeline registra **os dois** no `PipelineLog` quando o fallback também falha — evento `WARN 'Primary provider failed before fallback'` (com provider/statusCode da Gemini) + `ERROR` final (Groq), e `errorDetail.primaryError` no JSON do log (dashboard dev mostra ambos). Antes só o erro do fallback ficava registrado (no run de 17/08, o 404 do Groq escondia a falha transitória da Gemini que o causou). **2 testes novos** (ai.service: erro carrega o primário; pipeline: WARN+ERROR+primaryError no errorDetail); suíte API: 334 → **336**; typecheck limpo. **Em produção:** deployado junto do commit `24ba329`.
- [x] **Retry com backoff nos providers de IA (2026-08-17):** `gemini.provider` e `groq.provider` agora tentam **3x** com backoff exponencial (1s/2s + jitter até 500ms) em erros **transitórios** — HTTP 429, 5xx e timeout (AbortError) — antes de desistir (a Gemini cai no fallback Groq só depois de esgotar as tentativas; o Groq ganhou também timeout de 60s, que não tinha). Erros permanentes (400/404, etc.) não retentam. **Retry-After respeitado (2026-08-17):** quando a resposta 429/5xx traz o header `Retry-After` (delta-seconds ou HTTP-date), o delay usa o valor do servidor em vez do backoff fixo, com **teto de 30s** para não travar o pipeline (o fallback existe justamente para não esperar demais). Lógica centralizada no `ai-utils.ts`: `withRetry`, `isTransientApiError`, `sleep`, `parseRetryAfterMs` e `attachRetryAfter` (que anexa o delay ao erro no provider) — mesmo padrão nos dois providers. Isso ataca a causa-raiz do run de 17/08: uma falha momentânea da Gemini derrubava o pipeline direto no fallback. **10 testes novos nesta rodada** (4 de parse do Retry-After + 3 de attach + 2 no Gemini + 1 no Groq); suíte API: 346 → **356**; typecheck limpo. **Ainda não deployado** — entra no próximo push para a `main`.

### 3. Endpoint de diagnóstico de chaves ✅

- [x] `GET /api/health/providers` (protegido com `JOB_SECRET`) testando ao vivo NewsData, Gemini e Groq — resposta `{ newsdata: "ok"|"invalid", gemini: "...", groq: "..." }`
- [x] Testes Vitest (26 novos: service + rota) + documentação em `docs/api.md`

### 4. Classificador de categorias RSS ✅

- [x] Classificação por palavras-chave (título/descrição → Category) para feeds sem categoria (hoje 4 de 5 caem em WORLD) — `services/category-classifier.service.ts`, peso 2 no título / 1 na descrição, sem acentos, fallback WORLD
- [x] Expandir `rss-sources.ts` com feeds especializados (economia: InfoMoney, Valor; esportes: ESPN Brasil, Trivela; ciência: Olhar Digital, Superinteressante; saúde: Veja Saúde, Drauzio Varella — URLs verificadas como RSS válido)
- [x] Testes do classificador (14 unit) + integração no provider RSS (16 testes novos no total)

### 5. Medição (critérios de sucesso do PRD §18) ✅

- [x] Cobertura de testes do backend >70% — medido 2026-08-16: 94,33% linhas / 91,91% statements / 94,73% funções / 94,33% branches; threshold 70 em `apps/api/vitest.config.ts` + passo `test:coverage` no CI (`ci.yml`, `turbo test:coverage`)
- [x] Lighthouse >90 — auditado contra produção 2026-08-16 (mobile, via Lighthouse real): **Performance 96 · Accessibility 96 · Best Practices 96 · SEO 100**; `.lighthouserc.json` + workflow `lighthouse.yml` (semanal + manual) falham se qualquer categoria < 90

### 6. Documentação (Fase 5) ✅

- [x] `docs/setup.md` — guia completo: pré-requisitos, 3 arquivos de env (com tabelas), Docker/Postgres, dev, testes, trigger manual do pipeline, troubleshooting e deploy
- [x] Diagramas Mermaid — 4 criados em `docs/diagrams/` (system-architecture, er-diagram, pipeline-sequence, data-flow) alinhados ao PRD §§3.1–3.3 e à implementação real (dedup por sourceUrl, NewsData.io, classificador)
- [x] README final — features, screenshots reais (docs/screenshots/: home, news, article), stack, quick start, scripts, pipeline, docs e URLs de produção

### 7. Polish UI/UX (Fase 5) ✅

- [x] Dark mode — base CSS já existia (variáveis `.dark` + `@custom-variant`); adicionado mecanismo completo: script anti-FOUC (`theme-init`), toggle no header (`theme-toggle`, Sun/Moon, persiste em localStorage com fallback para preferência do sistema), brand colors tema-aware (variaveis `--brand-*`) e correção de `bg-white`/`hover:text-brand-900` (invisivel no dark) em header/navbar/paginas
- [x] Animações e micro-interações — fade-in-up no hero do artigo (com `motion-reduce:animate-none`), hover lift + sombra nos cards de noticia (imagem ja tinha scale no hover)
- [x] Testes no frontend (eram zero) — Vitest + React Testing Library + jsdom: 14 testes (format, api client, NewsCard, ThemeToggle) em 4 suites; `pnpm test` via turbo cobre api + web; corrigido também lint do web (faltava `eslint-plugin-import` declarado)

### 8. Pós-MVP (depois do core polido)

- [x] **Dashboard de métricas no frontend** (a API `/api/metrics/*` já existe pronta) — página `/dashboard` (ISR 1h) com resumo do dia (notícias, artigo, IA, duração, erros), últimos 7 dias (média/dia, artigos, taxa de sucesso, duração média), distribuição por categoria e uso de IA (barras com cores do tema) e últimos 30 dias; client com TanStack Query + skeletons (`loading.tsx`/`DashboardSkeleton`) e error boundary (`error.tsx`); link "Métricas" na navbar; tipos compartilhados em `packages/types/src/metrics.ts`; helpers de formatação em `lib/format.ts`; **11 testes novos no web** (format, api client, DashboardClient)
  - **Validado localmente (2026-08-15):** API + web no ar, `/dashboard` renderizando com dados reais; encontrado e corrigido um **bug pré-existente de hidratação** no `ThemeToggle` (Item 7): o estado inicial lia a classe `.dark` no cliente, divergindo do HTML do servidor em dark mode (erro de hydration em todas as páginas). Fix: estado inicial neutro + sincronização idempotente no mount + persistência apenas no clique; teste de regressão adicionado (26 testes web)
- [ ] Newsletter com o artigo diário — **implementada até o frontend** (plano em `docs/newsletter-plan.md`, passos 1–5): modelos `Subscriber` + `NewsletterLog` + enum no Prisma; provider Resend; service `newsletter.service`; rotas subscribe/unsubscribe/send; **estágio 7.5 no pipeline** (não-crítico, idempotente via `NewsletterLog.date`); **frontend**: form de inscrição no footer (`SubscribeForm` com validação e estados) + página `/newsletter/unsubscribe` (cancelado/inválido, noindex); **36 testes novos** (provider + service + rotas + pipeline + web) e fluxo completo validado localmente (inscrever → unsubscribe → reativar). **Docs atualizadas (2026-08-16):** envs + painel dev no `setup.md`, números no `presentation.md`. **Deploy em produção validado (2026-08-16):** release publicado (merge dev → main, `4dc87df`; deploy automático Render/Vercel confirmado); schema aplicado ao Neon via `prisma db push` (o build do Render não aplica schema — tabelas `User`/`Favorite`/`Subscriber`/`NewsletterLog`/`PipelineEvent` estavam faltando e quebravam o upsert de auth e a newsletter); envs da newsletter no Render (`RESEND_API_KEY`, `SITE_URL`, `NEWSLETTER_FROM`) e de auth no Vercel/Render (`NEXTAUTH_SECRET`/`NEXTAUTH_URL`, `AUTH_JWT_SECRET` idêntico nos dois, `ADMIN_EMAILS`, `CORS_ORIGIN`); login GitHub real em produção criando `User` com role `ADMIN` (validado no banco Neon); envio da newsletter validado: `POST /api/newsletter/send` → `{total:1, sent:1, failed:0}` em modo de teste (`onboarding@resend.dev` — Resend entrega apenas para o e-mail da conta; assinante de teste `pedrolevidiass@gmail.com`). **Falta:** domínio próprio → verificar no Resend e trocar `NEWSLETTER_FROM` para o domínio (envio real para qualquer assinante)
- [x] Autenticação/favoritos, i18n, painel admin — plano em `docs/post-mvp-plan.md` (P1 auth+favoritos → P2 i18n → P3 admin após Item 9; decisões: Google+GitHub, cookie de locale). **P1.1 + P1.2 concluídos (2026-08-16):** modelo `User` + enum `UserRole` (Prisma); next-auth v4 (Google/GitHub, sessão JWT); **plugin de auth JWT na API** (`AUTH_JWT_SECRET` compartilhado web↔api, `src/plugins/auth.ts` + `utils/jwt.ts`); rota `POST /api/auth/upsert` (cria/atualiza usuário no signIn, role por `ADMIN_EMAILS`, aceita name/image nulos dos OAuth providers — bug real achado no smoke test); `AuthButton` no header (Entrar/Sair), `SessionProvider` + tipos de sessão; **18 testes novos** (12 API: jwt + upsert; 6 web: jwt util + AuthButton) e smoke test local do fluxo JWT (200/401/401) validado. **P1.3 concluído (2026-08-16):** modelo `Favorite` (`userId+newsId` unique, sem FK — padrão do schema) + `favorite.service` (list com join manual em News, add idempotente via upsert com 404 p/ notícia inexistente, remove com 404 p/ favorito inexistente) + rotas `GET/POST/DELETE /api/favorites` (JWT obrigatório) + tipos compartilhados `Favorite`/`FavoriteWithNews` em `packages/types`; **14 testes novos** (7 rotas + 7 service) e smoke test real do fluxo (add→idempotente→list com notícia embutida→404s→delete→401) validado. **P1.4 concluído (2026-08-16):** **rotas proxy no Next** (`app/api/favorites` + `[newsId]`) que leem a sessão do next-auth e assinam o JWT server-side (o browser nunca vê o `AUTH_JWT_SECRET`); `FavoriteButton` (heart) no `NewsCard` e no `NewsDetail` com toggle otimista (TanStack Query) e redirect para sign-in quando deslogado; página `/favorites` protegida (redirect p/ sign-in com callbackUrl) com lista, skeleton, erro+retry e estado vazio; link "Favoritos" no navbar só quando logado; **16 testes novos** (3 api client + 4 FavoriteButton + 4 FavoritesList + 5 rotas proxy). Validado no preview: hearts em todos os cards, clique deslogado → signIn, `/favorites` → redirect, console limpo. **P1 completo** — auth + favoritos ponta a ponta. **P2 concluído (2026-08-16)** — i18n pt/en com next-intl 3.26: `i18n/request.ts` resolve o locale do cookie `locale` (default `pt-BR`); `middleware.ts` garante o cookie na primeira visita; `messages/pt-BR.json` + `messages/en.json` com todas as strings de UI; `NextIntlClientProvider` no layout + `html lang` dinâmico + metadata localizada (`generateMetadata` com `getTranslations`); **seletor de idioma (PT/EN) no header** (`LocaleSwitcher`, grava cookie + `router.refresh()`); componentes client usam `useTranslations`/`useLocale`, server components usam `getTranslations`/`getLocale`; datas/números localizados (`formatDate`/`formatArticleDate`/`formatCount` com locale, `toDateFormatLocale` em `lib/i18n.ts`); categorias via chaves `categories.*`; **64 testes no web** (+10 novos: paridade de chaves pt/en, namespaces usados existem nos 2 JSONs, render pt/en, LocaleSwitcher); validado em produção local (curl + preview): pt-BR/en, `lang` correto, datas "15 de ago. de 2026" ↔ "Aug 15, 2026", plurais ICU ("8 fontes consultadas" ↔ "8 sources consulted"). **P2.3 — migração p/ rotas com prefixo (2026-08-16):** `/pt-BR` `/en` (`localePrefix: 'always'`); `i18n/routing.ts` + `i18n/navigation.ts` (Link/`usePathname`/`useRouter` com prefixo), `setRequestLocale` + `generateStaticParams`, páginas movidas para `app/[locale]/`, root layout pass-through (`app/layout.tsx` só repassa children), sitemap/hreflang por idioma, LocaleSwitcher com `router.replace(pathname, {locale})`. **ISR restaurado:** `● SSG` com `revalidate: 3600` por idioma (o cookie sozinho tornava tudo dinâmico — trade-off anterior revertido). **Bug de hidratação encontrado e corrigido:** `app/loading.tsx`/`app/error.tsx` na raiz criavam boundaries fora do `<html>` (root pass-through) e quebravam a hidratação ("Only one element on document allowed") — removidos; o `not-found.tsx` raiz agora renderiza `<html>`/`<body>` próprios (padrão do exemplo oficial do next-intl). **65 testes web verdes** (+teste de link localizado no NewsCard); validado em dev e produção: hidratação limpa, troca PT/EN client-side, redirect `/` → `/pt-BR`, sitemap com os 2 idiomas, 404 localizado. **Follow-ups (2026-08-16):** (a) **hreflang completo** — `alternates.languages` em todas as `generateMetadata`, inclusive nas dinâmicas `news/[id]` e `article/[date]` (id/data no path) e nas noindex (`favorites`, `unsubscribe`); validado no HTML renderizado; (b) **revalidação on-demand** — `/api/cron/daily-news` chama `revalidatePath('/[locale]', 'layout')` + `revalidatePath('/sitemap.xml')` após o trigger do pipeline, regenerando o HTML estático dos dois idiomas sem esperar os 3600s. **Detalhe importante:** o cache do Next grava as tags com o padrão literal da rota (`_N_T_/[locale]/layout`), então revalidar por caminho resolvido (`/pt-BR`) **não funciona** — o padrão `/[locale]` é obrigatório (validado localmente: manifest de tags + re-render bloqueante ~5–14× mais lento que o HIT após o cron, em ambos os idiomas). **Testes de regressão adicionados (2026-08-16):** `tests/routes/daily-news-api.test.ts` com **7 testes** — sucesso: `revalidatePath` chamado com `('/[locale]', 'layout')` (cobre os dois idiomas) + `('/sitemap.xml')`; ausência em 5 cenários de falha (401 sem/errado `CRON_SECRET`, 500 sem `BACKEND_JOB_URL`, 502 do backend, 500 no fetch). Suíte web: **72 testes** (65 → 72). **P3 — painel admin concluído (2026-08-16):** `DELETE /api/news/:id` na API (authPlugin + `role === 'ADMIN'` no JWT, `ForbiddenError` novo 403, 401/403/404); página `/admin` localizada (`/pt-BR/admin`, `/en/admin`, noindex) protegida por sessão + role — redirect p/ sign-in deslogado, tela de acesso restrito p/ não-admin; `AdminPanel` (client): botão "Executar pipeline" via `/api/admin/run-pipeline` (valida sessão + role server-side e **reusa o handler do cron** com `CRON_SECRET` — o browser nunca vê o secret) e lista das últimas 20 notícias com remoção via `/api/admin/news/:id` (assina JWT com role); link "Admin" no navbar só p/ ADMIN; tipos `RunPipelineResult`/`DeleteNewsResult` em `packages/types`; strings `nav.admin`/`admin.*`/`metadata.admin` em pt-BR e en. **25 testes novos** (8 API news-admin + 17 web: 8 rotas proxy, 3 api client, 6 AdminPanel). Suíte web: **89 testes** (72 → 89); API: 330. **Fix de bug latente encontrado na validação:** páginas protegidas (`/admin` e também `/favorites`, do P1) eram prerenderizadas como SSG com o `redirect()` "assado" no HTML estático (em dev: `x-nextjs-cache: HIT` + meta-refresh p/ sign-in **mesmo com sessão válida**) — usuários logados seriam redirecionados ao sign-in para sempre. Correção: `export const dynamic = 'force-dynamic'` nas duas páginas. Validado ao vivo com sessão forjada (JWE do next-auth): admin → painel renderiza, user → "Acesso restrito", anônimo → redirect p/ sign-in (comportamento do P1 preservado). Trigger do painel validado ponta a ponta: `POST /api/admin/run-pipeline` → `success:true, started, revalidated:true` e o run novo falhou na etapa 6 (chaves locais inválidas) com eventos INFO 1–5 + ERROR na 6 e `errorStage: 6` — integração P3 ↔ Item 9 confirmada. **Fix de UX no sign-in (2026-08-16):** com `pages.signIn = '/'` no `authOptions`, o `signIn()` sem provider (botão "Entrar" do header e o heart deslogado) caía num loop `/?callbackUrl=...` em vez de abrir a escolha de provider. Correção: página própria localizada `app/[locale]/signin` (`pages.signIn = '/signin'`) com botões Google/GitHub (`SignInForm`, lucide `Chrome`/`Github`), exibição de erro do OAuth via `?error=` (ex.: `OAuthSignin` quando o provider não está configurado), link de volta à home e callbackUrl preservado; redirects das páginas protegidas (`/admin`, `/favorites`) agora apontam direto para `/signin?callbackUrl=...` (o middleware do next-intl localiza e preserva o query). **3 testes novos** (`sign-in-form.test.tsx`); suíte web: **92 testes** (89 → 92). Validado no preview: página renderiza localizada, clique em "Continuar com Google" inicia o fluxo OAuth real (`/api/auth/callback/google`) e o erro aparece no alert quando o provider não está configurado; anônimo em `/pt-BR/admin` → `/pt-BR/signin?callbackUrl=...`. **Bug de CORS em produção (2026-08-17):** o painel admin carregava, mas a lista "Últimas notícias" falhava ("Não foi possível carregar as notícias") — o mesmo para qualquer chamada client-side à API (ex.: inscrição da newsletter no footer). Causa: `CORS_ORIGIN` no Render com **barra final** (`https://newra-news-web.vercel.app/`) — o browser compara o header `Origin` byte a byte com `Access-Control-Allow-Origin`, e a barra fazia o match falhar → resposta bloqueada (auth não quebrava porque as chamadas são server-side). Fix: normalização no schema do env (`apps/api/src/config/env.ts` — `.transform()` remove barras finais, fonte única para todos os consumidores do `CORS_ORIGIN`); **3 testes novos** em `tests/config/env.test.ts` (remove 1 barra, remove várias, mantém sem barra); suíte API: 330 → **333**; typecheck limpo. Commit `6b7174f`. Validado em produção após redeploy: `access-control-allow-origin: https://newra-news-web.vercel.app` (sem barra) no GET e no preflight OPTIONS; painel com a lista carregando (7.991 notícias). A env no Render segue com a barra — o código agora corrige sozinho em qualquer deploy futuro.

### 9. Dashboard de logs e erros do pipeline (dev-only) — Observabilidade

> Contexto: hoje, diagnosticar falhas da pipeline exige caçar `console.warn/error`
> não estruturados no painel do Render ou consultar endpoints isolados
> (`/api/jobs/:pipelineId`, `/api/health/providers`). Este item centraliza logs e erros
> num painel privado do dev.
> **Não conflita com o item 8:** lá é um dashboard **público de métricas de negócio** no
> frontend (portfólio); aqui é **observabilidade** (logs e erros da pipeline) no backend,
> protegida por `JOB_SECRET` e sem exposição ao público.

- [x] Modelo `PipelineEvent` no Prisma: registra cada evento da pipeline (pipelineLogId, Stage 1–9, nível info/warn/error, mensagem, contexto JSON, createdAt) — substitui os `console.warn/error` soltos (stage `Float` p/ suportar 7.5 da newsletter; cascade com PipelineLog)
- [x] Enriquecer `PipelineLog`: etapa da falha (`errorStage`) + erro estruturado (`errorDetail` JSON com message/provider/statusCode, inferido da mensagem dos providers) — `error` string mantida como legado
- [x] Endpoints protegidos com `JOB_SECRET` (prefixo `/api/dev`): `GET /api/dev/logs` (últimos runs + erros recentes, filtros status/since/limit) e `GET /api/dev/logs/:pipelineId` (detalhe completo com eventos por etapa)
- [x] Página HTML servida pela API em `/dev/dashboard` (protegida por `JOB_SECRET` via header ou `?secret=`, rate limit 60/min): histórico de runs (status, duração, contagens, etapa da falha, erro), erros recentes e status dos providers (reusa `checkAllProviders` do item 3); auto-refresh 30s, HTML auto-contido e escapado
- [x] Testes Vitest (service `pipeline-event` 12 + rotas `dev` 17 + pipeline 3 novos = **32 novos**) + documentação em `docs/api.md`
- **Validado (2026-08-16):** schema aplicado via `prisma db push` (migrations são gitignored no projeto); suíte completa verde (**394 testes: 322 API + 72 web**); smoke test real da API no ar: `/api/dev/logs` 401 sem/errado secret → 200 com `JOB_SECRET`, uuid inválido 400, pipeline inexistente 404, `/dev/dashboard` 401 sem secret → 200 com `?secret=`; lint e typecheck limpos; cobertura API 97% linhas (threshold 70); **validação visual no preview**: `/dev/dashboard` renderizando providers ao vivo (newsdata ok, gemini/groq invalid nesta máquina), run real FAILED com duração e "ver erro" expandindo a mensagem ("Groq API error: 401"); ajuste de CSS p/ tabelas com scroll próprio (sem overflow da página) e cores dos badges por status (ok verde / invalid vermelho / not_configured dourado)

### 10. Newra News V2.0 — redesign editorial (planejado 2026-08-19)

> Plano completo: `docs/Newra-News-V2-Frontend-Redesign-Plan.md` (versão 2.1 do documento + §40 auditoria de prontidão + §41 convenções de execução com Opus 5).
> A V2.0 transforma o portal de "feed de cards" em publicação digital: grid editorial, Daily Brief como produto, experiência de leitura, newsletter/contas e fundação para monetização.

**Concluído nesta rodada (2026-08-19):**

- [x] Plano V2.1 instalado em `docs/Newra-News-V2-Frontend-Redesign-Plan.md` (substitui o rascunho V2.0, que era superset-verificado — nada perdido)
- [x] Auditoria do repositório contra o plano → §40 (3 bloqueadores, 14 correções pontuais, 2 itens de higiene)
- [x] README reescrito no padrão open source (§36): badge de CI ativado, badge de Node corrigido para >=22, links relativos, diagrama Mermaid do pipeline, seções "Por que o Newra existe" e "Roadmap"
- [x] `CONTRIBUTING.md` criado (§36-F) com branches, Conventional Commits, convenções de código, testes, migrations e checklist de PR
- [x] §41 do plano — convenções de execução com Claude Opus 5 (effort por dificuldade, escopo fechado por branch, sem passo de verificação redundante, iteração visual nas fases de UI)

**Bloqueadores resolvidos (§40.1 do plano):**

- [x] **Migrations versionadas** — removidas do `.gitignore` (a pasta só tinha `.gitkeep`) e migration de baseline `0_init` gerada a partir do schema atual via `prisma migrate diff --from-empty --to-schema-datamodel` (215 linhas de SQL: 5 enums + 9 tabelas), sem tocar em banco nenhum
- [x] **Job de deploy de migrations** — `.github/workflows/migrate.yml`: dispara em push na `main` quando `schema.prisma` ou `migrations/**` mudam (+ `workflow_dispatch`), roda `migrate status` e depois `migrate deploy`, com `concurrency` serializando execuções. É um **no-op explícito enquanto o secret `DATABASE_URL` não existir** — o que garante a ordem correta (baseline antes do secret). Scripts raiz `db:migrate:deploy` e `db:migrate:status` adicionados (o primeiro era citado por `setup.md` mas não existia)
- [x] **Licença** — `LICENSE` MIT na raiz; badge e seção do README atualizados
- [x] **Repositório git órfão** — `apps/web/.git` removido (15.652 objetos soltos, **zero commits** — era um `git add` de 13/03 que nunca virou commit; nada recuperável perdido)
- [x] **14 divergências do plano** — corrigidas no corpo das seções afetadas (§18.1 `/api/home`, §24 `Category`, §23 rotas signin/admin + newsletter, §12/§23 Tailwind v4, §4.1 custo da migração de paleta, §37-B comando com `--`, §38-B distância real da estrutura, §26 Lighthouse como piso 96/96/96/100, §36 badges). Registro completo em §40.2
- [x] **`docs/setup.md`** — mandava aplicar schema com `prisma db push` e citava um script inexistente; agora documenta o fluxo de migrations + seção "Alterando o schema"

**Pendências — dependem de algo fora do repositório (§40.5):**

- [x] **Baseline no Neon concluído (2026-08-19)** — `migrate diff --from-url` contra o Neon retornou `-- This is an empty migration.` (schema de produção idêntico ao versionado, sem drift), `migrate resolve --applied 0_init` aplicado e `migrate status` retornando `Database schema is up to date!`. Secret `DATABASE_URL` cadastrado no GitHub com a connection string **direta** (sem `-pooler`; o endpoint pooled passa por PgBouncer em modo transaction, que não suporta os advisory locks nem o DDL do Prisma Migrate — o Render segue com a pooled). Senha do role `neondb_owner` rotacionada e atualizada nos dois destinos; produção validada ao vivo: `/api/health` 200 e `/api/news` 200 servindo 5.334 notícias do banco
- [x] **Asset de logo recebido e vetorizado (2026-08-19)** — vieram 3 PNGs de 1600px; a cor bateu exata com o `brand-600 #C94F22` da §4.1. A geometria é regular (4 stadiums de raio 112 + sparkle de raio 294, com simetria de rotação 180°), então foi **reconstruída em vetor** em vez de traçada: erro de forma de **3 px** em 768.744 px de arte na validação pixel a pixel, o resto sendo antialiasing de borda. Versionados `apps/web/public/logo/logo-mark.svg` (`#C94F22`) e `logo-mono.svg` (`currentColor`) — 633/638 bytes contra 36,7 KB do PNG. Detalhes em §40.3
- [x] **Lockup horizontal decidido (2026-08-19)** — o PNG "horizontal" entregue está **vazio à direita de x=320** (zero pixels com alpha); não havia wordmark para vetorizar. **Decisão: a V2 usa wordmark tipográfico** — `logo-mono.svg` + "Newra News" na fonte de **interface** da §5 (não na serif das headlines). Motivos: acompanha a troca de tipografia da V2 sem redesenho, o responsivo sai de graça (texto some no mobile via media query, sem segundo arquivo), e o nome continua sendo texto real — selecionável, achável no Ctrl+F e acessível sem `aria-label`. O lockup desenhado fica **adiado, não descartado**: reavaliado ao fim da Fase 2, quando a tipografia já estiver fixa — desenhar letra contra uma fonte que ainda vai mudar é mirar em alvo móvel. Ponto de reavaliação registrado no checklist da Fase 2 (§28) e detalhes em §40.3
- [ ] **Landing `/[locale]/newsletter`** — não existe hoje; entrou como entregável da Fase 2 e só depois disso entra na baseline visual da §30

### 11. V2.0 Fase 0 — Discovery técnico ✅ Concluída em 2026-08-20

> Entregáveis em `docs/v2/`. Índice em `docs/v2/README.md`. Checklist da §28 do plano fechado.

**Documentos entregues:**

- [x] **`00-diagnostico.md`** — 11 rotas de página (com estratégia de render, indexação e auth), 33 componentes, mapa de consumo das APIs pelo frontend (função → endpoint → quem chama), Lighthouse por rota, auditoria de acessibilidade, First Load JS por rota e baseline de métricas de uso
- [x] **`01-design-tokens.md`** — paleta em duas camadas (paleta fixa + semântica que inverte no tema), claro e escuro reconciliados, contraste medido par a par, mapeamento das 31 variáveis do shadcn, escala tipográfica, radius, sombra, espaço, motion e z-index
- [x] **`02-sitemap-telas.md`** — as 11 rotas cruzadas com a árvore de componentes da §23; 18 componentes que nascem, 6 renomeados, o resto só muda de estilo; que fase entrega cada tela
- [x] **`03-contratos-api.md`** — `GET /api/home`, `GET /api/trending`, `GET /api/news/:id/related` e a migration `add_daily_briefing_metadata`; tipos `EditorialStory`/`DailyBriefing`
- [x] **`04-analytics-e-slots.md`** — os 14 eventos da §18.5 com payload fechado, regras de LGPD e consentimento, mais 5 slots de anúncio com altura reservada
- [x] **`baseline-v1/`** — 42 capturas da V1 (12 rotas × 3 larguras + dark mode em 3 rotas), com o script `apps/web/scripts/capture-visual-baseline.mjs` (`pnpm visual:baseline`) para regenerar nas fases seguintes

**Decisões fechadas:**

- [x] **Tipografia: Newsreader (manchetes) + Inter (interface)** — a §5 listava opções sem escolher e o wordmark da §40.3 depende da fonte de interface. Sai o Bricolage Grotesque; a interface fica com métricas já validadas em produção, evitando trocar duas fontes de uma vez
- [x] **Destino dos 13 usos de `brand-400`/`brand-900`** — 3 padrões apenas: hover de link (9×), gradiente de fallback de imagem (2×) e fundo do rodapé (1×)

**Correções que a medição fez no próprio plano:**

- [x] **O piso "96·96·96·100" da §26 era só da home** — medindo as 5 rotas com mediana de 3 execuções: `/pt-BR` 97·96·96·100, `/pt-BR/news` 95·95·96·100, `/pt-BR/article` 97·94·96·100, `/pt-BR/about` 98·96·96·100, `/en` 98·96·96·100. O critério de aceite passa a ser a tabela por rota
- [x] **`brand-600` não passa AA para texto normal sobre `paper`** — a §4.1 verificou só sobre branco puro (4,54:1); sobre o fundo editorial `#FAF9F7` cai para 4,32:1 e sobre `brand-100` para 3,80:1. Links e texto em laranja usam `brand-700` (5,92:1)
- [x] **A §4.1 não cobria a camada semântica do shadcn** — são 31 variáveis, e 8 delas (`--sidebar-*`) são código morto: não existe componente de sidebar no projeto
- [x] **`line #E4E1DD` não serve como borda significativa** — 1,24:1 sobre `paper`, abaixo do 3:1 da WCAG 1.4.11. Token novo `line-strong #969084` (3,02:1) para bordas de controle

**Defeitos de acessibilidade identificados na V1** (causa dos scores 94–96):

- [x] `#FFFFFF` sobre `#EC6426` = **3,27:1** em 16 elementos (badges de categoria, seletor de idioma, toggle de tema, botão de favoritar) — resolvido pelo token novo (6,23:1)
- [x] `text-white/50` sobre `bg-brand-900` = **4,04:1** nos títulos de seção e no copyright do rodapé (`footer:29,48,60,74`)
- [x] `heading-order` — o grid de notícias emite `h3` sem `h2` na sequência

**Infraestrutura — dois defeitos que a §40 dava como resolvidos:**

- [x] **A migration `0_init` não replicava em banco limpo** — o `migration.sql` terminava com o banner "Update available 5.22.0 -> 7.9.1" do CLI do Prisma (10 linhas de caracteres de caixa), porque foi gerada com `migrate diff` redirecionado para arquivo e o aviso saiu junto pelo stdout. Invisível em produção: lá o baseline foi aplicado com `migrate resolve --applied`, que **marca como aplicada sem executar o SQL** — e o `migrate deploy` do workflow, pelo mesmo motivo, nunca a executa. Qualquer banco novo falhava com `syntax error at or near "┌───┐"`
- [x] **Faltava `migration_lock.toml`** — criado pelo `migrate dev`, e o baseline nasceu de um `migrate diff`. Sem ele, `migrate diff --from-migrations` não resolve o conector, ou seja: **não havia como checar drift** entre as migrations e o `schema.prisma`. Verificado em banco limpo depois da correção: `All migrations have been successfully applied` + `No difference detected`

**Workflow do Lighthouse — três defeitos silenciosos:**

- [x] auditava **só a raiz**, que redireciona para `/pt-BR` — o score era medido através de um redirect, o que penaliza performance. Agora audita as 5 rotas de URL estável (as de detalhe ficam fora de propósito: id de notícia é removido pelo cleanup e a data do artigo muda todo dia)
- [x] `numberOfRuns: 3` do `.lighthouserc.json` era **ignorado** — a action sempre repassa o próprio input `runs` (default 1) ao `lhci`. Corrigido no `with:`
- [x] o `upload-artifact` ignora caminhos ocultos por padrão, então `.lighthouseci/` subia **vazio** e os relatórios morriam com o runner. Corrigido com `include-hidden-files`, mais um passo que imprime a mediana por rota no summary do job

### 12. V2.0 Fase 0.5 — Backend editorial 🔶 Parcial em 2026-08-20

> Criada porque a revisão da Fase 0 expôs que **nenhuma fase do §28 comportava o trabalho de backend**: as Fases 1 e 2 são 100% frontend (conferido item a item) e a Fase 3 abre com `HeroStory`/`DailyBrief`/`TrendingList`, que consomem endpoints inexistentes. A lista de branches da §29 também era toda de frontend. Plano atualizado com a **Fase 0.5** e a branch `feat/v2-editorial-api`.

**Entregue — antes da Fase 1, não entre a 2 e a 3:**

- [x] **Migration `add_daily_briefing_metadata`** — `Article` ganha `generatedAt`, `promptVersion`, `modelVersion` e `status` (enum `ArticleStatus`); nova tabela `BriefingSource`. Aplicada e verificada em banco limpo (`migrate reset` → as duas migrations aplicam; `migrate diff --from-migrations` → `No difference detected`)
- [x] **Pipeline gravando a auditoria** — Stage 6 captura `generatedAt` antes da chamada à IA e loga `modelVersion`/`promptVersion`; Stage 7 grava os quatro campos **no `create` e no `update`** do upsert (sem isso um artigo regenerado manteria a auditoria do primeiro run)
- [x] **`ARTICLE_PROMPT_VERSION`** — época manual + **impressão digital sha256 do conteúdo dos dois prompts** (`v1-ebb73b75`). Versão escrita à mão que alguém esquece de subir é pior que nenhuma, porque passa a mentir sobre qual prompt gerou o artigo; com o hash, editar o texto muda a versão sozinho
- [x] **`modelVersion` é o modelo, não o provider** — `ai.service` devolve `GEMINI_MODEL`/`GROQ_MODEL` conforme quem gerou. O nome do provider não bastaria: o modelo por trás dele muda (o Groq trocou `llama-3.1-8b-instant` por `openai/gpt-oss-20b` em 08/2026)
- [x] **`BriefingSource` com campos desnormalizados** — `title`/`source`/`sourceUrl` são cópias, não join. O Stage 8 apaga `News` aos 30 dias e `Article` vive 90; com join, dois terços dos briefings retidos ficariam sem lista de fontes, que é justamente o que a §18.4 quer auditar. `newsId` é ponteiro fraco (nulável, sem FK) resolvido por `sourceUrl` — o `createMany` do Stage 4 não devolve ids. Quando não resolve, a fonte entra mesmo assim: perder o registro de auditoria é pior que perder o ponteiro
- [x] **Fontes substituídas em transação**, não acrescentadas — o artigo é upsert por data e um segundo run do dia escolhe outro conjunto; sem a remoção o briefing acumularia as fontes dos dois runs
- [x] **Endpoints de detalhe servem `sources`** ordenadas por `position`; a listagem não (seriam 15 linhas por artigo sem nada as exibindo)
- [x] **Tipos compartilhados** — `BriefingSource`, `ArticleWithSources`, enum `ArticleStatus` em `packages/types/src/article.ts`; `docs/api.md` atualizado com os campos de auditoria e o formato de `sources`
- [x] **9 testes novos** (448 → **457**): 4 no `ai.service` (modelo do Gemini, modelo do Groq no fallback, formato da versão do prompt, versão derivada do conteúdo) e 4 no pipeline (campos de auditoria no create e no update, fontes na ordem enviada à IA, `newsId` nulo quando não resolve, substituição em transação), mais 1 no `article.service` (fontes ordenadas por `position`)
- [x] **Smoke test contra o banco real** — auditoria persistida e devolvida pelo service, fontes na ordem certa com `newsId` resolvido, re-run substituindo (3 → 2, não 5) e cascade delete zerando as fontes junto com o artigo

> **Por que a migration não esperou.** Nada registrava quais notícias entravam no briefing — o Stage 5 logava só `{ count }` — e tanto `News` quanto `PipelineLog` são purgados aos 30 dias. Todo briefing gerado antes desta migration fica permanentemente sem lista de fontes, **sem backfill possível**. Como a Fase 5 exibe transparência de IA sobre um histórico de 90 dias, adiar custava dado, não só tempo.

**Entregue na branch `feat/v2-editorial-api` (2026-08-20) — ver item 16.**

### 13. V2.0 Fase 1 — Foundation ✅ Concluída em 2026-08-20

> Branch `feat/v2-design-foundation` (§29). A fase troca os tokens globalmente: a partir daqui a V1 visual deixa de existir e a referência é `docs/v2/baseline-v1/`.

- [x] **`styles/tokens.css`** — paleta (camada 1) + semântica (camada 2) + `@theme inline`, importado pelo `globals.css` antes de qualquer regra. O `globals.css` caiu de ~160 para 44 linhas: só imports, a animação e as regras de base
- [x] **A camada 1 ficou fora do `@theme`, de propósito** — `bg-brand-600` deixou de ser uma classe válida, então a regra "componentes usam só a semântica" passou a ser mecânica em vez de convenção. O preço é que uma classe de camada 1 não quebra o build, só não pinta; por isso existe o teste de guarda
- [x] **57 usos de classe de marca migrados** — os 13 de `brand-400`/`brand-900` mapeados na §5, mais os 44 de `brand-600`/`brand-100` que mantinham o nome e passaram a ser consumidos pela semântica
- [x] **Dois `hover:text-brand-700` que nunca funcionaram** (`admin/page.tsx`, `sign-in-form.tsx`) — `brand-700` não existia como token na V1. Achados pela migração, não por bug report
- [x] **As 16 falhas de AA de branco sobre laranja somem na origem** — `--primary` virou `brand-700` (6,23:1), e os `<Badge className='bg-brand-600 text-white'>` viraram `<Badge>` sem override
- [x] **`text-white/50` do rodapé** (4,04:1) — títulos de seção passaram a `text-on-brand` sólido e a linha de copyright a `/70`. Ganhou hierarquia junto com o contraste
- [x] **Tipografia** — Newsreader no lugar do Bricolage Grotesque; Inter fica. Escala nomeada por papel (`text-display`, `text-h1`…`text-overline`) com `clamp()`, sem breakpoint novo
- [x] **Forma, ritmo, motion e camadas** — radius de 5 níveis (botão/input 8px, card 12px, badge pill), sombra só em overlay, `--spacing-section|block|gutter`, `container-editorial`, `duration-*`/`ease-*` e `z-*`. `prefers-reduced-motion` virou regra global
- [x] **As 8 variáveis `--sidebar-*` apagadas** e `--chart-1..5` com rampa de matiz variado — as 10 cores medidas contra o trilho da barra nos dois temas
- [x] **`components/editorial/`** — `ArticleMeta`, `SourceBadge` e `ReadingTime` (§11 do plano), adotados por `news-card` e `news-detail`. Mais `readingTimeFromText` em `lib/format.ts`, porque o `readingTimeMinutes` do contrato da §24 só chega na branch `feat/v2-editorial-api`
- [x] **`scripts/check-contrast.mjs`** (`pnpm --filter @newranews/web contrast:check`) — mede os 53 pares lendo o próprio `tokens.css`, incluindo as composições de opacidade. Reproduziu todos os números da §4 e **achou um caso que o documento não previa**: `danger-400` dá 3,61:1 sobre `brand-950`, a superfície escura do rodapé. Acrescentado `danger-300 #F79A90` (5,01:1)
- [x] **22 testes novos (458 → 480)** — `article-meta.test.tsx` (8), `readingTimeFromText` (4) e `design-tokens.test.ts` (7): este último varre `app/` e `components/` proibindo camada 1, opacidade sobre `--text-muted`, cor crua do Tailwind e sombra fora dos overlays, e confere que toda utility de cor aponta para variável declarada
- [x] **Convenções registradas em `apps/web/CLAUDE.md`** — a tabela papel → classe é o que as Fases 2–7 vão consultar
- [x] **Revisão da própria fase** — build, lint, typecheck e 477 testes passavam com **4 defeitos dentro**: `??` no lugar de `||` em `ArticleMeta` (com `source: ''` a data e o tempo de leitura sumiam junto), ativo e hover com o mesmo `bg-surface-accent` na nav mobile (a V1 distinguia em dois níveis e a tradução perdeu um), `z-base` (0) num scrim — traduzir `z-40` pelo token de valor mais próximo é o inverso do que a tabela da §8 quer — e `--radius-xl`/`--radius-2xl` aliasados para 12px em vez de as 29 classes serem migradas. Todos corrigidos; o do `??` tem teste de regressão verificado (falha com `??`, passa com `||`), e radius e duração viraram invariante de suíte. Registro em `docs/v2/01-design-tokens.md` §11.4

**Pendências fechadas em 2026-08-20, depois do merge:**

- [x] **Lighthouse por rota** — rodado contra produção pelo mesmo workflow da §3.1 ([run 32420796553](https://github.com/tavinholoco/newra-news/actions/runs/32420796553), depois da correção do kicker). **A acessibilidade sobe nas cinco rotas:** `/pt-BR` 96→**100**, `/en` 96→**100**, `/about` 96→**100**, `/news` 95→98, `/article` 94→98. As três de 100 não têm **nenhuma** auditoria reprovando; nas outras duas sobra só o `heading-order`, que é estrutura semântica e cabe à Fase 3. **`color-contrast` desapareceu das cinco rotas** — era ele que segurava os scores em 94–96 na V1. Performance de pé (`/news` +3; duas rotas 1 ponto abaixo, dentro do ruído). Tabela completa em `docs/v2/01-design-tokens.md` §12
- [x] **A medição achou um erro da própria Fase 1** — a home continuava reprovando em `color-contrast`: o kicker "ARTIGO DO DIA" do `article-card` foi migrado para `text-brand-accent` (= `brand-600`), que sobre `surface-accent` dá 4,21:1 — passa os 3:1 de ícone e reprova os 4,5:1 de texto. O elemento tinha ícone **e** texto na mesma linha, e eu classifiquei a linha como ícone, inclusive no `check-contrast.mjs`. Corrigido para `text-link` (5,77:1); o par de texto entrou no script
- [x] **Baseline visual da V2** — 39 capturas em `docs/v2/baseline-v2/`, tiradas **de produção** em vez do seed local (o seed não tem imagens de notícia, o que exagerava a saturação da V1). São 3 a menos que a V1 porque as do dashboard saíram junto com a rota

**Em aberto, sem bloquear a Fase 2:**
- [ ] **A escala tipográfica e o `container-editorial` ainda não são usados** — as páginas seguem com `max-w-7xl px-4 sm:px-6 lg:px-8`. Trocar contêiner e hierarquia é reflow, que é a Fase 2/3
- [ ] **`heading-order` do grid de notícias** continua quebrado (§3.3 do diagnóstico) — é estrutura semântica, corrigida na reorganização editorial da Fase 3

### 14. Métricas do pipeline restritas a ADMIN ✅ 2026-08-20

> Branch `feat/admin-only-metrics`, empilhada sobre `feat/v2-design-foundation`. Métrica de pipeline — volume coletado, provider de IA que respondeu, duração da execução, dias com falha — é **operação do projeto**, não conteúdo editorial. Expor a saúde interna do sistema para o leitor anônimo não tem função de produto e conta mais do que precisa a quem estiver sondando.

- [x] **Página movida** — `/[locale]/dashboard` → `/[locale]/admin/metrics`, `noindex`, atrás de sessão + role ADMIN
- [x] **O guard passou para `app/[locale]/admin/layout.tsx`** — junto do `force-dynamic`. Assim "tudo sob `/admin` é só para ADMIN" é garantia estrutural, e uma página nova não depende de alguém lembrar de repetir a verificação. O `/admin/page.tsx` deixou de carregar a sua cópia. **Verificado no `prerender-manifest.json`: nenhuma rota de `/admin` é prerenderizada** — o bug histórico de o `redirect()` ser assado no HTML estático não volta
- [x] **`GET /api/metrics/dashboard` passou a exigir JWT com role ADMIN** — esconder só a página seria cosmético: o dado ficaria a um `curl` de distância. Rota nova em `routes/metrics/admin.ts` com `authPlugin` encapsulado, mesmo desenho do `DELETE /news/:id`. `/weekly` e `/monthly` seguem públicas
- [x] **Rota proxy `/api/admin/metrics`** — o browser não tem o `AUTH_JWT_SECRET`; a rota lê a sessão do next-auth, confere o role e assina o token server-side. `getDashboardMetrics` saiu do bloco público de `lib/api.ts` e passou a usar `fetchWebApi`
- [x] **A página deixou de buscar no servidor** — não há mais SSR de métricas porque o token é assinado pelo proxy; o `DashboardClient` busca no cliente e mostra o `DashboardSkeleton`. É `noindex` e atrás de sessão, então não há SEO a perder
- [x] **Redirect 308 de `/[locale]/dashboard`** — a URL antiga estava no sitemap; o `next.config.js` mantém link antigo funcionando e deixa o buscador reconciliar
- [x] **Saiu do `sitemap.ts`, do menu público (`NAV_LINKS`) e da baseline visual** — entrou no bloco de links que só aparece para ADMIN, ao lado de "Admin"
- [x] **Bug achado no caminho:** o `isActive` da navbar usava `startsWith`, então em `/admin/metrics` os itens "Admin" e "Métricas" ficavam **os dois** marcados como ativos. Passou a vencer o href mais longo que casa — item pai segue ativo em rota de detalhe (`/article/[date]`) sem competir com um filho que também está no menu
- [x] **9 testes novos (480 → 489)** — 3 na API (401 sem token, 401 com token inválido, 403 para não-admin) e 6 no `navbar.test.tsx`, que não existia: visibilidade por role e as quatro combinações de link ativo
- [x] **Plano inteiro atualizado** — §23 (estrutura + nota), §28 Fase 6, §30 (rotas da baseline), §19, §2.2 do plano mestre; `docs/v2/02-sitemap-telas.md` (árvore, ficha da tela, tabela de fases, cobertura da baseline); nota datada em `docs/v2/00-diagnostico.md`, que é retrato do commit `8827d3c` e não foi reescrito; `docs/api.md`, `docs/architecture.md`, `README.md`, `apps/web/CLAUDE.md` e o script de captura visual

### 15. V2.0 Fase 2 — Shell ✅ Concluída em 2026-08-20

> Branch `feat/v2-header` (§29). A V1 empilhava marca, idioma, tema, sessão e navegação numa faixa única de 64 px. A §10 separa informação de sistema de navegação editorial, em três linhas.

**M0 — o acoplamento que precisava sair primeiro**

- [x] **A altura do header estava fixa em três lugares** (`h-16` no header, `top-16` no menu mobile, `calc(100vh-4rem)` no `<main>`) e um masthead de três linhas quebraria os três. Resolvido **estruturalmente, não com um token**: o `<body>` virou coluna flex com `flex-1` no `<main>`, e o menu mobile se ancora por `absolute top-full` dentro do header. Nenhum número mágico sobrou, e nada precisa ser remedido quando o masthead mudar de altura

**M1 — marca**

- [x] **`layout/logo.tsx`** — marca em SVG inline (`currentColor`, para herdar a cor no rodapé escuro, coisa que um `<img>` não faz) + wordmark **tipográfico** (§40.3-A). Variantes `full`/`mark`/`responsive`; no mobile o wordmark some e a marca fica, com `sr-only` cobrindo o nome acessível
- [x] **Derivados do vetor, sem asset novo** — `app/icon.svg` (com safe area: o `viewBox` justo cola na borda a 16 px), `app/apple-icon.tsx` (180×180, gerado em vez de PNG versionado) e `opengraph-image` na paleta da V2 — era um gradiente slate `#0f172a`, fora da marca

**M2 — masthead em três linhas**

- [x] **`top-bar`** — data, edição, newsletter, idioma, tema, sessão. A data é renderizada **no cliente**: no servidor seria o dia do servidor, e o mismatch quebraria a hidratação
- [x] **`masthead`** — marca, navegação secundária e busca; no mobile vira o header compacto
- [x] **`editorial-nav`** — a faixa de assuntos, em todas as telas, com scroll horizontal no mobile e sublinhado de seção como indicador (§12: parecer editoria, não pílula de app)
- [x] **`mobile-nav`** — painel com busca, links por sessão/role, idioma e tema; fecha no Esc e prende o scroll do body
- [x] **`masthead-search`** — `<form role="search">` de verdade, que submete para `/news?search=`

**M3/M4 — rodapé, bloco de newsletter e landing**

- [x] **Rodapé** no ritmo dos tokens (`container-editorial`, `py-section`, escala tipográfica) e com o logo no lugar do texto solto
- [x] **`monetization/newsletter-cta`** — a manchete da §20, a frequência declarada e o que acontece com o e-mail
- [x] **`/[locale]/newsletter`** — a única rota nova da V2 (§23). SSG, 119 kB, no sitemap

**A decisão que a faixa de categorias forçou**

- [x] **As categorias eram estado local do `/news`.** Uma faixa presente em todas as telas precisa levar a algum lugar, então elas viraram `/news?category=X` — URL compartilhável e indexável. O `/news` **lê** o parâmetro; **escrever** a URL a cada clique de filtro e de página continua sendo o "filter state" da Fase 4

**Revisão do próprio código — 4 defeitos que build, lint e tipos deixavam passar**

- [x] **A URL mudava e a lista não** — navegar de `?category=A` para `?category=B` é client-side na mesma rota: o componente não remonta e o inicializador do `useState` não roda de novo. O filtro ficava na categoria anterior e a URL passava a mentir. Teste de regressão escrito **antes** da correção, verificado falhando
- [x] **`id` fixo em componente renderizado duas vezes** — `masthead-search` aparece no masthead e dentro do menu; dois elementos com o mesmo `id` e dois `<label>` apontando para ele. Agora `useId()`
- [x] **Sessão duplicada no mobile** — `AuthButton` aparecia no masthead compacto e de novo dentro do menu aberto. Saiu do menu
- [x] **`<nav aria-label>` dizendo "Abrir menu"** e uma condicional de radius com os dois ramos iguais
- [x] **O `renderWithIntl` perdia o provider no `rerender`** — passava `<Provider>{ui}</Provider>` como JSX, então `rerender(ui)` renderizava sem contexto. Passou a usar a opção `wrapper` do RTL, e isso vale para toda a suíte

**Verificação**

- [x] **522 testes (516 → 522 depois das correções; 154 no web, 6 suites novas)** — `nav.test.ts`, `editorial-nav`, `mobile-nav`, `logo`, `masthead-search` e `news-page-client`
- [x] **Acessibilidade 100, zero auditorias reprovando** — Lighthouse local contra `/pt-BR/newsletter`, que exercita masthead, faixa de categorias, rodapé e o CTA
- [x] **Home continua em 157 kB** de First Load JS; typecheck 5/5, lint 5/5, 54 pares de contraste passando
- [x] **Aviso de fonte silenciado** — o `next/font` não tem Newsreader na base de métricas e imprimia `Failed to find font override values` a cada build sem gerar ajuste nenhum. Ficou uma stack de fallback serif explícita (§40.3 previu o risco de CLS) e `adjustFontFallback: false`

**As duas telas de texto que a tabela §4 atribui à Fase 2**

- [x] **`/[locale]/about`** — a ficha pedia "a medida editorial de 68ch e a tipografia serif". Passou para `container-editorial` + `max-w-prose` no corrido e para a escala nomeada (`text-h1`…`text-body-sm`) no lugar de `text-3xl`/`text-2xl`/`text-sm`. A medida vale para o corrido: a grade de etapas e os chips seguem na largura editorial, porque espremer três cartões em 620 px não melhora leitura
- [x] **`/[locale]/newsletter/unsubscribe`** — mesmo ritmo. Os dois estados diferem em ícone, cor e texto, não em estrutura, então viraram um objeto no lugar de dois blocos de JSX quase idênticos
- [x] **Acessibilidade 100 nas duas**, sem nenhuma auditoria reprovando

**Fechamento da fase**

- [x] **Lockup reavaliado (§40.3-B) — fica o tipográfico.** Desta vez a decisão saiu de medição, não de sequenciamento: o lockup foi medido em produção no tamanho em que aparece (Inter 20px, `/pt-BR` a 1440px) e dá **151,5 × 28 px = 5,41:1**, praticamente a proporção de 4:1–5:1 que o lockup desenhado perseguiria. A geometria que justificaria desenhá-lo já está lá, saindo da composição tipográfica. A medição também mostrou que a marca alinha à **caixa alta** (centro a 0,5 px) e não à **altura-x** (1,5 px), que era o alvo da §40.3-B — **não corrigido de propósito**: 1,5 px num tipo de 20 px, com a marca transbordando o texto 6 px acima e 7 abaixo, e o conserto seria um `translate-y` mágico, exatamente o que a fase passou inteira tirando do código. Registro completo em §40.3
- [x] **Baseline visual recapturada** — 42 capturas, 12 rotas, de produção às 23:05. Entrou `/pt-BR/newsletter` (3 imagens); as 37 restantes foram substituídas. O diretório é **reescrito a cada fase** em vez de acumular um por fase: a referência útil é sempre a da fase anterior, os estados antigos ficam no git, e cada conjunto pesa ~15 MB

### 16. V2.0 Fase 0.5 — Backend editorial ✅ Concluída em 2026-08-20

> Branch `feat/v2-editorial-api` (§29). **É o que desbloqueia a Fase 3**: ela abre com `HeroStory`/`DailyBrief`/`TrendingList`, que consomem estes endpoints. Contratos fechados na Fase 0 em `docs/v2/03-contratos-api.md`.

- [x] **Tipos editoriais** — `packages/types/src/editorial.ts` com `EditorialStory`, `DailyBriefing`, `HomeResponse`. `EditorialStory` é a notícia na perspectiva da **composição**, não da coleta; os três campos que não existem no banco (`readingTimeMinutes`, `isFeatured`, `isTrending`) são calculados ou posicionais, e nenhum exigiu migration
- [x] **`editorial.mapper.ts`** — `News` → `EditorialStory`, compartilhado pelos três serviços. **A ponte entre os dois enums `Category`** (Prisma e `packages/types`, idênticos em membros mas nominalmente distintos para o TypeScript) mora aqui, uma vez só, em vez de espalhar casts
- [x] **`GET /api/home`** — agregada, para a Home não fazer 6+ chamadas em sequência a partir de um Server Component. Hero é a mais recente **com imagem** (a §6.2 quer capa e ~30% do acervo vem de RSS sem imagem); briefing é `null` quando o pipeline do dia não rodou; categorias vazias são omitidas
- [x] **`GET /api/trending` (etapa 1)** — `recência + saves × 2`, com meia-vida de 12h. Documentado como etapa 1 em três lugares (serviço, `docs/api.md`, contratos): **o que ele devolve hoje é "recentes mais favoritadas"**, e um trending cujo critério não está escrito vira mito
- [x] **`GET /api/news/:id/related`** — mesma categoria em ±72h, com dois níveis de fallback. O terceiro nível existe para categoria pouco povoada nunca devolver lista vazia
- [x] **`Cache-Control` estreia na API** — o contrato registrava que **não havia precedente** e deixava a decisão para esta etapa. Ficou **header por rota** via `utils/cache.ts`, não hook global: um hook aplicaria política a `/api/favorites` e `/api/metrics/dashboard`, que devolvem dado por usuário — `s-maxage` num proxy compartilhado ali é vazamento entre sessões, não otimização
- [x] **54 testes novos (368 → 422)** em 5 suites: mapper, trending, related, home e as rotas

**Dois defeitos que a revisão do próprio código achou**

- [x] **A precedência esvaziava o trending.** A §3 manda "sem repetição entre blocos" com `hero` → `topStories` → `trending` → …; lida ao pé da letra, `topStories` leva as mais recentes, o trending ranqueia por recência, e o bloco voltava vazio. A leitura correta é que a precedência decide **quem fica com a notícia disputada** — o perdedor desce o próprio ranking até preencher. O `/api/home` passou a pedir 4× mais candidatos. Pego por teste antes de ir para produção
- [x] **O trending nunca alcançava a matéria antiga e favoritada.** Os candidatos vinham só das 200 mais recentes, mas um favorito vale 2,0 e a recência vale no máximo 1,0 — ou seja, o score existe justamente para promover a matéria que a recência não promove, e ela era cortada antes de ser pontuada. Na janela de 7 dias o efeito era gritante: recência de 0,00006, só os saves colocariam a matéria ali. Os candidatos passaram a vir de **dois lados** — as mais recentes e as mais favoritadas

**Fica para depois da Fase 8**

- [ ] **`GET /api/trending` etapa 2** — `+ clicks × 0,5 + shares × 3`, quando a camada de analytics da §27 existir

---

### 17. V2.0 Fase 3 — Home ✅ Concluída em 2026-08-21

> Branch `feat/v2-home` (§29). É a fase mais pesada da V2: dos sete blocos da §6.1 só o `newsletter-cta` já existia. A Home da V1 era um `ArticleCard` de altura fixa mais um grid de 12 cards idênticos — sem hierarquia, que é o diagnóstico da §2.2.

**Camada de dados**

- [x] **`getHome()` em `lib/api.ts`** — a Home passou a fazer **uma** chamada. Compor bloco a bloco a partir de um Server Component seriam 6+ requisições em sequência; a da V1 fazia 2 para montar bem menos página. `getTrending()` entrou junto (tipado, testado) para telas que mostrem o ranking isolado — a Home não o usa, porque `/api/home` já devolve o bloco com a precedência aplicada
- [x] **`lib/ads.ts`** — placements, formatos e a tabela de alturas da §9 dos slots, mais o `hasAdInventory()` que hoje devolve `false`

**Camada de cards (§11)**

- [x] **`story-card`, `story-card-horizontal`, `story-card-compact`** — vertical com imagem, miniatura + manchete, e só manchete. **São client components de propósito:** precisam de `useTranslations` para o rótulo da categoria, e um server component assíncrono não pode ser renderizado de dentro de um client component — o que quebraria o reuso na listagem CSR de `/news` na Fase 4. Continuam renderizando no servidor, porque a Home é SSG/ISR
- [x] **`story-image`** — o placeholder de marca num lugar só. ~30% do acervo vem de RSS sem imagem, e na V1 cada card reescrevia o mesmo IIFE com o mesmo gradiente
- [x] **`section-heading`** — filete + título + "ver tudo". Numa página sem sombra (§8 dos tokens) o filete é o que separa dois blocos; cinco seções desenhando cada uma a sua régua era o começo do problema de hierarquia

**Blocos da Home**

- [x] **`hero-story`** — imagem com `priority` (é o LCP; as outras 27 ficam `lazy`), manchete em `text-h1`, dek e metadata. **Uma âncora só** — o CTA "Ler a matéria" está dentro dela e não é um segundo tab stop
- [x] **`briefing-card`** — o "Newra Daily Brief" como peça editorial própria, não "um card colorido" (§6.3): superfície `surface-accent`, selo, contagem de fontes, tempo de leitura e a linha de transparência de IA da §8 como texto normal, não rodapé cinza
- [x] **`top-stories`, `trending-list`, `latest-stories`, `category-section`** — o numeral do ranking é `aria-hidden`: a posição já é semântica pelo `<ol>`, e ouvir "3" antes de cada manchete seria a mesma informação duas vezes
- [x] **`ad-slot`** — sem inventário **não renderiza nada**, nem caixa vazia nem a palavra "Publicidade" (§8 dos slots). Com inventário reserva a altura antes de o criativo chegar, e o leaderboard reserva 100px e não 90 porque abaixo de `md` ele vira mobile-banner — crescer depois seria o salto que o componente existe para impedir
- [x] **Layouts responsivos** — duas faixas de três colunas que colapsam; sem overflow horizontal em 375px, verificado no browser nos dois locales

**Decisões que valem registro**

- [x] **O `h1` da Home é `sr-only`.** Quem abre a página vê a manchete do dia, não a palavra "Home", mas quem navega por heading precisa de uma raiz de outline. **Não é o Lighthouse que pede isto**, ao contrário do que a primeira redação deste item dizia: o `heading-order` reprova salto de nível, não ausência de `h1`, e `page-has-heading-one` não existe no conjunto auditado — conferido no relatório de 21/08. A hierarquia ficou `h1` (oculto) → `h2` de hero e de seção → `h3` de card, conferida no DOM de produção
- [x] **Sem o indicador "Atualizado"** que a §6.2 previa como opcional — o `updatedAt` do contrato é o `@updatedAt` do Prisma e muda quando o pipeline reclassifica a categoria, não quando alguém revisa o texto
- [x] **Todo bloco se omite sozinho, e o wrapper também.** Um grid vazio tem altura zero mas ainda consome o `gap-section` do pai; sem o guard, acervo sem imagem abria um buraco sem explicação no meio da página
- [x] **`ArticleCard` removido** — era o hero da V1, ficou sem nenhum consumidor quando o `briefing-card` entrou
- [x] **Home caiu de 157 kB para 143 kB de First Load JS** — o grid da V1 arrastava `FavoriteButton` para dentro do bundle da Home, e com ele `next-auth/react` e o TanStack Query. Salvar matéria é da Fase 5/6 e não estava no checklist desta

**O defeito que a revisão achou — e que era da Fase 1**

- [x] **`cn` apagava a cor sempre que a classe de tamanho vinha junto.** O `tailwind-merge` resolve `text-<valor>` por heurística: `text-sm` ele conhece como tamanho, `text-red-500` como cor, e **qualquer outra coisa cai num grupo só**. Como a V2 nomeia a escala por papel (`text-meta`, `text-h3`), tamanho e cor viravam "conflito" e a última classe apagava a primeira. `ArticleMeta` vinha desde a Fase 1 renderizando a metadata em `--ink` cheio em vez de `--ink-muted` — passava no contraste (17:1), então o Lighthouse nunca reclamou; o que se perdia era a hierarquia, exatamente o problema que a §2.2 aponta na V1. Não aparece em build, lint nem tipos: a classe simplesmente não chega ao HTML. Corrigido em `lib/utils.ts` declarando a escala como `font-size` para o `tailwind-merge`, com `tests/lib/cn.test.ts` de guarda. Medido no browser antes e depois: `rgb(17,19,21)` → `rgb(105,113,120)`
- [x] **`leading-snug` sumiu dos títulos de card** como consequência correta — a escala nomeada carrega a própria entrelinha (1,3 e 1,35), e o `leading-*` brigava com o token

**Testes**

- [x] **49 testes novos (154 → 203 no web; 625 no total)** em 5 suites: `story-card`, `home-blocks`, `ad-slot`, `ads` e `cn`, mais os de `getHome`/`getTrending` em `api.test.ts`. Fixtures dos blocos em `tests/fixtures/editorial.ts` e um mock de `next/image` compartilhado em `tests/mocks/` — `fill` e `priority` são props do componente, não atributos de DOM, e repassá-las cruas fazia o React descartá-las, o que deixaria qualquer asserção sobre elas passando por engano
- [x] **4 pares novos no `check-contrast.mjs`** (58 no total, 0 reprovando) — a Fase 3 é a primeira a pôr texto de marca e metadata sobre `surface`, que é a superfície do card e não a da página

**Fechamento contra produção — 21/08**

- [x] **Lighthouse por rota** (§26) — [run 32477242736](https://github.com/tavinholoco/newra-news/actions/runs/32477242736). **Acessibilidade 100 nas cinco rotas, zero auditorias reprovando** — o alvo da fase. Atribuição honesta, porém: o `heading-order` que sobrava em `/news` e `/article` era o `h3` "NAVEGAÇÃO" do rodapé, que virou `h2` no commit `523ee90`, **da Fase 2**, uma hora depois da medição de 20/08. Esta é a primeira medição depois de aquilo chegar em produção — a Fase 3 não o corrigiu
- [x] **Recapturar a baseline visual** (§30) — 42 capturas, e foi a captura da home que tornou óbvio o hero sem clamp. Nenhum teste da suíte pergunta "que altura isto ficou"
- [x] **Contrato conferido em produção** — 36 matérias na resposta de `/api/home`, **36 distintas, zero repetidas**: a regra de "sem repetição entre blocos" da §3 vale no ar, não só no teste

**Dois defeitos que a medição de produção achou** (PR #105)

- [x] **O `dek` do hero não tinha clamp.** `dek` é a `description` da News, e boa parte dos feeds põe a matéria inteira ali — 1.876 caracteres no hero de produção, e o `latest` tem deks de 6.381. Todos os outros cards clampavam; o hero era o único que não, e renderizava 704px de texto corrido onde cabe um resumo de duas linhas. **É também a causa da queda de performance:** medido no browser, o parágrafo sem clamp ocupa 519.618 px² contra 350.815 px² da imagem do hero, ou seja, era **ele** o elemento de LCP (2,8–3,9s) — um bloco de texto que ninguém pré-carrega. Com o clamp o LCP passa a ser a imagem, que já tem `priority`/`fetchpriority=high`, e a página encolhe 612px
- [x] **O gate do Lighthouse nunca tinha rodado.** A execução de 21/08 **passou** com a home em 78 de performance, doze pontos abaixo do piso de 90 do `.lighthouserc.json`. A action só executa `lhci assert` quando recebe `configPath` ou `budgetPath` — ela lê o rc para as URLs do collect de qualquer jeito, que é exatamente por que ninguém notou. O log tem "Collecting" e "Uploading" e nenhum "Asserting". O cabeçalho do workflow prometia esse gate desde o dia em que foi escrito

**Performance da home: 97 → ~90, e o número publicado enganava**

As três execuções de `/pt-BR` deram 78 · 86 · 94, e `/en` — a mesma página — deu 85 · 94 · 95. O resumo do workflow estampou **78** porque publica a "execução representativa", que o lhci escolhe pela mediana de FCP e interactive, **não do score de performance**. Somando as seis amostras da mesma página, a mediana real é ~90, contra 97 da V1 (§3.1 do diagnóstico). O clamp do hero ataca a causa; remedir depois do deploy do PR #105.

**Achados do pipeline que a Home expôs — corrigidos em 21/08**

- [x] **Classificação de categoria errada, na primeira dobra.** Produção mostrava crime sob `TECHNOLOGY`, acidente de trânsito sob `ECONOMY` e violência doméstica sob `SPORTS`. É o `category-classifier.service.ts`, não a Fase 3 — mas a Home passou a **agrupar por categoria**, e o grid indiferenciado da V1 escondia isso.

  **O mecanismo:** o score somava toda ocorrência de toda palavra-chave, título com peso 2 e descrição com peso 1, sem piso nenhum. Como a descrição é o corpo da matéria — até 14.429 caracteres no acervo —, uma palavra ambiente citada de passagem decidia a categoria sozinha. Medido contra as 36 matérias da Home de produção: **toda** classificação errada tinha pontuação zero no título e vinha de uma ou duas palavras soltas no corpo; **toda** classificação certa tinha o título pontuando.

  Os piores casos eram palavras que dizem *como* a matéria foi apurada, não do que ela trata: `redes sociais` sozinha classificou 5 matérias policiais como Tecnologia; `programacao` (grade de atrações, não código) deu 7 e 8 pontos a duas agendas culturais; `fundo` casou com "poço sem fundo"; `empresa` com "a empresa de ônibus informou"; `clube` com "clube de tiro"; e o regex de palavra inteira para `ia` casa com o imperfeito de "ir".

  **A correção tem três partes:** (a) ocorrência da mesma palavra conta até um teto de 2, então repetir "redes sociais" nove vezes não decide nada; (b) a descrição só classifica sozinha com **3 palavras distintas** — o que preserva a agenda cultural com música/show/festival/banda e derruba a matéria policial que cita "empresa" uma vez; (c) as palavras ambiente saíram das listas, e entrou vocabulário de negócios que faltava (`credores`, `dividendos`, `acionistas`, `recuperacao judicial`), sem o qual matéria real de empresa passou a cair em WORLD. Um quarto ajuste veio da revisão: **empate entre evidência de título e evidência de corpo não é empate** — sem isso "Justiça concede habeas corpus a influenciador" empatava 5 a 5 e a ordem de prioridade entregava a matéria para Política.

  **Resultado nas 29 matérias do feed genérico: 16 mudaram de categoria, todas para melhor** — 14 matérias de polícia, trânsito e obituário foram para `WORLD`, uma pauta de moda saiu de Tecnologia para Entretenimento, e uma de política externa foi para `WORLD`. As 13 restantes já estavam certas e continuaram.

  **Sobre acrescentar `CRIME`/`GENERAL` ao enum: fica de fora, por ora.** Não é o que corrige o erro — o mecanismo é —, custa migration mais rótulos nos dois JSONs, schemas Zod e a faixa de categorias; e só depois desta correção dá para *medir* que fatia do acervo realmente cai em `WORLD` e decidir com dado. `WORLD` já é o balde genérico e é onde esse gênero deve ficar até lá
- [x] **`description` do feed vinha suja** — o `dek` do hero em produção começava repetindo o `title`, seguido do crédito da foto ("Divulgação/Polícia Civil do Maranhão"), e só então o corpo; um título começava com quebra de linha literal. `providers/news/feed-text.ts` apara o título e remove a linha duplicada e a de crédito na ingestão, que é o único lugar onde se conserta uma vez. O casamento de crédito é conservador de propósito — curta **e** sem pontuação final **e** (com barra ou palavra de crédito) —, porque só "curta e sem ponto" comeria a abertura legítima de uma matéria. O classificador também passou a ler o texto limpo: antes recebia `item.title` cru, com entidade e quebra de linha, enquanto o título gravado era o decodificado

---

### 18. Pendências antes de abrir a Fase 4 ✅ fechadas em 2026-08-21

> Saiu da medição da Fase 3 contra produção. Três frentes, e só **uma** delas é
> bloqueio de verdade — as outras duas são dívida que fica cara se ficar.

**18.1 — O classificador promovia demais** ✅

O conserto de 21/08 tirou o vocabulário ambiente e acabou com a matéria policial
dentro de "Tecnologia". Mas ele destravou o problema simétrico: agora que a
ingestão classifica texto **limpo** (antes classificava com entidades, e era
cega a toda palavra acentuada), o piso de 3 palavras distintas fica frouxo para
um corpo de milhares de caracteres.

Medido no acervo: **remover** rótulo acerta sempre (320 demoções, amostra 20/20),
**atribuir** rótulo erra perto de metade (1.240 promoções — "Carnaval 2027" →
Política, "Festival da Juventude oferece 118 vagas de estágio" → Entretenimento).

É bloqueio porque a Fase 4 **é** a navegação por categoria: `category-nav`,
filtro por categoria na URL, estado vazio por categoria. Polir essa tela sobre
categoria não confiável é construir sobre areia — e cada dia de pipeline grava
mais linhas com a fraqueza.

**Dez regras candidatas medidas** contra as 3.688 linhas do acervo, com um
gabarito de 24 decisões conferidas à mão:

| regra | acerto |
|---|---|
| corpo inteiro, piso 3 (a anterior) | 54% |
| lide de 600 ou 800 caracteres, piso 3 | 63% |
| **corpo inteiro, piso 5** (a que subiu) | **67%** |
| lide de 600, piso 5 | 58% |
| só o título classifica | 54% |

- [x] **A hipótese do lide perdeu.** Cortar o texto tira tanto sinal bom quanto
      ruim; o ganho veio de exigir mais evidência, não de ler menos. A
      maquinaria do lide não ficou no código — não se guarda o que a medição
      rejeitou
- [x] Piso subiu de 3 para 5 palavras distintas
- [ ] **67% é o teto do método.** Dez regras, intervalo de 54% a 67%: não é
      falta de ajuste, é o limite de casar palavra-chave em corpo de notícia.
      Passar disso pede **classificação por IA** — o pipeline já fala com Gemini
      e Groq. Fica como trabalho próprio, e é o que destravaria
      `categoryMode: 'all'`

> **Correção à avaliação anterior: isto não bloqueia a Fase 4.** A Fase 4 é
> trabalho de interface sobre um campo de categoria que existe e é estável —
> `category-nav`, filtro na URL, paginação, estado vazio. A qualidade da
> classificação é preocupação de produto em paralelo, não dependência de UI. O
> bloqueio de verdade era a ingestão estar **piorando** a cada dia, e isso o
> piso de 5 resolveu.

**18.2 — Medição da Fase 3 fechada** ✅

O clamp do dek do hero está em produção desde 21/08, mas ninguém remediu depois.

- [x] **Lighthouse por rota** ([run 32492043154](https://github.com/tavinholoco/newra-news/actions/runs/32492043154)) — **a Home foi de 78 para 95** de performance. O clamp do dek fez o que se esperava: o elemento de LCP saiu do parágrafo e virou a imagem do hero, que já tinha `fetchpriority=high`

| Rota | Perf | Acess. | BP | SEO |
|---|---|---|---|---|
| `/pt-BR` | **95** (era 78) | 100 | 100 | 100 |
| `/pt-BR/news` | 93 | 100 | 100 | 100 |
| `/pt-BR/article` | 96 | 100 | 100 | 100 |
| `/pt-BR/about` | 97 | 100 | 100 | 100 |
| `/en` | 95 | 100 | 100 | 100 |

- [x] **O gate rodou de verdade** — o log traz `Asserting · Checking assertions against 5 URL(s), 15 total run(s)`, o que nenhuma execução anterior tinha. Passou nas cinco rotas, então a execução de segunda não vai vermelha
- [x] **Baseline visual recapturada** — 42 imagens de 21/08. E foi ela que achou o último defeito da Fase 3: seção de categoria com **uma matéria só** deixava metade da faixa em branco, porque a grade de duas colunas era incondicional. Corrigido, com teste de regressão

**18.3 — Backfill virou etapa do pipeline** ✅ — o desenho mudou

O plano anterior era rodar o job manualmente. **Isso estava errado como
desenho**, e a crítica veio do usuário: um job atrás de segredo, que alguém
precisa lembrar de disparar, não é resposta para "dado gravado diverge das
regras atuais" — na próxima mudança de regra o problema volta igual.

- [x] **A renormalização virou a etapa 8.5 do pipeline diário.** Qualquer
      correção de regra alcança o acervo inteiro na execução seguinte, sem
      ninguém disparar nada e sem segredo na mão de alguém
- [x] Roda **depois do cleanup** de propósito — renormalizar linha que a etapa 8
      acabou de apagar é trabalho jogado fora
- [x] Não-crítica, como a newsletter e o cleanup: falha vira WARN e o pipeline
      completa. Fica em `clear-only`, o subconjunto seguro
- [x] Idempotente: em regime, varre e não escreve nada
- [x] O endpoint continua existindo, com o papel corrigido na documentação —
      serve para **inspecionar** (`dryRun` devolve o relatório sem gravar) e
      para caso pontual, não é o mecanismo

**O `JOB_SECRET` deixou de ser passo do plano.** Não havia nada que ele
resolvesse que a etapa 8.5 não resolva melhor, e a medição que motivou tudo saiu
do `/api/news` público, sem segredo nenhum.

---

### 19. V2.0 Fase 4 — News / Category ✅ Concluída em 2026-08-21

> Branch `feat/v2-news-category`. A `/news` deixa de ser uma grade uniforme de
> cards e vira o **acervo**: título e descrição por categoria, `category-nav`
> com contagem, filtros de fonte, período e ordem, hero, lista editorial e
> paginação numerada. Checklist da §28 fechado.

```text
[x] category landing   (título + descrição curta por categoria — §7)
[x] search UI          (URL, histórico local, vazio útil, destaque do termo)
[x] filter state       (a URL passa a ser escrita, não só lida)
[x] pagination         (numerada, na URL)
[x] empty states       (três, e cada um com a saída que cabe)
[x] skeletons          (com a forma da tela que antecedem)
```

**A ficha da tela pedia uma coisa que o §28 não deixa explícita: contagem.** O
`category-nav` mostra quantas matérias cada categoria tem, e nada expunha isso —
o frontend teria de disparar oito requisições para desenhar oito pílulas. Daí
`GET /api/news/facets`, **aditivo**: o contrato do `GET /api/news` que a admin e
os favoritos consomem não mudou de forma. De quebra, ele entrega a lista de
fontes que o filtro da §7 pede, sem uma constante que envelhece quando o
pipeline troca de feed.

**Cada faceta ignora a própria dimensão.** Com Esportes selecionado, as outras
sete continuam reportando os seus números — é justamente a informação que faz
alguém trocar de categoria. Foi a regra que o `buildNewsWhere` compartilhado
existe para garantir: contagem e lista saem do mesmo predicado, menos a dimensão
contada.

**O `GET /api/news` ganhou o resto dos filtros da §7** — `source`, `sort`
(`recent`/`oldest`) e o período por `from`/`to`. O `date` de dia exato continua
valendo; quando os dois chegam, o período ganha, porque é o controle que o
leitor acabou de mexer e `date` costuma ser sobra de URL anterior.

**O estado saiu do componente e foi para a URL.** Até a Fase 3 havia três
`useState` ressincronizados por efeito: a URL era **entrada**, e clicar num
filtro a deixava mentindo. Agora `useNewsFilters` lê e escreve, e não há segunda
cópia para divergir. Escolha (categoria, fonte, período, ordem, página) escreve
com `push`, para o botão Voltar funcionar; a busca, que é debounced, escreve com
`replace` — senão "copa do mundo" deixaria quatro entradas de histórico.

**Período viaja como rótulo (`?period=7d`), não como data.** `?from=2026-08-14`
deixa de significar "os últimos sete dias" amanhã. A data é derivada na hora da
consulta e **ancorada na meia-noite UTC**: ancorada no instante, o `from` mudaria
a cada milissegundo, e ele entra na chave de cache do TanStack Query e na URL da
API — cada render viraria uma consulta nova e o CDN nunca acertaria.

**Nada aqui desenha um card.** A lista compõe `hero-story` e
`story-card-horizontal`, os mesmos da Home — era esse o ponto de eles terem
nascido client components na Fase 3. Ganharam duas props opcionais: o termo a
destacar e um slot de ação, que é como a listagem **manteve o botão de
favoritar** que a V1 tinha sem aninhar `<button>` dentro da âncora do card.
`news-grid` e `news-filters` saíram; `news-card` fica só para os favoritos, que
são da Fase 6.

**A hierarquia de heading é a correção obrigatória da ficha da tela.** O grid
antigo emitia `h3` sem `h2` antes (`heading-order` reprovado, §3.3 do
diagnóstico). Agora `h1` é o título da página, `h2` o hero e o "Últimas", `h3` os
cards — com teste que percorre os headings e falha em qualquer salto de nível.

**O estado vazio diz qual das três razões vale.** Busca sem resultado cita o
termo que falhou; combinação de filtros que não fecha diz que é a combinação;
acervo vazio diz que a coleta ainda não rodou — e **não** oferece "limpar
filtros", que mandaria o leitor limpar o que já está limpo. O terceiro é o que
costuma faltar.

**O histórico de busca é `localStorage`, não conta.** A `/news` é pública e não
exige sessão; o que alguém procurou não vira registro no projeto. Toda leitura é
defensiva — `localStorage` lança em modo privativo de alguns navegadores e o
conteúdo é editável à mão. Histórico corrompido volta vazio e nunca derruba a
busca.

**`<select>` nativo para fonte, período e ordem.** Teclado, leitor de tela e o
seletor do sistema no mobile vêm corretos de graça; um popover próprio seria
reimplementar o que o navegador faz, e a §15 cobra exatamente esse
comportamento. A coerência visual vem dos tokens de borda, superfície e raio.

#### O que a revisão da própria fase encontrou

Quatro defeitos, todos achados depois de o código estar escrito — três contra o
app rodando, um pelo teste.

- **A pílula "Todas" prometia um número que o clique não entregava.** Ela
  mostrava `facets.total`, que já aplica o filtro de categoria: com Mundo
  selecionado lia **594** e depois abria **2.373**. Cada pílula promete o que o
  próprio clique devolve, então ela passou a somar as facetas de categoria — que
  são as contagens com a categoria suspensa.
- **`facets.total` saiu do contrato.** O `meta.total` da listagem é o mesmo
  número, vindo da mesma consulta que trouxe as matérias visíveis. Dois totais
  por caminhos diferentes discordam enquanto um dos dois está no ar. Tirar
  também tirou uma consulta `count` por requisição.
- **A linha de contagem anunciava "Nenhuma notícia encontrada" durante o
  carregamento.** Sem resposta ainda, `meta.total` é zero — e a frase aparecia
  logo acima do esqueleto. Agora ela só entra quando há resposta.
- **A paginação cortava uma faixa de cinco páginas com reticências.** Foi o
  teste que pegou: `paginationRange(1, 5)` devolvia `[1, 2, …, 5]`. Abaixo de
  oito páginas a faixa inteira cabe, e cortar é esconder o que já era visível.

Uma prop que ninguém passa também saiu: `StoryCard` tinha ganhado `highlight`,
mas o hero do acervo é `HeroStory` e a lista é de cards horizontais.

#### Verificação

- **Contra o app rodando** (API + web local, 2.373 notícias no acervo): URL
  escrita e lida nas seis dimensões; `h1` e descrição trocando com a categoria;
  facetas corretas sob filtro combinado (`?category=SPORTS&source=ESPN Brasil`
  zera as outras sete categorias, porque a ESPN só publica esporte); destaque do
  termo com `<mark>`; estado vazio de busca citando o termo; sem erro no
  console; sem overflow horizontal a 375px.
- **`/news` continua SSG** (`●` no relatório de build) — o Suspense repete o
  cabeçalho no fallback, então o HTML pré-renderizado sai com um `h1` de
  verdade, e não com um retângulo cinza.
- **783 testes verdes** (497 API em 40 suites + 286 web em 35). `pnpm lint`,
  `pnpm typecheck` e `pnpm build` limpos; `contrast:check` em 60 pares, zero
  reprovando — o par novo é o texto principal sobre `surface-accent`, que é o
  `<mark>` do destaque (17,25:1 no claro, 15,50:1 no escuro).

#### Fechamento contra produção (21/08, depois do merge do PR #110)

**Lighthouse por rota** ([run 32525537279](https://github.com/tavinholoco/newra-news/actions/runs/32525537279)) — disparado por `workflow_dispatch`, não pela agenda de segunda:

| Rota | Perf | Acess. | BP | SEO |
|---|---|---|---|---|
| `/pt-BR` | 95 | 100 | 100 | 100 |
| `/pt-BR/news` | **97** (era 93) | **100** | 100 | 100 |
| `/pt-BR/article` | 96 | 100 | 100 | 100 |
| `/pt-BR/about` | 97 | 100 | 100 | 100 |
| `/en` | 94 | 100 | 100 | 100 |

A `/news` reescrita **subiu** de 93 para 97 e manteve acessibilidade 100 — a
hierarquia `h1 → h2 → h3` segurou o `heading-order`. O gate rodou (`Asserting`)
e passou nas cinco.

**Baseline visual recapturada** — 42 imagens, mesmas 12 rotas e 3 larguras, de
produção. E ela achou um defeito que o Lighthouse não veria.

##### O defeito que a baseline encontrou

Nas três larguras da `/news`, as oito pílulas de categoria apareceram com **0**
ao lado do nome, logo acima de "5.783 notícias". A página pontuou 97 assim —
zero é tão rápido de renderizar quanto qualquer número, então nenhuma métrica
sintética reclamaria.

A cadeia:

1. O merge dispara os dois deploys ao mesmo tempo. O build da Vercel correu
   **antes** de o Render subir `/api/news/facets`, então o prefetch tomou 404.
2. O `.catch(() => ({ categories: [], sources: [] }))` da página transformou a
   falha num **resultado vazio** — e resultado vazio é uma afirmação: "o acervo
   tem zero matérias em cada categoria".
3. Essa afirmação foi ao ar como `initialData` de uma query com `staleTime` de 5
   minutos. O TanStack Query a considerou fresca e **nunca buscou de novo** —
   para todo visitante, em toda visita, porque a página é estática e cada mount
   recebe o mesmo `initialData`.

O conserto é `prefetch` em `lib/api.ts`: falha vira `undefined`, que significa
"não medido" e a tela já sabe desenhar (chip sem número, esqueleto na lista).
**A `/article` tinha exatamente o mesmo padrão** e teria mostrado "nenhum
artigo" num acervo de 89 — corrigida junto, embora não seja da Fase 4.

> A lição não é sobre o race de deploy, que vai acontecer de novo. É que
> `catch` com valor de fallback **mente sobre a diferença entre "vazio" e "não
> deu"** — e um `staleTime` transforma a mentira em permanente. Onde o valor só
> é renderizado no servidor, sem query atrás, `.catch(() => null)` continua
> certo: ali `null` já significa ausência.

As cinco `news--*` foram recapturadas depois do deploy do conserto, e agora as
contagens somam o total: 639 + 248 + 838 + 331 + 243 + 119 + 3.106 + 259 =
5.783. O seletor de **Fonte**, que a lista vazia estava escondendo, também
apareceu.

#### O que **não** entrou

- **"Somente salvos" da §7.** Filtrar a listagem por favoritos exige juntar
  `Favorite` e `News` na consulta do acervo e uma resposta por usuário — que não
  pode ser cacheada no CDN como o resto da rota é. É trabalho da **Fase 6**, com
  o resto do ecossistema de conta.
- **Autocomplete da busca**, que a própria §7 marca como futuro.

---

### 20. Pré-requisitos da Fase 5 ✅ Concluídos em 2026-08-21

> Mesma forma que a Fase 0.5 teve para a Fase 3: backend pequeno que precisa
> entrar **antes**, não trabalho concorrente. A Fase 5 é a tela de artigo (§8 e
> §9), e três dos sete itens do checklist dependem de dado que não estava
> chegando.

**20.1 — O artigo era buscado com auditoria e servido sem ela** ✅

O `article.service` lia os campos de auditoria e a lista de fontes desde a Fase
0.5 (`include: withSources`). Mas `articleItemSchema` continuava sendo o da V1, e
o `fastify-type-provider-zod` **serializa pelo schema**: `generatedAt`,
`promptVersion`, `modelVersion`, `status` e as ~15 fontes iam do banco direto
para o lixo na saída.

Três itens do checklist da Fase 5 dependiam disso: `source list`, `AI
disclosure` e parte do `article hero`. O tipo `ArticleWithSources` já existia em
`packages/types` desde a Fase 0.5 e **não era usado por ninguém** — foi escrito
justamente para isto.

- [x] Campos de auditoria no `articleItemSchema` (listagem inclusive: são
      escalares baratos, já carregados, e o tipo compartilhado `Article` os
      declara como obrigatórios — sem eles o tipo mentia)
- [x] `articleWithSourcesSchema` nos dois endpoints de detalhe (`/:date` e
      `/latest`); a listagem paginada **não** ganha `sources`, que seriam ~150
      objetos por página sem nada os exibindo
- [x] `serializeArticle` em arquivo próprio — as três rotas precisam dela, e uma
      importar da outra acoplaria módulos de rota sem relação hierárquica
- [x] `getArticleByDate`/`getLatestArticle` do web tipados como
      `ArticleWithSources`
- [x] 5 testes novos: os quatro campos no `/:date`, a ordem das fontes, os
      mesmos no `/latest`, o artigo legado com os três nulos, e a listagem
      **sem** `sources`

> **A documentação estava certa; o código é que ficou para trás.** O
> `docs/api.md` descrevia `{ ...article, "sources": [...] }` e a tabela dos
> quatro campos desde 20/08 — então nada denunciava a divergência, e ela passou
> despercebida por um dia. A lição é sobre onde a verdade mora: com schema de
> resposta declarado, **o schema é o contrato**, não o `select` do serviço.

**Verificação.** O banco local só tem artigos anteriores à migration, então
todos os campos vêm nulos e `sources` vazio — que é exatamente o caso legado
coberto por teste. Que o pipeline preenche de verdade está confirmado pelo
`GET /api/home` de **produção**, que expõe o mesmo dado como `DailyBriefing`:
briefing de 21/08 com `generatedAt: 2026-08-21T11:00:10.888Z` e **15 fontes**.
`promptVersion` e `modelVersion` são gravados no mesmo objeto `auditFields` que
`generatedAt`, então preenchem juntos.

**20.2 — `/news/[id]` precisa de dono** ✅ resolvida na Fase 5 — é dela

A ficha da tela em `docs/v2/02-sitemap-telas.md` a marca como **Fase 4**; o §28
põe os componentes dela (`article hero`, `source list`, `related stories`,
`share/save`, `newsletter CTA`) na **Fase 5**. A Fase 4 seguiu o §28, então a
tela continua com o visual da V1 — `text-sm`, `text-6xl`, `mb-8`, fora da escala
nomeada e do ritmo dos tokens — e o `GET /api/news/:id/related`, entregue na
Fase 0.5, **nunca foi consumido**.

Recomendação, aceita: tratar como Fase 5. Os cinco itens mapeiam nela um a um, e
separar as duas telas de artigo em fases diferentes duplicaria `source-list` e
`related-stories`. A ficha da tela foi corrigida, e o `related` ganhou o primeiro
consumidor. Ver **item 21**.

**20.3 — O que a Fase 5 não terá** 📋

- **"Salvar" no briefing.** `Favorite` referencia `newsId`; um `Article` não
  pode ser favoritado hoje. O `share` da §8 é novo e independe disso; o `save`
  vale só em `/news/[id]`, onde já funciona.
- **"Horário da coleta"** que a §8 lista junto do horário de geração: não há
  coluna para ele. O mais próximo é o `createdAt` do artigo, que é quando a
  linha foi escrita — a poucos segundos da geração, e portanto redundante com
  `generatedAt`. Melhor omitir do que rotular um número como coisa que ele não
  é, como já foi decidido para o indicador "Atualizado" da Home.

---

### 21. V2.0 Fase 5 — Article ✅ Concluída em 2026-08-21

> Branch `feat/v2-article`. **Três telas, não uma:** `/news/[id]` (notícia
> coletada), `/article/[date]` (briefing de IA) e `/article` (histórico).
> Checklist da §28 fechado.

```text
[x] article hero        (casca com encaixes: as duas telas, uma composição)
[x] body typography     (medida de leitura; `###` da IA vira `h2`)
[x] source list         (só no briefing — leva à fonte, não a /news/[id])
[x] AI disclosure       (só no briefing — a notícia não é gerada por IA)
[x] share/save          (share nas duas; save só onde `Favorite` alcança)
[x] related stories     (só na notícia — o briefing já lista as suas fontes)
[x] newsletter CTA      (fim das duas telas)
[x] /article no ritmo dos tokens   (agrupado por mês, o do dia marcado)
```

**`/news/[id]` era da Fase 5, e a ficha dizia 4.** A decisão ficou registrada
como pendente no item 20.2 e foi resolvida aqui: os cinco itens do checklist
mapeiam nela um a um, e separar as duas telas de artigo em fases diferentes
duplicaria `source-list` e `related-stories`. A ficha foi corrigida. Efeito
colateral: o `GET /api/news/:id/related`, entregue na Fase 0.5, **ganhou seu
primeiro consumidor** depois de um dia sem nenhum.

#### As três decisões que mudaram o que se construiu

**A transparência de IA é só do briefing.** `/news/[id]` é matéria escrita por
uma redação e coletada por RSS. Carimbá-la como produzida por IA mentiria na
direção que mais custa a um produto jornalístico — é justamente a confiança que
a §8 quer construir. O que aquela tela declara é a outra coisa: que o texto e a
apuração são do veículo, e que o Newra News coletou e organizou.

**A "leia também" do briefing são as próprias fontes.** Ele já lista as quinze
matérias que o originaram; uma segunda lista de relacionadas seria a mesma
informação duas vezes na mesma tela. `related-stories` ficou em `/news/[id]`.

**Nada de renderizador de Markdown.** O corpo de produção foi medido antes de
decidir: 7.604 caracteres, cinco subtítulos, **todos `###`**, zero negrito, zero
listas. `react-markdown` seriam ~40 kB no bundle para reconhecer sintaxe que o
modelo não produz. `parseArticleBody` faz o que o texto real pede, com o
comentário dizendo em que condição a decisão se revê — nova medição, não
precaução.

#### O nível do heading é da página, não do texto

A IA escreve `###`, mas o `h1` é o título do artigo, então o subtítulo é `h2`.
Emitir `h3` abriria salto de nível — o mesmo defeito que reprovou `heading-order`
em `/news` e `/article` na Fase 1. Há teste que falha se o `ArticleBody` voltar
a emitir `h3`.

#### `source-list` leva à fonte, nunca a `/news/[id]`

Duas razões, e a segunda é decisiva: a §8 pede explicitamente que o leitor
alcance a matéria original, e **`newsId` é ponteiro fraco** — o cleanup apaga
`News` aos 30 dias e o briefing vive 90, então em dois terços dos artigos
retidos o link interno daria 404, vindo justamente da seção cuja função é
sustentar confiança.

#### A `pagination` saiu de `news/` para `editorial/`

Ela nunca soube nada sobre notícia, e o histórico estava prestes a ganhar uma
cópia — que divergiria na primeira correção de acessibilidade. Agora recebe o
nome da região por prop, porque quem sabe do que é a lista é a tela. Os dois
botões "Anterior/Próxima" do histórico sumiram junto.

#### O que a revisão da própria fase encontrou

**O link "pular para o conteúdo" não existia.** A string `shell.skipToContent`
está no repositório desde a Fase 2 e **nada a renderizava** — apareceu na
varredura por chaves órfãs. Não havia bypass block nenhum (WCAG 2.4.1), e o
shell tem três linhas mais a faixa de assuntos: cerca de doze paradas de
tabulação antes do conteúdo, em toda página. Agora existe.

Ele se desloca por `top` negativo, e não pelo par usual `sr-only` /
`focus:not-sr-only`: aquele par põe duas utilities de **mesma especificidade**
disputando `position`, `width` e `height`, e quem vence depende da ordem no CSS
gerado. Com `top`, `.focus\:top-4:focus` é classe + pseudo-classe (0,2,0) contra
`.-top-24` (0,1,0) — o foco vence por especificidade, que ordem nenhuma desfaz.

> **Uma medição minha estava errada, e vale registrar.** Cheguei a concluir que
> o `focus:not-sr-only` "não funcionava" porque o link media 1px com foco. O
> `document.hasFocus()` do painel era `false` — sem o documento focado, `:focus`
> não casa com nada, e a medição não dizia o que eu li nela. A regra de CSS
> estava correta o tempo todo. A escolha por `top` continua sendo a certa, mas
> pelo argumento de especificidade, não por aquela medição.

**Sete chaves de mensagem que ninguém lê** — quatro nascidas na Fase 4
(`news.highlightLabel`, `news.clearSearchTerm`, `common.resultsFor`,
`pagination.ellipsis`) e três órfãs desta (`article.readFull`,
`news.originalSource`, `common.pageXOfY`), mais `newsletter.sampleTitle`.
Removidas, e agora há teste que falha na próxima. Namespaces resolvidos
dinamicamente (`categories`, `categoryDescriptions`, `newsPeriod`, `newsSort`)
ficam de fora, e `metadata` também — os filhos dele são namespaces, não chaves.

**"Gerado em" mostrava só a data**, que é a mesma data do briefing e portanto não
dizia nada. A §8 pede o **horário** da geração. `formatDateTime` existe para
isso, separado de `formatDate`, onde a hora seria ruído.

#### Verificação

- **Contra o app rodando** (API + web local): hierarquia `h1 → h2 → h3` limpa
  nas três telas; 12 fontes numeradas de 1 com `position` 0-based; os quatro
  campos de auditoria renderizando (`gemini-2.5-flash`, `v1-ebb73b75`, "21 de
  ago. de 2026, 08:00", "12 fontes"); declaração de IA **antes** da lista;
  4 relacionadas em `/news/[id]` e nenhuma declaração de IA ali; histórico
  agrupado em "agosto de 2026" com o selo "Hoje" numa única linha; sem erro no
  console; sem overflow horizontal a 375px; medida de leitura em 689px.
- O banco local só tinha briefings anteriores à migration, então a auditoria foi
  semeada localmente para conseguir ver o caminho completo. O caminho degradado
  (tudo nulo) é o que o banco tinha e está coberto por teste.
- **820 testes verdes** (502 API em 40 suites + 318 web em 38). `pnpm lint`,
  `pnpm turbo typecheck` e `pnpm build` limpos; `contrast:check` em 60 pares,
  zero reprovando.

#### Fechamento contra produção (21/08, depois do merge do PR #113)

**Lighthouse por rota** ([run 32538891625](https://github.com/tavinholoco/newra-news/actions/runs/32538891625)):

| Rota | Perf | Acess. | BP | SEO |
|---|---|---|---|---|
| `/pt-BR` | 93 | 100 | 100 | 100 |
| `/pt-BR/news` | 95 | 100 | 100 | 100 |
| `/pt-BR/article` | 96 | 100 | **96** | 100 |
| `/pt-BR/about` | 97 | 100 | 100 | 100 |
| `/en` | 94 | 100 | 100 | 100 |

**Acessibilidade 100 nas cinco** — o skip link e a hierarquia de heading
seguraram. O gate passou (piso 90). Mas `/article` **perdeu 4 pontos de
best-practices**, e a baseline recapturada achou um segundo defeito. Os dois
são desta fase.

##### O relógio dentro do render derrubou a hidratação

O relatório aponta `errors-in-console` com dois erros React: **#418** (hydration
failed) e **#422** (erro ao hidratar Suspense). Só em `/article`, nas três
execuções; as outras quatro rotas, zero.

O `ArticleGrid` lia `new Date()` durante o render para decidir o selo "Hoje" — e
a página é **estática**. O HTML guarda o dia do *build* e o cliente compara com o
dia de *agora*. O build correu às 23:5x UTC e a medição às 00:04: o dia virou no
meio, o selo existiu de um lado só, e o React derrubou a hidratação da árvore.

Não é acaso de horário — é garantido acontecer toda meia-noite UTC. O relógio
saiu para um efeito: os dois lados começam sem selo e ele entra depois. Há teste
com `renderToString` que falha se o selo voltar a alcançar o render do servidor,
e ele foi conferido contra a versão defeituosa antes de entrar.

##### O briefing imprimia o parágrafo de abertura duas vezes

A captura mostrou o dek e o primeiro parágrafo do corpo **idênticos**, um embaixo
do outro. `summary` não é um resumo escrito à parte: o `parseMarkdownResponse` o
define como a primeira linha não-vazia do conteúdo, então dek e lide são o mesmo
texto **por construção** — verdade nos seis artigos que a API devolve, e em 1 de
8 notícias de RSS.

O conserto ficou na apresentação e não na ingestão porque alcança **o acervo
inteiro**: corrigir o parser só arrumaria os briefings seguintes, e os 90 dias
retidos continuariam repetindo.

**Baseline recapturada** — 42 imagens, e só **onze** diferem: as das três telas
reconstruídas. As outras 31 são byte a byte idênticas. As imagens de
`article-detail` são o registro do estado **com** a duplicação; recapturar essas
depois que o conserto subir.

#### O que **não** entrou

- **"Salvar" no briefing.** `Favorite` referencia `newsId`; um `Article` não pode
  ser favoritado. É Fase 6, com o resto do ecossistema de conta.
- **"Horário da coleta"** que a §8 lista ao lado do de geração: não há coluna, e
  o mais próximo (`createdAt` do artigo) fica a segundos da geração — redundante
  com `generatedAt`. Melhor omitir do que rotular um número como coisa que ele
  não é, pelo mesmo critério que barrou o indicador "Atualizado" na Home.
- **Página na URL em `/article`.** A ficha escopa a tela a ritmo visual, e ler a
  query string exigiria uma fronteira de Suspense numa página que não precisa de
  nenhuma. Diverge de `/news`, que é compartilhável por contrato — dívida
  consciente, anotada no componente.
- **Recapturar `article-detail--*`** depois que o conserto da duplicação subir;
  o resto do conjunto está correto.

---

### 22. Pendências e pré-requisitos da Fase 6 📋 levantados em 2026-08-21

> A Fase 6 é o **ecossistema de conta**: `favorites`, `profile`, `preferences` e
> `newsletter settings` (§28; a visão em §19, "Seu Newra"). Ao contrário da Fase
> 5, ela **muda o banco** — e é isso que precisa ser decidido antes de a
> primeira tela ser escrita.

**22.1 — `Favorite` só alcança notícia** 🔴 é o bloqueio real

```prisma
model Favorite {
  userId String
  newsId String   // e nada mais
  @@unique([userId, newsId])
}
```

Duas coisas já registradas como fora de alcance esperam por isto:

- **"Salvar" no briefing** (Fase 5) — `/article/[date]` tem `share` e não tem
  `save`, porque não há como favoritar um `Article`;
- **"Somente salvos" da §7** (Fase 4) — o filtro do acervo.

São o mesmo problema com duas caras. O desenho a escolher:

| Opção | O que muda | Custo |
|---|---|---|
| `articleId` nullable ao lado de `newsId` | uma coluna, um check | `@@unique` composto vira parcial; toda consulta passa a testar dois campos |
| Tabela polimórfica (`itemType` + `itemId`) | modelo novo | perde a FK; o dado de exibição vira responsabilidade da leitura |
| `Favorite` separado por tipo | `ArticleFavorite` próprio | duplica serviço e rota, mas cada um continua simples e com FK |

Não decidir isto antes torna a Fase 6 uma sequência de remendos.

**22.2 — "Somente salvos" quebra o cache da rota** 🔴 decidir antes de desenhar

`GET /api/news` hoje é público e cacheável. Com o filtro de salvos ele passa a
juntar `Favorite` e `News` e a devolver **resposta por usuário** — e um
`s-maxage` num proxy compartilhado ali seria vazamento entre sessões, exatamente
o que `utils/cache.ts` documenta como o motivo de o header ser por rota.

Ou o filtro vira uma rota autenticada própria (`/api/favorites` já é isso, e já
pagina), ou a `/news` ganha um caminho sem cache quando o parâmetro está
presente. A primeira reusa o que existe; a segunda mantém uma tela só.

**22.3 — `User` não tem onde guardar preferência** 🟠 migration nova

O modelo tem `email`, `name`, `image`, `role` e os timestamps. A §19 quer
categorias favoritas, temas, fontes, horário do briefing e tipo de alerta —
**nenhum deles cabe hoje**. E a §19 é explícita: *"não implementar toda a
personalização na primeira entrega; primeiro criar a arquitetura visual que
comporte isso"*.

Vale a mesma lição da Fase 0.5: **preferência é dado que só existe daqui para
frente**. Se a tela entrar antes da coluna, cada dia é um dia de escolha do
leitor que não foi guardada.

**22.4 — `Subscriber` e `User` não se conhecem** 🟠 afeta "newsletter settings"

São duas tabelas com `email` e nenhuma relação. Hoje funciona porque o
cancelamento é por token no e-mail, sem sessão. Mas "newsletter settings" dentro
do perfil precisa responder "este usuário está inscrito?" — e cruzar por
`email` em duas tabelas é a resposta frágil: o e-mail do provedor de login pode
não ser o da inscrição.

**22.5 — `favorites-list` é o último consumidor do `news-card` da V1** 🟡

A tela ainda monta uma grade de cartões da V1: `NewsCard`, `Skeleton` solto,
`grid-cols-3`. Quando a Fase 6 a migrar para os cards editoriais, **`news-card`
pode sair do repositório** — é o único lugar que ainda o importa.

**22.6 — Não existem `/profile` nem `/preferences`** 🟡 terreno limpo

As rotas de conta hoje são `/favorites`, `/signin` e o segmento `/admin`. Perfil
e preferências nascem do zero, e o guard de sessão + role já vive em
`app/[locale]/admin/layout.tsx` — o mesmo padrão serve para um segmento
`/account`, e página nova sob ele já nasceria protegida.

**22.7 — Página protegida não pode ser SSG** ⚪ armadilha já paga

`/favorites` é `force-dynamic` com um comentário explicando por quê: o
`redirect()` de sessão foi "assado" no HTML estático e mandava todo mundo para o
sign-in, logado ou não. Toda tela de conta nova herda essa restrição.

#### Ordem sugerida

1. **22.1 e 22.2 juntos**, porque são o mesmo problema — e são backend, como a
   Fase 0.5 foi para a Fase 3;
2. **22.3**, a migration de preferências, pelo mesmo motivo de "só existe daqui
   para frente";
3. as telas, com **22.5** saindo de graça no caminho.

**22.4** só bloqueia "newsletter settings"; dá para adiar se a fase for
recortada.

---

### 23. V2.0 Fase 6 — decisões de arquitetura e plano de execução 📋 decididas em 2026-08-21

> As quatro decisões que o item 22 deixou em aberto foram tomadas. Este item é
> o **plano de execução** da fase; o item 22 continua sendo o levantamento que
> as motivou.

#### As quatro decisões

**D1 (22.1) — `Favorite` polimórfico: `itemType` + `itemId`.**

```prisma
enum FavoriteItemType {
  NEWS
  ARTICLE
}

model Favorite {
  id        String           @id @default(uuid())
  userId    String
  itemType  FavoriteItemType @default(NEWS)
  itemId    String
  createdAt DateTime         @default(now())

  @@unique([userId, itemType, itemId])
  @@index([userId, createdAt])
}
```

Escolhido porque **"Salvos" tem de ser uma lista só**, notícias e briefings
ordenados pela data em que o leitor os salvou — duas tabelas paginadas por
`createdAt` não se juntam numa página sem ler as duas inteiras. O custo que a
tabela do item 22 atribuía a esta opção ("perde a FK") **já estava pago**:
`Favorite` nunca teve FK; a única relação declarada no schema é
`Article` ↔ `BriefingSource`.

A opção `articleId` nullable foi descartada por um defeito que o levantamento
não via: no Postgres `NULL` é sempre distinto de `NULL`, então
`@@unique([userId, newsId])` com `newsId` nulo deixaria o **mesmo briefing ser
salvo N vezes**. Corrigir isso pede dois índices únicos parciais em SQL cru.

Migration: renomear `newsId` → `itemId` e backfill de `itemType = 'NEWS'` em
tudo que já existe. Aditiva e reversível; produção tem favoritos reais.

**D2 (22.2) — o "somente salvos" vive em `/api/favorites`, e compõe.**

A rota autenticada que já existe e já pagina ganha as mesmas dimensões da
listagem (`category`, `search`, `from`/`to`, `source`, `sort`), e a `/news`
troca de fonte de dados quando o filtro está ligado. A `/news` pública segue
intocada e cacheável.

A alternativa ("a `/news` ganha caminho sem cache") caiu por um motivo que só o
código mostra: **o browser nunca fala autenticado com a API**. `lib/api.ts`
chama `NEXT_PUBLIC_API_URL` direto, sem token; só as rotas proxy do Next assinam
o JWT (`app/api/favorites/route.ts`). Ela exigiria uma rota proxy nova do mesmo
jeito — e ainda poria um desvio por usuário dentro da rota mais cacheada do
site.

**D3 (22.3) — preferências: só o que a tela honra hoje, em tabela própria.**

```prisma
model UserPreference {
  id         String          @id @default(uuid())
  userId     String          @unique
  categories Category[]      @default([])
  theme      ThemePreference @default(SYSTEM)
  createdAt  DateTime        @default(now())
  updatedAt  DateTime        @updatedAt
}
```

**"Horário do briefing" fica de fora**: o pipeline roda num cron único, e um
controle que o sistema não honra é o mesmo erro da pílula "Todas" da Fase 4 —
um número que não promete o que o clique entrega. "Temas" e "fontes" também
ficam para quando houver quem os consuma.

**E o opt-in de alerta saiu daqui na implementação.** Ele era para ser a
terceira coluna, mas o único canal de saída que existe é a newsletter, e ela é
`Subscriber` — o mesmo que a D4 acabou de amarrar ao usuário. Uma coluna
`alertOptIn` ao lado disso não seria "preferência ainda sem consumidor", seria
**duas fontes de verdade para a mesma resposta**, com a chance de discordarem no
dia seguinte. A tela de conta lê e escreve a inscrição, que é quem o envio
consulta.

Tabela própria, e não colunas em `User`, para o upsert de login não dividir
espaço com dado de produto (`upsertUser` roda a cada sign-in).

**D4 (22.4) — `Subscriber` ganha `userId` nullable.**

Preenchido quando um usuário logado se inscreve, e backfill por e-mail no
momento da migration. A leitura de "newsletter settings" é por `userId` com
fallback por e-mail. Cruzar só por e-mail mentiria quando o e-mail do provedor
de login não é o da inscrição — inscrito aparecendo como não inscrito, e um
clique criando inscrição duplicada.

#### O que a leitura do código acrescentou ao item 22

- **`useIsFavorite` baixa os 100 primeiros favoritos e testa no cliente**
  (`lib/queries.ts`). Com o "salvar" chegando ao briefing e a todos os cards
  editoriais, do 101º favorito em diante o coração mente. A fase entrega um
  `GET /api/favorites/ids` (só os ids, uma query por sessão).
- **`upsertUser` sobrescreve `name` e `image` a cada login.** Se o
  `/account/profile` deixar editar o nome, o próximo sign-in o desfaz. Nesta
  fase o perfil é **de leitura** (identidade do provedor, salvos, inscrição,
  sair); nome editável pede coluna própria e é escopo novo.
- **A migration de produção corre em paralelo com os deploys.** O `migrate.yml`
  dispara no push para `main`, junto com Vercel e Render — a mesma corrida que a
  seção "Fechar uma fase" do `CLAUDE.md` descreve. Migration só aditiva, e
  confirmar que ela terminou **antes** de medir.
- **`/api/news` não usa `withEditorialCache`** — quem usa são `home`,
  `trending`, `facets` e `related`. O `s-maxage` que o item 22 cita como risco
  chega à `/news` pela ISR da página (`revalidate = 3600`), não pela rota.
- **`news-grid` provavelmente sai junto com `news-card`** (22.5) — conferir os
  consumidores restantes na hora.

#### Plano de execução

**PR 1 — banco e API** (é a Fase 0.5 desta fase; nenhuma tela antes dele)

```text
[x] migration do Favorite polimórfico, com backfill itemType = NEWS
[x] migration do UserPreference
[x] migration do Subscriber.userId + backfill por e-mail
[x] favorite.service por tipo (list/add/remove) + hidratação por tipo na leitura
[x] GET /api/favorites com os filtros da listagem (D2) e GET /api/favorites/ids
[x] GET/PUT /api/account/preferences (autenticadas, sem Cache-Control)
[x] leitura de inscrição por userId com fallback por e-mail
[x] testes de API + docs/api.md + docs/v2/03-contratos-api.md

    -- o que o contrato novo obrigou a mexer junto --
[x] tipos compartilhados (união discriminada por itemType) e o cliente do web
[x] trending contava favorito: passou a contar só itemType NEWS
[x] proxy do Next unificado em lib/api-proxy.ts (cinco rotas assinando JWT)
```

**Entregue em 21/08 — 869 testes (825 → 869), lint, typecheck e build limpos.**
Três achados que o plano não previa:

- **O trending contava salvamento.** `getTrending` agrupava `Favorite` por
  `newsId` sem filtrar tipo; com briefing salvável, salvar o briefing do dia
  passaria a empurrar uma notícia no ranking. Hoje filtra `itemType: 'NEWS'`.
- **A migration é escrita à mão**, porque `migrate diff` resolveria o rename de
  `newsId` como DROP + ADD — apagando os favoritos que já existem em produção.
  Aplicada no banco local e conferida com `migrate diff` contra o schema: sem
  drift além do índice de `News.sourceUrl` que já faltava lá.
- **`meta.total` da lista de salvos passou a contar o que a lista mostra.** A
  versão anterior contava a linha do favorito, e o cleanup do Stage 8 apaga
  notícia com mais de 30 dias — o leitor via "12 salvos" e nove cards.

**PR 2 — telas de conta**

```text
[x] segmento /account com guard de sessão no layout (padrão do admin/layout.tsx)
[x] force-dynamic em todas — /favorites já paga essa conta desde a V1
[x] /favorites mantém a URL (está no menu mobile e na baseline) e migra para
    story-card-compact + estado vazio editorial
[x] save-button editorial no lugar do FavoriteButton da V1 (cards, news-detail
    e briefing)
[x] /account (perfil, leitura), /account/preferences, /account/newsletter
[x] /signin redesenhado — visual apenas, sem tocar no fluxo
[x] news-card sai do repositório (news-grid não existia mais)
[x] i18n pt-BR/en, testes web, suíte design-tokens verde

    -- a pendência da Fase 5 que este PR fecha --
[x] "salvar" no briefing (§8) — `/article/[date]` ganhou o botão
```

**Entregue em 21/08 — 892 testes (869 → 892), lint, typecheck e build limpos.**

Decisões que a implementação tomou:

- **O perfil é de leitura.** `upsertUser` reescreve `name` e `image` a cada
  sign-in: campo editável ali seria desfeito no login seguinte, sem aviso.
- **"Salvos" é uma lista só**, notícia e briefing na ordem em que foram salvos —
  é o que o `Favorite` polimórfico existe para permitir. `briefing-card-compact`
  nasceu para o briefing ter a forma do card compacto sem virar notícia.
- **O tema virou `lib/theme.ts`, com um escritor só.** São dois controles
  mexendo na mesma chave do `localStorage` (o botão do cabeçalho e as
  preferências da conta), e duas cópias da mesma gravação divergiriam no
  primeiro ajuste. `SYSTEM` **apaga** a chave em vez de gravar o valor atual:
  gravado, o tema deixaria de acompanhar o aparelho quando ele virasse à noite.
- **O tema é aplicado quando o `PUT` responde**, a partir do que ele devolveu —
  aplicar no clique deixaria a tela escura com a escolha não gravada se a
  chamada falhasse.
- **`/favorites` não se mudou para `/account/saved`.** É URL da V1, está no menu
  e na baseline visual; movê-la pediria um redirect permanente para não ganhar
  nada. Ela entra na `account-nav` como quarta aba.

**Falta o PR 3:** "somente salvos" na `/news` — a API já serve.

**PR 3 — "somente salvos" na `/news`** ✅

```text
[x] `saved` entra no estado da URL, zera a página e conta como filtro ativo
[x] a tela troca de fonte de dados: /api/favorites autenticada no lugar da
    listagem pública, com o recorte inteiro viajando junto
[x] contagem sai das pílulas e do seletor de fonte no modo salvos
[x] estado vazio próprio, e sem hero — o recorte não é uma edição
[x] o controle só aparece com sessão; `?saved=1` sem sessão mostra o acervo
```

**Entregue em 22/08 — 903 testes (892 → 903), lint, typecheck e build limpos.**

Duas decisões que a implementação tomou:

- **A contagem some no modo salvos.** As facetas contam o **acervo**; com o
  filtro ligado, a pílula "Esportes 223" abriria uma lista de dois itens — o
  mesmo defeito da pílula "Todas" da Fase 4, que lia 594 e abria 2.373. Pílula
  sem número continua filtrando; pílula com número errado é promessa quebrada.
  Vale também para o `(30)` ao lado de cada fonte no seletor.
- **`?saved=1` sem sessão mostra o acervo**, não uma tela vazia nem um erro. É a
  mesma regra de `?category=BANANA`: a query string é editável por qualquer um,
  e valor que a tela não consegue honrar cai no default em silêncio.

As duas consultas **nunca correm juntas** — `enabled` desliga a que não está
valendo, então ligar o filtro não dispara uma busca no acervo que ninguém vai
ler.

**A Fase 6 fecha aqui**, faltando o ritual contra produção (Lighthouse por rota
e baseline visual).

**Fechamento, contra produção:** Lighthouse por rota
(`gh workflow run "Lighthouse CI" --ref main`), baseline visual de produção nas
mesmas larguras, item deste arquivo marcado e **só o topo** do `CLAUDE.md`
atualizado.

#### Armadilhas que valem para esta fase

- Resposta por usuário **não** leva `Cache-Control` — é o que `utils/cache.ts`
  documenta.
- Campo novo tem de entrar no **schema de resposta** Zod, senão o
  `fastify-type-provider-zod` o descarta em silêncio.
- Nível de heading é decisão da página (`heading-level`), nunca do componente.
- Nada de relógio dentro do render — "salvo há 3 dias" é efeito, não JSX.
- Nome novo na escala tipográfica exige entrada em `TYPOGRAPHY_SCALE`.
- Bloco sem dado devolve `null` **e** o wrapper do grid junto.

---

### 24. V2.0 Fase 6 — Account ecosystem ✅ Concluída em 2026-08-22

> Três PRs, na ordem que o item 23 planejou: **#116** (banco e API), **#117**
> (telas de conta) e **#118** ("somente salvos" no acervo). O detalhe de cada um
> está no item 23; este item é o **fechamento** — o que a medição contra
> produção achou e o que a fase deixa para trás.

#### O ritual, contra produção

**Lighthouse por rota** ([run 32547642493](https://github.com/tavinholoco/newra-news/actions/runs/32547642493)):

| Rota | Performance | Acessibilidade | Best practices | SEO |
|---|---|---|---|---|
| `/pt-BR` | 94 | 100 | 100 | 100 |
| `/pt-BR/news` | 96 | 100 | 100 | 100 |
| `/pt-BR/article` | 96 | 100 | 100 | 100 |
| `/pt-BR/about` | 97 | 100 | 100 | 100 |
| `/en` | 94 | 100 | 100 | 100 |

**A primeira execução reprovou, e não era a mudança.** Disparada minutos depois
do merge, deu **83** de performance na `/pt-BR` (execuções 0,64 · 0,83 · 0,83)
enquanto a `/en` — a mesma página, outro idioma — deu 94. O 0,64 é o custo da
**regeneração da ISR** logo após o deploy. Dois `curl` na rota (0,23 s cada) e
uma segunda execução devolveram 94, sem uma linha de código mudar. O aviso
entrou no ritual do `CLAUDE.md`: **medir logo após o merge mede o deploy**.

**Baseline visual** — 20 imagens mudaram, e cada uma tem explicação:

| Imagens | Por quê |
|---|---|
| `news--*` (5), `news-detail--*` (3) | o ícone de salvar virou marcador (era coração) |
| `article-detail--*` (5) | o briefing ganhou o botão "salvar" |
| `signin--*` (3), `favorites-anon--*` (3) | o redesenho do sign-in (o `/favorites` anônimo cai nele) |

As que **não** mudaram são exatamente as que não têm controle de salvar nem
foram redesenhadas — home, histórico, `/about`, `/en` e a 404. A comparação
pixel a pixel do `news--375` confirmou: fora o ícone, as duas capturas são
idênticas, mesmas matérias e mesmas contagens.

#### O que a auditoria de fechamento achou

Nenhum item do checklist ficou de fora, mas duas coisas apareceram ao conferir a
fase inteira — as duas corrigidas antes de fechar:

- **A tela "Salvos" não paginava.** Pedia 100 itens e desenhava o que viesse,
  como na V1. Passou a não ter consequência quando o perfil, ao lado, anuncia
  "132 salvos": a lista mostraria 100 e nada diria que havia mais. A rota já
  paginava; faltava a tela usar, e agora a página mora na URL (`?page=`), com
  volta à primeira quando a última linha de uma página interna é removida.
- **A contagem de salvos do perfil não se atualizava.** `useToggleFavorite`
  invalidava as chaves de favoritos, mas não a da conta: salvar uma matéria e
  voltar para `/account` mostrava o número de antes.

#### O que a fase deixa para trás

- **Nome editável no perfil.** `upsertUser` reescreve `name` e `image` a cada
  sign-in; um campo ali seria desfeito no login seguinte, sem aviso. Pede coluna
  própria, e é escopo novo.
- **Temas, fontes e horário do briefing** (§19). Sem consumidor, e "horário"
  nunca terá enquanto o pipeline rodar num cron único.
- **Excluir a conta.** Ninguém pediu, e é fluxo com consequência jurídica.
- **A leitura de `/api/favorites` resolve os salvos inteiros antes de paginar.**
  É o que faz o `meta.total` prometer o que a lista mostra, e o conjunto é
  limitado pela conta. Com dezenas de milhares de salvos por pessoa vira
  consulta a otimizar — não é o caso hoje, e está documentado no serviço.

#### Números da fase

- **905 testes** (825 → 905): 537 na API (+35) e 368 no web (+45), 84 suites.
- **Sai do repositório:** `news-card` da V1 e seu teste; `favorite-button` virou
  `editorial/save-button`.
- **Documentação:** `docs/api.md` (favoritos reescritos + seção de conta), §10
  nova em `docs/v2/03-contratos-api.md`, fichas das telas em
  `docs/v2/02-sitemap-telas.md`, regras de conta e de i18n em
  `apps/web/CLAUDE.md`, e o ritual de medição no `CLAUDE.md` da raiz.

### 25. V2.0 Fase 7 — SEO, performance e acessibilidade ✅ Concluída em 2026-08-22

> Branch `feat/v2-seo`, PR único. O checklist da §28 tem dez itens; os cinco de
> SEO eram código a escrever, e as cinco auditorias eram medição. **Foi a
> medição que rendeu mais** — quatro defeitos que estavam em produção e que
> nenhum item do checklist nomeava.

#### O que a fase escreveu

| Peça | O que faz |
|---|---|
| `lib/seo.ts` → `pageMetadata` | a metadata inteira de uma página pública |
| `lib/seo.ts` → `alternatesFor` | canonical + hreflang + `x-default` |
| `lib/json-ld.ts` | `Organization`, `WebSite`, `NewsArticle`, `BreadcrumbList` |
| `components/seo/json-ld.tsx` | serializa um nó (ou `@graph`) com escape |
| `components/editorial/breadcrumb.tsx` | a trilha visível |
| `app/news-sitemap.xml/route.ts` | a janela de 48h do Google Notícias |

**Canonical.** Nenhuma rota declarava `canonical` — nem as públicas, nem as
`noindex`. O que havia eram **quinze cópias** manuais de
`{ 'pt-BR': '/pt-BR/x', en: '/en/x' }`, nenhuma com `x-default`. Agora o caminho
sem prefixo de idioma é escrito **uma vez por página** e o helper deriva o
canonical, os três `hreflang` e o `og:url`. O canonical é auto-referente: as duas
URLs servem o mesmo corpo em português, mas canonizar `/en` para `/pt-BR` tiraria
do índice justamente a versão que serve quem busca em inglês.

**JSON-LD.** O layout de idioma declara `Organization` + `WebSite` (com a
`SearchAction` apontando para a busca que existe); as telas de leitura declaram
`NewsArticle` + `BreadcrumbList` e referenciam a organização pelo `@id`.

> **A autoria segue quem escreveu.** Em `/news/[id]` o `author` é o veículo, o
> `publisher` é o Newra News e o `isBasedOn` aponta para a matéria original — é o
> par honesto de o corpo ser um trecho de RSS. No briefing o `author` é o site e
> as quinze fontes viram `citation`. Carimbar texto de terceiro como nosso é o
> mesmo erro que a §8 evita na interface, num lugar onde o buscador acredita.

**Trilha.** A visível e o `BreadcrumbList` recebem **a mesma lista**: o Google
pede que o dado estruturado descreva a trilha visível, e duas listas paralelas
divergem no primeiro degrau que alguém renomear. Ela substituiu o "← voltar" das
duas telas — dois controles de volta na mesma linha seriam a mesma ação duas
vezes — e as chaves `news.backTo`/`article.backTo` saíram dos JSONs junto.

**News sitemap.** É route handler e não `sitemap.ts` porque o
`MetadataRoute.Sitemap` do Next não emite o namespace `news:`.

> **Só as URLs `pt-BR`, e é decisão sobre o conteúdo.** As fontes RSS são
> brasileiras: o corpo é o mesmo texto em português nas duas URLs, e o que `/en`
> traduz é a moldura. Declarar `/en/news/{id}` com `news:language` inglês diria
> que ali há matéria em inglês que não existe. As duas URLs continuam no
> `sitemap.xml` geral, com o `hreflang` dizendo o que elas são. `news:language` é
> ISO 639 (`pt`), não o BCP-47 da rota. Medido: **734 URLs** na janela, dentro do
> teto de 1.000 do formato.

#### O que a medição achou — os quatro defeitos

Nenhum deles estava no checklist, e os quatro estavam em produção.

**1. A imagem de compartilhamento do site era inalcançável.** O matcher do
middleware exclui o que tem ponto (`sitemap.xml`, `icon.svg`, `robots.txt`), mas
as rotas de metadata **geradas** — `opengraph-image.tsx`, `apple-icon.tsx` — são
servidas em URL **sem** extensão. O middleware as tratava como página sem idioma:
`GET /opengraph-image` → 307 para `/pt-BR/opengraph-image` → 404. O mesmo para
`/apple-icon`, o ícone do iOS. Valia desde que os dois arquivos existem.

**2. A tela do briefing apontava para uma URL que nunca existiu.** Desde a Fase 5
o `og:image` e o `twitter:image` de `/article/[date]` eram `/opengraph-image.png`
— 404. Todo compartilhamento do briefing carregava imagem quebrada.

**3. A metadata do Next não faz merge profundo, e ninguém tinha percebido.** O
layout declara `openGraph: { type, siteName, locale }` e `twitter: { card }`; a
página que declara os seus **substitui o objeto inteiro**. Medido no HTML de
produção: nenhuma página tinha `og:type`, `og:site_name`, `og:locale` nem
`og:image`, e a Home, a `/news`, o histórico, a `/about` e a `/newsletter`
compartilhavam com `twitter:card: summary` em vez de `summary_large_image` —
porque as duas telas de leitura repetiam o valor à mão e as outras cinco não.
Repetir os quatro campos nas sete páginas resolveria hoje e quebraria na oitava:
o default agora vive em `pageMetadata`.

**4. O briefing exibia a véspera.** `Article.date` é data de calendário gravada à
meia-noite UTC, e `formatArticleDate` lia no fuso local. Em qualquer fuso
negativo — o Brasil é um — meia-noite UTC do dia 22 vira 21h do dia **21**. A URL
dizia `/article/2026-08-22` (o `toDateSlug` sempre usou UTC) e a página dizia
"sexta-feira, 21 de agosto"; no histórico, o mesmo card levava a um dia e
rotulava outro. E não era só cosmético: o servidor da Vercel roda em UTC e o
navegador não, então a mesma data saía diferente dos dois lados — a divergência
de hidratação da armadilha do relógio, agora vinda do dado em vez do `Date.now`.
`formatArticleDate` passou a ler em UTC; `formatDate`/`formatDateTime` continuam
no fuso local, que é o certo para um **instante** (o "membro desde" do perfil
migrou para `formatDate`).

#### As auditorias

**Imagem** — virou guarda, não passada manual (`tests/lib/images.test.ts`): nada
de `<img>` cru, `fill` sempre com `sizes`, `alt` sempre declarado (nem que vazio)
e `priority` só nos três lugares onde a imagem pode ser o LCP. As quatro regras
já valiam no código; nenhuma delas quebra build, lint ou tipo quando for violada,
que é a razão de existirem.

**Contraste** — `contrast:check`, 60 pares, **0 reprovando**. A trilha não
introduziu combinação nova: `ink-700` (11,22:1), `ink-500` (4,71:1) e `ink-950`
(17,70:1) sobre `paper` já estavam medidos.

**Teclado** — 40 elementos focáveis na tela da notícia, **todos com nome
acessível**, na ordem do DOM, com o skip link em primeiro. Um `h1`, nenhum salto
de nível de heading, 21 regras de foco no CSS gerado.

**Leitor de tela** — a árvore de acessibilidade não apontou defeito, e rendeu uma
melhora: as duas telas de leitura viraram `<article>`. A tela **é** um artigo e
nada dizia isso — era uma pilha de `div` com um `h1` no meio.

> **A árvore do painel deriva papel pela tag, não pelo cálculo do Chrome.** Uma
> `<section>` sem nome acessível apareceu como `region`, o que não é o papel
> real. Cheguei a registrar "dois landmarks `banner`" como achado antes de
> conferir — não era. Conferir no DOM antes de concluir a partir dela.

**Core Web Vitals** — o Lighthouse do ritual de fechamento, contra produção
aquecida. Ver abaixo.

#### Ajustes que a verificação pediu

- **A trilha quebrava em duas linhas.** Com `flex-wrap`, o degrau atual pedia a
  largura inteira **antes** de truncar e ia sozinho para a segunda linha — 52px
  de altura numa tela de 1280. Sem quebra, os ancestrais ficam `shrink-0` e só o
  atual encolhe: 24px em 1280 e em 375, sem rolagem horizontal.
- **`images: []` apagaria o default.** Em `/news/[id]` a foto só sobrescreve
  quando existe: ~30% do acervo não tem imagem, e uma lista vazia trocaria o
  cartão de marca por um cartão sem imagem nenhuma.

#### O ritual, contra produção

**Lighthouse por rota** ([run 32579866160](https://github.com/tavinholoco/newra-news/actions/runs/32579866160)), com o site aquecido (dois GETs por rota, ~0,2 s cada):

| Rota | Performance | Acessibilidade | Best practices | SEO |
|---|---|---|---|---|
| `/pt-BR` | 93 | 100 | 100 | 100 |
| `/pt-BR/news` | 91 | 100 | 100 | 100 |
| `/pt-BR/article` | 96 | 100 | 100 | 100 |
| `/pt-BR/about` | 98 | 100 | 100 | 100 |
| `/en` | 95 | 100 | 100 | 100 |

Gate verde nas cinco rotas. Acessibilidade, best practices e SEO em **100**;
performance entre 91 e 98. A `/news` caiu de 96 para 91 e a `/pt-BR` de 94 para
93 — dentro da faixa de aquecimento que a própria Fase 6 documentou, e o
JSON-LD acrescenta 1–2 KB de HTML por página. Não há audit reprovado.

**Antes de medir, conferi que a mudança estava no ar** — `/opengraph-image` e
`/apple-icon` respondendo **200 image/png** (eram 307→404), `/news-sitemap.xml`
com **732 URLs** e `news:language` em `pt`, `robots.txt` listando os dois
sitemaps, e as cinco rotas públicas com canonical, `x-default`, `og:url`,
`og:type`, `og:image`, `og:site_name` e `twitter:card: summary_large_image`.

**Baseline visual** — e foi ela que achou o defeito que o Lighthouse não pega.

> **A trilha foi ao ar com os degraus grudados.** O `flex-shrink: 1` ficou no
> `li`, e o `shrink-0` que eu tinha escrito estava no `<a>` de dentro — mas quem
> o flex encolhe é o item da linha. Com `min-w-0` junto, cada `li` clipava o
> próprio conteúdo: medido em produção, "Notícias" pedia 77px e recebia 51,
> comendo exatamente o chevron e o gap. A trilha renderizou
> "Home›NotíciasSaúde 'A geração sóbria'…" sem separador visível nenhum. O
> teste da fase media a **existência** dos degraus, não a largura deles — agora
> mede as duas coisas (`shrink-0` nos ancestrais, `min-w-0` só no atual, e um
> separador por degrau depois do primeiro).

Das 35 imagens que a captura mexeu, **nenhuma ficou sem explicação**:

| Imagens | Por quê |
|---|---|
| estáticas em 768 e 1440 (`about`, `newsletter`, `newsletter-unsubscribe`, `signin`, `favorites-anon`) | só a data do top-bar avançou (21→22/08). Os 375px **não** mudaram, e é a confirmação: o top-bar é `hidden md:block` |
| `home--*`, `news--*`, `article-history--*` | o pipeline diário rodou entre as duas capturas |
| `news-detail--*`, `article-detail--*` | a captura segue a matéria e o briefing **mais recentes**, e os dois trocaram (o manifest registra) |

A captura foi **descartada** em vez de commitada: ela registrava a trilha
quebrada, e baselinar um defeito faria a próxima comparação aprovar o erro. A
recaptura fica para depois deste deploy.

#### Números da fase

- **418 testes no web** (368 → 418, +50): `seo`, `json-ld`, `images`,
  `breadcrumb`, `json-ld` (componente) e `news-sitemap` são suites novas.
- **Guardas novas:** nenhuma página escreve caminho localizado à mão; toda
  `generateMetadata` passa por um dos dois helpers; as quatro regras de imagem; o
  escape do `<script>` (o conteúdo vem de feed de terceiro, e `JSON.stringify`
  não escapa `<`); a trilha visível igual ao `BreadcrumbList`; a data do briefing
  em UTC.
- **Documentação:** seção SEO reescrita em `apps/web/CLAUDE.md`, com as regras de
  metadata, de matcher e de fuso.

### 26. V2.0 Fase 8 — pré-requisitos: eventos de produto (banco e API) ✅ Concluído em 2026-08-22

> Branch `feat/v2-product-events`. É o **primeiro dos três PRs** dos
> pré-requisitos, e o único de backend — mesmo corte que a Fase 6 usou.

#### Por que este PR vem antes de qualquer slot

A §28 lista cinco itens de monetização e **nenhum deles é o primeiro passo**. O
`AdSlot` existe desde a Fase 3, reserva altura e não renderiza nada sem
inventário; o que falta para ligá-lo não é criativo, é **onde gravar a
impressão**. Sem `ad_view`/`ad_click` não há viewability, sem viewability não há
CTR, e sem CTR o "framework de experimento de preço" mede o nada.

#### O que entrou

| Peça | Papel |
|---|---|
| `packages/types/src/analytics.ts` | os 14 eventos e os vocabulários fechados |
| `model ProductEvent` + migration | uma tabela, `payload` em `Json`, dois índices |
| `routes/events/schemas.ts` | a união discriminada em Zod + a guarda contra deriva |
| `services/product-event.service.ts` | gravação em lote e o expurgo por idade |
| `POST /api/events` | ingestão pública e anônima, lote de 1 a 20, 30 req/min |

**Anônima por construção.** Não há `userId`, e-mail, IP nem User-Agent: o
`sessionId` é aleatório, de sessão, e não persiste entre visitas. É o que a §4
dos slots exige, e é o que permite a tabela existir sem virar dado pessoal.

**E é por ser anônima que a rota é chata com o corpo.** Não há sessão para
autenticar — a própria §4 proíbe o identificador que serviria para isso —, então
o que separa evento de lixo é o schema: tipo fora do catálogo, `source`
inventado, `sessionId` que não é UUID, `path` com query string, lote vazio ou
acima do teto → 400, e **nada é gravado**.

#### A guarda contra deriva, e o que ela pegou na primeira execução

O tipo em `packages/types` é o que o web escreve; o schema Zod é o que a API
aceita. Os dois descrevem o mesmo contrato em linguagens diferentes, e um campo
acrescentado só de um lado passa pelo build dos dois — aparecendo só como 400 em
produção. `SchemaMatchesSharedType` é uma linha que não gera código nenhum e
falha o `typecheck` no instante em que os dois discordarem.

> **Ela reprovou na primeira execução, e o achado era real.** Eu tinha escrito
> `z.nativeEnum(Category)` importando o `Category` do **Prisma** — que é união de
> literais — contra o `Category` de `packages/types`, que é um `enum` TS e
> portanto nominal: `"TECHNOLOGY"` não é atribuível a `Category`. Aqui não havia
> ponte a fazer: o valor vai para o `payload` JSON, nunca para uma coluna enum.
> O schema passou a validar contra o enum compartilhado, e a ponte entre os dois
> continua onde sempre esteve, no `editorial.mapper`.

#### Duas decisões de escopo, e o motivo de cada uma

- **Sem tabela de agregado diário.** A §4 pede um agregado que sobreviva à
  retenção de 90 dias, mas **hoje ninguém o leria** — e tabela sem consumidor é a
  armadilha da pílula de contagem da Fase 4 em outra forma. Ela entra com a tela
  de métricas de produto que a exibir.
- **Sem instrumentação.** Este PR não chama `track()` em componente nenhum: sem a
  camada e sem consentimento, seria evento que não sai.

Mas a **retenção entrou**, e era o que dava para esquecer: ingestão sem expurgo é
tabela que cresce para sempre. Ela vive na **etapa 8 do pipeline**, junto do
cleanup que já apaga notícia aos 30 dias e briefing aos 90 — mecanismo, não job
manual. Corta por `occurredAt` e não `createdAt`: o que a §4 limita é há quanto
tempo o comportamento aconteceu, não quando a linha chegou.

> **Foi o teste do pipeline que avisou da dependência nova.** O mock do Prisma
> não conhecia `productEvent`, então a etapa 8 lançou e caiu de INFO para WARN —
> exatamente o que aconteceria num ambiente sem a migration aplicada.

#### Um efeito colateral que valia a pena

`AdPlacement` e `AdFormat` **saíram** de `apps/web/lib/ads.ts` para
`packages/types`: o nome da posição viaja no payload de `ad_view` e a API o
valida, então declará-lo nos dois lugares faria um `placement` novo passar pelo
build dos dois e ser recusado em runtime. A tabela de alturas ficou onde estava
— ela é decisão de layout e só o web a usa.

#### Números

- **976 testes** (955 → 976): **558 na API** (+21) e 418 no web, 92 suites.
- A migration foi conferida com `prisma migrate diff` contra um shadow database:
  **"No difference detected"** — o SQL reproduz o schema.
- **Documentação:** seção "Eventos de produto" em `docs/api.md` e em
  `apps/api/CLAUDE.md`, com as regras de vocabulário, de deriva e de retenção.

#### O que vem a seguir

**PR 2 — camada e consentimento** (`lib/analytics/`, `lib/consent.ts`, o banner,
e a instrumentação dos eventos que já têm call site). O consentimento mexe em
toda página, e a camada nasce lendo a decisão: sem decisão, descarta. **PR 3 —
inventário e slots.**

### 27. V2.0 Fase 8 — pré-requisitos: a camada de analytics ✅ Concluído em 2026-08-22

> Branch `feat/v2-analytics-layer`. **PR 2 dos três.** O PR 1 (item 26) deu o
> banco e a rota; este dá o `track()` e liga os oito eventos que já têm ponto de
> disparo.

#### As quatro decisões tomadas antes da primeira linha

Foram perguntadas e respondidas antes de escrever código, porque cada uma muda o
trabalho:

| Questão | Decisão |
|---|---|
| Consentimento | **banner no PR 3**, camada já no PR 2 |
| `search.query` | **enviar, com higiene forte** |
| `subscription_intent` | **fora do PR 2** — o Newra Plus não existe |
| Escopo | **os 8 eventos com call site pronto** |

**O banner no PR 3, e não aqui.** A §5 do doc escreveu "nenhum evento sai antes
da decisão de consentimento", mas o desenho fechou depois: a camada é
*cookieless*, não tem identificador entre sessões e não fala com terceiro. O
tratamento se apoia em legítimo interesse (LGPD art. 7º, IX), e um banner hoje
interromperia a leitura em toda página sem portar decisão nenhuma — a mesma
armadilha do `AdSlot` renderizar caixa vazia sem inventário. O que muda isso é
anúncio personalizado, que é o PR 3. **A camada já nasce obedecendo:** DNT e GPC
são respeitados, um `denied` gravado vale, e quando o banner existir ele só
precisa gravar a decisão.

#### O que entrou

| Peça | Papel |
|---|---|
| `lib/analytics/index.ts` | `track()`, a fila e o transporte |
| `lib/analytics/consent.ts` | a decisão, DNT e GPC |
| `lib/analytics/session.ts` | o `sessionId`, em `sessionStorage` |
| `lib/analytics/sanitize.ts` | a higiene do termo de busca |
| `components/analytics/page-view.tsx` | evento de visualização numa página server |
| `app/api/events/route.ts` | o repasse same-origin |

**Os oito instrumentados:** `homepage_view`, `story_open`, `briefing_open`,
`category_view`, `search`, `favorite_add`, `share`, `newsletter_signup`.

> **O destino é uma rota do próprio Next, e não a API direto.** `sendBeacon` é o
> único transporte que o navegador promete entregar durante uma navegação — que
> é justamente quando o clique mais interessante acontece — e ele **não sabe
> fazer preflight**. Um POST `application/json` para o Render exigiria preflight
> e o beacon falharia em silêncio, sem erro em lugar nenhum. Same-origin, não há
> preflight a fazer.

#### O que o compilador cobrou, e estava certo

`source` e `position` nasceram como props **obrigatórias** nos cards. O
`typecheck` reprovou 13 usos e 30 linhas de teste — que é exatamente o ponto:
prop opcional deixaria um uso novo sem atribuição, e a falta só apareceria na
hora de ler a métrica.

E cobrou um erro de verdade: **`position` não existe no payload de
`briefing_open`**. Eu tinha exigido a prop nos dois cards de briefing, onde ela
não chegava a lugar nenhum — a armadilha do controle sem consequência, em forma
de prop. Saiu dos dois.

#### Três defeitos que a verificação achou

- **O `homepage_view` caiu no ramo errado.** A inserção automática pegou o
  primeiro `container-editorial` do arquivo, que é o do **estado vazio** da
  Home: o evento só dispararia nos dias em que o pipeline não rodou. Agora sai
  nos dois ramos — Home vazia continua sendo uma visita à Home.
- **A regra de "parece chave" descartava palavra longa sem dígito.** O teste de
  truncamento reprovou com 200 letras iguais; a mesma regra descartaria
  "anticonstitucionalissimamente", que tem 29 letras e é palavra de verdade. A
  regra passou a exigir **mistura de letra e dígito**, que é a forma de uma
  chave.
- **A API de produção ainda não serve `/api/events`.** Medido: a migration de
  #122 rodou (`Migrate (produção)`, 16:06 UTC, sucesso), mas
  `POST /api/events` responde **404** no Render três horas depois. A tabela
  existe e o código não subiu — o deploy do backend precisa ser conferido antes
  de o PR 2 medir qualquer coisa em produção. **Não é defeito deste PR**, e o
  proxy se comportou certo: repassou o 404 do backend sem inventar sucesso.

#### A verificação que sustenta o PR

Com o navegador apontado para a API de produção, um clique no hero da Home
produziu este payload no `sendBeacon` — capturado interceptando o transporte:

```json
{ "type": "story_open", "source": "hero", "position": 0,
  "path": "/pt-BR", "locale": "pt-BR", "category": "HEALTH",
  "sessionId": "ead86ed6-…", "occurredAt": "2026-08-22T19:12:18.146Z",
  "storyId": "13a1eaa9-…" }
```

Ele virou **teste na API**: o payload real do navegador, contra o Zod de
verdade, esperando 201. É a única asserção que prova que os dois lados
concordam sobre o formato do fio — as outras testam o schema contra o que o
próprio teste escreveu.

Também conferido no navegador: o `sessionId` está em `sessionStorage` e
**não** em `localStorage`, e o `path` sai sem query string.

#### Números

- **1.000 testes** (976 → 1.000): 558 na API (+1) e **442 no web** (+24), 93
  suites.
- **Documentação:** seção "Analytics" em `apps/web/CLAUDE.md`; a §3 de
  `docs/v2/04-analytics-e-slots.md` deixou de dizer "toggle do coração" — o
  coração virou marcador na Fase 6.

#### O que vem a seguir

**PR 3 — inventário e slots:** ligar o inventário, `ad_view`/`ad_click`, o
banner de consentimento e o `premium-cta`. Antes dele, **conferir o deploy do
Render**: sem `/api/events` no ar, a camada mede para o vazio.

Fora do PR 2, de propósito: os três eventos de scroll (pedem
`IntersectionObserver` novo nas telas de leitura) e `subscription_intent`.

### 28. V2.0 Fase 8 — pré-requisitos: slots, consentimento e profundidade ✅ Concluído em 2026-08-22

> Branch `feat/v2-ad-slots-consent`. **PR 3, o último dos pré-requisitos.** Fecha
> o catálogo em **13 dos 14** eventos.

#### Três decisões, e o motivo de cada uma

- **`subscription_intent` e `premium-cta` ficam de fora.** Não há plano, preço
  nem funil — CTA que não leva a lugar nenhum é a armadilha do controle sem
  consequência. O "reserved inventory" da §28 é atendido por **inventário de
  casa**: a newsletter, que é produto real com funil real.
- **O banner de consentimento é o gate de terceiro, e nasce desligado.** Mesmo
  padrão do `AdSlot`: existe, é testado, e liga com uma variável.
- **Um observador só** para `ad_view` e os três eventos de scroll — é a mesma
  primitiva, e duas implementações da mesma regra divergiriam no primeiro ajuste
  de limiar.

#### O `AdSlot` agora tem três estados, não dois

| `NEXT_PUBLIC_AD_NETWORK` | Consentimento | O que renderiza |
|---|---|---|
| ausente | irrelevante | inventário **de casa** — a newsletter |
| presente | `granted` | o espaço de terceiro, rotulado "Publicidade" |
| presente | qualquer outro | **nada** |

> **Inventário de casa não se chama "Publicidade".** Carimbar assim a promoção
> da própria newsletter seria mentir sobre a natureza do espaço — a mesma regra
> que impede a matéria coletada de ser carimbada como escrita por IA.

> **Rede sem consentimento não cai no criativo de casa.** A posição foi vendida;
> preenchê-la com outra coisa entregaria ao anunciante um espaço que ele pagou e
> não teve.

#### Consentimento: duas funções que discordam de propósito

`isTrackingAllowed` permite com `unset`; `isThirdPartyAllowed` nega. É a
diferença entre os dois tratamentos — medição anônima de primeira parte se apoia
em legítimo interesse, e carregar script que grava cookie e cruza comportamento
entre sites exige consentimento prévio e expresso. Está em duas funções para não
virar um `if` que alguém simplifica.

No banner: **recusar vem primeiro** na ordem de tabulação e tem o mesmo peso
visual, e ele é `dialog` com `aria-modal='false'` — `alertdialog` moveria o foco
à força, tirando do lugar quem está lendo.

#### O que a verificação achou

**Uma fragilidade real no `ScrollDepth`.** O guard do `requestAnimationFrame`
era o id do frame, zerado dentro do callback — o que **só funciona porque o rAF
do navegador é assíncrono**: a atribuição acontece depois dele, e com uma
implementação síncrona ela reescreve o `null` e trava o agendamento para sempre.
O stub síncrono da suite pegou; o guard passou a ser um booleano, que não depende
da implementação.

> **O painel do navegador não compõe frames, e isso é mais amplo do que "o
> screenshot falha".** Medido nesta fase: `requestAnimationFrame` **nunca**
> dispara, eventos de `scroll` **nunca** disparam (mesmo com `scrollY` e o rect
> mudando), e um `IntersectionObserver` novo, num elemento inteiramente visível,
> não recebe callback. `ad_view` e os três eventos de scroll ficaram, portanto,
> **cobertos por teste e não por navegação** — com `IntersectionObserver` e rAF
> de mentira, que é o que torna a regra de permanência verificável.

#### O que a verificação **conseguiu** provar no navegador

Com `NEXT_PUBLIC_ADS_ENABLED=true` e a API de produção:

| Estado | Observado |
|---|---|
| sem rede | dois slots, rótulo "Do Newra News", link para `/pt-BR/newsletter`, **altura reservada = altura real (100px)** |
| rede, sem decisão | banner com "Recusar" antes de "Aceitar", `aria-modal='false'`, foco não roubado, e **zero slots** |
| rede, `granted` | dois slots rotulados "Publicidade", sem criativo de casa, banner não volta depois do reload |

Reserva igual à altura real é a asserção que importa: é CLS zero medido, não
prometido.

#### Números

- **1.025 testes** (1.000 → 1.025): 559 na API e **466 no web** (+24), 96 suites.
- Suites novas: `use-in-view`, `scroll-depth`, `consent-banner`; a de `ad-slot`
  passou de 3 para 8 casos.
- **Documentação:** as duas variáveis de ambiente em `docs/setup.md`, e as
  seções de monetização e consentimento reescritas em `apps/web/CLAUDE.md`.

#### O estado do catálogo

**13 dos 14 instrumentados.** Fora: `subscription_intent`, que espera um plano
pago existir.

#### O que continua pendente, e não é código

**A API de produção segue sem `/api/events`.** Conferido de novo depois do merge
do #123: `POST` responde **404**. O `uptime` da API (3h50m às 19:57 UTC) bate com
o merge do #122 — então o Render **reiniciou** naquele momento e mesmo assim não
serve a rota; `/api/account` responde 401, o que mostra que a build tem a Fase 6.
Enquanto isso não for resolvido no painel do Render, **a camada mede para o
vazio**: os eventos saem, o proxy repassa o 404 e nada é gravado — sem quebrar
nada, que é o caminho testado.

### 29. V2.0 Fase 8 — anúncio cancelado, e a fase reescrita ✅ 2026-08-22

> Branch `refactor/v2-drop-ads`. **Decisão de produto:** o site não exibe
> anúncio. Este item registra o que saiu, o que ficou, e o que a decisão mudou
> no plano.

#### O que saiu

~750 linhas em sete arquivos, mais o vocabulário compartilhado e dois
namespaces de i18n:

| Peça | Por que existia |
|---|---|
| `components/monetization/ad-slot.tsx` | o espaço, com altura reservada e três estados |
| `lib/ads.ts` | inventário, formatos e alturas |
| `components/consent/consent-banner.tsx` | o gate de terceiro |
| `lib/use-in-view.ts` | a regra de viewability (metade por um segundo) |
| 3 suítes de teste | 27 casos |
| `ad_view`, `ad_click`, `AD_PLACEMENTS`, `AD_FORMATS` | o catálogo compartilhado |
| `NEXT_PUBLIC_ADS_ENABLED`, `NEXT_PUBLIC_AD_NETWORK` | as duas chaves |

**A alternativa era deixar dormente, e ela foi recusada com razão.** Código que
ninguém executa é a mesma armadilha do controle que não muda nada: cada mudança
de token, de chave de i18n ou do `cn` teria de mantê-lo verde para sempre, e
quem lesse o repo não distinguiria "ainda vai ligar" de "decidimos não". O git
guarda tudo (PR #124), e a engenharia continua legível nos itens 28 e 29.

**Visualmente não mudou um pixel:** os dois slots da Home já não renderizavam em
produção, porque `NEXT_PUBLIC_ADS_ENABLED` nunca foi ligado lá.

#### Duas consequências que a remoção obrigou a resolver

**1. A máquina de consentimento perdeu quem escrevesse nela.** `readConsent`,
`writeConsent` e o tipo `ConsentDecision` existiam para o banner. Sem ele,
`readConsent` lia uma chave que nada gravava — um `if` que nunca muda de lado.
Saiu tudo; ficou `isTrackingAllowed()`, que respeita **DNT e Global Privacy
Control**.

> Isso deixa o **direito de oposição** com um mecanismo só: o sinal do
> navegador. É o padrão para medição anônima de primeira parte — *cookieless*,
> sem identificador entre sessões, sem terceiro — e está registrado como item em
> aberto caso se queira um controle explícito na interface.

**2. A pasta `monetization/` ficou com um arquivo só.** O `newsletter-cta`
promove a **própria** newsletter: é conteúdo, não inventário. Foi para
`editorial/`, e a pasta deixou de existir — nome de pasta que descreve uma
estratégia cancelada é sinal falso para quem chega depois.

#### O catálogo de eventos: de 14 para 12

`ad_view` e `ad_click` saíram do tipo compartilhado e do Zod da API. Um cliente
antigo que ainda os mandasse recebe **400** — e há teste para isso, porque o
schema é o contrato.

`subscription_intent` **fica**, sem call site: está pronto para o dia em que o
Newra Plus existir, e até lá não finge medir nada.

#### O que a decisão mudou no plano

| Onde | O quê |
|---|---|
| §21 | "Monetização: estratégia proposta" virou "o que fica planejado"; fase 1 **cancelada**, fases 2, 3 e 4 **adiadas** |
| §22 | marcada como **histórica** — existia para decidir onde o anúncio entra antes de fechar o layout |
| §28, Fase 8 | "Monetização" → **"Medição de produto"**, com a tela de métricas como único item aberto |
| `docs/v2/02` | `ad-slot` e `premium-cta` fora do inventário de componentes |

> **"Experiência sem anúncios" saiu da lista do Newra Plus.** Era o item mais
> fácil de vender e o menos honesto — cobrar para tirar um incômodo que o
> próprio site cria. Sem anúncio, não há o que remover.

#### Números

- **998 testes** (1.025 → 998): 559 na API e **439 no web** (−27), 92 suites.
  É a única vez neste projeto em que o número cai, e cair é o resultado certo:
  os 27 casos testavam código que não existe mais.

#### O próximo passo

**A tela de métricas de produto, versão mínima** — entregue no **item 31**. E
ela achou uma contradição neste parágrafo: "sessões recorrentes" **não é
mensurável**, porque o `sessionId` morre ao fechar a aba. O gatilho passou a ser
assinantes ativos e contas.

### 30. O 404 do `/api/events`: não era o Render ✅ 2026-08-22

> Branch `fix/types-runtime-build`. Três PRs atribuíram este 404 ao deploy do
> Render. **Estava errado, e a causa era código.**

#### O diagnóstico, em ordem

1. **O build local produz a rota.** `pnpm turbo build --filter @newranews/api`
   emite `dist/routes/events/` e o `dist/app.js` registra `/api/events`.
2. **O artefato não sobe.** Rodando o mesmo comando do Render
   (`node apps/api/dist/server.js`), o processo morre antes de abrir a porta:
   `ERR_MODULE_NOT_FOUND` resolvendo `@newranews/types`.
3. **A causa.** O pacote tinha `"main": "./src/index.ts"` — código TypeScript —
   e um `build` que era `tsc --noEmit`, ou seja, **não emitia JavaScript**.
4. **Por que só agora.** Até o PR #122 a API só importava `type` desse pacote, e
   import de tipo **some na compilação**. O `product-event.service.ts` e o
   `routes/events/schemas.ts` trouxeram o primeiro import de **valor**
   (`PRODUCT_EVENT_RETENTION_DAYS`, `Category`, `EVENT_SOURCES`), que vira
   `require('@newranews/types')` no `dist`.

#### Por que o sintoma não parecia com a causa

Boot quebrado **não derruba a API**: o Render reprova o health check e mantém a
build anterior servindo. Daí o quadro que confundiu três PRs — `/api/health` em
200, `/api/account` em 401 (a Fase 6 estava lá) e `/api/events` em 404, tudo no
mesmo serviço.

> **E uma inferência minha estava errada.** Eu disse que o `uptime` da API batia
> com o merge do #122, logo ela teria reiniciado sem pegar o código. O plano
> free do Render **hiberna com ~15 min sem tráfego**: quem acordou o serviço
> naquele instante foi o meu próprio `curl`. `uptime` não diz nada sobre deploy.

#### A correção

`packages/types/package.json` passou a seguir o que o `@newranews/database` já
fazia: `main` e `types` apontando para `dist`, e `build` emitindo de verdade.

| Antes | Depois |
|---|---|
| `"main": "./src/index.ts"` | `"main": "./dist/index.js"` |
| `"build": "tsc --noEmit"` | `"build": "tsc"` |

Verificado com o artefato real: `POST /api/events` com lote vazio responde
**400** (o schema rejeitando) e com evento válido chega ao Prisma. Antes, o
processo não abria a porta.

#### A guarda, e por que ela precisava existir

**Nem o `tsc` nem a suíte veem este defeito.** Os testes rodam o **fonte** pelo
resolvedor do Vitest, que entende TypeScript; o `tsc` só checa tipo. Quem executa
o `dist` é o Node puro, e só ele reprova.

`apps/api/tests/build/runtime-deps.test.ts` varre o **fonte** atrás de import
de **valor** de pacote do workspace e exige que cada um publique JavaScript —
`main` com extensão `.js` **e** um `build` que não seja `--noEmit`. Conferido
nos dois sentidos: com a configuração antiga ela reprova; com a nova, passa.

> **A primeira versão varria o `dist` e reprovou no CI** — por um motivo que
> vale guardar: o job de teste roda `turbo test`, cujo `dependsOn: ["^build"]`
> constrói as **dependências** do pacote, não o próprio `apps/api`. Guarda que só
> funciona depois de um build que o CI não faz não guarda nada. A checagem
> passou a ser estática.

#### Números

- **1.000 testes** (998 → 1.000): 561 na API (+2) e 439 no web, 93 suites.

#### O que conferir no próximo deploy

`POST https://newra-news-api.onrender.com/api/events` com `{"events":[]}` deve
responder **400**. Se responder 404, a build no ar ainda é a antiga.

### 31. V2.0 Fase 8 — a tela de métricas de produto ✅ Concluída em 2026-08-22

> Branch `feat/v2-product-metrics`. **Fecha a Fase 8.** Era o único item aberto:
> a camada gravava e ninguém lia.

#### Antes de construir, a confirmação

O item 30 previa conferir o deploy antes de montar a tela sobre suposição.
Conferido em produção:

| Requisição | Resposta |
|---|---|
| `POST /api/events` `{"events":[]}` | **400** — o schema rejeitando lote vazio |
| evento válido | **201** `{"accepted":1}` |
| `source` inventado | **400** |

A rota está no ar e grava. (O evento válido do teste virou a primeira linha
real da tabela.)

#### A contradição que apareceu ao desenhar a tela

O plano dizia que a tela produziria **"o número de sessões recorrentes"** que
destrava patrocínio e Plus. **Ela não pode, e a impossibilidade é por desenho.**

O `sessionId` vive em `sessionStorage` e morre ao fechar a aba — é exatamente
isso que mantém a medição anônima e dispensa consentimento. Saber quem voltou
exigiria identificador persistente, que a §4 dos slots proíbe. Construir a tela
prometendo esse número seria a pílula de contagem da Fase 4 outra vez: um
número que promete o que não entrega.

**O gatilho foi corrigido no plano** para os dois números persistentes que a tela
passou a mostrar: **assinantes ativos** (que é literalmente o que um
patrocinador pede) e **contas criadas** (quem loga volta por definição). Sessões
continuam na tela como **volume**, com a legenda dizendo isso.

#### O que entrou

| Peça | Papel |
|---|---|
| `services/product-metrics.service.ts` | a agregação |
| `GET /api/metrics/product` | admin (JWT + role ADMIN), janela de 1 a 90 dias |
| `app/api/admin/product-metrics/route.ts` | o proxy que assina o JWT |
| `components/dashboard/product-metrics-client.tsx` | a tela, abaixo do painel do pipeline |

A tela responde, na ordem: **audiência** (assinantes, contas, sessões),
**leitura** (aberturas, 25%, 50% e a taxa de leitura completa), **cliques por
origem**, **categorias abertas**, **eventos por tipo** e **buscas sem
resultado**.

> **Uma consulta e a agregação em memória, de propósito.** As alternativas eram
> SQL cru com operadores de JSON — o que menos se consegue testar — ou seis
> `groupBy`, que são seis idas ao banco para uma tela. É a mesma dívida
> consciente da `/api/favorites`, com o mesmo aviso escrito no serviço: vira a
> consulta a otimizar quando a janela trouxer centenas de milhares de linhas.

> **A janela pára em 90 dias porque é a retenção do evento cru.** Uma janela
> maior mostraria queda onde houve **apagamento** — e o leitor concluiria que o
> site perdeu audiência.

#### Decisões menores que valem registro

- **A ordem dos cartões de audiência é deliberada**, e há teste para ela:
  assinante e conta antes de sessão. Quem lê "sessões" primeiro conclui que tem
  audiência recorrente sem ter.
- **Erro e zero não se confundem.** Consulta que falha mostra aviso, não zero —
  a mesma regra do `prefetch` que falha em `undefined`.
- **A janela entra na chave do TanStack Query.** Sem isso, trocar de 30 para 7
  dias mostraria o número anterior enquanto a consulta nova não resolve.

#### O que **não** foi verificado no navegador, e por quê

A tela exige sessão com role ADMIN. Ver o resultado real exigiria forjar um
token de admin contra a **produção** com o segredo do `.env.local` — e isso é
credencial de administrador do sistema no ar, não material de verificação.

Verificado sem credencial: o proxy responde **401 sem sessão**, a rota da API
responde 401/403/200 conforme o papel, a agregação está coberta por nove casos e
a renderização por doze — incluindo o **estado vazio**, que é o de hoje.

#### Números

- **1.026 testes** (1.000 → 1.026): **575 na API** (+14) e **451 no web** (+12),
  95 suites.

#### O que fica em aberto

- **A tabela de agregado diário**, reavaliável em ~90 dias: é quando o expurgo
  começa a apagar evento cru e a comparação entre meses deixa de existir. Entra
  sem retrabalho — o expurgo e a etapa 8 do pipeline já estão lá.
- **A tela nasce mostrando quase zero**, e zero é honesto: a ingestão entrou no
  ar hoje.

### 32. Auditoria de fechamento da Fase 8 ✅ 2026-08-23

> Branch `fix/lighthouse-warmup`. **A fase estava entregue; a auditoria achou um
> defeito operacional e duas derivas de documentação.**

#### O que está no ar, conferido

| Verificação | Resultado |
|---|---|
| `POST /api/events` `{"events":[]}` | **400** — o schema rejeitando |
| evento válido | **201** `{"accepted":1}` |
| `GET /api/metrics/product` sem token | **401** — a rota existe e guarda |
| `data-ad-placement` no HTML da Home | **0** — nenhum slot sobrou |
| Testes locais | 1.026 (575 API + 451 web) |

#### O defeito: o gate media o cold start, não a página

A primeira execução do Lighthouse deu **81** de performance na `/en` — doze
pontos abaixo do piso. O `CLAUDE.md` mandava aquecer e remedir, e foi o que fiz:
a `/en` subiu para 93 e **a `/pt-BR` caiu para 81**. O problema não sumiu,
**migrou para a página que estava fria**.

A causa ficou clara cruzando as rotas:

| Rota | Chama a API? | Score |
|---|---|---|
| `/pt-BR/about` | não | 97, 97 — estável |
| `/pt-BR`, `/en` | sim (`getHome`) | oscila 81 ↔ 94 |

**A API roda no plano free do Render, que hiberna com ~15 min sem tráfego.** As
duas páginas que a consultam regeneram a ISR sob demanda, e a requisição que
dispara a regeneração espera a API acordar. Medido: **4,9 s na primeira passada
contra 0,22 s na terceira**.

Ou seja: **o gate semanal de segunda 09:00 UTC ia reprovar por infraestrutura**,
e num horário em que ninguém está olhando — exatamente quando a API está há
horas dormindo.

#### A correção é mecanismo, não instrução

O `CLAUDE.md` mandava um humano aquecer o site **desde a Fase 6**. Passo que
depende de alguém lembrar não roda na segunda às 09:00.

O workflow ganhou o passo **"Warm production before measuring"**: duas passadas
em cada URL, lidas do próprio `.lighthouserc.json` (para as duas listas não
derivarem), com `curl -f` para uma rota quebrada falhar alto em vez de ser
aquecida e depois medida como score ruim.

**Provado na própria branch:**

| Rota | Performance | Acessibilidade | Best practices | SEO |
|---|---|---|---|---|
| `/pt-BR` | 92 | 100 | 100 | 100 |
| `/pt-BR/news` | 90 | 100 | 100 | 100 |
| `/pt-BR/article` | 97 | 100 | 100 | 100 |
| `/pt-BR/about` | 97 | 100 | 100 | 100 |
| `/en` | 91 | 100 | 100 | 100 |

Gate verde, ninguém em 81. **A `/news` em 90 raspa o piso** — fica registrado
para não ser confundido com o aquecimento se cair.

#### As duas derivas de documentação

- **`apps/api/CLAUDE.md`** dizia que a tabela de alturas "ficou em
  `apps/web/lib/ads.ts`" — arquivo removido no item 29.
- **`docs/v2/04-analytics-e-slots.md`** ainda listava `ad_view` e `ad_click` no
  catálogo (são doze eventos, não catorze) e descrevia a Parte 2 como
  especificação corrente. Ela virou **histórica**, com a lição que sobrevive:
  espaço reservado antes de o conteúdo chegar é o que protege o CLS — aplicado
  hoje no `story-image` e no `story-card`, sem anúncio nenhum.

#### A baseline visual não foi recapturada, e não por esquecimento

A Fase 8 **não mudou um pixel de rota pública**: os dois `AdSlot` da Home já
não renderizavam em produção (`NEXT_PUBLIC_ADS_ENABLED` nunca foi ligado lá) —
medido, zero `data-ad-placement` no HTML — e o `newsletter-cta` só trocou de
pasta. Recapturar agora traria só a diferença de conteúdo do dia, que é ruído.

#### Estado do projeto após a auditoria

**Fases 0 a 8 concluídas.** A próxima é a **9 (Backend review)** — a antiga
"Fase 9 — Release" virou quatro fases no item **33**.

---

### 33. A Fase 9 virou quatro — o plano das fases finais ✅ 2026-08-23

> Branch `docs/v2-final-phases`. **Nenhuma linha de código de produto.** A §28 do
> plano fechava com uma fase de oito itens de checklist ("Fase 9 — Release") e
> passou a ter quatro fases planejadas: **9 (backend review)**, **10 (frontend
> review)**, **11 (integração geral)** e **12 (ajustes finos e release final)**.

#### Por que quatro

Os oito itens da Fase 9 original eram todos de *verificação de saída* —
regressão visual, QA, Lighthouse, smoke, SEO, analytics, canary. Nenhum olha
para dentro do que oito fases construíram, e **os quatro defeitos mais caros
deste projeto não seriam achados por nenhum deles**: o schema que descartava o
que o serviço carregava (Fase 5), a imagem OG inalcançável (Fase 7), o pacote
que compilava sem emitir JavaScript (Fase 8) e o gate medindo cold start (item
32). Três dos quatro já estavam **em produção** quando foram achados.

#### A anatomia, e a camada obrigatória

Cada fase de revisão abre com **inventário fechado** (senão não tem critério de
parada) e fecha com a regra de triagem: **todo achado sai como correção
mergeada, guarda no CI, ou dívida com gatilho numérico** — nunca como item de
lista.

Sobre isso, **duas trilhas obrigatórias em todas as quatro fases**: o eixo `S`
(segurança) e o eixo `T` (testes e guardas), com duas regras próprias:

- **achado de segurança não vira dívida sem aceite de risco escrito** — qual é o
  risco, quem aceita, o que mudaria a decisão;
- **todo achado de segurança sai com o teste que o mantém fechado** — o
  `runtime-deps.test.ts` é o modelo: não conserta nada, impede que volte.

A superfície é dividida para não haver sobreposição nem buraco: **9** cuida do
servidor, **10** do navegador, **11** da costura, **12** do gate. Nenhum dos dois
eixos é adiável para a fase seguinte.

#### O que a análise já achou, planejando

Não era o objetivo, mas a varredura para montar o inventário achou quinze coisas
verificadas. As que mais pesam:

| Achado | Fase | Como foi verificado |
|---|---|---|
| **O site não tem cabeçalho de segurança nenhum** — a API tem o conjunto do helmet | 10.S | medido em produção |
| **O feed RSS escreve no mesmo canal das instruções da IA** — sem delimitador, sem escape, e a saída publica sozinha | 9.S | leitura de `ai-prompts.ts` + `formatNewsItems` |
| **116 advisories** (`pnpm audit`), **102 em produção, 40 high** — `next` só corrigido na 15, `fastify` na 5 | 9.S/10.S | `pnpm audit --prod` |
| `POST /api/auth/upsert` no código e ausente da `docs/api.md` (34 rotas × 32 documentadas) | 9.1 | comparação rota a rota |
| Sem `trustProxy` e com todo tráfego server-side saindo da Vercel, o balde de rate limit **pode ser um só** — o teto de 30/min da `/api/events` viraria teto global de ingestão | 9.S | **hipótese**, com experimento definido |
| CORS permite só `GET`/`POST`, e existem 2 PUT + 2 DELETE — funcionam por passarem pelo BFF | 9.S/11.S | leitura + contagem de rotas |
| `render.yaml` não declara `AUTH_JWT_SECRET` nem `ADMIN_EMAILS` | 11.7 | leitura do blueprint |
| Nenhuma chamada `fetch` do web tem timeout, com a API hibernando no plano free | 11.2 | varredura por `AbortSignal`/`timeout` |
| Playwright instalado, **sem config e sem uma única spec** | 11.T | `find` por `playwright.config` e `*.spec.ts` |
| `@newranews/web` sem `test:coverage` — o piso de 70% do CI mede só a API | 10.T | leitura do `package.json` |
| §26 promete **error rate, API latency e cache hit rate**; nenhuma instrumentação existe | 9.5/11.3/13.2 | varredura por `onResponse`, `latency`, `p95` |
| 53 de 75 componentes são `'use client'` (21 de 28 na camada editorial) | 10.1 | contagem |
| Baseline com 6 imagens escuras em 3 rotas; **9 rotas sem referência dark** | 10.3 | contagem em `docs/v2/baseline-v2/` |
| `remotePatterns: hostname: '**'` — otimizador de imagem aberto a qualquer host | 10.6 | leitura do `next.config.js` |
| Zero tags e nenhum CHANGELOG; README com capturas e texto da V1 (16/08) | 13.4 | `git tag` + `ls docs/screenshots` |

**Uma coisa saudável, registrada de propósito:** o `article-body` não é um
renderizador de Markdown — devolve nós de React —, e a decisão tomada por peso
de bundle **também é a mitigação de XSS** do texto gerado por IA. Isso precisa
estar escrito, porque trocar por `react-markdown` um dia perderia a propriedade
junto.

#### A varredura de dependência mudou o cronograma

O plano original punha a varredura na fase de release, como gate. Rodada em 23/08, ela
devolveu **40 advisories high em dependências de produção**, e dois deles só se
resolvem em **major de framework** (`next` 14 → 15, `fastify` 4 → 5). Major de
framework na fase de ajuste fino seria mexer na fundação depois de as três
revisões terem certificado o que está em cima. A medição passou para **9.S** e
**10.S**; a **13.S** ficou com o gate.

#### Certificação de que a Fase 9 pode abrir

Rodado nesta branch, em 23/08:

| Verificação | Resultado |
|---|---|
| `turbo lint` + `turbo typecheck` | **10 tarefas, 0 falhas** |
| `turbo test` (API, sem cache) | **575 testes em 45 suítes** |
| `turbo test` (web) | **451 testes em 50 suítes** |
| `turbo test:coverage` (API, sem cache) | **98,03% stmts · 93,48% branch · 98,76% funcs** |
| `turbo build` | **4 tarefas, 0 falhas** |
| `GET /api/health` em produção | **200** |
| `origin/main` | PR #129 mergeado (`3e60b61`) |

**1.026 testes verdes, build limpo, produção no ar.** A Fase 9 abre sem dívida
de suíte herdada.

#### Correções de deriva incluídas

- A §28 marcava a **Fase 8 como "🔶 em andamento"** com a tela de métricas
  desmarcada, embora ela esteja concluída desde 22/08 e auditada em 23/08.
  Passou a ✅, com os itens 31 e 32 referenciados no checklist.
- A §29 ganhou as quatro branches novas (`review/v2-*`, `release/v2.0`) e a
  regra de que, em fase de revisão, **a branch é guarda-chuva e cada eixo sai em
  PR próprio** — com `S` e `T` sempre separados.

#### Onde ficou

- **O plano das quatro fases:** `docs/Newra-News-V2-Frontend-Redesign-Plan.md`,
  §28 — "As quatro fases finais", com "Anatomia de uma fase de revisão", "A
  camada de segurança e testes" e uma seção por fase.
- **A ordem:** 9 ‖ 10 → 11 → 12, em "Ordem, paralelismo e branches".

---

### 34. V2.0 Fase 9 — Backend review ✅ Concluída em 2026-08-23

> Branch `review/v2-backend`. Os seis eixos da §28 fechados: **9.1** (contrato
> HTTP), **9.S** (segurança do servidor), **9.3** (dados e consultas), **9.4**
> (pipeline), **9.5** (observabilidade) e **9.T** (testes e guardas).
>
> **575 testes em 45 suítes → 728 em 54.** Cobertura da API: 98,03% → **98,71%
> stmts**, 93,48% → **93,32% branch**, 98,76% → **99,45% funcs**. Advisories de
> produção em `apps/api`: **21 → 6** (16 high → 3); no repo inteiro, 102 → 83
> (40 high → 25).

#### 9.S — o balde de rate limit era um só para a internet inteira

**A suspeita mais séria do plano, confirmada por medição em produção.** Três
requisições com `X-Forwarded-For` diferentes na mesma janela de 60s devolveram
`x-ratelimit-remaining` **98, 97 e 96** — um contador só. Sem `trustProxy`, o
Fastify usa o peer do socket como `request.ip`, e atrás do proxy do Render o
peer é o proxy.

A consequência era exatamente a que a §9.S previu, e silenciosa: todo o tráfego
server-side sai da Vercel, e a ingestão de eventos passa pela rota
`/api/events` do Next. Com balde único, o teto de 30/min daquela rota era **teto
global de ingestão**, e a tela de métricas que fechou a Fase 8 subcontaria sem
sinal nenhum — 429 num `sendBeacon` não tem retorno que o cliente leia.

`trustProxy: 1`, e não `true`: `true` confia na ponta **esquerda** do
`X-Forwarded-For`, que é escrita pelo cliente, e escapar do limite seria mandar
um IP novo por requisição. Com `1`, só o último hop conta. As três guardas estão
em `tests/security/server-hardening.test.ts`, e a primeira delas foi verificada
reprovando com o `trustProxy` removido.

#### 9.S — o feed escrevia no mesmo canal das instruções da IA

Sem delimitador, sem escape, e a saída **publica sozinha** (Stage 7 persiste,
7.5 manda e-mail aos assinantes, a Home exibe). A revisão não resolveu o
problema inteiro — decidiu a fronteira, em três camadas:

1. **fronteira declarada** — o material vai entre `MATERIAL_START` e
   `MATERIAL_END`, e o system prompt manda tratar tudo ali como dado, nunca como
   instrução;
2. **o material não falsifica a fronteira** —
   `neutralizeMaterialDelimiters` neutraliza um delimitador escrito dentro de um
   item (o único ataque que é *bypass* e não persuasão) e some com a quebra de
   linha, que é como se falsifica o rótulo de campo do item seguinte;
3. **a saída fora do formato é recusada** — `parseMarkdownResponse` aceitava
   qualquer coisa: sem `# `, pegava a primeira linha não vazia como título e
   seguia em frente. Uma resposta que obedecesse ao material em vez das
   instruções virava briefing publicado com o pipeline registrando sucesso.

**O que a camada 2 deliberadamente não faz:** filtrar frases suspeitas. Lista de
palavra proibida em texto jornalístico é falso positivo garantido — uma matéria
*sobre* injeção de prompt seria a primeira censurada — e não fecha nada, porque
a mesma ordem se escreve de mil maneiras. Há teste para isso também.

A montagem do prompt saiu dos dois providers para `buildArticleUserPrompt`: cada
um fazia `ARTICLE_USER_PROMPT + formatNewsItems(items)` por conta própria, e um
terceiro provider nasceria sem o fechamento do bloco — que é a condição que a
fronteira existe para impedir. O sufixo entra no hash de
`ARTICLE_PROMPT_VERSION`, senão mexer na fronteira não mudaria a versão gravada
e dois briefings sob regras diferentes ficariam indistinguíveis.

#### 9.S — os outros cinco achados

| Achado | O que era | O que ficou |
|---|---|---|
| `purpose` do JWT | conferido **dentro** do handler do `/api/auth/upsert` e ignorado nas outras; o token de upsert passava no `/api/favorites` | conferência no plugin, **simétrica** (a sessão recusa `purpose`, o upsert recusa a sessão). Nenhuma ponta do frontend mudou — o BFF já assinava a sessão sem `purpose` |
| `/dev/dashboard` | aceitava o `JOB_SECRET` por `?secret=` — log de acesso, histórico, `Referer` | POST com o segredo no corpo; o que fica no browser é uma **assinatura com prazo** em cookie `HttpOnly`, nunca o segredo |
| erro 500 | devolvia `error.message` de qualquer erro (nome de tabela, trecho de SQL, string de conexão em falha de Prisma) e **não logava nada** | frase fixa + `x-request-id`; o erro inteiro vai para o log |
| CORS | `['GET', 'POST']`, com 2 PUT e 2 DELETE registrados | declara o que existe, com guarda que compara a lista com o roteador |
| CSP | `contentSecurityPolicy: false` | `default-src 'none'`, que é a que cabe num JSON; a única página HTML declara a sua, por nonce |

Além deles, montar a matriz de autorização (9.T) achou **`GET /api/jobs/:pipelineId`
público** devolvendo `log.error` — a mensagem crua da falha do pipeline. É o
mesmo vazamento que o error handler fechou para o 500, por outra porta. Fechar
não custou acesso: o `pipelineId` só existe na resposta do disparo, que já
exigia o segredo. E havia **três cópias** da checagem do `JOB_SECRET`, duas
delas sem passar pelo `assertJobSecret` — que agora compara em tempo constante.

#### 9.S — advisories: 21 → 6, e o aceite de risco das que sobram

`pnpm audit --prod` filtrado por `apps/api`. Overrides de `fast-uri`,
`brace-expansion` e `yaml` — todos patch/minor — fecharam 15 das 21, sendo 13
**high**. As seis restantes, com o aceite escrito que a §28 exige:

| Advisory | Risco hoje | O que mudaria a decisão |
|---|---|---|
| `fastify` — bypass de validação por `content-type` com tab (**high**) | **mitigado**: `content-type` com caractere de controle é recusado com 415 na porta, antes de o parser ser escolhido. Guarda em `tests/security/content-type-bypass.test.ts` | a major `fastify@5`, que é dívida da Fase 13 |
| `fastify` — DoS em `sendWebStream` (low) e spoof de `request.protocol`/`host` (moderate) | a API não usa `sendWebStream`; `protocol`/`host` não decidem nada, e o `trustProxy: 1` limita o alcance a um hop | idem |
| `find-my-way` — DDoS com HTTP/2 (**high**) | **não alcançável**: a API não serve HTTP/2 (`buildApp` não passa `http2`) | servir HTTP/2 |
| `@fastify/static` × 2 — travessia de caminho e bypass de route guard (**high**/moderate) | **não alcançável em produção**: o pacote só entra pela UI do Swagger, que deixou de ser registrada em produção nesta fase | reabrir a UI em produção, ou `@fastify/swagger-ui` passar a suportar `@fastify/static@10` |

> **Quem aceita:** Pedro Levi, 23/08/2026. As três da `fastify` saem juntas na
> major da Fase 13; as três de alcance zero saem quando o alcance mudar.

#### 9.1 — a `docs/api.md` documentava 32 rotas e o roteador registrava 34

`POST /api/auth/upsert` — a rota pela qual **todo usuário é criado** — não
estava escrita em lugar nenhum. Documentada, junto com o escopo do `purpose`.

Mas a saída do eixo não é a correção, é a guarda, e são duas:

- **`api-docs-drift.test.ts`** enumera o roteador e exige que cada rota apareça
  na `docs/api.md`, e que o documento não descreva rota que sumiu. A terceira
  asserção é a que segura as outras duas: um parser que devolvesse vazio faria
  as duas passarem para sempre.
- **`response-schema-contract.test.ts`** confere o schema de resposta contra **a
  coluna do Prisma**, e não contra o `select` do serviço. É a guarda que não
  existia quando o `articleItemSchema` da V1 descartou os campos de auditoria e
  as 15 fontes que o serviço já carregava. Coluna nova reprova até alguém
  decidir se ela sai na resposta ou entra na lista de omitidas — com o motivo
  escrito.

O `servers` do OpenAPI anunciava `http://0.0.0.0:3001` em produção, que é o bind
e não é endereço de ninguém. Passou a sair de `API_PUBLIC_URL`, e a **UI**
deixou de ser registrada em produção — o documento continua sendo gerado sempre,
porque é dele que as guardas leem.

#### 9.3 — as quatro migrations nunca tinham rodado do zero

O banco local está baselinado com `migrate resolve`, que marca como aplicada sem
executar o SQL; produção recebeu `migrate deploy` uma vez, sem ninguém comparar o
resultado. O replay em banco limpo (23/08): as quatro aplicaram, e
`prisma migrate diff` contra o `schema.prisma` devolveu **"No difference
detected"**.

O replay também virou fato o que era conhecimento oral: o índice único de
`News.sourceUrl` **existe** no que as migrations produzem e **não existe** no
banco local — 5 índices contra 4. É por isso que só o ambiente de
desenvolvimento acumula título repetido.

O replay não cabe no CI (a suíte roda sem banco, de propósito), então ficou
guarda **estática** em `tests/build/migrations.test.ts`: `migration.sql` não
vazio, sem saída de CLI colada dentro — o defeito que a Fase 0 achou —,
`migration_lock.toml` com provider, e a constraint única presente.

**Índices × consultas que de fato rodam.** Medido contra produção: **6.221
notícias**, **513/dia**. Com a retenção de 30 dias, o teto do acervo é ~15.400
linhas — `News` é tabela **limitada**, não crescente. O plano da listagem com
filtro de categoria é `Index Scan Backward` no `publishedAt` com filtro, e nesse
tamanho não há índice faltando. O composto `(category, publishedAt)` entra
quando a retenção crescer ou o volume diário dobrar, e não antes.

#### 9.4 — o dia em que o pipeline não roda

As quatro perguntas da §9.4, agora com teste
(`tests/services/pipeline-degraded.test.ts`, 17 asserções):

- **se a etapa 6 falha, a 8 não roda** — e isso é o certo: no dia sem briefing o
  cleanup **não apaga acervo** de um produto que já está degradado. As notícias
  do dia entram assim mesmo (a 4 vem antes da 6), o run é marcado `FAILED` com
  `errorStage: 6`, e feed vazio aborta na 5 em vez de mandar o modelo inventar o
  dia;
- **falha não-crítica não derruba o resto**: newsletter que estoura não impede
  cleanup nem métricas, cleanup que estoura não impede renormalização, e o run
  fecha `SUCCESS`. A newsletter não conta como `pipelineError` e o cleanup
  conta — distinção de produto, não de código;
- **idempotência**: o `findFirst` cobre `SUCCESS` e `RUNNING` no mesmo predicado
  (dois runs simultâneos disputariam o mesmo `upsert` do dia), o `skipDuplicates`
  se apoia na constraint única, e as fontes do briefing são substituídas na
  **mesma transação** — sem isso, uma falha entre o delete e o create deixaria o
  briefing sem fonte nenhuma;
- **retenção**: os quatro números (News 30d, PipelineLog 30d, Article 90d,
  ProductEvent 90d por `occurredAt`) têm teste. Quatro documentos os descrevem;
  este é o único que reprova quando o código discordar.

Do lado da Home, o dia sem artigo com acervo cheio: `briefing: null` e o resto
desenha. O schema declara `nullable()` — se não declarasse, a rota devolveria
500 num dia em que o produto só estava degradado.

#### 9.5 — medir, e não riscar

A §26 promete **error rate** e **API latency**, e não havia instrumentação
nenhuma: observabilidade rica do *pipeline*, zero da *API como serviço*. A §9.5
punha a decisão como bifurcação. **Medir saiu mais barato que riscar**: um
`onResponse`, um contador por padrão de rota e um histograma por bucket, mais o
`x-request-id` em toda resposta (o que liga o relato de fora à linha do log,
agora que o 500 não conta mais o que aconteceu).

`GET /api/metrics/http` (admin) devolve error rate, taxa de 4xx, p50/p95/p99/max
e a lista por rota. **Nada é persistido**, e o preço está escrito na resposta:
`since` e `uptimeSeconds` dizem de quanto tempo a janela fala, porque um
`errorRate: 0` logo depois de um deploy pareceria saúde e seria só ausência de
amostra.

> **O gatilho para persistir:** mais de uma instância no Render, ou a primeira
> pergunta que exija comparar duas semanas. Antes disso, uma escrita no Prisma
> por requisição para responder algo que se pergunta uma vez por semana é a
> tabela sem leitor de novo.

#### 9.T — o que os testes afirmam, não a porcentagem

- **A matriz de autorização** (`tests/security/authorization-matrix.test.ts`):
  rota × anônimo × sessão × admin × `JOB_SECRET` × token de upsert. O que a
  torna guarda e não documentação é ser **exaustiva sobre o roteador** — o
  último teste enumera as rotas registradas e exige linha para cada uma. Rota
  nova sem decisão de autorização reprova o CI. Foi montá-la que achou o
  `GET /api/jobs/:pipelineId`.
- **Uma correção de harness que valia mais que um achado:** as guardas de escopo
  do `purpose` estavam passando **pelo motivo errado**. O `env` é lido na carga
  do módulo, então setar `AUTH_JWT_SECRET` num `beforeAll` chega tarde,
  `verifyAuthJwt` recusava todo token por "auth não configurada", e o 401 vinha
  de graça. Teste que passa pelo motivo errado é pior que teste ausente: o `env`
  virou mock e há asserção de caminho feliz provando que o harness exercita o
  que diz exercitar.
- **`GET /api/news` nunca serializou uma linha.** `listNews` estava mockado em
  `{ data: [], total: 0 }` na suíte inteira, então a rota mais chamada do produto
  passava sempre por `data: []`. Com a lista vazia, a suíte não podia achar a
  versão daquele defeito da Fase 5 nesta rota.
- **Onde estavam os 6% que faltavam**, medido e não estimado: `env.ts` 64% (o
  `process.exit(1)` do boot, que não roda em processo de teste),
  `daily-pipeline.job.ts` 84% (o callback de erro do cron), uma linha
  inalcançável do histograma — e `src/providers/types.ts`, um arquivo **só de
  `interface`** que não emite JavaScript e era medido como 0% sobre 18 linhas
  inexistentes. Excluído por não ter o que cobrir; é a única exclusão desse
  tipo, por arquivo e não por padrão.

#### As duas dívidas ganharam o número que faltava

A §9.3 pedia que elas deixassem de ser frase:

- **`/api/favorites` resolve os salvos inteiros antes de paginar.** É o que faz
  o `meta.total` prometer o que a lista mostra. O ponto em que dói é **~5.000
  salvos numa conta**: aí o `IN` da hidratação carrega 5 mil ids para devolver
  20 linhas. E é observável sem instrumentação nova — `GET /api/account` já
  devolve `saved: { news, articles }`.
- **`/metrics/product` agrega em memória a partir de uma consulta só.** O ponto
  em que dói é **~200.000 linhas na janela de 90 dias** (≈60 MB de objetos numa
  requisição, num plano de 512 MB) — o que, a ~4 eventos por pageview, são
  **~550 pageviews/dia**. Abaixo disso, uma consulta e uma agregação em memória
  custam menos que seis `groupBy`.

#### Verificação

| Verificação | Resultado |
|---|---|
| `pnpm lint` (monorepo) | 5 tarefas, 0 falhas |
| `pnpm build` (monorepo) | 4 tarefas, 0 falhas |
| `pnpm test` (monorepo) | 4 tarefas, 0 falhas |
| `pnpm test` (API) | **728 testes em 54 suítes** |
| `pnpm test:coverage` (API) | **98,71% stmts · 93,32% branch · 99,45% funcs** |
| `pnpm audit --prod` (`apps/api`) | **21 → 6** advisories (16 high → 3) |
| replay das 4 migrations em banco limpo | aplicadas; `migrate diff` = "No difference detected" |
| balde de rate limit em produção | **medido**: 98 / 97 / 96 com XFF distintos — balde único, confirmado |

#### Verificação contra produção, pós-merge (24/08/2026)

O ritual do `CLAUDE.md`, contra o site no ar. **A primeira sondagem pegou o
deploy no meio do voo** — `/api/metrics/http` devolveu 404, que é a assinatura
da build antiga ainda servindo. Três minutos depois, tudo no lugar:

| Sonda | Resultado |
|---|---|
| `GET /api/metrics/http` | **401** — a rota existe e exige admin (404 seria a build antiga) |
| `GET /api/jobs/:pipelineId` | **401** — era pública e devolvia a mensagem crua da falha |
| `GET /api/docs` | **404** — a UI do Swagger não é servida em produção |
| headers de `/api/health` | `content-security-policy: default-src 'none';…` e `x-request-id` |
| `x-request-id` de entrada | **ecoado** (`prova-da-fase-9`), e gerado quando não vem |
| preflight de `DELETE /api/favorites/...` | **204**, `allow-methods: GET, POST, PUT, DELETE, OPTIONS` |
| `content-type` com TAB em `POST /api/events` | **415** |

> **O TAB no fim do valor devolve 400, e não é falha da guarda:** o `curl` apara
> espaço em branco à direita do header antes de enviar, então o caractere nunca
> sai da máquina. Com o TAB no meio (`application/json;\tcharset=utf-8`) a
> resposta é 415, como manda o teste.

**O balde de rate limit, medido de novo — e o resultado é o oposto do de antes.**
Antes do merge, três requisições davam `remaining` 98, 97, 96: perfeitamente
monotônico, porque a chave era uma só para todo mundo. Depois do merge, oito
requisições seguidas deram `99, 98, 98, 97, 96, 95, 97, 96` — **duas sequências
interleaved**. E o `uptime` do `/api/health` cresceu continuamente no mesmo
intervalo (167,4 → 170,1 s), o que descarta a explicação de duas instâncias:
**é um processo só, com duas chaves diferentes**, porque o IP de saída desta
máquina alterna num pool de NAT. A chave deixou de ser global e passou a
acompanhar o cliente, que é exatamente o que a correção fez.

> Uma medição de duas máquinas em redes diferentes continua sendo o teste
> canônico, e ela não é possível a partir de um host. Quem mantém isso fechado é
> a guarda do CI, verificada reprovando com o `trustProxy` removido.

**`API_PUBLIC_URL` não é verificável de fora**, porque a UI do Swagger deixou de
ser servida em produção — e é justamente por isso que **não bloqueia nada**: sem
a variável, o `servers` volta a anunciar o bind, num documento que produção não
expõe. Ela só passa a importar no dia em que a UI for reaberta.

#### O gate do Lighthouse, e o que ele escondia

`92 · 81 · 97 · 97 · 90`, e **verde**. A `/news` nove pontos abaixo do piso com
a execução passando: o LHCI faz assert **otimista** por padrão — confere a
melhor das três execuções (90) — enquanto o passo "Print scores" imprime a
representativa (81). Dois números para a mesma pergunta, e o gate sempre conferia
o mais generoso. Corrigido para `aggregationMethod: median`.

**E a causa da `/news` não é o que o `CLAUDE.md` mandava suspeitar.** O
aquecimento funcionou (0,16–0,56 s por rota, sem sinal de hibernação), e o audit
da execução ruim diz: **56 requisições na página, zero para a API**, a mais lenta
sendo o próprio documento em 214 ms. O que derruba o score é o **LCP de uma
`<img>` de card, em 4.390 ms**, servida por `/_next/image` a partir de
`s2-valor.glbimg.com`; os audits que caem são `uses-responsive-images` e
`image-delivery-insight`. É **entrega de imagem — §10.6**, e está roteado para
lá com a medição pronta.

**A correção foi provada offline, contra os artefatos da execução que passou
verde.** Mesmos 15 relatórios, dois configs:

```
config antigo (otimista):  All results processed!                    exit 0
config novo   (mediana):   × categories.performance failure          exit 1
                             expected: >=0.9
                                found: 0.89
                             all values: 0.89, 0.9, 0.81
```

Vale reparar no número: a mediana verdadeira da `/news` naquele run é **0,89** —
o "81" que a tabela imprimia é a execução *representativa*, que é um terceiro
número ainda. Os três discordavam, e só um deles decidia o gate.

> **A execução seguinte, já com a mediana, passou** — `92 · 90 · 97 · 99 · 92`,
> com a `/news` em exatamente 90. Não é contradição: é o que significa raspar o
> piso. A mediana da `/news` oscila entre 89 e 90, então **o gate vai reprovar
> de forma intermitente** até a §10.6 fechar. Intermitência aqui é sinal, não
> ruído: ela mede o quanto a rota depende de uma imagem de terceiro chegar a
> tempo.

A dispersão entre as três execuções, que a tabela de uma linha por rota
escondia:

| Rota | execuções | representativa | chama a API? |
|---|---|---|---|
| `/pt-BR` | 60, 90, 92 | 92 | sim |
| `/pt-BR/news` | 89, 90, 81 | 81 | não (ISR) |
| `/pt-BR/article` | 98, 96, 97 | 97 | não |
| `/pt-BR/about` | 98, 97, 97 | 97 | não |
| `/en` | 79, 92, 90 | 90 | sim |

---

### 35. V2.0 Fase 10 — Frontend review ✅ Concluída em 2026-08-24

> Branch `review/v2-frontend`. Os sete eixos da §28 fechados. **Onze achados**,
> todos saindo como correção mergeada ou guarda no CI — e **duas propostas do
> próprio plano medidas e derrubadas**, que é o que uma fase de revisão deveria
> produzir tanto quanto correção.

#### Inventário, conferido na abertura

| O que | Quanto |
|---|---|
| páginas | 15 (rotas `[locale]`) |
| componentes | 75, dos quais **52** são `'use client'` |
| módulos de `lib/` | 21 |
| rotas de BFF | 12 |
| chaves de i18n | 337 por locale, **paridade exata, zero órfã** |
| baseline visual | 12 rotas × 3 larguras — **43 imagens, 6 escuras** |
| suítes / testes | 50 / 451 |

**First-load JS por rota**, lido do build (compartilhado: 87,3 kB):

| Rota | First Load JS | | Rota | First Load JS |
|---|---|---|---|---|
| `/about` | **87,5 kB** | | `/admin/metrics` | 137 kB |
| `/newsletter/unsubscribe` | 98,7 kB | | `/admin` · `/signin` · `/article` | 139 kB |
| `/newsletter` | 122 kB | | `/[locale]` | 146 kB |
| `/account/newsletter` | 128 kB | | `/account` · `/favorites` | 156 kB |
| `/account/preferences` | 129 kB | | `/news` | 164 kB |
| | | | `/article/[date]` · `/news/[id]` | 166–167 kB |

#### 10.S — o site não tinha cabeçalho de defesa nenhum

A assimetria que o item 33 já apontava, agora corrigida: a API carrega o
conjunto do helmet desde a Fase 2 e uma CSP de verdade desde a Fase 9; o site
respondia **sem** `x-content-type-options`, `x-frame-options`,
`referrer-policy`, `cross-origin-opener-policy` e CSP. O que torna isso
reincidente é que **nada acusa** — sem `headers()` o build passa, o lint passa,
a suíte passa e as 15 páginas renderizam igual. Só um `curl -I` sabe.

**A CSP foi decidida medindo, não supondo.** O HTML de produção da Home tem
**63 scripts inline**: um é o `theme-init` (constante, hashável), um é o
`ld+json`, e os **61 restantes são chunks de Flight do App Router**, cujo
conteúdo é o payload daquela página — muda por rota e por regeneração da ISR.
Hash não fecha conjunto que muda; nonce fecharia, mas exige cabeçalho por
requisição, e ler `headers()` numa página do App Router a torna dinâmica.
Seriam as 15 páginas estáticas trocadas por render sob demanda para endurecer
uma diretiva. `script-src` fica com `'unsafe-inline'` e **a razão está escrita**.

O que sobra ainda paga: sem curinga nem `https:` no `script-src`, um
`<script src>` injetado não executa; `object-src 'none'` mata plugin;
`base-uri 'self'` mata sequestro por `<base>`; `frame-ancestors 'none'` mata
clickjacking.

Verificado contra um build de produção servido localmente: os seis cabeçalhos na
resposta de seis rotas, **zero evento `securitypolicyviolation`**, o script de
tema executando, 26 imagens carregando pelo otimizador e um `fetch` do navegador
para a API passando pelo `connect-src`.

#### 10.S — uma CLI de scaffolding estava na árvore de produção

O `shadcn` estava em `dependencies` e **nenhuma linha do produto o importa** —
é a CLI que gera componente. Dali ele arrastava `@modelcontextprotocol/sdk`,
`express`, `hono`, `ts-morph` e `@dotenvx/dotenvx` para a árvore de produção, e
toda advisory dessa subárvore contava como advisory de produção deste app.

**`pnpm audit --prod`: 83 → 36**, com 10 das *high* indo junto.

A guarda é o formato exaustivo que a Fase 9 firmou: **dependência de produção ⇒
consumidor declarado**, uma linha cada. Dependência nova reprova a suíte até
alguém escrever quem a importa em runtime — e escrever a linha é o que expõe o
"ninguém".

#### 10.S — o aceite de risco das 8 advisories *high* do `next`

As 21 advisories restantes do `next` só têm correção em **15.x**, que arrasta
`next-intl` 3 → 4 e `params` assíncrono nas 15 páginas. É fase própria, não item
de revisão — então é dívida com aceite escrito. **O que torna o aceite honesto é
que nenhuma das oito alcança esta configuração**, e cada "não alcança" é uma
afirmação sobre o código:

| Advisory | Por que não alcança |
|---|---|
| 3× DoS por Server Components / deserialização de RSC | não há Server Action |
| DoS no App Router via Server Actions | não há Server Action |
| SSRF em Server Actions em *custom server* | nem um nem outro |
| SSRF por upgrade de WebSocket | o app não serve WebSocket |
| Bypass de middleware no **Pages Router** com i18n | o app é App Router |
| SSRF em `rewrites` com host do atacante | não há `rewrites` |

**Cada premissa virou teste.** No dia em que alguém escrever a primeira Server
Action ou o primeiro `rewrite`, o aceite deixa de valer — e isso aparece no PR,
não numa varredura seis meses depois.

#### 10.4 — "a API disse não" e "a API não respondeu" eram a mesma coisa

O maior achado do eixo, e ele tinha causa única: `fetchApi` lançava um `Error` de
texto corrido, então **nenhum chamador conseguia perguntar qual das duas
aconteceu** — e os quatro pontos auditados colapsavam no pessimista.

| Onde | O que a tela **afirmava** |
|---|---|
| **Home** | "sem notícias hoje" — e a ISR guardava a afirmação por **uma hora** |
| `/news/[id]` e `/article/[date]` | **404 numa matéria que existe**, cacheado, e o buscador via o mesmo |
| cancelamento da newsletter | **"link inválido"** para quem só pegou a API dormindo |

A terceira é a mais cara: quem chega ali quer sair, e ser informado de que o
próprio link de descadastro não presta é ser mandado embora sem sair.

`ApiError` carrega o status, com `null` significando "não houve resposta". A Home
passou a usar `nullUnlessPublishing`: na revalidação o Next mantém a última
página boa e tenta de novo; no build da Vercel ele falha — e falhar é o que se
quer, porque a Vercel preserva o deploy anterior e o `CLAUDE.md` já registra que
os dois deploys disparam juntos e não terminam juntos. Antes esse desencontro
nascia como Home vazia em produção; agora nasce como build vermelho.

**E aqui o CI ensinou uma distinção que a revisão não tinha visto.** A primeira
versão simplesmente não capturava, e o job Build reprovou com `ECONNREFUSED` —
porque ele roda **sem API nenhuma, de propósito**: o `CLAUDE.md` afirma que
`build` não precisa de banco, como `lint` e `typecheck`. "Build" não é uma coisa
só: o da Vercel publica, o do CI só confere que compila. `nullUnlessPublishing`
separa os dois pela variável `VERCEL`, que vale também em runtime — e é o caso
de runtime que mais importa, porque é o único que acontece com gente lendo.

**A linha entre os dois casos de detalhe foi traçada contra a API real, não
suposta:** id fora do formato UUID devolve **400** com o erro do Zod, UUID válido
sem linha devolve **404**. Os dois significam que o recurso não pode existir, e
tratar só o 404 mandaria a URL digitada errada para a página de erro — que
responde 200 dizendo "algo deu errado" onde o certo é "não encontrada".

A auditoria também removeu `getLatestArticle`/`useLatestArticle`: mortos desde a
V1, nenhuma tela os chama, e o que restava neles era um `try/catch` apagando
qualquer falha — o padrão que a revisão foi caçar, mantido vivo por código morto.

**A matriz de estado saiu como teste, não como tabela**: 15 linhas, 4 colunas, e
tela que promete esqueleto e não desenha esqueleto reprova.

**`staleTime` × `revalidate`:** contam coisas diferentes, e de propósito. O HTML
da ISR pode ter até **1 h**; o cliente considera o dado fresco por **5 min** e
então rebusca. O primeiro é a idade máxima do que chega pronto; o segundo, a
janela em que a tela se corrige sozinha. Nenhum ajuste — a nota existe para a
pergunta não voltar.

#### 10.4 — o soft 404, que não deu para corrigir aqui

`notFound()` dentro de rota com `revalidate` e `not-found.tsx` **aninhado**
responde **HTTP 200**, não 404. Conferido que **não é o middleware**:
`/pt-BR/rota-que-nao-existe` passa pela mesma reescrita do `next-intl` e responde
404 corretamente. Só o Next 15 corrige — mesma dívida das advisories.

**O que segura o estrago é o `noindex` no `generateMetadata` do caminho de
falta**, e essa linha ganhou guarda, porque ninguém lembraria de mantê-la.

#### 10.2 — a preferência declarada e desobedecida

O `globals.css` derruba animação e `scroll-behavior` sob
`prefers-reduced-motion`, o que dava a impressão de que a preferência valia em
todo lugar. **Não valia:** `scrollTo({ behavior: 'smooth' })` passa por cima da
regra de CSS, e as duas listagens paginadas faziam exatamente isso — os dois
únicos lugares do produto com rolagem programática.

As mesmas duas linhas tinham um segundo problema: rolavam a janela e **deixavam
o foco no botão de paginação**, agora fora da tela. Para quem usa teclado, o
próximo Tab salta de volta ao rodapé sem explicação; para quem usa leitor de
tela, **nada anuncia que a página mudou**. Mover o foco para a região de
resultados resolve os dois, e a região é nomeada pela contagem — conferido no
navegador: clicar na página 2 leva o foco para lá e o nome acessível lê
"2.373 notícias".

**O erro do formulário era anunciado uma vez e ficava órfão do campo.** O
`role='alert'` dispara quando a mensagem aparece — e foi isso que a auditoria da
Fase 7 conferiu. Mas quem volta ao campo ouve só "e-mail, entrada inválida":
`aria-invalid` diz *que* está errado e nada dizia *o quê*. O formulário aparece
duas vezes na mesma página, então o id da descrição é por instância.

Reflow a 200% de zoom (viewport de 640 px) conferido sem estouro horizontal.

#### 10.3 — a 404 ia ao ar sem uma linha de CSS

**Nove das doze rotas nunca tinham sido capturadas no escuro**, e a razão escrita
ao lado da configuração — "não acrescenta informação nova nas páginas de
formulário" — não sobreviveu à medição: o escuro é exatamente onde token errado
aparece. Toda rota passou a ter referência escura em 1440, e as três telas de
conteúdo mantêm o 375. **51 imagens, 15 escuras.**

A primeira captura achou algo maior que um token. **A 404 — a página que todo
endereço errado do site alcança, inclusive os com prefixo de idioma —
renderizava com folha de estilo nenhuma**: Times New Roman, link azul
sublinhado, fundo branco mesmo no tema escuro. Conferido em produção: o HTML
dela não tinha `<link rel="stylesheet">` nenhum, enquanto a Home carregava 56 kB.

E o comentário no arquivo **afirmava o contrário do que acontece**: dizia que as
rotas sem locale são redirecionadas e que o 404 localizado seria o usado, e que
aquele era "apenas o fallback final". No App Router, caminho que não casa com
arquivo de rota nenhum não cai dentro do segmento `[locale]` — o roteador não
casa nada e renderiza o `not-found` da **raiz**.

A causa é de empacotamento: o `globals.css` era importado pelo layout de idioma,
e o Next prende o chunk à entrada que o importa. Importar nos dois lugares **não
resolve** — o Next deduplica e o chunk continua onde estava; medido, a 404 seguia
recebendo 3,4 kB de `@font-face` e nada mais. Ele precisa morar **só** na raiz.
A página também precisava do próprio `ThemeInit`.

**Estava assim desde que a página existe, e estava na baseline versionada**, na
captura clara, sem ninguém olhar.

E a varredura de cor crua tinha um buraco: exigia sufixo numérico, então
`bg-white`, `text-black` e os cinzas neutros passavam batido — as classes que
somem no claro e ficam ilegíveis no escuro. As quatro ocorrências que existem são
**véu sobre conteúdo** (preto translúcido sobre foto ou sobre a página), que deve
ser fixo nos dois temas; viraram exceção declarada, e uma quinta reprova.

#### 10.6 — o otimizador aberto, e a lista que teria quebrado 22% das imagens

**Aqui a revisão do próprio código pegou o erro antes de ele ir ao ar**, e o
motivo de ele ter passado vale mais que a correção: a primeira medição amostrou
**100 itens por fonte**, que é exatamente a amostra que esconde o problema.

Varrendo o acervo inteiro — 3.000 de 6.441 itens — o quadro se inverte. **O
pipeline não ingere só os 13 feeds RSS: ingere também a NewsData.io**, que agrega
centenas de veículos.

| Medida | Valor |
|---|---|
| fontes distintas no acervo | **87** — só **12** em `rss-sources.ts` |
| hosts de imagem distintos | **95**, com 81 deles abaixo de 50 itens |
| cobertura da lista fechada | **77,6%** |
| imagens que virariam placeholder | **22,4% — 491 de 2.191**, em silêncio |

Ou seja: a primeira saída da §10.6 **não existe** — enumerar hosts de um agregador
de terceiro é lista que nasce incompleta. Fica a segunda, aceitar e registrar,
agora apoiada num número.

O que limita o custo do abuso, já que o host não pode: teto de `deviceSizes`
(**6** transformações por URL em vez de 8 × 8), **um** formato, e
`minimumCacheTTL` de 30 dias contra o default de **60 segundos**. **Gatilho:** o
aviso de cota de otimização de imagem da Vercel — ordem de grandeza conhecida,
**~4.700 imagens de origem distintas por mês** só do tráfego legítimo. A saída,
se apertar, é proxy próprio com URL assinada, não lista de hosts.

**O audit da `/news` foi lido, e desmentiu duas suposições.** O LCP **é** o hero
e ele **tem** `fetchpriority=high`; 65% do tempo é *Load Delay*. E o reflexo de
ligar AVIF está errado aqui: cada formato **dobra** as variantes por imagem, e
todo MISS paga o download da origem — que naquela imagem pesa **2,8 MB** para
virar 79 kB servidos. O que estava de fato superdimensionado era o `sizes`:
`66vw` num monitor de 2560 px pede 1.690 px para desenhar 790. Todo `sizes`
agora termina em largura fixa, e o hero usa **62vw**, medido nas duas pontas da
faixa fluida (634 px de 1024 · 800 px de 1280).

#### 10.1 — o Risco 3 da §32 não se materializou

Dos **52** client components: **44 são causa** (estado, evento ou API de
navegador), **6 são i18n** (o `useTranslations` do next-intl v3 é client-only) e
**2 são contágio estrutural**. Tirar o `'use client'` do `story-image` foi
tentado e **revertido**: o mesmo componente é consumido por cards client em toda
rota que tem hero, então a diretiva não tira nada do bundle e ainda duplica o
módulo entre os grafos — **+0,33 kB na `/news/[id]`**, medido nos dois sentidos.

#### 10.T — o gate de cobertura media um app só

O CI roda `pnpm turbo test:coverage` com piso de 70%, e o `@newranews/web` **não
tinha o script** — o passo media só a API, e o badge do README falava por um app
só. Eram 451 testes sem piso nenhum.

**Medido ao fixar: 72,35% stmts · 88,86% branch · 71,42% funcs.** O piso é o
mesmo 70 da API, mas **a folga aqui é fina e está escrito por quê**: lá o piso
ficou 24 pontos abaixo do medido, aqui pouco mais de um em `functions`. Onde
falta cobertura é sabido — `lib/queries.ts` mede 28% de funções, invólucros finos
de `useQuery` exercitados pelos testes de componente.

O maior buraco real foi preenchido: **`lib/auth.ts` media 41%** e é o caminho de
identidade. Agora 100%. Escrever esses testes esbarrou na armadilha que o
`CLAUDE.md` registra do lado da API, pela outra ponta: **no jsdom a assinatura
HS256 do `jose` lança**, o `catch` do callback engole, e toda asserção sobre o
caminho de falha passaria pelo motivo errado. Quem expôs foi a asserção de
caminho feliz — que é a mitigação que aquela nota prescreve.

#### Números

| | Antes | Depois |
|---|---|---|
| testes / suítes do web | 451 / 50 | **522 / 57** |
| cobertura do web no CI | **não medida** | 72,35% stmts, piso 70 |
| advisories de produção (`pnpm audit --prod`) | 83 | **36** |
| cabeçalhos de defesa no site | **0** | 6 |
| imagens da baseline / escuras | 43 / 6 | **51 / 15** |
| suítes em `tests/security/` | 0 | 3 |

**Total do monorepo: 1.250 testes** (728 API + 522 web).

#### Verificação pós-merge (24/08/2026, contra produção)

O ritual do `CLAUDE.md`, depois do merge do PR #133 e dos dois deploys.

**O deploy subiu, provado pelo que só existe na versão nova:** os seis
cabeçalhos na resposta da `vercel.app`, com o `connect-src` resolvido para
`https://newra-news-api.onrender.com` — o que também prova que a Vercel leu a
env no build.

| Verificação | Resultado |
|---|---|
| a 404 carrega CSS | **sim** — os dois chunks, inclusive o de 56 kB; status **404**; `ThemeInit` presente |
| hosts de imagem da cauda longa | **5 de 5 servem WebP real** — `p2.trrsf.com`, `estadao`, `oantagonista`, `glbimg`, `bbci` |
| violações de CSP na `/news` | **zero** |
| região de resultados | presente, `tabIndex=-1`, nome acessível `"6.441 notícias"` |
| `sizes` do hero em produção | `(max-width: 1280px) 62vw, 800px` |

**Lighthouse (run [32749923100](https://github.com/tavinholoco/newra-news/actions/runs/32749923100)), mediana de 3 execuções:**

| Rota | perf | antes | LCP | CLS | TBT | a11y · BP · SEO |
|---|---|---|---|---|---|---|
| `/pt-BR` | 92 | 92 | 2,94 s | 0,000 | 249 ms | 100 · 100 · 100 |
| `/pt-BR/news` | **94** | 93 | **2,82 s** | 0,000 | 175 ms | 100 · 100 · 100 |
| `/pt-BR/article` | 96 | 96 | 2,57 s | 0,002 | 123 ms | 100 · 100 · 100 |
| `/pt-BR/about` | 97 | 97 | 2,59 s | 0,000 | 76 ms | 100 · 100 · 100 |
| `/en` | **94** | 92 | 2,89 s | 0,000 | 150 ms | 100 · 100 · 100 |

**A `/news` foi de 3,2 s para 2,82 s de LCP** — é o efeito do `sizes` limitado, e
é o único número de performance que esta fase se propôs a mover.

**O `csp-xss` do Lighthouse passa (score 1) e best-practices fica em 100 nas
cinco rotas.** A CSP com `'unsafe-inline'` no `script-src` **não custa ponto** —
o que ela cobra é o que está escrito no aceite, não pontuação.

> **Um número para a Fase 13, medido aqui:** o critério de performance da §31 diz
> **"LCP alvo < 2,5 s"**, e **nenhuma das cinco rotas alcança** — a melhor é a
> `/article` com 2,57 s. É LCP de laboratório com throttling simulado, mais
> pessimista que campo, mas o critério não faz essa ressalva. A §31 Performance é
> da 12; o número já está aqui para ela não redescobrir.

**Baseline recapturada de produção:** 51 capturas, e o diff é exatamente o
esperado — **as quatro imagens da `not-found`** (a correção do CSS) e as quatro
da Home em 1440 (onde o `sizes` do hero mudou de variante). Nenhuma outra tela
se mexeu, que é o que a captura determinística promete.

#### Certificação de que a Fase 11 pode abrir

Rodado na `main`, depois do merge, em 24/08:

| Verificação | Resultado |
|---|---|
| `turbo lint typecheck test build --force --concurrency=1` | **12 tarefas, 0 falhas** |
| suítes | **54 API + 57 web** |
| `turbo test:coverage --force` | API **98,71%** · web **72,35%** — os dois com piso |
| `GET /api/health` | **200** |
| `GET /pt-BR` | **200**, com os seis cabeçalhos |
| gate do Lighthouse | **verde**, cinco rotas acima do piso |
| `origin/main` | PR #133 mergeado (`1a63757`) |

**1.250 testes verdes, build limpo, produção no ar. A Fase 11 abre sem dívida de
suíte herdada.**

**O inventário da §28 para a Fase 11 foi reconferido**, porque a regra da fase é
abrir com inventário fechado. Duas linhas tinham derivado e estão corrigidas no
plano: o BFF tem **6** rotas por `proxyToApi` (o plano dizia 5) e o
`Cache-Control` editorial cobre **4** rotas — `/api/home`, `/api/trending`,
`/api/news/facets` e `/api/news/:id/related` — e não 5. Conferido nas duas
pontas: as chamadas de `withEditorialCache` no código e o header em produção.

As demais premissas continuam valendo, e cada uma foi medida e não suposta:

| Premissa da §28 | Estado em 24/08 |
|---|---|
| nenhuma chamada `fetch` do web tem timeout | **confirmado** — zero `AbortSignal`/`AbortController` no `apps/web` |
| Playwright instalado, sem config e sem spec | **confirmado** — zero `playwright.config`, zero `*.spec.ts` |
| `SchemaMatchesSharedType` só numa rota | **confirmado** — só em `routes/events/schemas.ts` |
| dois enums `Category` | **confirmado** — `schema.prisma` e `packages/types/src/news.ts` |
| `render.yaml` não declara `AUTH_JWT_SECRET` nem `ADMIN_EMAILS` | **confirmado** |
| 12 eventos no catálogo de analytics | **confirmado** — os três `article_scroll_*` contam |
| 12 rotas de BFF | **confirmado** |

> **A Fase 10 deixa uma peça pronta para a 11.2.** O `ApiError` já separa "a API
> não respondeu" de "a API disse não" — o que falta ali é **quem decide em
> quanto tempo desistir**, que é o item de timeout. A metade difícil já está
> feita.

#### O que a Fase 11 vai cobrar daqui

- **A costura da sessão.** Quando o upsert falha, `token.id` cai no id do
  *provedor*, que não é o id da API — a sessão passa a apontar para um usuário
  que a API não conhece. O comportamento de hoje está **congelado em teste** para
  que a decisão da 11 seja mudança visível, e não descoberta.
- **O soft 404** e as advisories do `next` compartilham a mesma dívida: Next 15.
- **A `Reuters` devolve zero itens** — medido ao mapear as fontes. É configuração
  do `apps/api`, e a Fase 9 já fechou; entra como item de acervo para a 11.

---

### 36. V2.0 Fase 11 — Integração geral ✅ Concluída em 2026-08-24

> Branch `review/v2-integration`. Os oito eixos da §28 fechados, menos um item
> que depende de credencial de produção e passou para a 13.2. **Quinze achados**,
> e o padrão deles é o mesmo: **nenhum tem sintoma de erro** — a costura não
> quebra, ela combina errado e a tela continua desenhando. Mais **três medições
> que derrubaram suposições do próprio plano**, o que é tão produto de uma fase
> de revisão quanto correção.
>
> **1.250 testes em 111 suítes → 1.314 em 122**, mais **29 specs de E2E em 5
> arquivos, que antes eram zero**. Cobertura: API 98,71% → **98,72% stmts**;
> web 72,35% → **72,50% stmts**.

#### O inventário, reconferido na abertura

A regra da fase é abrir com inventário fechado, e ele foi conferido contra o
código antes de qualquer linha:

| Costura | §28 dizia | Medido em 24/08 |
|---|---|---|
| rotas de BFF | 12 | **12** ✓ (6 por `proxyToApi`, 14 call sites) |
| `Cache-Control` editorial | 4 | **4** ✓ |
| `AbortSignal` no web | zero | **zero** ✓ |
| Playwright | sem config, sem spec | **confirmado** ✓ |
| `SchemaMatchesSharedType` | só em `/events` | **confirmado** ✓ |
| `render.yaml` sem `AUTH_JWT_SECRET`/`ADMIN_EMAILS` | — | **confirmado** ✓ |
| eventos no catálogo | 12 | **12 declarados, 11 com call site** ⚠️ |

#### 11.3 — quem espera a API acordar? **hoje, ninguém** — e a suposição do plano caiu

A §11.3 mandava medir, não supor, e a medição desmentiu a premissa que o plano,
o `CLAUDE.md` e o workflow do Lighthouse carregavam desde a Fase 8:

| Medição (24/08) | Resultado |
|---|---|
| `uptime` do `/api/health` às 20:14:46Z | 3.146 s |
| `uptime` às 20:46:07Z, **17 min sem uma requisição minha** | 5.024 s |
| delta de `uptime` × janela de relógio | **1.878 s × 1.881 s — processo contínuo** |
| tempo da primeira resposta depois da ociosidade | **0,29 s** (cold start seria ~4,9 s) |

**A API não hibernou.** O `keep-alive` documentado no `docs/setup.md` §9 —
UptimeRobot batendo em `GET /api/health` a cada 5 min — está de pé e funciona.
O plano free do Render continua hibernando com ~15 min sem tráfego; o que não
acontece é o tráfego acabar.

**O que isso muda, e o que não muda.** Não muda nada do que a fase corrigiu: o
prazo de 8 s continua certo (hibernação é *uma* causa de pendurar, não a única,
e um keep-alive num serviço de terceiro em plano gratuito não é garantia — ele
já falhou antes, que é como a Fase 8 mediu os 4,9 s), e o aquecimento do
workflow do Lighthouse é barato demais para tirar. O que muda é a **explicação
preguiçosa**: de agora em diante, "deve ser a API dormindo" precisa de sonda
antes de virar conclusão. É a mesma lição que a `/news` ensinou no gate do
Lighthouse, pelo outro lado.

#### 11.3 — `revalidate = 3600` estava nas duas telas de leitura e não fazia nada

**O achado de maior alcance da fase, e ele estava escrito à vista de todos.** A
§11.3 mandava medir *quem espera a API acordar* em vez de supor. A medição:

| Rota | `x-vercel-cache` | `Cache-Control` da resposta |
|---|---|---|
| `/pt-BR` | `HIT`, `Age: 1491` | `public, max-age=0, must-revalidate` |
| `/pt-BR/news` | `PRERENDER` | idem |
| `/pt-BR/news/[id]` | **`MISS` nas três tentativas** | `private, no-cache, no-store` |

As duas telas de leitura declaravam `export const revalidate = 3600` e **não
eram guardadas em lugar nenhum**. A causa é uma regra do Next 14 que não aparece
em erro nenhum: rota com segmento dinâmico e **sem `generateStaticParams`** é
marcada `ƒ` no build — renderizada a cada requisição —, e o `revalidate` do
arquivo passa a valer só para o cache de dados, nunca para o HTML. **A tabela do
build dizia `ƒ` desde sempre**, e ninguém a leu como contradição com a linha do
topo do arquivo.

O custo caía sobre a página **que se compartilha**: quem chega de busca ou de
rede social chega num detalhe, e era a única rota do produto sem cache nenhum —
toda visita pagava um render de função inteiro, e toda visita cujo cache de
dados tivesse expirado pagava também a API acordar. `generateStaticParams`
vazio vira as duas para `●`. Guarda em `tests/lib/rendering-mode.test.ts`, que
liga a declaração ao efeito porque eles moram em lugares diferentes.

**E a outra proposta do próprio plano caiu, também por medição.** `Cache-Control`
na `/api/news` teria acrescentado um cabeçalho que ninguém lê: a `/api/home` já
carrega a política e o Cloudflare que fica na frente do Render responde
`cf-cache-status: DYNAMIC`. JSON não é cacheável ali por padrão e aquelas regras
são do Render; o cache de dados do Next decide por `next.revalidate` e ignora o
cabeçalho; o navegador lê `max-age`, que `s-maxage` não é. As quatro rotas
existentes ficam — a política está certa e custa zero — mas **o cache hit rate
da §26 foi riscado, com a medição no lugar da promessa**.

#### 11.2 — ninguém tinha decidido em quanto tempo desistir

Nenhuma chamada `fetch` do web tinha prazo. Some ao plano free do Render, que
hiberna com ~15 min sem tráfego: uma API dormindo segurava a função da Vercel
até a plataforma matá-la, e o leitor via **uma página que nunca responde** — que
nenhuma tela sabe desenhar, porque não é um estado, é a ausência de um.

A metade difícil já estava feita na Fase 10: o `ApiError` separa "a API não
respondeu" de "a API disse não", e prazo estourado cai no primeiro caso.

Os números estão em `lib/timeouts.ts` e os dois são limitados por medição.
**8 s** para a perna servidor→API fica acima do cold start de **4,9 s** que a
auditoria da Fase 8 mediu e abaixo do teto de **10 s** da função no plano Hobby
— um prazo menor trocaria uma espera por uma falha, que é pior. **12 s** para a
perna navegador→BFF é maior de propósito: assim quem desiste primeiro é sempre o
de dentro, e o BFF ainda está vivo para devolver um status em vez de uma
requisição abortada.

> **Passar `signal` é seguro nesta versão, e foi conferido, não suposto.** O
> `patch-fetch.js` do `next@14.2.35` repassa o `signal` ao fetch de origem e **o
> remove quando a chamada é revalidação em segundo plano**. O prazo vale para a
> requisição que alguém está esperando, nunca para a regeneração atrás dela.
> Reconferir ao subir para o Next 15.

**Três rotas de admin tinham cada uma a sua cópia do proxy** — mesma leitura de
sessão, mesma checagem de papel, mesma assinatura, mesmo repasse — e as cópias
já divergiam: elas declaravam `cache: 'no-store'` e o `api-proxy.ts` não, para
dado igualmente por-usuário. Quatro implementações de uma decisão é onde a
costura racha, e é por isso que o prazo, o id de requisição e o formato do corpo
de erro precisariam ser escritos quatro vezes. Passaram a usar `proxyToApi` com
`requireRole`. Junto: o proxy devolvia `NextResponse.json(null)` em resposta
não-JSON — status certo, corpo vazio, nada que uma tela soubesse dizer.

#### 11.1 — a guarda de contrato saiu de uma rota para todas

`packages/types` é a fonte única, e **uma rota só** tinha guarda ligando os dois
lados. A deriva já custou um dia de produção na Fase 5: o serviço carregava os
campos de auditoria e as ~15 fontes, o schema de resposta era o da V1, e o
`fastify-type-provider-zod` serializa pelo schema — o dado ia do banco para o
lixo na saída, com a `docs/api.md` descrevendo o comportamento certo.

`utils/contract.ts` traz `assertContract`, uma linha por resposta, ao lado do
schema que ela protege. A conferência é **bidirecional**: só uma direção
deixaria passar campo que o tipo declara e o schema nunca produz, que é
exatamente aquele defeito.

`Widen` existe para uma diferença que é real e **não** é deriva: o `Category`
compartilhado é `enum` nominal, as rotas usam `z.enum([...])` e o Prisma tem um
terceiro. Normalizar enum de string para os seus literais mantém a guarda
honesta sem espalhar a ponte entre os dois enums — ela continua onde sempre
esteve, no `editorial.mapper`, e **agora há teste dizendo isso**.

`POST /api/auth/upsert` — a rota pela qual **todo usuário é criado** — era o
único contrato que o web lia por uma forma escrita à mão dentro do callback.
Ganhou `AuthUpsertResult` em `packages/types`, usado nos dois lados.

A guarda exaustiva é `tests/routes/shared-type-contract.test.ts`, no formato que
a Fase 9 firmou: enumera as respostas de sucesso que o roteador declara e exige,
para cada uma, ou a asserção ou uma linha na lista de exceções com o motivo.

#### 11.6 — a sessão apontava para um usuário que a API não conhece

Item que a Fase 10 congelou em teste para que a decisão da 11 fosse mudança
visível. Quando o upsert do sign-in falhava, sobravam dois estados ruins:

- **falha de rede ou resposta não-ok** → `token.id` indefinido, a pessoa parecia
  logada e toda ação de conta devolvia 401 pelo BFF, **por trinta dias**;
- **200 sem `data`** → `token.id` caía no id do **provedor**, e esse é o caro: o
  BFF assinava um JWT com um `sub` que não existe no banco, `GET /api/account`
  devolvia 404 e **salvar uma matéria estourava a chave estrangeira** — 500 numa
  tela que dizia estar logada.

O id do provedor nunca é gravado, e o upsert é **retentado enquanto a API não
confirmar** — não num job, e sim na próxima leitura de sessão, que é exatamente
quando o dado passa a fazer falta. Com um intervalo de cinco minutos, uma API
fora do ar não acrescenta uma chamada por requisição: acrescenta uma a cada
cinco minutos, e a sessão se conserta sozinha na primeira que passar.
`Session['user']['id']` virou opcional, porque o estado é real.

**As três portas do papel ADMIN.** A página esconde a tela, o BFF recusa antes
de assinar, a API recusa o token — e é profundidade, não redundância: quem tiver
o `AUTH_JWT_SECRET` pula as duas primeiras. A terceira tinha quatro cópias
inline do mesmo `if`, e virou um `requireAdmin`.

#### 11.T — o smoke E2E existe, e a primeira execução achou o que ela existe para achar

`@playwright/test` estava no `devDependencies` **sem config e sem uma única
spec**. Agora são **29 specs em 5 arquivos**, rodando **contra produção** — a
decisão que o eixo inteiro sustenta, porque três dos quatro defeitos mais caros
deste projeto já estavam no ar, e há uma classe que só existe lá: os deploys da
Vercel e do Render disparam juntos e **não terminam juntos**.

**E a primeira execução reprovou três specs, corretamente.** Anônimo em
`/pt-BR/favorites` respondia **200 com
`<meta http-equiv="refresh" content="1;url=/signin?…">`**, e não 307. O
`redirect()` de um server component resolve depois de a resposta começar a ser
transmitida — o `loading.tsx` do segmento de idioma despacha a casca na hora — e
o Next cai naquela tag: **um segundo** olhando o esqueleto, o status errado, e um
salto a mais porque o alvo não levava prefixo de idioma.

O middleware passou a decidir **antes de renderizar**, e ele é deliberadamente
burro: pergunta só se **existe** cookie de sessão, nunca se é válido. Validar ali
exigiria o `NEXTAUTH_SECRET` no runtime de borda, e o modo de falha — variável
ausente, `getToken` nulo, **todo mundo deslogado** — é muito pior que o meta
refresh. Cookie presente e inválido continua caindo no guard da página, que é e
sempre foi a autoridade.

Duas coisas que o smoke **deliberadamente não faz**, com o motivo escrito: não
inscreve ninguém na newsletter (seria um `Subscriber` de verdade, contado pela
tela de métricas e com e-mail no dia seguinte, sem como desfazer sem o token), e
não dispara rollback ao reprovar — reverter deploy sozinho exige distinguir "o
deploy quebrou" de "a API estava dormindo", e este projeto já cometeu o erro
oposto com o gate do Lighthouse medindo cold start. Rollback é decisão da §13.6,
com número atrás.

**Os fluxos com login são pulados sem segredo, e o pulo é barulhento** — um passo
do workflow imprime quais correram. Ligá-los põe o `NEXTAUTH_SECRET` de produção
no runner do CI, e essa é decisão de quem é dono do segredo, não do teste;
`e2e/support/session.ts` documenta o que custa e quais são os quatro segredos.

#### 11.5 — o balde de ingestão é um só para todos os leitores

A Fase 9 mediu que o balde de rate limit era um só para a internet inteira e
consertou com `trustProxy: 1`. Esta fase mediu **o caminho que sobrou**, que é
justamente o que carrega o tráfego: navegador → BFF do Next → API. O IP que
chega na API é o da função da Vercel.

| Medição (24/08) | Resultado |
|---|---|
| 3 requisições **diretas** na API | consumiram o meu balde (`remaining` 29, 28, 27) |
| 3 requisições **pelo BFF** | **não tocaram** nele — balde distinto |
| 45 pelo BFF em **12 segundos** | **10 × 400 e 35 × 429** |

Uma máquina esgota o teto de ingestão do site inteiro em doze segundos. **O
número fica em 30**, e não por folga: com lote de 20, o teto já permite 600
eventos/min, o que alcança as **200.000 linhas** da dívida de agregação da
`/metrics/product` em ~5h30 — dobrá-lo corta esse prazo pela metade e não evita
nada. Quem limita o estrago é o lote e a retenção de 90 dias. Do lado legítimo,
~2 requisições por pageview fazem deste teto ~15 pageviews/min, quinze vezes o
pico plausível do marco de ~550 pageviews/dia.

**A perda seria silenciosa** — 429 num `sendBeacon` não tem retorno que o cliente
leia —, então o gatilho precisa ser observável, e é: `GET /api/metrics/http`
conta por rota e classe de status desde a Fase 9. **429 em `POST /api/events` é
a medida do que está sendo perdido.**

**A cadeia foi provada ponta a ponta:** um lote pelo `POST /api/events` do Next
devolveu `201 { data: { accepted: 1 } }`, e `accepted` é a contagem do
`createMany` — navegador, BFF, API, Postgres, com linha na ponta.

**E `newsletter-landing` era um valor do vocabulário que nunca tinha sido
emitido.** O `NewsletterCta` fixava `origin='article-cta'`, inclusive dentro da
`/newsletter` — a página cuja razão de existir é converter. Toda inscrição vinda
dali entrava na conta do CTA de fim de matéria, e o `origin` existe justamente
para não somar dois canais num número só.

#### 11.S — o mapa de confiança, e um log que guardava e-mail

O mapa está **no código**, no plugin de CORS, que é a fronteira que o torna
verdadeiro ou falso. Três das quatro linhas são configuração; a quarta era pura
convenção — *navegador → API direto: sem autenticação, e mutação nunca vem por
aqui* — e é dela que depende a lista de métodos do CORS.
`tests/lib/trust-boundary.test.ts` a escreve como regra: o segredo compartilhado
tem três módulos nominais, o cliente do navegador para a API só usa GET e POST, e
toda mutação atravessa o BFF same-origin.

**A varredura de LGPD achou um, e é do tipo que se esconde num caminho de
falha.** `sendEmailWithResend` colava os 200 primeiros caracteres do corpo de
erro do Resend na exceção; `sendDailyNewsletter` guardava a primeira dessas
mensagens em `NewsletterLog.error`. Em falha de destinatário o Resend **ecoa o
endereço** — então o e-mail de um assinante podia acabar numa coluna que:

- **ninguém lê** (nenhuma rota, nenhuma tela, nenhum job);
- **o cleanup não expurga** (ele cobre `News`, `PipelineLog`, `Article` e
  `ProductEvent`);
- **sobrevive ao cancelamento da inscrição**, porque cancelar mexe no
  `Subscriber` e em log nenhum.

Jogar o corpo fora foi descartado: "Resend API error 422" sozinho não separa
domínio não verificado de destinatário inválido, e é isso que alguém quer saber
às sete da manhã. `utils/redact.ts` mantém a frase e tira o endereço.

**A rota de eventos continua anônima, e agora algo diz isso.** O risco não é
ataque, é deriva: um `userId` acrescentado "para melhorar a métrica" muda a
natureza jurídica da tabela inteira. As duas pontas ganharam guarda — o BFF
repassa só um `content-type` (nem o cookie, nem o IP encaminhado, nem o agente),
e o schema da API descarta qualquer campo de identidade que alguém anexe.

**Rotação do segredo compartilhado** virou runbook em `docs/setup.md` §9.1, com a
parte que importa: não há como rotacionar um segredo compartilhado sem janela, e
o procedimento **escolhe onde a janela cai**. API primeiro, porque o sintoma é
alto — 401 nas telas de conta. Web primeiro faria o upsert do sign-in falhar em
silêncio, e como esta fase o retenta a cada cinco minutos, a falha ficaria
escondida atrás da retentativa.

#### 11.7 — o blueprint não declarava o que a API precisa

`render.yaml` declarava quinze variáveis e **não declarava `AUTH_JWT_SECRET` nem
`ADMIN_EMAILS`**. As duas estão configuradas à mão no painel do Render desde
16/08 — foi assim que o login de produção passou a funcionar —, então o serviço
atual funciona. Recriado a partir do blueprint, ele sobe com health check verde e
**toda rota de conta em 401**, porque `verifyAuthJwt` falha fechado.

O `zod` não protege contra isso: `AUTH_JWT_SECRET` é `.optional()` e tem de ser,
senão a API não sobe em desenvolvimento. Então o critério da guarda não é
"obrigatória", é **declarada** — `tests/build/env-parity.test.ts` enumera as
chaves do schema e exige cada uma no blueprint ou com motivo escrito (`PORT` e
`HOST`, as duas da plataforma). Leitura estática, porque importar
`src/config/env` executaria o `process.exit(1)` de carga do módulo dentro do
processo de teste.

#### O acervo: a `Reuters` não era URL errada

O item que a Fase 10 entregou como "acervo para a 11". `feeds.reuters.com`
responde **NXDOMAIN** — a Reuters desligou os feeds RSS públicos e não há
substituto. A fonte saiu.

O que importa mais que a fonte morta é **por que ela sobreviveu**: o
`Promise.allSettled` do `fetchFromRss` está certo — um feed fora do ar não pode
derrubar a coleta do dia — mas descarta a rejeição sem rastro. Toda execução do
pipeline gastava uma resolução de DNS fadada a falhar e nada dizia. Fonte que
rejeita ou devolve zero passou a avisar por nome. **Não virou teste de rede**:
uma suíte que bate nos treze feeds reprova no dia em que um publisher espirrar, e
gate que falha por motivo alheio é gate que se aprende a ignorar.

E a mesma ausência que esta fase achou no web: `fetchFeedXml` não tinha timeout.
O provider de e-mail tem 15 s desde que existe; o de feed não tinha nenhum.

#### A revisão do próprio código, que achou mais três

- **O `x-request-id` só viajava para dentro.** Repassar o cabeçalho de entrada
  não liga nada — quem chama o BFF é o navegador, e navegador não manda esse
  cabeçalho. A API gera o dela e a ecoa desde a Fase 9, mas o proxy montava uma
  resposta nova e o id morria ali. Agora ele volta ao chamador, que é a metade
  que faz a outra valer.
- **Um teste que provaria a metade errada de uma porta.** O caso "leitor comum
  barrado no BFF de admin" usava a fixture `request` do Playwright, que é um
  contexto de rede próprio e **não compartilha cookie** com o `BrowserContext`:
  a sessão forjada não chegava nela, e o teste passaria com 401 provando "não sei
  quem você é" onde o ponto é provar "sei, e não pode".
- **Um achado de segurança sem a guarda.** `redactEmails` foi escrito e nada o
  testava, o que quebra a regra da §28. `tests/security/pii-in-logs.test.ts`
  fecha, e a primeira execução dele falhou **pelo motivo errado** — com
  `RESEND_API_KEY` vazio o provider abortava antes do `fetch` — que é a
  armadilha de `env` na carga do módulo já catalogada. A asserção de caminho
  feliz foi quem a expôs.

#### Três vezes a mesma armadilha, e vale registrar

**Guarda estática que lê comentário como código.** Aconteceu três vezes nesta
fase, nas duas direções: um `201` dentro de prosa contado como declaração de
rota; um `assertContract` **comentado** contando como asserção presente (a
guarda passou verde exatamente sobre o defeito que existe para achar); e um
`proxyToApi` citado num JSDoc que dizia *não* usá-lo, reprovando o que estava
certo. E uma quarta parenta: um literal de vocabulário vivo dentro de um
`Extract<...>` numa `interface`, contado como emissão.

A regra: **guarda que varre fonte tira comentário e declaração de tipo antes de
qualquer regex** — e só se descobre isso insistindo em ver a guarda **falhar**.

#### Números

| | Antes | Depois |
|---|---|---|
| testes / suítes da API | 728 / 54 | **756 / 59** |
| testes / suítes do web | 522 / 57 | **558 / 63** |
| **total do monorepo** | **1.250 / 111** | **1.314 / 122** |
| specs de E2E | **0** | **29 em 5 arquivos** |
| cobertura da API (stmts) | 98,71% | **98,72%** |
| cobertura do web (stmts) | 72,35% | **72,50%** |
| workflows | 4 | **5** (`smoke.yml`) |

#### O que a Fase 13 vai cobrar daqui

- **A primeira leitura honesta da tela de métricas** (11.5) é o único item que
  não fechou: exige credencial de admin de produção. Tudo que a prepara está
  feito — a cadeia provada, o balde medido, e o gatilho de subcontagem
  observável em `/api/metrics/http`.
- **Os fluxos autenticados do smoke** entram no dia em que os quatro segredos
  forem configurados. Sem eles, 6 dos 29 specs ficam pulados — e o pulo aparece.
- **Rollback pós-deploy** (§13.6): o smoke falha e avisa; reverter sozinho é
  decisão com número atrás, e hoje não há execução nenhuma que a justifique.
- **A dívida do Next 15 ganhou um terceiro morador.** Além das 8 advisories
  *high* e do soft 404, o meta refresh do `redirect()` em rota com `loading.tsx`
  é da mesma família — o atalho do middleware cobre o caso comum, e o caso raro
  (cookie presente e inválido) continua pagando o segundo.
- **`NewsletterLog` não tem retenção.** Uma linha por dia, e sem PII depois desta
  fase — mas é a única tabela do produto fora do expurgo. **Gatilho:** a primeira
  coluna com texto livre que voltar a ser gravada ali.

---

### 37. Fechamento da Fase 11 — verificação pós-merge e a auditoria antes da última fase ✅ 2026-08-24

> Branch `chore/v2-close-phase-11`. O ritual completo contra produção depois do
> merge do PR #135, mais a varredura que a Fase 13 herda: **o que ainda falta
> para o projeto estar 100% até aqui**, separado do que é escopo da própria 12.

#### O ritual, com o terceiro passo estreando

**1. Smoke E2E — rodou sozinho no merge, e é a primeira vez.** O workflow
disparou no push da `main`, esperou os 7 min dos dois deploys e sondou as duas
metades antes de medir (web 200 em 1,35 s; API 200 em 0,16 s e 0,07 s na
segunda). **23 specs passaram, 6 pulados**, e o passo "Which flows will run"
imprimiu o motivo do pulo, como manda o desenho.

**E os três specs que estavam vermelhos ficaram verdes** — o que é a prova de
que a correção do middleware chegou ao ar:

```
✓ 12 anônimo › é mandado ao sign-in em /pt-BR/favorites (1.4s)
✓ 13 anônimo › é mandado ao sign-in em /pt-BR/account (507ms)
✓ 14 anônimo › é mandado ao sign-in em /pt-BR/admin (499ms)
```

**2. As sondas de produção**, uma por achado da fase:

| Sonda | Antes | Depois |
|---|---|---|
| `/pt-BR/news/[id]`, três requisições | `MISS` · `private, no-cache, no-store` | **`HIT` · `Age: 215` · `public, max-age=0, must-revalidate`** |
| anônimo em `/pt-BR/favorites` | 200 + `<meta refresh>` de 1 s | **307 → `/pt-BR/signin?callbackUrl=%2Fpt-BR%2Ffavorites`** |
| anônimo em `/en/account` | idem, sem prefixo de idioma | **307 → `/en/signin?...`** |
| `__next-page-redirect` no HTML | presente | **zero ocorrências** |
| `GET /api/account` sem sessão | — | **401 `{"error":"Unauthorized"}`** |
| `POST /api/events` anônimo | — | **400** (schema recusa o lote vazio; não 401) |
| cabeçalhos de defesa na Home | 6 | **6** (sem regressão da Fase 10) |
| `x-request-id` de entrada na API | — | **ecoado** |
| 9 rotas públicas + 6 rotas de metadata | — | **todas 200; `/rota-que-nao-existe` → 404** |

**3. Baseline visual: 51 capturas, e nenhuma imagem mudou.** Só o `capturedAt`
do manifesto. É exatamente o que se esperava — as correções da 11 foram todas de
costura (prazo, cache, contrato, sessão, segurança) e nenhuma tem pixel. A
captura determinística cumprindo a promessa dela.

**4. Lighthouse — e aqui o ritual achou um buraco no próprio gate.**

O gate media **cinco rotas, e nenhuma era de detalhe**. O motivo estava escrito
no workflow e era metade certo: uma URL **fixa** para `/news/[id]` ou
`/article/[date]` apodrece — o cleanup remove a notícia aos 30 dias e a data do
briefing muda todo dia. Mas a conclusão não seguia da premissa: o problema é a
URL fixa, não a rota ser imensurável, e o workflow já falava com a API para
aquecer.

Ficar de fora custava caro. São **as duas páginas por onde se chega ao site**
vindo de busca ou de rede social, as duas mais pesadas em first-load JS
(166–167 kB), e as duas cuja renderização a Fase 11 mudou de `ƒ` para `●` — uma
correção de performance que o gate não conseguia ver.

Com o passo de resolução, **sete rotas, medianas de 3 execuções**:

| Rota | execuções | mediana | LCP |
|---|---|---|---|
| `/pt-BR` | 66, 94, 96 | **94** | 2,85 s |
| `/pt-BR/news` | 88, 92, 95 | **92** | 2,84 s |
| `/pt-BR/article` | 96, 96, 96 | **96** | 2,77 s |
| `/pt-BR/about` | 97, 97, 97 | **97** | 2,61 s |
| `/en` | 94, 95, 96 | **95** | 2,90 s |
| **`/pt-BR/news/<id>`** | 96, 97, 98 | **97** | **2,61 s** |
| **`/pt-BR/article/2026-08-24`** | 96, 97, 98 | **97** | **2,42 s** |

**As duas de detalhe são as melhores rotas do produto**, e o briefing tem **o
único LCP abaixo de 2,5 s do conjunto** — que é o alvo da §31, alcançado pela
primeira vez por alguma rota, e invisível até agora só porque o gate não olhava.
Antes da correção da 11 elas seriam as piores: render de função a cada
requisição.

> **A tabela impressa quase me enganou de novo.** O passo "Print scores" mostrou
> a `/pt-BR/article` em **92** e eu registrei "caiu 4 pontos" antes de conferir:
> as três execuções foram `[96, 96, 96]`, mediana **96**. A tabela imprime a
> execução *representativa*, o gate confere a mediana, e são números diferentes
> — exatamente o que o item 34 documentou. Está no `CLAUDE.md` agora, no
> imperativo.

#### A auditoria: o que falta para estar 100% até aqui

A pergunta é a de antes da última fase — **o que é dívida das fases 0–11**,
separado do que a 12 já tem no próprio inventário.

**O que estava faltando e foi corrigido aqui:**

| Achado | O que era |
|---|---|
| o gate do Lighthouse não media as duas telas de detalhe | corrigido acima |
| a seção **"Fase Atual"** do `progress.md` estava **duas fases atrás** | ela abria com "Fase 5 — Polish e Portfólio" e terminava no replanejamento de 23/08, sem 10 nem 11. Ganhou uma linha de estado no topo e as duas entradas que faltavam — e um aviso de que a seção é **log de anexação**, não ordem cronológica |
| checkbox de `"somente salvos"` aberto na Fase 4 | estava certo quando escrito (apontava para a 6), a 6 entregou e ninguém voltou para marcar |

**O que continua aberto, e é dívida real das fases anteriores:**

1. **O diagrama ER documenta 3 entidades e o schema tem 12.** `ARTICLE`,
   `CATEGORY` e `NEWS`; faltam `User`, `Favorite`, `UserPreference`,
   `Subscriber`, `NewsletterLog`, `ProductEvent`, `BriefingSource`,
   `PipelineEvent`, `PipelineLog` e `DailyMetric` — **nove de doze**. Os quatro
   `.mermaid` são de 15/08, antes da V2 inteira.
2. **Os screenshots do README são de 15/08 — da V1.** O site foi inteiramente
   redesenhado a partir de 20/08. Quem abre o repositório vê um produto que não
   existe mais. (A baseline de produção com 51 capturas já está versionada em
   `docs/v2/baseline-v2/` — a matéria-prima existe.)
3. **`docs/presentation.md` é de 16/08** — a peça de portfólio descreve a V1.
4. **A newsletter não entrega para assinante real.** O domínio próprio nunca foi
   verificado no Resend, então o envio funciona apenas para o e-mail da conta
   (item 11 do plano de ação registra isso desde 16/08). O produto tem
   inscrição, cancelamento, estágio no pipeline e tela — e **não envia**.
5. **`GET /api/trending` etapa 2** (`+ cliques × 0,5 + shares × 3`) esperava a
   camada de analytics. **Ela existe desde a Fase 8** — o gatilho disparou e
   ninguém percebeu, porque o item ficou registrado dentro de um item histórico.
6. **Zero tags no repositório e nenhum `CHANGELOG.md`.** O `CONTRIBUTING.md`
   existe.
7. **O controle de opt-out de analytics na interface** — item aberto desde a
   Fase 8, hoje o único opt-out é o sinal do navegador (DNT/GPC).

**O que NÃO está faltando, e vale dizer para não virar susto na 12:**

- **zero `TODO`/`FIXME`/`HACK`** em todo o código de produção dos dois apps e
  dos pacotes;
- **`docs/api.md` não pode derivar** — a guarda `api-docs-drift` enumera o
  roteador e exige linha por rota;
- **`docs/setup.md` está de 24/08** e ganhou o runbook de rotação do segredo;
- **as 9 rotas públicas e as 6 rotas de metadata respondem 200**, e endereço
  errado responde **404** (não soft 404 — esse é só o `notFound()` interno, que
  tem `noindex` com guarda);
- **advisories de produção: 36**, o mesmo número com que a Fase 10 fechou —
  nenhuma regressão, e o aceite de risco das *high* está escrito no item 35;
- **1.314 testes em 122 suítes + 29 specs de E2E**, todos verdes.

#### Números da verificação

| Verificação | Resultado |
|---|---|
| `turbo lint typecheck test build --force` | **12 tarefas, 0 falhas** |
| CI do merge na `main` | **verde** (Lint, Test, Build, Gitleaks) |
| Smoke E2E pós-deploy | **23 passaram, 6 pulados, 0 falharam** |
| gate do Lighthouse, 7 rotas | **verde**, mediana mínima 92 |
| baseline visual | **51 capturas, 0 imagens alteradas** |
| `GET /api/health` | **200** |

---

### 38. V2.0 Fase 12 — Refinamento visual e de leitura ✅ Concluída em 2026-08-25

> Branch `refine/v2-visual-reading`. Fase nova, aberta entre a 11 e o release —
> a antiga Fase 12 virou a **13**. O plano foi emendado na §28 ("As cinco fases
> finais") e o motivo cabe numa frase: **as três revisões olharam camadas, e
> nenhuma olhou uma tela com dado de produção dentro.**

#### Por que ela existe

As Fases 9, 10 e 11 acharam 15, 14 e 15 defeitos, e **nenhum** deles era:

| O que a pessoa via | Alcance |
|---|---|
| as abas de `/account` desenhadas umas por cima das outras | toda a área de conta |
| `/admin` sem link nenhum em tela ≥ 768 px | desde a Fase 3 |
| a tag `<img>` inteira, `srcset` e tudo, impressa como texto | **63,7% do acervo** |
| o rótulo "Trecho" sobre uma caixa vazia | **23,2%** |
| a palavra `null` como subtítulo | 158 notícias |
| `**asteriscos**` no meio da frase | **60% dos briefings** |
| um retângulo laranja com um "N" a cada quatro células | **25,5% do acervo** |

**Nenhum tem sintoma de código.** Build verde, 1.314 testes verdes, Lighthouse
verde, smoke verde. Só aparecem para quem abre a tela e lê.

#### Os sete achados

**1. As abas da conta colapsavam para 33 px, e a causa era um nome de token.**

No Tailwind v4, `--spacing-<nome>` gera o eixo de espaço inteiro, e
`inline-<valor>` ali é `inline-size`. Com `--spacing-block` no `@theme`, a folha
ganha **dois** `.inline-block` — o de display, do core, e o de `inline-size`,
do token. Mesma especificidade, vence o último. `clamp(1.5rem, 1.25rem + 1vw,
2.5rem)` a 1280 px dá **32,80 px**, o número medido na tela.

Provado medindo a mesma marcação com `style` inline em vez da classe: **119 px
contra 33**. Corrigido com `inline-flex` + `shrink-0`, e a guarda **deriva dos
tokens** — `--spacing-flex` amanhã põe `inline-flex` na lista sozinho.

> **A primeira versão da guarda passou verde sobre o defeito.** Montava o padrão
> numa template literal onde `\\s` virou `\s`, que não é classe de espaço — é a
> letra `s`. É a **quinta** vez que uma guarda estática deste projeto falha por
> análise de texto (quatro na Fase 11). A saída foi parar de montar regex: ela
> parte a fonte em palavras.

**2. `/admin` não tinha link em desktop desde o masthead de três linhas.**

A V1 tinha uma `Navbar` responsiva só, que montava os links da sessão — então
apareciam nos dois tamanhos. A §10 partiu a barra em `Masthead` (lista estática)
e `MobileNav` (com sessão), e **os links de sessão foram só para o segundo**. A
rota respondia 200, a suíte estava verde, e o único jeito de achar era procurar
o link e não encontrar.

`sessionNavLinks` passa a ser a lista única das duas cascas, e o painel entra na
**top-bar** — linha 1 é informação de sistema, e ADMIN não é editoria. Guarda de
paridade: rota de sessão nova entra sozinha e reprova se cair em um lado só.

**3. As métricas já estavam sob o guard de admin; o que faltava era serem parte
do painel.**

`/admin/metrics` exige sessão com role ADMIN desde que a página se mudou para
lá. Mas a `/admin` tinha um link no canto do título, a `/admin/metrics` tinha
uma seta de voltar, e as duas eram **contêineres diferentes** (`max-w-5xl` ×
`max-w-7xl`) — a largura da página mudava ao trocar de tela. Viraram abas de uma
casca só, no layout do segmento, ao lado do guard.

**4. O corpo que vem do feed nunca passou por higiene nenhuma.**

Medido contra as 6.669 linhas de produção:

| Defeito | Antes | Depois |
|---|---|---|
| tag HTML no corpo | **63,7%** | **0%** |
| corpo abrindo com `<img>` | **51,9%** | **0%** |
| "Trecho" com corpo vazio | **23,2%** | **0%** |
| aviso de paywall no texto | 7,3% | **0%** |
| rodapé de WordPress | 5,5% | **0%** |
| a palavra `null` como texto | 158 | **0** |
| dek acima de 320 caracteres | **60,7%** | **0%** |
| sem imagem | 27,1% | **25,5%** |

**E o dek não era um dek:** mediana de **594** caracteres, p90 de 5.613,
**máximo de 33.073** — metade do acervo usava o campo de subtítulo para guardar
a matéria inteira, e a tela imprime o dek num parágrafo **sem clamp**. Depois:
p50 **111**, p90 281, máximo 320.

> **A primeira versão da correção teria destruído a matéria de metade do
> acervo.** A regra ingênua — "corpo igual ao dek vira `null`" — descartava
> **5.635 corpos**, mediana de 1.080 caracteres, máximo de 33.073. Certa sobre a
> TechCrunch (mesma frase única nos dois campos) e catastrófica sobre G1, Folha,
> Valor, BBC e Trivela (**a matéria inteira nos dois**).
>
> O erro era de premissa: quando os dois campos carregam o mesmo texto longo,
> aquele texto é o **corpo**, e o dek é a abertura dele. Não havia corpo
> repetido para descartar — havia uma matéria no campo errado.
>
> **Só um ensaio contra produção pegou isso.** Um teste de unidade sobre caso
> inventado passaria nas duas versões.

Duas propriedades foram **verificadas contra o acervo inteiro**, não
argumentadas: **nada perde texto** (as 196 linhas que encolhem perdem só
rodapé, paywall e tag) e **a passada é idempotente** (zero linhas mudam na
segunda), que é o que a etapa 8.5 exige para rodar todo dia.

A varredura da 8.5 deixou de ser restrita às fontes do classificador — o filtro
protegia a **categoria**, e o HTML cru estava justamente nas fontes de categoria
fixa que ele excluía. A reclassificação mantém o recorte antigo, dentro do laço.
**107 fotos** foram recuperadas de dentro do corpo HTML (InfoMoney), o que
derruba o acervo sem foto de 27,1% para 25,5%.

**5. A tela de leitura mentia sobre o que tinha para ler.**

Imprimia marcação como texto (o React escapa o que recebe); rotulava "Trecho"
sobre nada; e mostrava o dek duas vezes quando ele era prefixo do corpo. O corte
do prefixo só acontece quando o dek termina em fronteira de frase — um dek que
para no meio de uma oração é resumo, e tirá-lo deixaria a matéria abrindo por
"com um panorama complexo".

**6. A medição do renderizador do briefing tinha vencido.**

A nota do `article-body` dizia que o corpo só usava `###`, sem negrito nem
listas. Contados os 89 briefings retidos:

| Sintaxe | Briefings | O que aparecia |
|---|---|---|
| `**negrito**` | **53 (60%)** | os asteriscos |
| `###` | 37 (42%) | subtítulo — funcionava |
| `##` | 26 (29%) | subtítulo, **no mesmo nível do `###`** |
| `---` | 18 (20%) | um parágrafo com três traços |
| `- item` | 7 (8%) | um parágrafo com hífen |
| `*ênfase*` | 3 (3%) | os asteriscos |

Continua **não sendo** um renderizador de Markdown: link, tabela, citação,
código e lista numerada deram **zero** nos 89 e não são reconhecidos, com teste
afirmando isso. O nível do heading virou relativo, mapeando as profundidades
presentes para níveis consecutivos **por posição, nunca por subtração** — `##`
com `####` daria `h2` e `h4` na subtração, o salto que o `heading-order`
reprova.

> **Foi a guarda de acessibilidade que avisou.** O `article-body` saiu da lista
> de nível fixo permitido: ele fixava `h2` para não abrir salto a partir do
> `h1`, e pagava achatando a hierarquia.

O prompt passou a fixar um subconjunto fechado e a **época subiu para `v2`** — a
mudança conceitual de formato que o campo foi documentado para marcar.
**Verificado renderizando os 89 pelo componente:** 394 `<strong>`, 12 `<ul>`,
56 `<hr>`, só `H2` e `H3`, nenhum nível pulado, **zero marcação no texto**.

**7. A notícia sem foto virou card de texto.**

**1.703 (25,5%)** não têm imagem em lugar nenhum do feed. Recebiam a caixa com
o placeholder de marca — um retângulo laranja com um "N" a cada quatro células,
e de largura cheia na tela de leitura.

O que entra não é "o mesmo card sem a imagem": a manchete sobe um degrau da
escala e ganha uma linha antes de truncar, o dek ganha três, e um filete da cor
da categoria segura a coluna. **Medido no navegador a 1280 px: a célula mantém
exatamente a mesma altura das vizinhas com foto — 387 px**, então o ritmo da
grade fica intacto (a única coisa que o retângulo resolvia). Manchete de 18 →
22 px, dek de 15 → 16 px, nada truncado.

O placeholder **mudou de papel**: fica com o caso em que sempre foi certo — a
foto que existe e não carrega, onde a caixa já ocupa espaço e sumir com ela
seria salto.

#### Guardas novas

| Guarda | O que impede |
|---|---|
| `design-tokens` → utilities sombreadas | usar classe de display que um `--spacing-*` sombreia; a lista **deriva dos tokens** |
| `session-nav-parity` | rota de sessão que aparece numa casca e não na outra |
| `admin-nav` | a faixa do painel colapsar pelo mesmo defeito da conta |
| `feed-text-hygiene` (25 casos) | o texto do feed voltar a chegar cru — todos colados de produção |
| `article-body-markdown` | marcação virando caractere na tela, e salto de heading |
| `story-card` (sem foto) | o placeholder voltar a ocupar a célula |

#### Números

| Verificação | Resultado |
|---|---|
| testes | **1.314 → 1.391** (791 API em 60 suítes + 600 web em 66) |
| `turbo lint typecheck test build` | **verde** |
| higiene contra as 6.669 linhas de produção | **7 classes de defeito → 0**, 0 linhas perdendo texto, 0 não idempotentes |
| 89 briefings renderizados pelo componente | **0 vazamentos de marcação**, 0 saltos de heading |
| card sem foto, medido no navegador | **mesma altura de célula (387 px)** |

#### O que ficou em aberto

- **A `/article/[date]` ainda mostra a régua `---` como `<hr>`.** É o que o
  modelo escreveu nos 18 briefings que a usam, e removê-la seria descartar
  conteúdo. O prompt já a proíbe daqui pra frente; **gatilho:** quando os 90
  dias de retenção passarem e nenhum briefing retido tiver `---`, o ramo pode
  sair do renderizador.
- **A baseline visual da §30 está desatualizada** — as 51 capturas são de antes
  do card de texto e do briefing renderizado. Não é dívida desta fase: é item
  **13.5**, e agora tem um motivo a mais para não ser pulado.

---

### 39. Verificação pós-merge da Fase 12, e o botão que dizia ter feito ✅ 2026-08-25

> Branch `fix/pipeline-trigger-truth`. O ritual completo contra produção depois
> do merge do PR #137, mais o achado que ele produziu — que não estava na Fase
> 12 e só apareceu porque a verificação foi feita.

#### O ritual, com os três passos

| Passo | Resultado |
|---|---|
| **Lighthouse**, 7 rotas | **verde**. Perf 95 · 92 · 96 · 96 · 93 · 97 · 96, e **100 em acessibilidade nas sete** |
| **Smoke E2E** (rodou sozinho no merge) | **23 passaram, 6 pulados, 0 falharam** |
| **Baseline visual** | 51 capturas rodadas, **não commitadas** — ver abaixo |

O 100 de acessibilidade na `/pt-BR/article/2026-08-25` é evidência direta de que
o mapeamento `##` → `h2` e `###` → `h3` está certo: `heading-order` mediria o
salto se estivesse errado.

**Os deploys, conferidos e não presumidos.** A Vercel publicou o commit do merge
(`032bf12a`, 15:49:31Z), e a API reiniciou 1,3 min depois do merge (`uptime` de
655 s contra 12,2 min de relógio) — o que prova o deploy do Render **nesta
direção**, ao contrário do erro que o `CLAUDE.md` já registra.

#### Seis dos sete achados da Fase 12, confirmados no ar

- **Card de texto** — 16 cards de grade na Home, 2 sem foto, medidos com
  manchete **22 px** contra 18, dek 16 px, filete `rgb(240, 122, 69)`, e
  **zero** placeholders laranja no site inteiro. Linhas da grade com alturas
  iguais (408/408, 384/384).
- **Briefing** — 9 `<strong>`, **11 `<h2>` e 10 `<h3>`**, 5 `<hr>`, 2 `<ul>`, e
  nenhum `**` visível.
- **Tag `<img>`** — não vaza mais como texto, conferido numa notícia da G1 cujo
  `content` bruto ainda abre com `<img>`.
- **Rótulo "Trecho"** — some quando não há corpo; a dica da fonte entra no lugar.
- **Faixa da conta e link de admin** — o chunk servido pela Vercel, buildado do
  commit mergeado, tem `inline-flex` e **zero** `inline-block`.

#### O sétimo não estava no ar, e a razão é o mecanismo

A higiene de texto age pela **ingestão** e pela **etapa 8.5**, e a última
execução do pipeline foi às 11:00 UTC — **antes** do merge das 15:48. Medido no
acervo logo depois: 63,8% ainda com tag HTML, 60,7% com dek acima de 320.

O efeito, medido na pior linha (`/news/81ea73f8…`, G1):

> dek de **14.950 caracteres num `<p>` sem clamp = 8,1 telas** de subtítulo
> cinza, e logo abaixo **o mesmo texto** de novo como corpo. Página inteira:
> **24 telas**.

Rodando as funções reais sobre essas linhas, a previsão do que a 8.5 faria:

| Notícia | Tela antes | Tela depois | Duplicado eliminado |
|---|---|---|---|
| G1 · Juscelino | 29.825 chars | **14.875** | 14.950 |
| Valor · Agenda | 26.264 | **13.075** | 13.189 |
| G1 · Talebã | 24.497 | **12.208** | 12.289 |

**A baseline não foi commitada por isso**: as 51 capturas documentariam um
estado transitório, e a `/news/[id]` mostra `"The post … appeared first on
InfoMoney."` no dek **e** no trecho. Recapturar continua sendo item **13.5**,
depois que o acervo estiver curado.

#### E então o botão do painel

A recomendação foi disparar o pipeline. O painel foi clicado, disse **"Pipeline
disparado com sucesso"** — e nada aconteceu:

| Sinal | Esperado se tivesse rodado | Medido |
|---|---|---|
| `generatedAt` do briefing | ~16:2x | **11:00:10Z** |
| `promptVersion` | `v2-…` | **`v1-a7d3efd7`** |
| total de notícias | > 6.669 | **6.669** |
| tag HTML no corpo | 0% | **63,7%** |
| `uptime` da API | — | 38 min, **sem reinício** |

A causa está em `triggerPipeline`, e é antiga: **idempotência por dia**. Com um
run de hoje em `SUCCESS` ou `RUNNING`, ele devolve o id **daquele** e não
executa nada. A regra está certa — dois runs no mesmo dia gerariam o briefing
duas vezes e gastariam duas chamadas de IA.

**O defeito é a resposta.** Ela era `{ status: 'started', pipelineId }` nos três
casos; o BFF traduzia para `success: true`; o painel imprimia a frase verde. E,
com schema de resposta declarado, **o schema é o contrato**: enquanto ele
dissesse `z.literal('started')`, não havia como a rota contar a diferença nem
que o serviço a soubesse.

#### A correção

- **`triggerPipeline` devolve `PipelineTrigger`** — `outcome` (`started` ·
  `already-running` · `already-succeeded-today`), `pipelineId` e `startedAt` do
  run **referido**. Os dois "já" têm desfechos separados porque levam a ações
  opostas: um pede esperar, o outro diz que não vai rodar de novo hoje.
- **O schema declara o enum**, com guarda de compilação contra o tipo
  compartilhado — o mesmo padrão de `routes/events/schemas.ts`.
- **O painel diz qual foi, com a hora.** Verde só para `started`; os outros dois
  em `text-ink-secondary`, porque verde afirmaria que algo rodou.
- **O BFF não invalida o cache quando nada rodou.** `revalidatePath` de um run
  que não aconteceu joga fora uma página quente para regenerar a mesma — e, em
  `already-running`, regenera a partir de um banco que ainda está sendo escrito.

#### O que a leitura do BFF revelou de quebra

O comentário dizia *"Pipeline concluído: invalida o cache estático"*, e a rota
da API responde **no aceite**, não na conclusão — o pipeline segue no servidor
por ~55 s. A invalidação é otimista: ela derruba o HTML velho e quem chegar
depois regenera; se a visita cair no meio da execução, a página nasce com o dado
antigo e espera o `revalidate` de 3600 s.

Ficou **dívida com gatilho**, e o comentário agora diz a verdade: esperar a
conclusão exigiria sondar `GET /api/jobs/:id`, outra chamada autenticada dentro
do `maxDuration = 30` da rota, e o cron das 11h ainda paga o cold start do
Render. **Gatilho:** a primeira queixa de ver conteúdo do dia anterior depois de
um disparo manual.

#### Guardas

| Guarda | O que impede |
|---|---|
| `pipeline.test.ts` — três desfechos | o serviço voltar a devolver só o id |
| `jobs.test.ts` — serialização do não-`started` | o schema voltar a um literal e engolir o desfecho |
| `admin-panel.test.tsx` — três mensagens | a tela voltar a dizer "disparado" sem ter disparado |
| `daily-news-api.test.ts` — não revalida | invalidar cache de um run que não aconteceu |

**Verificadas reprovando:** com o desfecho forçado a `undefined`, os dois testes
novos do painel falham — que era exatamente o comportamento de 25/08.

#### A medição que ficou pendente, e virou comando

**Em 31/08 a API estava suspensa** (item 40), então a conferência do acervo
contra o banco não pôde ser feita — o que se mediu foi o HTML estático que a
Vercel servia: 13 telas de leitura, **maior dek de 273 caracteres**, zero
rodapé, zero paywall, zero tag HTML, zero `null`, e `promptVersion:
v2-52effd41` nos briefings de 26–28/08. **A Fase 12 funcionou**; faltou o
número do banco.

E faltou porque **a medição não morava em lugar nenhum** — ela vivia num arquivo
temporário da sessão. Virou
`pnpm --filter @newranews/api archive:hygiene`: varre `/api/news`, conta as seis
classes de defeito, e sai 1 se alguma tiver linha, 2 se a API não responder.
Mesmo padrão do `capture-visual-baseline.mjs` — manual, contra produção, com a
saída servindo de evidência.

Os três caminhos foram verificados contra uma API de mentira: acervo sujo
(6 classes acusadas, com exemplo em cada), acervo limpo, e API fora (explica em
vez de estourar com `Unexpected token '<'`, que foi como a primeira versão
morreu).

#### Números

| Verificação | Resultado |
|---|---|
| testes | **1.391 → 1.399** (794 API em 60 suítes + 605 web em 66) |
| `lint` · `typecheck` · `test` · `build` | **verde** |
| guardas exaustivas (docs, contrato, autorização) | **84 verdes** |

---

### 40. A API suspensa por esgotar o plano free, e o keep-alive janelado ✅ 2026-08-31

> Branch `fix/keep-alive-window`. Incidente de produção, não fase. O que o
> derrubou não foi código: foi uma conta que ninguém tinha feito.

#### O que aconteceu

Em **29/08/2026, ~13:06 UTC**, a API parou de responder. Não era hibernação — o
Render devolvia **HTTP 503 com a própria página de suspensão**, em 0,24 s, três
tentativas seguidas. Um cold start leva 30–60 s e devolve 200.

O painel do Render dizia: *"Free usage limit reached — Your service is now
suspended until the next billing period."*

#### A conta

O plano free do Render **não cobra requisição — cobra tempo de instância
ligada**: 750 h/mês por workspace, zerando no dia 1º. O serviço dorme sozinho
depois de ~15 min sem tráfego.

O keep-alive era um monitor do UptimeRobot pingando **a cada 5 min, o tempo
todo**. Como 5 < 15, o serviço **nunca dormia**:

```
ligado 24/7  ×  31 dias  =  744 h
teto do free             =  750 h
folga do mês inteiro     =    6 h   (0,8%)
```

> **A medição que provava isso já estava no `CLAUDE.md`, com o sinal trocado.**
> Em 24/08 ela foi registrada como boa notícia: *"a API não estava hibernando —
> o `uptime` cresceu 1.878 s numa janela de relógio de 1.881 s sem uma única
> requisição minha"*. Uptime crescendo 1:1 com o relógio **é** a definição de
> 24/7. A pergunta feita era "ela está dormindo?"; a que faltou era "quanto
> custa ela não dormir?".

**Um número não fecha, e está registrado por isso.** Ligado 24/7 desde o dia 1º,
a API sozinha chegaria a **~685 h** em 29/08 — abaixo das 750. A suspensão
naquele dia sugere **um segundo serviço free no mesmo workspace**. O
`render.yaml` declara só um; o painel pode ter outro criado à mão. **Conferir a
página de uso do Render é o primeiro passo se repetir.**

#### O estrago, medido

O site **não caiu** — as telas de leitura são estáticas com ISR e o
`nullUnlessPublishing` mantém a última página boa no ar. Ele congelou:

| | Estado em 31/08 |
|---|---|
| Home, `/about`, `/en` | 200, servindo o HTML de **29/08 13:06** (`X-Vercel-Cache: STALE`) |
| `/news` | carrega, mas "Não foi possível carregar", oito facetas em `0` |
| `/article/29`, `/30`, `/31` | **HTTP 500** |
| `/news-sitemap.xml` | 200 **com zero URLs** |

#### A decisão

**Janela de 06:00–00:00 BRT** (09:00–02:59 UTC), ping a cada 10 min:

```
18,25 h  ×  31 dias  ≈  566 h    contra 750 h
folga                ≈  184 h    (25%)
```

Duas razões para estas horas: o **pipeline das 11:00 UTC cai dentro dela** (a
API já está acordada quando ele chega), e a madrugada é quando ninguém lê — e o
custo de dormir ali é pequeno, porque Home, briefing e página de notícia são
estáticas com ISR. Quem sente é a `/news`, que é CSR: ~5 s de esqueleto na
primeira visita depois da janela fechada.

**Saiu do UptimeRobot e foi para o GitHub Actions.** Janela de horário no
UptimeRobot é recurso pago — o free só pausa monitor à mão. O repositório é
público, e para repositório público o Actions é gratuito e sem teto de minutos:
a janela virou `.github/workflows/keep-alive.yml`, versionada e revisável, sem
depender de painel de terceiro. **O agendamento do GitHub atrasa**, e aqui isso
custa um cold start para quem chegar na janela perdida — não é gate. **Gatilho
para trocar por cron dedicado:** a `/news` abrir fria em horário comercial com
frequência que incomode.

**O Lighthouse mudou de hora junto**, de 09:00 para 12:00 UTC na segunda. As
09:00 UTC passaram a ser o minuto exato em que a janela abre, e medir enquanto a
API acorda é a armadilha do cold start de novo — a mesma que a auditoria da Fase
8 já custou. 12:00 UTC está no meio da janela e **depois** do pipeline, então o
que se mede é o conteúdo do dia.

#### O que não precisou mudar

**Nenhuma linha de código.** O `lib/timeouts.ts` sempre foi escrito para uma API
que dorme — o cabeçalho dele abre em "o plano free do Render, que hiberna com
~15 min sem tráfego", e os 8 s de `API_TIMEOUT_MS` foram dimensionados **acima**
do cold start medido (4,9 s) e abaixo do teto de 10 s da função da Vercel. O
keep-alive é que era a exceção; a janela devolve o sistema ao comportamento para
o qual ele foi projetado.

As duas defesas independentes continuam: o aquecimento no workflow do Lighthouse
e o prazo do `timeouts.ts`.

#### Alternativas pesquisadas, e por que não

| Opção | Custo | Por que não agora |
|---|---|---|
| Render Starter | US$ 7/mês | resolve tudo; fica como a escolha se a janela incomodar |
| Koyeb free | R$ 0 | **sem teto de horas**, mas 0,1 vCPU e 512 MB — o pipeline diário faz IA e renormaliza 6.669 linhas; migrar sem medir seria trocar um problema por outro |
| Fly.io | ~US$ 2/mês | free tier acabou; é o sempre-ligado mais barato se for para pagar |
| Railway | ~US$ 5/mês | sem free tier permanente |
| Dobrar a API no Next (Vercel) | R$ 0 | cabe no Hobby (2 crons/dia, 300 s), mas são 34 rotas Fastify com plugins e as métricas em memória morrem no serverless — semanas para resolver um problema de US$ 7 |

---

### 41. O README padronizado, e o número que envelheceu em oito arquivos ✅ 2026-08-31

> Branches `docs/standardize-readme` (PR #141, mergeado) e
> `docs/sync-after-readme-standard`. Padronização de documento, não fase.

#### O pedido, e o que ele virou

O pedido era aplicar o `README-GENERATOR.md` — uma especificação de README
padronizado para os quatro repositórios do portfólio (TRAK Assessoria,
Repertório Progressivo, Newra News, Netsheet Engine). A regra central dele é
uma só: **toda afirmação sobre stack, comando, feature ou deploy precisa vir de
um arquivo real do repositório**; o que não for verificável vira pergunta ou é
omitido.

Aplicá-la ao README existente **encontrou cinco afirmações que tinham deixado
de ser verdade** — e nenhuma tinha sintoma. O README é o único documento do
repositório que ninguém guarda: `lint`, `typecheck`, `build`, 1.399 testes,
Lighthouse e smoke passavam por cima de todas.

| O que o README dizia | O que é verdade | Desde |
|---|---|---|
| "Swagger em `/api/docs`" na seção de produção | `isDocsUiEnabled()` devolve `false` em produção — foi assim que `@fastify/static` saiu do processo | Fase 9 |
| "13 feeds RSS" | 12. A Reuters saiu porque `feeds.reuters.com` devolve NXDOMAIN | 24/08 |
| Screenshots de `docs/screenshots/` | São de **16/08**, quatro dias antes de o redesign começar | 20/08 |
| Sem tabela de variáveis de ambiente | São 30, em três `.env.example` | sempre |
| Só português | O padrão exige par bilíngue espelhado | — |

O de produção era o mais caro dos cinco: **um endereço que o leitor tenta e não
existe**. Os outros envelhecem em silêncio; esse falha na cara de quem confiou.

#### O que foi entregue

`README.md` em inglês como padrão e `README.pt-BR.md` espelhado — 281 linhas
cada, 15 seções na mesma ordem. As três telas apontam para
`docs/v2/baseline-v2/`, **em vez de manter cópia própria**: o diretório é
reescrito a cada fase com os mesmos nomes, então a recaptura da 13.5 conserta
os dois de uma vez. Foi a cópia própria que envelheceu quinze dias sem ninguém
ver. **Isto fecha a dívida dos screenshots que a 13 herdava** (item 37).

A coluna "obrigatória" da tabela de env saiu do `envSchema` do Zod, não de
suposição: só `DATABASE_URL`, `GEMINI_API_KEY`, `GROQ_API_KEY` e `JOB_SECRET`
não têm default nem `.optional()`. E as três métricas impressas foram medidas —
`pnpm test` para os testes, `playwright test --list` para os 29 specs, os
`vitest.config.ts` para o piso de 70%. As porcentagens exatas de cobertura
ficaram **de fora**, porque `test:coverage` não foi rodado.

#### O achado que virou guarda

O `13` estava escrito em **oito** arquivos: os dois `CLAUDE.md`, dois
diagramas, a peça de portfólio, o plano da V2, o README, e o parágrafo do
**próprio `rss.provider.ts`** que conta a história da remoção da Reuters e
seguia dizendo treze ao explicar por que uma suíte não deve bater em todas as
fontes.

**Remover uma fonte é uma linha; a contagem dela está escrita em prosa, longe
do array, em arquivos que a mudança não abre.** O `tsc` não lê prosa e a suíte
não lia. Hoje lê: `apps/api/tests/docs/feed-count-drift.test.ts` compara
`rssSources.length` com a contagem escrita nos nove arquivos vivos, nas quatro
formas em que este repositório a escreve (`12 feeds`, `doze feeds`,
`twelve RSS feeds`, `(12 fontes)`).

A lista de arquivos é **explícita**, e é o ponto: `docs/progress.md` — este
arquivo — e a §74 do plano da V2 guardam o `13` de propósito. O primeiro é
diário, a segunda cita o README de 15/08 nomeando a URL de onde copiou.
Corrigir os dois seria reescrever o passado.

**A guarda reprovou na estreia, sobre o texto que a anuncia.** A armadilha
escrita no `CLAUDE.md` para explicar o defeito citava a string velha entre
aspas, e o regex não distingue "afirmo treze" de "cito quem dizia treze". É a
quinta vez que este projeto tropeça na mesma família — guarda estática vê
caractere, não intenção — e a primeira em que o tropeço apareceu antes do
merge, porque desta vez a guarda foi quebrada de propósito para conferir que
reprova.

#### O smoke vermelho, que não era do merge

O merge do PR #141 deixou o `Smoke E2E` vermelho: **3 falharam, 6 puladas, 20
passaram**. Ele falhou igual nos merges #139 e #140, antes deste PR.

Sonda direta: `https://newra-news-api.onrender.com/api/health` devolve **HTTP
503 "This service has been suspended"** em 0,51 s. É a suspensão do item 40 —
as horas do plano free acabaram em 29/08 e voltam no dia 1º.

O que separa as três que caem das 20 que passam é **precisar da API viva**: a
busca por `brasil`, o hero abrindo a matéria e o briefing do dia. As que passam
são servidas pela ISR — inclusive "a listagem carrega com contagem e cards" e
"a contagem das facetas não é zero". **O site de pé com o backend suspenso é o
comportamento desenhado**, e o smoke é o instrumento que mostra a diferença.

#### As duas dívidas de documentação que fecharam junto

**`docs/screenshots/` foi apagado.** Os três `.png` de 16/08 ficaram órfãos
quando o README passou a apontar para a `baseline-v2`, e não havia o que
recuperar deles: são a V1. A lição fica: **captura de tela que mora fora do
conjunto que o ritual recaptura é cópia condenada a divergir** — foi por morar
sozinha que essa envelheceu quinze dias sem ninguém ver.

**`docs/presentation.md` foi reescrito.** A peça de portfólio era de 16/08 e
descrevia a V1 inteira. O que estava errado nela, além do desenho:

| Dizia | É |
|---|---|
| 422 testes (330 API + 92 web) em 49 suites | 1.409 em 127 (804 API/61 + 605 web/66) |
| cobertura backend 97% — e 94% três parágrafos depois | API 98,77% stmts, web 72,79%, medidos em 31/08 |
| Lighthouse 96/96/96/100 | sete rotas, medianas de 92 a 97 (24/08) |
| UptimeRobot mantém o servidor ativo | é o que **causou** a suspensão; hoje é GitHub Actions janelado |
| pipeline de 9 estágios | onze — nove numeradas mais a 7.5 e a 8.5 |
| Swagger em `/api/docs` (produção) | só em desenvolvimento, desde a Fase 9 |
| `docs/diagrams/system-architecture.mmd` | a extensão é `.mermaid` — o link estava quebrado |
| painel dev-only `/dev/dashboard` | não existe mais |
| branch `dev` é a fonte da verdade | `dev` está **182 commits atrás** da `main` |
| "~92 dias de uptime" | a API estava suspensa quando isto foi escrito |

Os "desafios reais" eram todos da V1. Foram trocados pelos sete da V2, que são
melhores como material de entrevista porque cada um tem número e guarda: a
multiplicação de 744 h contra 750 h, o `revalidate` que não revalidava, o token
`--spacing-block` gerando um segundo `.inline-block`, a correção de dado que
quase apagou 5.635 corpos, o balde de rate limit compartilhado por
`request.ip`, a 404 sem folha de estilo e o botão que confirmava sem ter feito.

**O bloco de volume diário saiu, e não foi substituído.** A API está suspensa;
medir produção sem produção no ar é chute. O documento carrega a lacuna com o
motivo escrito e o comando que a preenche.

#### Dívida que não fecha aqui

- O diagrama ER continua com 3 entidades contra 12 no schema (item 37).
- Zero tags e nenhum `CHANGELOG.md`.
- A newsletter continua sem entregar a assinante real — domínio não verificado
  no Resend.

---

### 42. O keep-alive sai, e o que ele comprava foi medido ✅ 2026-09-01

> Branch `chore/drop-keep-alive`. Fecha o incidente do item 40 — não com uma
> terceira tentativa de manter a API acordada, e sim medindo o que isso valia.

#### Duas tentativas, e por que as duas falharam

**1. UptimeRobot a cada 5 min, o tempo todo** (até 31/08). Como o Render dorme
aos 15 min e 5 < 15, o serviço **nunca dormia**: 744 h contra o teto de 750, com
0,8% de folga. Em 29/08 as horas acabaram e a API foi suspensa até o dia 1º —
**três briefings perdidos** (30/08, 31/08, 01/09).

**2. Workflow do GitHub Actions com janela de horário** (31/08 → 01/09). Medido:
**2 execuções contra 46 esperadas**, uma delas 47 min atrasada e fora da janela.
A documentação do GitHub pede **no mínimo 15 min** em repositório público e avisa
que execução agendada é despriorizada e descartada em silêncio. O Render dorme
aos 15 min: os dois números não deixam folga, e **o mecanismo não podia
funcionar**. Foi por isso que a API estava fria às 11h de 01/09, quando o
pipeline tentou disparar.

#### O que faltou fazer antes das duas: medir o que o keep-alive comprava

| De onde a tela tira o dado | Rotas | O leitor espera? |
|---|---|---|
| estática + ISR, dado no HTML | `/`, `/news`, `/article`, `/about`, `/newsletter` | **não** |
| ISR sob demanda, 1ª visita ao item | `/news/[id]`, `/article/[date]` | sim, uma vez, **com esqueleto** |
| busca no navegador | `/account`, `/favorites`, `/admin`, `/news` ao filtrar | sim, uma vez, **com esqueleto** |

A `/news` **já traz a primeira página e as facetas no HTML estático**
(`prefetch(getNews(1, 20))`), e o TanStack Query tem `staleTime` de 5 min — ela
nem busca ao montar. Nenhuma rota deixa alguém diante de tela em branco: os
`loading.tsx` e os esqueletos já existem.

**O que o keep-alive comprava:** ~5 s de esqueleto na primeira matéria aberta em
cada sessão — e essa requisição acorda a API para o resto da visita.
**O que custava:** 99% da cota mensal, e dois dias de site congelado.

> **A premissa vinha da Fase 8**, quando o cold start derrubava o Lighthouse. As
> fases seguintes puseram prefetch e ISR em tudo, e ninguém reconferiu se ela
> ainda valia. **Premissa herdada tem prazo de validade igual à medição que a
> originou.**

#### O que já não depende de a API estar acordada

- **O pipeline** — a rota do cron aquece antes de disparar (item 40 do PR #143).
- **O gate do Lighthouse** — o passo "Warm production" bate duas vezes em cada
  URL antes do collect, desde 23/08.

#### Medido e recusado: assar as páginas de detalhe

A ideia era pôr as matérias recentes no `generateStaticParams` em vez de `[]`,
eliminando o único caso em que o leitor espera.

**O custo de build é baixo** — medido em 01/09, com a API quente, ~199 ms por
página (duas chamadas em paralelo), nos dois idiomas:

| Matérias assadas | Chamadas | Somado ao build |
|---|---|---|
| 36 (as da Home) | 144 | **~2 s** |
| 300 | 1.200 | ~20 s |
| 7.724 (tudo) | 30.896 | ~8,5 min |

**O que o mata é a validade.** Medido no mesmo dia: **as 36 matérias linkadas na
Home são todas do dia** (idade mediana 0,0 dias), e o pipeline traz ~530 novas
por dia. O `generateStaticParams` roda **só no build** — assar hoje cobre hoje, e
amanhã a Home linka 36 outras, nenhuma assada.

Só funcionaria com **rebuild diário** disparado depois do pipeline: peça nova,
com falha própria, que **descarta o cache da ISR inteiro a cada deploy** —
deixando todas as páginas frias, o oposto do objetivo. Seria a terceira
engenhoca para o mesmo problema.

#### Consumo, antes e depois

```
24/7 (até 29/08):   744 h/mês   99,2% do teto   <- suspendeu a API
janela (31/08):    ~566 h/mês   75%             <- nunca funcionou de fato
sem keep-alive:  ~60–150 h/mês  8–20%
```

#### Se um dia incomodar

Nessa ordem, e só com medição na mão: **cron-job.org** (gratuito, mas sem SLA e
sem garantia de execução, por escrito na documentação deles) ou **Render Starter
a US$ 7/mês** (sem hibernação, sem teto, sem terceiro). O runbook está em
`docs/setup.md` §9.0, junto com o que conferir se a API for suspensa de novo.

---

### 43. O título e o dek do briefing paravam de mostrar Markdown ✅ 2026-09-01

> Branch `fix/briefing-dek-markdown`. Nasceu de um sintoma de uma linha na
> verificação do item 39 — `**` aparecendo no subtítulo do briefing — e a
> medição achou um campo pior do que o procurado.

#### O sintoma, no briefing de 01/09 em produção

```
** no dek?         true
<strong> no dek?   false
<strong> no corpo? true
```

A Fase 12 ensinou o **corpo** a renderizar ênfase (`article-body`). O
**subtítulo** ficou de fora, e ninguém percebeu porque os dois vêm do mesmo
documento: `Article.summary` é derivado do Markdown que a IA escreve — a
primeira linha que não é heading — e vai direto para a tela, sem renderizador.

#### O que a medição achou, nos 88 briefings retidos

| | |
|---|---|
| subtítulo com marcador de ênfase | 19 (**21,6%**) |
| **título** com marcador de ênfase | 30 (**34,1%**) |
| **título** abrindo com o rótulo `TÍTULO:` impresso como valor | 17 (**19,3%**) |
| subtítulo que é só um rótulo (`Introdução:`) ou uma régua (`---`) | 15 (**17,0%**) |

**O campo mais afetado não era o que se procurava.** O título aparece no `h1`,
na aba do navegador, no card de cada mês do histórico, no cartão de
compartilhamento, no JSON-LD e **no sitemap do Google Notícias** — e o que
estava escrito em 17 deles era `**TÍTULO:** "Braços de Incêndio: Brasil Vivia
em Alerta..."`.

#### Separando por época do prompt, e a conclusão que muda o remédio

| Época | n | dek com ênfase | título com ênfase |
|---|---|---|---|
| `v2` (atual) | 5 | **2** | 0 |
| `v1` | 5 | 0 | 0 |
| `null` (antes do versionamento) | 78 | 17 | 30 |

As 30 do título e as 15 do subtítulo degenerado estão **todas** na época
anterior ao versionamento — o prompt as encerrou. **A ênfase no dek não:** ela
está em 2 dos 5 briefings da época `v2`, que é a que roda hoje. Por isso o
remédio não podia ser "ajusta o prompt e espera".

#### As duas pontas, e por que as duas

- **Na gravação** (`parseMarkdownResponse`, API): tira os marcadores dos dois
  campos e passa a derivar o subtítulo da primeira linha que é **prosa** —
  pulando régua, item de lista e rótulo de seção. Conserta o briefing **novo**
  em todo consumidor de uma vez, inclusive **o e-mail da newsletter**, que não
  passa pela web.
- **Na exibição** (`lib/markdown-text.ts`, web): cobre os **90 dias já
  gravados**, que a correção de gravação não alcança. `plainTitle` também tira
  o rótulo `TÍTULO:` e, **só quando o rótulo estava lá**, as aspas em volta —
  sem rótulo, aspas ficam, porque uma manchete pode ser inteira uma citação.

É a mesma divisão de trabalho da higiene de texto da Fase 12: a ingestão
conserta o que entra, a tela cobre o que já está lá.

#### Ensaiado contra produção antes de mergear

Reprocessando os 88 briefings com a regra nova de derivação:

```
subtítulo degenerado:  15 antes  ->  0 depois
21 dos 88 summaries mudariam, e cada substituição é uma frase de abertura real
```

E as duas funções de exibição sobre os mesmos 88: **30 títulos e 19 subtítulos
mudam, 0 campos viraram vazios, e 0 títulos perderam texto além dos
marcadores.** A regra do projeto — correção de dado se ensaia contra produção —
é o que separou "tira o rótulo" de "come a manchete".

#### O detalhe que quase passou: a deduplicação usa o dek como chave

`parseArticleBody` remove o parágrafo de abertura do corpo comparando-o com o
dek exibido. Com o dek limpo e o corpo ainda em Markdown, a comparação **para
de casar** e o parágrafo apareceria **duas vezes** — uma como subtítulo, outra
abrindo o corpo. A comparação passou a normalizar as duas pontas, o que também
a deixa indiferente a de qual lado veio o texto: briefing novo (gravado limpo)
e retido (gravado com marcador) deduplicam igual.

#### Guardas

- **`tests/lib/markdown-text.test.ts`** (web) — comportamento das duas funções
  mais **uma varredura exaustiva**: todo módulo de produção que lê `.title` ou
  `.summary` de um briefing tem de envolver a leitura no helper. Confirmada
  reprovando: tirar o `plainTitle` de um dos oito pontos acusa
  `components\editorial\briefing-card.tsx:84 — briefing.title`. Ela existe
  porque este defeito nasceu de um campo exibido sem que ninguém perguntasse de
  onde vinha.
- **`tests/providers/ai-utils.test.ts`** (API) — 8 casos novos, e **5 deles
  reprovam contra o código antigo** (os outros 3 são regressão: o corpo
  continua com o Markdown intacto, `3 * 4 = 12` não é ênfase, e "Introdução a
  um dia difícil" é manchete, não rótulo).

**1.416 testes em 127 suítes → 1.433 em 128** — +8 na API, +9 na web, que é
o arquivo novo. (A contagem escrita no `CLAUDE.md` dizia 1.409: estava 7 testes
atrás, e foi medida de novo em vez de incrementada.)

#### O que fica em aberto, e é limitado

Os **15 subtítulos degenerados já gravados** continuam degenerados na tela: o
texto certo não está no campo, e a exibição não tem de onde tirá-lo. Trocá-lo
pela primeira linha do corpo ali seria pior — é ele que a deduplicação usa como
chave, e um dek que não casa com o corpo faz o parágrafo de abertura aparecer
duas vezes. **Eles envelhecem com a retenção de 90 dias**: o mais novo é de
05/08/2026 e sai em ~03/11/2026. Nenhum briefing novo pode nascer assim.

---

### 44. Os diagramas descreviam um sistema que não existe mais ✅ 2026-09-01

> Branch `docs/diagrams-v2`. **Item adiantado da Fase 13.5** — nasceu de uma
> pergunta feita enquanto o README era atualizado ("os diagramas estão certos?")
> e a conferência achou muito mais do que a pergunta supunha.

#### O que a conferência mediu

Os quatro `.mermaid` eram de **16/08/2026** e tinham sido tocados **uma única
vez** desde então, no commit que corrigiu a contagem de feeds (`3db28ce`). A
sintaxe dos seis diagramas do repositório — os quatro do diretório e o bloco
embutido em cada README — estava **correta**: os seis passam no parser do
Mermaid 11 e renderizam. O defeito era inteiramente de conteúdo.

| Diagrama | O que dizia | O que é |
|---|---|---|
| `er-diagram` | 4 tabelas, 2 enums | **12 tabelas, 8 enums** |
| `system-architecture` | keep-alive do UptimeRobot | **removido em 01/09** (item 42) |
| `system-architecture` | Swagger em produção | **desregistrado desde a Fase 9** (`isDocsUiEnabled`) |
| `system-architecture` | shadcn/ui | **Base UI** — `shadcn` é só o CLI, em devDependencies |
| `system-architecture` | 4 rotas de frontend | **15 páginas** em `app/[locale]` |
| `system-architecture` · `data-flow` | pipeline de **9 etapas** | **11** — faltavam a 7.5 e a 8.5 |
| `pipeline-sequence` | `{ status: "started", pipelineId }` | `{ outcome, pipelineId, startedAt }` desde o item 39 |
| `data-flow` | `S5 -.-> S9` rotulada "artigo gerado alimenta o site" | aresta sem sentido: sai da seleção e chega nas métricas |

O `er-diagram` ainda declarava, no cabeçalho, que **"as tabelas são
desacopladas por design (sem FKs)"**. Deixou de ser verdade quando a Fase 12
criou `BriefingSource` e `PipelineEvent`, as duas com FK real e
`onDelete: Cascade`.

#### O padrão, e é o mesmo do item 41

**Nada acusava.** `tsc` não lê diagrama, a suíte não lia, e ninguém reabre um
`.mermaid` ao acrescentar uma tabela ou uma rota — a mudança não abre o arquivo.
É a família da contagem de feeds em oito lugares: **descrição que mora longe do
que descreve, e que só um leitor humano compara**. A diferença é que aqui o
número não está escrito em prosa, está na *forma* do desenho.

Corolário do item 41, agora com um segundo caso: **documento não tem CI**. As
duas vezes que este projeto pegou deriva de documentação foi porque alguém
mandou conferir afirmação por afirmação contra um arquivo real — nunca porque
uma ferramenta reclamou.

#### Seis diagramas, e os dois novos são função que não aparecia em lugar nenhum

Os quatro foram reescritos contra o código, e entraram dois:

- **`frontend-routes.mermaid`** — as 15 páginas de `app/[locale]`, agrupadas por
  função (leitura pública · conta · admin), com o modo de renderização de cada
  uma e o papel do `middleware.ts`. O de arquitetura mostrava quatro rotas, e
  espremer quinze mais os modos ali dentro deixaria os dois ilegíveis.
- **`auth-flow.mermaid`** — a sessão, que é o mecanismo menos óbvio do sistema:
  o cookie do next-auth **nunca chega na API**, que está em outro host, e quem
  atravessa é um JWT HS256 com escopo (`purpose`) assinado com o segredo
  compartilhado. Contas, favoritos, preferências e admin existem desde a Fase 6
  e não apareciam em diagrama nenhum.

#### Duas coisas sobre o parser do Mermaid, que custaram uma rodada

As duas só aparecem quando se renderiza de verdade, e **as duas foram
introduzidas pela reescrita** — não existiam nos arquivos de 16/08:

1. **Linha com `%%` sozinho quebra `flowchart` e `erDiagram`.** O comentário
   vazio não consome a quebra de linha, e o parser recebe `%%%%flowchart TB`.
   Em `sequenceDiagram` a mesma linha passa — são parsers diferentes, e foi por
   isso que o `auth-flow` passou verde enquanto os outros quatro reprovavam.
   Separador de parágrafo em cabeçalho de diagrama precisa de conteúdo: `%% ---`.
2. **`;` dentro de `Note` de `sequenceDiagram` termina a instrução.** O resto da
   nota vira instrução nova e o erro sai a três linhas de distância, apontando
   para texto que está certo.

#### Guarda

**`apps/api/tests/docs/diagram-drift.test.ts`** — compara **conjuntos derivados
da fonte**, não contagens:

- toda `model` do `schema.prisma` tem entidade no ER, e todo `enum` é nomeado;
- toda `page.tsx` de `app/[locale]` está no mapa de rotas — **e o mapa não
  inventa rota que não existe**, que é a direção oposta e pega o desenho que
  envelhece ao contrário;
- toda etapa que o pipeline **anuncia** (o segundo argumento de
  `logPipelineEvent`) está desenhada nos dois diagramas do pipeline.

**Contagem seria a guarda errada aqui.** A etapa 2 acontece dentro dos providers
e não grava `PipelineEvent`: contar marcadores dá 10, a prosa diz 11, e os dois
estão certos. Conjunto não tem esse problema — exige que toda etapa que se
anuncia esteja desenhada, e não opina sobre as que não se anunciam.

**Confirmada reprovando, uma quebra por asserção:** entidade renomeada, enum
renomeado, `/about` virando `/aboutx` (que reprova nas duas direções de uma vez)
e `8.5` virando `8.6` derrubam **5 testes**, e o caso da `pipeline-sequence`
segue verde — o que prova que o `it.each` é por arquivo, e não uma asserção só
disfarçada de duas.

O `data-flow.mermaid` também entrou em `ARQUIVOS_VIVOS` da
`feed-count-drift.test.ts`, porque passou a nomear a contagem de feeds.

**1.433 testes em 128 suítes → 1.441 em 129** — +8 na API (7 do arquivo novo,
1 do arquivo a mais na guarda de feeds), web inalterada em 618.

#### O que veio junto, porque estava errado pelo mesmo motivo

- **`docs/presentation.md`** — o diagrama ASCII ainda mostrava o keep-alive do
  GitHub Actions, e apontava a seta para o **Postgres**. Trocado pelo aquecimento
  antes do disparo, com o Resend e o BFF que faltavam.
- **Os dois READMEs** — a aresta `DB --> SEL` sugeria que a seleção lê do banco
  (ela roda sobre a lista deduplicada em memória), e a prosa chamava o cron
  interno do Fastify de *fallback*, que é justamente o que o comentário do
  `daily-pipeline.job.ts` nega com todas as letras: *"não é rede de segurança —
  é o caminho feliz de quando a API já estava acordada"*.

#### O que fica em aberto

A **recaptura da baseline visual** da 13.5 continua pendente — é o outro item
que envelheceu pelo mesmo motivo, e não foi tocado aqui. As 51 capturas de
`docs/v2/baseline-v2/` seguem sendo de antes da Fase 12, e são elas que as três
telas do README apontam.

### 45. A NewsData que não tinha voltado vazia, e o run que ninguém sabia medir ✅ 2026-09-02

> Branch `claude/newra-pipeline-news-collection-ff9b6f`, PR #148. Nasceu de uma
> pergunta de uso — *"as notícias estão todas de ontem, o pipeline rodou hoje?"*
> — e a resposta foi **sim**. O que a investigação achou não foi o defeito
> procurado, e sim o fato de que **não havia como responder aquela pergunta**.

#### A pergunta, e a resposta medida

O run de 02/09 abriu às 11h00 UTC, colheu **351 notícias de 42 fontes** e gravou
o briefing 12 s depois. Contra os seis runs anteriores, está dentro da faixa:

| coleta | itens | fontes | RSS | NewsData (veículos) | publicadas na véspera |
|---|---|---|---|---|---|
| **02/09** | **351** | **42** | 284 | **67 (34)** | 39% |
| 01/09 | 444 | 51 | 371 | 73 (39) | 36% |
| 29/08 | 425 | 49 | 351 | 74 (38) | 52% |
| 28/08 | 385 | 54 | 312 | 73 (43) | 42% |
| 27/08 | 367 | 36 | 299 | 68 (26) | 38% |
| 26/08 | 376 | 47 | 305 | 71 (36) | 39% |

O que o leitor viu tem duas causas somadas, e nenhuma é defeito: **o pipeline
roda uma vez por dia, às 08h de Brasília** — às 22h, a matéria mais nova do site
tem catorze horas — e **~39% de toda colheita chega carimbada com a data da
véspera**, porque é assim que os feeds publicam. Os 39% de 02/09 são a norma da
série, não uma anomalia.

#### O erro de medição, que é o achado transferível

A primeira leitura afirmou que **a NewsData tinha voltado vazia em 01/09** e que
aquele run colhera 49 itens de 7 fontes. Estava errado, e a conclusão saiu antes
da verificação.

A causa: a varredura pegou as **400 notícias mais recentes por `publishedAt`** e
agrupou por dia. O run de 02/09 (351 itens) cabe inteiro nessa janela; o de
01/09 (444) não — só os 49 mais frescos dele apareciam, e o que sobrava era RSS
por acaso, então a ausência da NewsData virou conclusão. **Foi a cauda de um
recorte lida como se fosse um run.** Varrendo 2.600 itens e agrupando por
`createdAt`, os números da tabela aparecem e a NewsData está lá todos os dias.

`publishedAt` é do veículo e `createdAt` é do pipeline — **só o segundo responde
"o que esta execução trouxe"**. Está na lista de armadilhas do `CLAUDE.md`.

A NewsData foi sondada direto para fechar a questão: as **oito categorias
respondem 200** entre 0,52 s e 0,84 s, isoladas e nas oito em paralelo, e os
limites do plano free (`X-RateLimit-Limit: 60` por janela e
`X-API-Limit-Remaining: 190` de 200 diárias) estão longe das **8 requisições por
dia** que o pipeline gasta.

#### O defeito real, achado de passagem

**Não havia como distinguir um run de 351 de um run de 49.** O provider de RSS
trata falha por feed desde o começo — `Promise.allSettled`, prazo de 30 s por
requisição e um aviso por fonte vazia. O da NewsData.io não tinha nenhuma das
três, e a assimetria não tinha motivo.

| Ponto | Antes | Agora |
|---|---|---|
| `newsdata.provider.ts` | `Promise.all` nas 8 categorias | `Promise.allSettled` — uma que rejeita não descarta as outras sete |
| `newsdata.provider.ts` | `fetch(url)` sem prazo | `AbortSignal.timeout(15_000)` |
| `newsdata.provider.ts` | oito respostas viram um número só | aviso por categoria que falha ou vem vazia |
| `news-fetcher.service.ts` | `console.warn` no stdout do Render | `warnings: FetchWarning[]` no retorno |
| `pipeline.service.ts` | run degradado idêntico a run bom | `PipelineEvent` `WARN` + `DailyMetric.pipelineErrors` |

**Feed vazio é registrado e não conta como erro.** No run de 02/09, quatro dos
doze feeds ficaram legitimamente vazios — os especializados publicam devagar.
Contá-los faria a luz acender todo dia, e luz que acende todo dia é luz que se
aprende a ignorar; mas a fonte que morreu de vez só aparece na sequência de dias
vazios, que é exatamente como a Reuters passou despercebida.

**Degradado não é falho:** o run continua `SUCCESS`, porque o dia teve briefing.
Reprová-lo mentiria na direção oposta.

**823 → 837 testes**, em 62 suítes. Os dois que afirmavam `rejects.toThrow`
codificavam o contrato antigo — uma categoria ruim derrubando as oito — e
viraram as três formas de uma categoria falhar sem levar as outras. As guardas
foram verificadas quebrando o código de propósito (`allSettled` de volta para
`all`, bloco de `warnings` desligado) e reprovaram.

#### O que fica em aberto

O sinal existe, mas **ninguém é avisado**: `GET /api/dev/logs` lista só runs
`FAILED`, e um run degradado fecha em `SUCCESS`. Ler o `WARN` exige abrir
`GET /api/dev/logs/:id` ou olhar `DailyMetric.pipelineErrors`. **Gatilho para
alarme de verdade:** o primeiro run com `pipelineErrors > 0` que passar
despercebido por mais de um dia.

---
### 46. A etapa 8.5 segurava o event loop, e o Render matava a instância ✅ 2026-09-03

> Nasceu de um e-mail do Render — *"HTTP health check failed (timed out after 5
> seconds)"* — e da pergunta de sempre: **o pipeline de hoje rodou?** Rodou, e o
> briefing foi gravado **2 s antes** de o processo parar de responder. A margem
> era essa.

#### O que a verificação mediu, antes de olhar o log

Tudo verde do lado de fora: briefing de 03/09 no ar, **377 itens de 45 fontes**
(faixa normal — 02/09: 351/42, 01/09: 442/51), NewsData presente, CI, Gitleaks e
Smoke E2E verdes no merge da madrugada, e o `archive:hygiene` fechando com
**`Acervo limpo`** — as seis classes de defeito da Fase 12 em **0,0%** sobre
8.190 linhas.

**E foi a higiene limpa que deu a primeira pista.** A etapa 8.5 tocou **zero
linhas antigas** naquele run: em regime ela varre o acervo inteiro e **não
escreve nada**. O trabalho que derrubou a API era trabalho jogado fora.

#### A linha do tempo, do log do Render

```
11:00:20.717  artigo persistido (etapa 7)
11:00:22.677  /api/health -> 200 em 0,84 ms      <- ultimo respondido
              --- 45,2 s de silencio absoluto ---  ~9 health checks perdidos
11:01:07.926  [server] received SIGTERM            <- o Render matou a instancia
11:01:19.913  Server listening (processo novo)
11:02        e-mail do alerta
```

Os health checks chegavam a cada **5,0 s** como relógio, respondidos em
**0,80–1,20 ms** durante as etapas 1 a 6. Depois das 11:00:22, nenhum.

**A hipótese foi levantada, descartada e reconfirmada** — e o descarte foi erro
de amostra: o primeiro recorte de log cobria só as etapas 1–6, que são **I/O**
(fetch de feed, chamada de IA) e deixam o event loop livre. A única etapa
CPU-bound é a **8.5**, e ela começa exatamente onde o silêncio começa.

#### A causa

`renormalizeStoredNews` era **uma consulta só**: `findMany` sem `take` trazendo
as 8.190 linhas com `content`, e um `for` síncrono passando por todas —
`decodeEntities`, `sanitizeTitle`, `sanitizeDescription`, `splitDekAndBody`,
`extractImageFromHtml` e o classificador lendo o texto inteiro — sem devolver o
event loop uma vez sequer. Com **0.1 vCPU** no plano free, 45 s.

**Não era memória, e medir isso primeiro evitou a correção errada.** O acervo
inteiro são ~27 MB de texto (1.706 chars por linha × 8.190), ~53 MB com
overhead de objeto — folgado nos 512 MB. Paginar aqui é sobre **não segurar a
CPU**, não sobre caber na RAM.

#### A consequência que passou do e-mail

O `SIGTERM` chegou no meio da 8.5, e o `shutdown` faz `process.exit(0)`:

- **o run ficou zumbi.** O `status` só vira `SUCCESS` na **etapa 9**, e o update
  pós-etapa 7 grava apenas `newsCount` e `articleId`. A linha ficou em `RUNNING`
  para sempre — e como a idempotência aceita `RUNNING` como "já tem run hoje",
  **o cadáver recusava todo disparo pelo resto do dia**, com a tela dizendo "já
  está rodando" sobre algo que morreu de manhã. É o espelho do episódio de
  25/08 (item 39), quando o painel dizia "disparado com sucesso" sem ter
  disparado;
- **a `DailyMetric` de 03/09 não foi gravada** — etapa 9 nunca chegou.

#### A correção

**Na varredura** (`news-renormalizer.service.ts`): leitura paginada por cursor
(`READ_PAGE_SIZE = 500`) com respiro a cada `YIELD_EVERY = 100` linhas, mais um
respiro entre lotes de escrita. O respiro é `setImmediate`, que roda na fase
*check* — **depois** da fase de poll —, então o I/O que esperava é atendido;
`await Promise.resolve()` não serviria, porque a microtask volta no mesmo tick.
Maior bloqueio contínuo: de 45 s para ~0,55 s.

O `orderBy` ganhou `{ id: 'asc' }` como desempate: `publishedAt` repete —
a colheita carimba dezenas de linhas no mesmo segundo — e cursor sobre ordem
ambígua pula e duplica linha.

**Na idempotência** (`pipeline.service.ts`): `RUNNING` há mais de
`STALE_RUN_MS` (15 min) é enterrado como `FAILED` e o disparo segue. Quinze
minutos é folga sobre o **pipeline inteiro** — os runs medidos fecham entre 20 s
e 60 s, mesmo com as três tentativas do Gemini e o fallback no caminho. O
`errorStage` fica **null de propósito**: o `currentStage` morreu com o processo,
e chutar uma etapa poria no banco um número que ninguém mediu.

O desfecho continua `started`, porque é o que o chamado fez. O cadáver é história
do run velho e está gravada nele — `FAILED` com `reason: 'stale-running'` e um
`PipelineEvent` de etapa 0.

#### As guardas, e vê-las falhar

**837 → 848 testes.** As duas que importam são as do respiro, e elas não
conferem `take`: um teste de `take` passaria com o laço de novo síncrono. Elas
agendam um `setImmediate` **antes** da varredura e perguntam **em que ponto** ele
rodou — contando leituras de campo por um getter na fixture. Com o laço síncrono
ele só roda depois de tudo (`readsWhenLoopTurned === reads.n`); com o respiro,
no meio. Confirmadas quebrando o código de propósito: as duas reprovaram, as
outras 23 seguiram verdes.

#### `feed-empty` que era `feed-failed`, fechado no mesmo PR

Os três feeds ficaram documentados acima como dívida com gatilho e fecharam
antes de o gatilho disparar — a pergunta seguinte na mesma conversa foi "então
classifica esses três como falhou".

**O problema não era a detecção, era onde ela perdia a informação.**
`fetchFromRss` já sabia, por fonte, qual `fetchSource` tinha lançado — o
`Promise.allSettled` interno via a rejeição direto —, mas só imprimia
`console.warn` e devolvia a lista achatada dos que **deram certo**. `fetchAll`
via essa lista, comparava contra `rssSources` e via a ausência — sem jeito
nenhum de distinguir "lançou" de "respondeu com zero". Superinteressante, Veja
Saúde e Drauzio Varella, em `ETIMEDOUT` havia dois dias, saíam como
`feed-empty`: a mesma classe de "publicou devagar", que **não conta** em
`pipelineErrors`.

A correção é uma função nova, `fetchFromRssWithFailures`, que devolve
`{ items, failures }` em vez de só os itens — `failures` é o `{ source, detail
}` que o `Promise.allSettled` interno já tinha em mãos. `fetchFromRss`
continua existindo como atalho fino sobre ela (`.then(r => r.items)`), então
os 20 testes de `rss.provider.test.ts` não mudaram uma linha. `fetchAll` ganhou
um quarto `FetchWarningKind`: `feed-failed`, que **conta** como erro do run
(a mesma regra de filtro em `pipeline.service.ts` — `kind !== 'feed-empty'` —
já cobria qualquer kind novo sem precisar mexer lá). `feed-empty` continua
existindo para o caso genuíno: fonte que respondeu e não tinha nada.

**848 → 853 testes**, cinco novos: o feed que lança vira `feed-failed` e não
`feed-empty`; a mesma fonte não aparece nas duas classificações ao mesmo
tempo; as duas convivem no mesmo run (o caso real de 03/09 — alguns feeds
fora, outros só quietos); os itens dos feeds que **deram certo** continuam
valendo quando outros do lote falham; e o caso raro em que as doze respondem
sem lançar e sem trazer item nenhum continua virando um único `provider-empty`
para `rss`, em vez de doze `feed-failed`/`feed-empty` idênticos afogando a
linha — o padrão ali sugere o provider inteiro mudo, não doze fontes
coincidentemente quietas na mesma hora.

#### O Gemini caindo pro Groq, investigado — e não é bug daqui

Pergunta seguinte: por que dois dias seguidos (02 e 03/09) o briefing saiu pelo
Groq? O log de 03/09 mostra o quadro inteiro:

```
Gemini API transient error (attempt 1/3), retrying in 1442ms
Gemini API transient error (attempt 2/3), retrying in 2298ms
Gemini provider failed, falling back to Groq: Error: Gemini API error 503:
{ "error": { "code": 503, "message": "This model is currently experiencing
  high demand. Spikes in demand are usually temporary. Please try again
  later.", "status": "UNAVAILABLE" } }
```

Três tentativas, três 503 `UNAVAILABLE`. Não é cota nossa — o pipeline chama a
Gemini **uma vez por dia**, ordens de grandeza abaixo de qualquer teto de
requisições diárias — e não é bug de classificação: `isTransientApiError`
reconhece 503 como transitório, `withRetry` tentou as três vezes com backoff
(1.442 ms, depois 2.298 ms), e o fallback entregou o briefing pelo Groq sem
perda nenhuma. É sobrecarga do lado do Google: "high demand"/`UNAVAILABLE" é a
mensagem pública deles para capacidade insuficiente no modelo, e está
reportada em massa ao longo de 2026 nos fóruns oficiais do Google AI e em
issues como `googleapis/python-genai#1373` — não um sintoma isolado deste
projeto.

`GET /api/metrics/weekly` mostra `aiProviderUsage: { gemini: 3, groq: 1 }` para
a janela 28/08–03/09, que deveria ter **dois** dias de Groq (02 e 03) — o
`groq: 1` conta só o 02/09, porque o `DailyMetric` de 03/09 nunca foi gravado
(a etapa 9 não rodou: é exatamente a consequência do `SIGTERM` na etapa 8.5
descrita acima). Depois desta correção, o `03/09` volta a contar.

**Não pede correção — o mecanismo fez o que devia.** Fica em aberto com
gatilho, não como bug: três dias seguidos de fallback, medido pelo mesmo
`aiProviderUsage.groq` que expôs a lacuna acima.

---

### 47. A esteira que constrói e publica não tinha etapa de segurança ✅ 2026-09-05

> **Fase 10 do `docs/Newra-News-Observability-Plan.md` — o primeiro PR de código
> do plano.** Ela é a primeira porque não depende de nenhuma outra e é a mais
> barata; e é higiene de esteira, não arquitetura.

#### O inventário, reconferido antes de abrir (a regra do §19)

| Achado | Estado em 05/09/2026 |
|---|---|
| `permissions:` declarado | **1 de 5** workflows — só o `gitleaks.yml` |
| Actions fixadas em SHA | **0 de 6** — todas em tag movível (`@v5`, `@v4`, `@v2`, `@v12`) |
| Auditoria de dependência no CI | **nenhuma** |
| SAST | **nenhum** |
| Dependabot | **inexistente** |

Os quatro primeiros são o que o plano escreveu em 04/09; conferidos um a um
contra os arquivos, os quatro estavam certos. As seis actions distintas são
`actions/checkout`, `actions/setup-node`, `actions/upload-artifact`,
`pnpm/action-setup`, `gitleaks/gitleaks-action` e `treosh/lighthouse-ci-action`,
em **21 ocorrências** de `uses:`.

#### O que entrou

**1. `permissions: contents: read` no topo dos cinco workflows** (o Gitleaks já
tinha). Sem a linha, o `GITHUB_TOKEN` herda o padrão do repositório e vai
**inteiro** para dentro de cada action de terceiro que o job executa. Só duas
escritas sobrevivem, e as duas têm motivo escrito: o Gitleaks comenta no PR
(`pull-requests: write`) e o CodeQL publica o SARIF (`security-events: write`).

**2. As 21 ocorrências fixadas em SHA de 40 hex, com o comentário da versão ao
lado** — que é a armadilha 20 do §17: SHA sem `# v4.3.0` é indecifrável, e
ninguém atualiza o que não consegue ler.

> **A tag movível já estava atrás, e isso é o argumento inteiro em uma linha.**
> `pnpm/action-setup@v4` aponta para **v4.3.0** enquanto a v4.4.0 existe há
> tempo. Ou seja: quem usa `@v4` não está em "sempre a última v4" — está em
> "onde o dono da tag deixou o ponteiro", e ele pode movê-lo em qualquer
> direção, retroativamente, sem abrir PR aqui.

**3. `pnpm audit --audit-level=high --prod` no job de lint**, reprovando o
merge.

> **O `--prod` foi medido, não escolhido por gosto.** Sem ele são **35**
> advisories *high/critical* em **17 pacotes**, e a maioria esmagadora é
> ferramenta que nunca é publicada: `eslint@8`, `vitest@2`, o CLI do `shadcn`.
> Uma lista de exceção com 35 linhas é a armadilha 21 do §17 escrita por
> extenso — vira ruído, alguém desliga o passo, e ele deixa de existir de fato
> enquanto continua existindo no arquivo. Com `--prod` são **18**, e as 18 já
> tinham alcance analisado nos itens **9.S** e **10.S**.
>
> O outro lado fica com o Dependabot, e a divisão é de propósito: o `audit`
> **reprova o merge**, o Dependabot **propõe a atualização** — de tudo,
> produção e desenvolvimento.

**4. `pnpm.auditConfig.ignoreGhsas` no `package.json` da raiz**, com as 18, e
**`docs/security-advisories.md`** com o motivo, a data e o gatilho de cada uma.
JSON não aceita comentário, então o identificador fica num arquivo e o argumento
no outro — e os dois não podem divergir. Dezoito advisories, **três gatilhos**:

| Gatilho | Quantas |
|---|---|
| `next` 14 → 15 | 8 do `next` + 7 da cadeia de build que ele carrega (`nanoid`, `postcss`, `browserslist`) |
| `fastify` 4 → 5 | `fastify` e `find-my-way` |
| reabrir a UI do Swagger em produção | `@fastify/static` |

**5. CodeQL** (`javascript-typescript`, `security-and-quality`) no `push` da
`main`, no PR contra ela, e semanalmente — o agendamento é o que pega advisory
nova sobre código que não mudou. **6. Dependabot** para `npm` e
`github-actions`, semanal e agrupado; sem agrupar, uma semana ruim abre quinze
PRs e a resposta humana a quinze PRs de bump é fechar todos.

#### A guarda, e os dois defeitos que ela achou enquanto era escrita

`apps/api/tests/build/workflow-hardening.test.ts` — estática, lendo os `.yml`
como texto, na mesma família do `env-parity.test.ts`. Nove asserções; ela
**reprovou em 7 na estreia**, que é o jeito certo de a fase começar.

Ela achou duas coisas que não estavam no inventário:

- **A contagem de workflows escrita em prosa, e é o item 41 outra vez.** Os dois
  READMEs afirmavam *"Cinco / Five workflows"*; o CodeQL fez seis, e a contagem
  mora em dois arquivos que a mudança não abre — exatamente como o `13` dos
  feeds sobreviveu em oito. A asserção pegou no mesmo turno em que o arquivo
  novo entrou.
- **A própria guarda passava verde sobre o pior caso que existe.** A asserção de
  escrita procurava `^\s+chave: write` — indentado, porque é assim que uma
  permissão aparece dentro do mapa. Só que **`permissions: write-all` é escrito
  na coluna zero**, como escalar, e concede tudo de uma vez: ele passava na
  asserção anterior (declara `permissions:`) e escapava desta. Achado na revisão
  do próprio código, e provado quebrando o `smoke.yml` de propósito para ver a
  versão nova reprovar.

**É a mesma família de sempre, e já é a sexta vez:** a guarda vê caractere, não
intenção. Só se descobre insistindo em vê-la falhar.

#### Números

| | Antes | Depois |
|---|---|---|
| Workflows | 5 | **6** |
| Workflows com `permissions:` | 1 | **6** |
| `uses:` fixados em SHA | 0 de 21 | **21 de 21** |
| Advisories *high* de produção reprovando o CI | — (não havia gate) | **0**, com 18 aceitas por escrito |
| Testes da API | 856 em 62 suítes | **865 em 63** |
| Testes totais | 1.474 em 129 | **1.483 em 130** |

#### O que fica pendente daqui

- **A lista de exceção envelhece por fora.** Advisory nova publicada sobre
  dependência de produção reprova o CI de um PR que não tem nada com ela — é o
  comportamento desejado de um gate, mas surpreende. O procedimento de
  acrescentar linha está no fim do `docs/security-advisories.md`.
- **O CodeQL rodou pela primeira vez neste PR: 201 regras, zero resultados.** O
  número de regras é o que separa "passou" de "passou vazio" — é a suíte
  `security-and-quality` inteira carregada, não um pack que não subiu. **Zero
  hoje não é zero para sempre:** a análise semanal existe justamente para pegar
  regra nova sobre código que não mudou, e o que ela achar entra como trabalho
  próprio, não como correção desta fase.
- **A próxima é a Fase 1 (o logger)**, que é o PR 2 da ordem do §19 e fecha o
  vazamento da DSN.

---


## Fase 1 — Setup e Infraestrutura ✅ Concluída em 2026-03-13

### Checklist do PRD (seção 17)

- [x] Monorepo Turborepo + pnpm workspaces
- [x] Packages compartilhados: `@newranews/database`, `@newranews/types`, `@newranews/eslint-config`, `@newranews/tsconfig`
- [x] Docker Compose — PostgreSQL 16 + pgAdmin 4 (`docker-compose.yml`)
- [x] Backend Fastify com TypeScript — `apps/api/src/server.ts` + `app.ts`
- [x] Prisma com schema inicial — 4 models (News, Article, PipelineLog, DailyMetric), 2 enums (Category, PipelineStatus)
- [x] Next.js 14 (App Router) com Tailwind CSS
- [x] shadcn/ui instalado e configurado (New York style, Zinc color, CSS variables)
- [x] Componentes base shadcn/ui: Button, Card, Badge, Input, Skeleton
- [x] ESLint + Prettier em todo o monorepo
- [x] Vitest no backend — `vitest.config.ts` + `tests/setup.ts` + stubs de teste
- [x] CI no GitHub Actions — pipeline lint → test → build com serviço PostgreSQL
- [x] Node.js 22 LTS alinhado em todo o projeto

### Commits desta fase

| Commit | Descrição |
|--------|-----------|
| `98d710c` | chore: initial monorepo scaffolding |
| `6e9e47b` | chore: upgrade Node.js from 20 to 22 LTS |
| `669e9d3` | fix(ci): force Node.js 24 runtime for GitHub Actions |
| `7a42e15` | fix(ci): upgrade checkout and setup-node to v5 for native Node.js 24 support |
| `5f60cbb` | chore: align Node.js config with 22 LTS target |
| `a8cd95e` | feat(web): add shadcn/ui completing Phase 1 setup |

### Decisões técnicas desta fase

- **Node.js 22 LTS** como target — `engines`, `.nvmrc`, `@types/node ^22.0.0`, Dockerfile `node:22-alpine`
- **CI actions v5** (`actions/checkout@v5`, `actions/setup-node@v5`) — elimina warnings de deprecação do Node 20
- **shadcn/ui New York style, Zinc** — mantido padrão; Geist font removida (indisponível no Next.js 14.2), substituída por Inter com `--font-sans`
- **Prisma migrations** — diretório criado mas vazio; primeira migration será gerada ao subir o banco pela primeira vez
- **Stubs de teste** — `apps/api/tests/` tem estrutura pronta; implementação real começa na Fase 2

---

## Fase 2 — Backend Core ✅ Concluída em 2026-03-16

> Referência: PRD seção 17 — "Fase 2 — Backend Core (Semana 3-4)"

### Checklist do PRD

- [x] Configurar plugins Fastify: cors, helmet, rate-limit, swagger
- [x] Implementar `GET /api/health`
- [x] Implementar `GET /api/news` (listagem paginada + filtro por categoria)
- [x] Implementar `GET /api/news/:id`
- [x] Implementar `GET /api/articles`
- [x] Implementar `GET /api/articles/latest`
- [x] Implementar `GET /api/articles/:date`
- [x] Implementar `POST /api/jobs/daily-pipeline` (Bearer token auth)
- [x] Implementar provider NewsAPI (`src/providers/newsapi.provider.ts`)
- [x] Implementar provider RSS (`src/providers/rss.provider.ts`)
- [x] Implementar provider Gemini AI (`src/providers/gemini.provider.ts`)
- [x] Implementar provider Groq AI fallback (`src/providers/groq.provider.ts`)
- [x] Implementar pipeline service completo (9 estágios)
- [x] Configurar cron job com `@fastify/schedule` (trigger diário)
- [x] Escrever testes para todos os services e rotas
- [x] Validar todas as rotas com Zod schemas

### Refatorações pós-fase 2 ✅ Concluídas em 2026-03-17

- [x] Cleanup de artigos >90 dias adicionado ao Stage 8 do pipeline (PRD 3.4)
- [x] Rate limit restritivo na rota `/api/jobs/daily-pipeline` (20 req/min vs 100 global)
- [x] Implementar `GET /api/jobs/:pipelineId` — status de execução do pipeline
- [x] Implementar `GET /api/metrics/weekly`, `/monthly`, `/dashboard` — 3 endpoints de métricas
- [x] Providers reestruturados em `providers/news/` (NewsAPI, RSS) e `providers/ai/` (Gemini, Groq, ai-utils)
- [x] `packages/database/prisma/seed.ts` — seed com dados realistas para todas as categorias
- [x] `docs/architecture.md` e `docs/api.md` preenchidos com documentação real
- [x] Testes atualizados: 131 testes em 16 suites

### Arquitetura de referência (apps/api/CLAUDE.md)

```
src/
├── routes/          # Uma rota por arquivo + schema Zod adjacente
├── services/        # Lógica de negócio (sem dependência do Fastify)
├── providers/
│   ├── news/        # NewsAPI, RSS
│   └── ai/          # Gemini, Groq
├── plugins/         # Registro de plugins Fastify
└── utils/          # errors.ts (erros customizados), schemas.ts (schemas Zod compartilhados)
```

---

## Fase 3 — Frontend Core ✅ Concluída em 2026-03-25

> Referência: PRD seção 17 — "Fase 3 — Frontend Core (Semana 5-6)"

### Commits desta fase

| Commit | Descrição |
|--------|-----------|
| `d84001a` | feat(web): implement global layout with header, navbar, and footer |
| `bb591c5` | feat(web): implement home page with news feed and daily article hero (#30) |
| `a5b727d` | fix(web): upgrade to Tailwind CSS v4 and fix missing styles |
| `8f8f393` | feat(web): implement /news page with ISR, filters, search, and pagination (#31) |
| `ccf6b5d` | fix(web): fix CI build failure and address code review issues in /news page |
| `1d4632c` | fix(api): improve error message when .env file is missing |
| `c59a752` | feat(web): implement /news/[id] individual news page with ISR (#32) |
| `7301248` | fix(web): remove dead prose classes and add aria labels to news placeholders |
| `5c859ee` | feat(web): implement /article and /article/[date] pages with ISR (#33, #34) |
| `f4d6258` | feat(web): implement /about page and enhance global 404 (#36) |
| `36765fa` | feat(web): configure TanStack Query with hooks and refactor client components (#37) |
| `3ebf0fb` | fix: resolve inconsistencies from recent commits code review |
| `58be12b` | feat(web): implement SEO — metadata, Open Graph, sitemap, robots (#38) |
| `ae2c7e3` | feat(web): mobile-first responsiveness improvements (#39) |
| `9e0c2b3` | fix(web): mobile menu covering header on small viewports |
| `c9b7bda` | fix(web): replace undefined brand-700 hover color and sanitize error output |

### Auditoria final pré-Fase 4 ✅

Auditoria completa realizada em 2026-03-25 antes de iniciar Fase 4:

- **Checklist PRD:** 11/11 itens verificados e completos
- **Integração frontend ↔ backend:** 5/5 endpoints compatíveis, tipos compartilhados via `@newranews/types`
- **Bugs corrigidos:** `hover:text-brand-700` (cor inexistente no tema) → `hover:text-brand-900` em 4 arquivos; `error.tsx` sanitizado para não expor `error.message` em produção
- **Build:** lint 0 erros, build limpo (10 rotas)

### Decisões técnicas desta fase

- **Tailwind CSS v4** — upgrade de v3 para v4 (CSS-first config, `@theme inline`, `@import "tailwindcss"`) para compatibilidade com shadcn v4 base-nova style e suporte a opacity modifiers com CSS variables hex
- **ISR com revalidate: 3600** — home page revalida server-side a cada hora
- **Fontes:** Bricolage Grotesque (`--font-display`) para headings, Inter (`--font-sans`) para body via next/font/google
- **`lib/format.ts`** — `CATEGORY_LABELS`, `formatDate()`, `formatArticleDate()` e `toDateSlug()` extraídos para uso compartilhado entre componentes de news e article
- **`generateMetadata()`** — introduzido em `/news/[id]` e `/article/[date]`; título dinâmico + Open Graph tags
- **`ArticleHistoryCard`** — card compacto para grid de artigos (distinto do hero `ArticleCard` da home)
- **`/about` SSG** — página estática sem data fetching; evitou uso de Badge/Card (shadcn base-ui hooks) em favor de elementos nativos compatíveis com server components SSG
- **404 global** — melhorado com ícone `SearchX`, hierarquia visual e descrição, alinhado ao padrão de `/news/[id]/not-found.tsx`
- **TanStack Query v5** — `QueryClientProvider` em `app/providers.tsx`, hooks em `lib/queries.ts` com query key factories hierárquicas; `staleTime: 5min`, `gcTime: 10min`, `refetchOnWindowFocus: false`; `keepPreviousData` para paginação sem flash; client components refatorados de 5-7 useState + fetch manual para `useQuery` hooks
- **SEO completo** — `lib/seo.ts` com constantes centrais (`SITE_URL`, `SITE_NAME`, `SITE_DESCRIPTION`); `metadataBase` + `title.template` no root layout; `generateMetadata()` + OG + Twitter tags em todas as páginas; `opengraph-image.tsx` com `ImageResponse` (edge runtime, 1200×630); `sitemap.ts` (ISR 1h, rotas estáticas + news + artigos, graceful fallback se API indisponível); `robots.ts`; `NEXT_PUBLIC_SITE_URL` env var
- **Responsividade mobile-first** — touch targets: `Input` `h-8→h-9`, botões de paginação `size='lg'`, botão X de busca com `p-1` + `aria-label`; tipografia: `text-2xl sm:text-3xl` nos h1 de listagem; `break-words` em divs de conteúdo de notícia/artigo para evitar overflow horizontal com URLs longas

### Checklist do PRD

- [x] Implementar layout global (header, footer, navbar)
- [x] Página `/` — Home com feed de notícias (ISR)
- [x] Página `/news` — Listagem de notícias (ISR + CSR para filtros)
- [x] Página `/news/[id]` — Notícia individual (ISR)
- [x] Página `/article` — Histórico de artigos (ISR)
- [x] Página `/article/[date]` — Artigo do dia (ISR)
- [x] Implementar busca e filtros por categoria
- [x] Página `/about` e página 404 (SSG)
- [x] Configurar TanStack Query — `QueryClientProvider` + hooks em `lib/queries.ts`
- [x] SEO: `generateMetadata()`, Open Graph tags, sitemap auto-gerado
- [x] Responsividade mobile-first

---

## Fase 4 — Integração e Deploy ✅ Concluída em 2026-08-14

> Referência: PRD seção 17 — "Fase 4 — Integração e Deploy (Semana 7-8)"

### Commits desta fase

| Commit | Descrição |
|--------|-----------|
| `601c1f6` | feat(web): harden Vercel cron route and adjust schedule to BRT timezone |
| `3992903` | feat(web): prepare monorepo for Vercel deployment |
| `bcf997b` | feat(api): prepare backend for Render deployment |
| `287eef5` | fix(api): resolve Prisma type resolution in pnpm monorepo |
| `2ce1f2f` | fix(api): truncate and sanitize news content in AI prompt |
| `cc8c2c5` | fix(api): also truncate description field in AI prompt |
| `cf83180` | fix(api): migrate Gemini provider from deprecated 1.5-flash to 2.5-flash |
| `b231841` | fix: decode HTML entities in news pipeline and handle broken images |
| `e0703fe` | fix(api): handle ISO-8859-1 encoding and extract media images in RSS provider |

### Checklist do PRD

- [x] Configurar Vercel Cron Job (`vercel.json`)
- [x] Implementar API Route de trigger no Next.js (`/api/cron/daily-news`)
- [x] Deploy do frontend na Vercel
- [x] Deploy do backend no Render
- [x] Criar instância PostgreSQL no Neon
- [x] Configurar UptimeRobot para keep-alive
- [x] Configurar variáveis de ambiente em todos os serviços
- [x] Rodar migrations em produção
- [x] Testar pipeline completo em produção

### Validação em produção (2026-08-14)

Verificado ao vivo contra `https://newra-news-web.vercel.app` e `https://newra-news-api.onrender.com`:

- **Pipeline diário:** 89 artigos gerados em 90 dias (17/05 → 14/08/2026), apenas 1 gap (01/06)
- **Confiabilidade:** último mês — 31 artigos, 0 dias de falha, taxa de sucesso 100%, IA: Gemini
- **Volume:** ~250 notícias/dia, ~27s por execução do pipeline
- **Infra:** backend Render com uptime de ~92 dias; todas as rotas do frontend retornam 200; Swagger em `/api/docs`
- **CORS:** configurado para o domínio de produção da Vercel

### Problemas conhecidos (pós-validação)

- [x] **Sitemap com URLs de localhost** — `NEXT_PUBLIC_SITE_URL` ausente na Vercel. Corrigido no código (fallback para `VERCEL_PROJECT_PRODUCTION_URL`) e validado em produção em 2026-08-14 — commit `ea2fb5f`
- [x] **Artigos ausentes do sitemap** — `getArticles(1, 90)` estourava o limite de 50 da API e falhava em silêncio. Corrigido com paginação + `toDateSlug()` e validado em produção (89 URLs de artigos, todas respondendo 200) — commit `5994ce7`
- [x] **Diversidade de categorias reduzida** — NewsAPI substituída pela **NewsData.io** (provider implementado + testes; ver `docs/news-api-alternatives.md`). Pendente: adicionar `NEWSDATA_API_KEY` no Render e validar em produção

### Recomendações pendentes

- [x] **Endpoint de diagnóstico de providers** — `GET /api/health/providers` (protegido) testando ao vivo NewsData/Gemini/Groq, para nunca mais depender de investigação manual. Detalhes: `docs/news-api-alternatives.md` §5

### Pendências pós-Fase 4 (não-bloqueantes)

- [ ] Configurar domínio customizado (opcional) — quando houver, definir `NEXT_PUBLIC_SITE_URL`
- [x] Documentação final (README, docs/) — concluída na Fase 5 (README com screenshots, docs/setup.md, docs/presentation.md, diagramas Mermaid)

---

## Fase 5 — Polish e Portfólio ✅ Concluída em 2026-08-15

> Referência: PRD seção 17 — "Fase 5 — Polish e Portfólio (Semana 9-10)"

### Checklist do PRD

- [x] Refinar UI/UX e animações — item 7: dark mode completo, animações/micro-interações e primeiros testes do frontend (14)
- [x] Gerar diagramas Mermaid (arquitetura, ER, sequência, fluxo)
- [x] Completar documentação do README com screenshots
- [x] Code review geral e refatorações — sem TODO/any/@ts-ignore; logs auditados; removido código morto (`utils/logger.ts`); corrigido erro de tipo latente em teste do web (CI não pegava porque `next lint`/`next build` não typecheckam `tests/`)
- [x] Otimização de performance (Lighthouse score — 96/96/96/100, ver item 5)
- [x] Adicionar loading states e error boundaries — `loading.tsx` + `error.tsx` em `/news` e `/article` (cobrem também `/news/[id]` e `/article/[date]`), `loading.tsx` e `not-found.tsx` em `/article/[date]`
- [x] Preparar apresentação do projeto para portfólio — `docs/presentation.md` (pitch, arquitetura, números de produção, roteiro de walkthrough e perguntas prováveis)

### Melhoria de qualidade nesta fase

- [x] **Typecheck no CI** — scripts `typecheck` (tsc --noEmit) em web, api (com `tsconfig.tests.json` cobrindo `tests/`) e types; passo `pnpm turbo typecheck` no job de lint do `ci.yml`; task no `turbo.json`. Impede que erros de tipo fora do graph de build passem despercebidos (o erro do teste do web voltaria a ocorrer sem isso)
