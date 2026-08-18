# Progresso do Projeto — Newra News

> Este arquivo é a fonte de verdade do progresso de desenvolvimento.
> Atualizar ao concluir cada milestone. Referenciar o commit correspondente.

---

## Fase Atual

**Fase 5 — Polish e Portfólio** ✅ Concluída em 2026-08-15

> Fases 1–4 concluídas. Pipeline validado em produção: 89 artigos em 90 dias (17/mai → 14/ago), 1 gap, 0 falhas no último mês.
> NewsAPI substituída pela NewsData.io — provider ativo em produção desde 2026-08-16: 3 chaves ok (NewsData/Gemini/Groq), 8 categorias preenchidas, 491 notícias/dia.
> Checklist completo da Fase 5 fechado: UI/UX (item 7), code review geral, loading states + error boundaries e apresentação de portfólio (`docs/presentation.md`); typecheck adicionado ao CI.

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
