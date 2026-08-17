# Plano — Autenticação, Favoritos, i18n e Painel Admin

> Sub-item 3 do Item 8 (Pós-MVP) do plano de ação (`docs/progress.md`).
> Status: **concluído (2026-08-16)** — P1 (auth + favoritos), P2 (i18n pt/en com prefixo `/pt-BR` `/en`) e P3 (painel admin) implementados, testados e validados em produção.
> Referência: PRD §2.2 ("Sistema de autenticação para favoritar notícias",
> "Internacionalização (i18n) — português e inglês", "Painel administrativo").

---

## 1. Objetivo e critério de prioridade

O projeto é **portfólio** (PRD §1.3). A régua para priorizar não é "quanto
código", e sim **o que o recrutador consegue ver e entender em 5 minutos**:

| Prioridade | Feature | Valor de portfólio | Esforço |
|---|---|---|---|
| **P1** | Autenticação + Favoritos | Alto — feature full-stack completa (OAuth → API → DB → UI) | Médio |
| **P2** | i18n pt/en | Médio — mostra padrão mainstream (next-intl) e polimento | Médio-baixo |
| **P3** | Painel admin (mínimo) | Baixo — pouco demo-ável, sobrepõe-se ao Item 9 (observabilidade) | Alto |

**Decisão:** implementar **P1 primeiro** (entrega 1 sub-item completo e
demo-ável), **P2 em seguida**. P3 fica **opcional/stretch** e só após o Item 9.

---

## 2. P1 — Autenticação (next-auth v4) + Favoritos

### 2.1 Stack de auth

- **next-auth v4** (Auth.js v5 mira Next 15+; o projeto usa Next 14.2 → v4 é a
  escolha estável e documentada).
- **Providers OAuth: Google + GitHub** — sem senha própria (nada de hashing),
  padrão mainstream, demonstra integração com provedores externos.
- **Session strategy: JWT** (sem tabela de sessão).
- Envs novas (web): `AUTH_SECRET` (next-auth), `GOOGLE_CLIENT_ID`,
  `GOOGLE_CLIENT_SECRET`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`.

### 2.2 Como o backend Fastify autentica o usuário

Arquitetura desacoplada (web na Vercel, API no Render) — o frontend não pode
compartilhar o cookie de sessão do next-auth com a API. Solução:

```
Web (next-auth sessão JWT) ──► assina JWT HS256 com AUTH_JWT_SECRET
      payload: { sub: userId, email, iat, exp (1h) }
API (Fastify) ◄── Authorization: Bearer <jwt>  →  plugin valida com o mesmo secret
```

- Env nova **compartilhada** web + api: `AUTH_JWT_SECRET`.
- A API ganha um **plugin de auth** (`src/plugins/auth.ts`) que valida o Bearer
  e injeta `request.user = { id, email }` (401 sem/inválido).
- Demonstra **JWT em arquitetura cliente/servidor desacoplada** — ponto forte
  para portfólio.

### 2.3 Modelos Prisma

```prisma
model User {
  id        String   @id @default(uuid())
  email     String   @unique
  name      String?
  image     String?
  role      UserRole @default(USER)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model Favorite {
  id        String   @id @default(uuid())
  userId    String
  newsId    String
  createdAt DateTime @default(now())

  @@unique([userId, newsId])
  @@index([userId, createdAt])
}

enum UserRole {
  USER
  ADMIN
}
```

- **User é upsert** no callback `signIn` do next-auth (id do banco vira `sub` do JWT).
- Sem FKs explícitas — mesmo padrão dos models existentes (índices + campos).
- `ADMIN_EMAILS` (env) decide quem nasce com `role: ADMIN` (para o P3).

### 2.4 API (Fastify)

| Rota | Auth | Descrição |
|---|---|---|
| `GET /api/favorites` | Bearer JWT | lista notícias favoritas do usuário (join com News, paginado) |
| `POST /api/favorites` `{ newsId }` | Bearer JWT | adiciona (idempotente: já existe → 200; news inexistente → 404) |
| `DELETE /api/favorites/:newsId` | Bearer JWT | remove (404 se não existe) |

- Schemas Zod + `errorResponseSchema` — padrão das rotas existentes.
- Sem rota de login no backend: o JWT vem pronto do web.

### 2.5 Frontend

- `app/api/auth/[...nextauth]/route.ts` + `SessionProvider` no `providers.tsx` +
  `useSession`.
- **Botão de favoritar**: ícone heart no `NewsCard` (toggle) e na página
  `/news/[id]`; deslogado → redireciona para sign-in (ou mostra tooltip).
- **Página `/favorites`**: lista os favoritos do usuário (ISR/CSR com TanStack
  Query); requer login (redirect para `/api/auth/signin`).
- `lib/api.ts`: funções de favorites com Bearer do session.
- Link "Favoritos" no navbar (visível quando logado) + botão sign-in/sign-out.

### 2.6 Testes

- **API**: plugin de auth (401 sem token, 401 token inválido), rotas favorites
  (CRUD, idempotência, 404, autorização).
- **Web**: toggle de favorito (mock de `useSession` + fetch), página favorites
  (mock), fluxo de redirect deslogado.

---

## 3. P2 — i18n pt/en (next-intl)

### 3.1 Stack

- **next-intl** — padrão de facto para App Router, compatível com Next 14.
- **Estratégia de locale (migrada)**: **rotas com prefixo** `/pt-BR` `/en`
  (`localePrefix: 'always'`) — implementado em 2026-08-16 para recuperar a
  renderização estática + ISR por idioma (o cookie sozinho tornava as páginas
  dinâmicas). Middleware negocia o locale (cookie `NEXT_LOCALE` →
  accept-language → default `pt-BR`) e redireciona URLs sem prefixo.
  `setRequestLocale` + `generateStaticParams` habilitam SSG/ISR por idioma.

### 3.2 Escopo

- Extrair **strings de UI** para `messages/pt-BR.json` e `messages/en.json`:
  navbar, footer, newsletter, botões, headings, metadata, `not-found`,
  `error.tsx`, dashboard, favoritos.
- **Conteúdo não é traduzido** — notícias e artigos permanecem como vêm das
  fontes (traduzir conteúdo de terceiros seria inviável e fora de escopo).
- `NextIntlClientProvider` no layout; `getTranslations` em server components;
  `useTranslations` em client components.
- Datas: passar o `locale` para `formatDate`/`formatArticleDate` (hoje fixos em
  pt-BR) — en → `en-US`.

### 3.3 Testes

- Extração valida: todas as chaves usadas existem nos 2 JSONs (teste unitário
  percorre o `messages` e o código).
- Renderização em pt/en (mock de cookie).

---

## 4. P3 — Painel admin (opcional / stretch)

> Só depois do Item 9 (observabilidade) — o Item 9 cobre logs; o admin aqui é
> **ação**, não observação.

- Rota `/admin` protegida por sessão + `role === 'ADMIN'`:
  - Botão **"Executar pipeline agora"** → reusa a API Route `/api/cron/daily-news`
    (com `CRON_SECRET`/`BACKEND_JOB_SECRET`).
  - **Deletar notícia** → novo `DELETE /api/news/:id` (JWT + admin) com 404 se
    não existir; card de notícia ganha ação de remoção no admin.
- Nada de edição de conteúdo (curadoria completa = muito escopo para o retorno).
- Envs: `ADMIN_EMAILS`.

---

## 5. Riscos e mitigações

- **next-auth v4 + Next 14** — combinação estável e documentada; migrar para
  Auth.js v5 fica como evolução futura junto com upgrade do Next.
- **JWT compartilhado** — `AUTH_JWT_SECRET` forte, expiração curta (1h), nunca
  em `NEXT_PUBLIC_*`.
- **i18n refatora strings hardcoded** — risco de regressão de UI; mitigado pelos
  testes existentes (26+ web) + teste de paridade de chaves.
- **Escopo do admin infla** — cortado para 2 ações (trigger + delete); se
  apertar, P3 é descartável sem prejuízo ao portfólio.

---

## 6. Sequência de implementação

- [x] **P1.1** — `User` model + migration; next-auth v4 (Google/GitHub) + sign-in/out UI + envs
- [x] **P1.2** — plugin de auth JWT na API + upsert de User no signIn + testes
- [x] **P1.3** — `Favorite` model + rotas `/api/favorites` + testes
- [x] **P1.4** — frontend: toggle no card/detalhe, página `/favorites`, navbar + testes
- [x] **P2.1** — next-intl 3.26 + middleware de locale + `messages/pt-BR.json` e `messages/en.json` (inicialmente cookie; **migrado p/ prefixo `/pt-BR` `/en`** — ver 7)
- [x] **P2.2** — extração de strings de UI (navbar, footer, newsletter, botões, headings, metadata, not-found, error.tsx, dashboard, favoritos) + datas/contagens localizadas (`formatDate`/`formatArticleDate`/`formatCount` recebem locale) + seletor de idioma no header + teste de paridade de chaves + render pt/en
- [x] **P2.3** — migração para rotas com prefixo (`/pt-BR`, `/en`): `i18n/routing.ts` + `i18n/navigation.ts` (Link/usePathname/useRouter com prefixo), `setRequestLocale` + `generateStaticParams`, páginas movidas para `app/[locale]/`, root layout pass-through, sitemap/hreflang por idioma, LocaleSwitcher com `router.replace(pathname, {locale})` — **ISR restaurado** (`● SSG` + `revalidate: 3600` por idioma), 65 testes verdes, validado em dev e produção
- [x] **P3** (opcional, 2026-08-16) — `/admin` (trigger pipeline + delete news) + `DELETE /api/news/:id` (JWT + role ADMIN)
- [x] **Docs** — `docs/api.md` (DELETE /api/news/:id) e `docs/progress.md`; `docs/setup.md`/`docs/presentation.md` não precisaram de mudança (fluxo de dev/deploy inalterado)

---

## 7. Decisões confirmadas (2026-08-16)

- [x] Provedores OAuth: **Google + GitHub**
- [x] i18n: ~~cookie sem prefixo~~ → **prefixo de URL `/pt-BR` `/en`** (2026-08-16: recupera SSG/ISR por idioma e dá URLs canônicas + hreflang para SEO multilingue)
- [x] Painel admin (P3): **depois do Item 9** (fora do escopo imediato)

> **P1 concluído (2026-08-16)** — auth + favoritos completos (backend + frontend).
> **P2 concluído (2026-08-16)** — i18n pt/en com next-intl 3.26: primeiro com
> cookie (sem prefixo) e **migrado para rotas com prefixo `/pt-BR` `/en`** —
> `setRequestLocale` + `generateStaticParams` + `i18n/navigation` (Link/usePathname/
> useRouter com prefixo), páginas sob `app/[locale]/`, sitemap/hreflang por
> idioma, seletor no header (`router.replace`). **ISR restaurado:** páginas
> `● SSG` com `revalidate: 3600` por idioma (o cookie sozinho tornava tudo
> dinâmico). 65 testes web verdes + validado em dev e produção (hidratação,
> troca PT/EN, redirects, hreflang).
> **Detalhe de implementação importante:** com root layout pass-through, não
> pode haver `loading.tsx`/`error.tsx` na raiz (boundaries caem fora do
> `<html>` e quebram a hidratação — "Only one element on document allowed");
> eles vivem em `app/[locale]/`, e o `not-found.tsx` raiz renderiza `<html>`
> próprio.
> **P3 concluído (2026-08-16)** — painel admin após o Item 9: `DELETE /api/news/:id`
> na API (authPlugin + `role === 'ADMIN'` no JWT, 401/403/404), página
> `/pt-BR/admin` `/en/admin` protegida (redirect p/ sign-in deslogado, tela de
> acesso restrito para não-admin, noindex), `AdminPanel` com "Executar pipeline"
> (reusa a rota `/api/cron/daily-news` via `/api/admin/run-pipeline`, session +
> role check server-side) e lista das últimas 20 notícias com botão de remoção
> (proxy `/api/admin/news/:id` assina JWT com role), link "Admin" no navbar só
> para ADMIN. 17 testes web novos + 8 testes API novos; validado em dev.
