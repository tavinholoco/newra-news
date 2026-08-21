# Progresso do Projeto — Newra News

> Este arquivo é a fonte de verdade do progresso de desenvolvimento.
> Atualizar ao concluir cada milestone. Referenciar o commit correspondente.

---

## Fase Atual

**Fase 5 — Polish e Portfólio** ✅ Concluída em 2026-08-15

> Fases 1–4 concluídas. Pipeline validado em produção: 89 artigos em 90 dias (17/mai → 14/ago), 1 gap, 0 falhas no último mês.
> NewsAPI substituída pela NewsData.io — provider ativo em produção desde 2026-08-16: 3 chaves ok (NewsData/Gemini/Groq), 8 categorias preenchidas, 491 notícias/dia.
> Checklist completo da Fase 5 fechado: UI/UX (item 7), code review geral, loading states + error boundaries e apresentação de portfólio (`docs/presentation.md`); typecheck adicionado ao CI.

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

**Próximo ciclo — V2.0 Fase 4 (News / Category)** 📋 **Desbloqueada** — item 18 fechado

> `category-nav`, busca, `filter state` (escrever a URL a cada clique — hoje `/news` só **lê** o parâmetro), paginação, estados vazios e skeletons. Os cards de `components/editorial/` são para reusar, não reconstruir.
>
> O item 18 fechou: classificador medido e apertado, acervo se renormalizando sozinho na etapa 8.5 do pipeline, Lighthouse de volta a 95 na Home e baseline recapturada.

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
