# Diagnóstico técnico da V1

Entregável da Fase 0 (plano V2 §28): o retrato do que existe hoje, medido, antes
que o redesign comece a apagar as evidências.

- **Commit auditado:** `8827d3c`
- **Data:** 20/08/2026
- **Baseline visual:** `baseline-v1/` (42 capturas, 12 rotas × 3 larguras)

---

## 1. Superfície do frontend

| | Quantidade |
|---|---|
| Rotas de página localizadas | 11 (× 2 locales) |
| Route handlers do Next | 6 |
| Componentes React | 33 em 10 pastas |
| Grupos de rota na API | 9 |
| Testes | 448 em 50 suites (356 API em 32 + 92 web em 18) |

### 1.1 Rotas públicas

| Rota | Render | Indexação | Auth | Observação |
|---|---|---|---|---|
| `/[locale]` | ISR 3600s | sim | — | hero do artigo + feed de 12 |
| `/[locale]/news` | ISR 3600s | sim | — | busca, filtro, paginação |
| `/[locale]/news/[id]` | dinâmica | sim | — | |
| `/[locale]/article` | ISR 3600s | sim | — | histórico de briefings |
| `/[locale]/article/[date]` | dinâmica | sim | — | |
| `/[locale]/about` | estática | sim | — | |
| `/[locale]/dashboard` | ISR 3600s | sim | — | métricas do pipeline |
| `/[locale]/signin` | `force-dynamic` | **noindex** | — | Google + GitHub |
| `/[locale]/favorites` | `force-dynamic` | **noindex** | sessão | |
| `/[locale]/newsletter/unsubscribe` | estática | **noindex** | token | |
| `/[locale]/admin` | `force-dynamic` | **noindex** | role ADMIN | |

O `force-dynamic` em `/signin`, `/favorites` e `/admin` **não é decorativo**: sem
ele o `redirect()` das páginas protegidas era pré-renderizado no HTML estático e
usuários com sessão válida caíam no login para sempre. Foi um bug real
corrigido em 16/08. Qualquer refatoração de layout na V2 precisa preservar isso.

Rotas do Next fora do `[locale]`: `api/admin/news/[id]`, `api/admin/run-pipeline`,
`api/auth/[...nextauth]`, `api/cron/daily-news`, `api/favorites`,
`api/favorites/[newsId]`, mais `robots.ts`, `sitemap.ts` e `opengraph-image.tsx`.

### 1.2 Componentes

```
admin/      1   admin-panel
article/    5   article-card, article-detail, article-grid,
                article-history-card, article-page-client
auth/       2   auth-button, sign-in-form
dashboard/  4   category-bars, dashboard-client, dashboard-skeleton, metric-card
favorites/  1   favorites-list
layout/     4   footer, header, locale-switcher, navbar
news/       7   favorite-button, news-card, news-detail, news-filters,
                news-grid, news-page-client, news-search
newsletter/ 1   subscribe-form
theme/      2   theme-init, theme-toggle
ui/         6   badge, button, card, input, safe-image, skeleton
```

Não existe pasta `editorial/` nem `monetization/` — as duas que a §23 propõe
como espinha dorsal da V2. Também não existe `top-bar`, `masthead`,
`category-nav`, `hero-story` nem qualquer primitivo de anúncio.

### 1.3 Como o frontend consome a API

| Função (`lib/api.ts`) | Endpoint | Quem chama |
|---|---|---|
| `getNews` | `GET /news` | home, `/news`, `sitemap.ts` |
| `getNewsById` | `GET /news/:id` | `/news/[id]` |
| `getLatestArticle` | `GET /articles/latest` | home |
| `getArticles` | `GET /articles` | `/article`, `sitemap.ts` |
| `getArticleByDate` | `GET /articles/:date` | `/article/[date]` |
| `getDashboardMetrics` | `GET /metrics/dashboard` | `/dashboard` |
| `subscribeToNewsletter` | `POST /newsletter/subscribe` | `SubscribeForm` (rodapé) |
| `unsubscribeFromNewsletter` | `GET /newsletter/unsubscribe` | `/newsletter/unsubscribe` |
| `getFavorites` / `addFavorite` / `removeFavorite` | proxy `/api/favorites*` → `GET/POST/DELETE /favorites` | `FavoritesList`, `FavoriteButton` |
| `runDailyPipeline` | proxy `/api/admin/run-pipeline` → `POST /jobs/daily-pipeline` | `AdminPanel` |
| `deleteNewsAdmin` | proxy `/api/admin/news/:id` → `DELETE /news/:id` | `AdminPanel` |

Tudo que exige credencial passa por rota proxy do Next, que lê a sessão do
next-auth e assina o JWT server-side — o browser nunca vê `AUTH_JWT_SECRET` nem
`CRON_SECRET`. Esse desenho deve sobreviver ao redesign.

**A home faz 2 chamadas** (`getNews` + `getLatestArticle`). A Home da V2 tem
hero, briefing, top stories, trending, seções por categoria e newsletter — sem o
`GET /api/home` agregado da §18.1 isso vira 6+ chamadas. Contrato em
`03-contratos-api.md`.

O contrato dos 9 grupos de rota está em `docs/api.md` (514 linhas) e foi
conferido contra o código nesta auditoria. **Não há endpoint de trending nem de
relacionadas**, e o modelo `Article` não tem os campos de auditoria da §18.4.

---

## 2. Design tokens de hoje

`styles/globals.css` declara **36 variáveis** em `:root`: 4 de marca, 1 de radius
e **31 semânticas** do shadcn, todas redeclaradas em `.dark`.

| | Claro | Escuro |
|---|---|---|
| `--brand-900` | `#632713` | `#632713` |
| `--brand-600` | `#EC6426` | `#F27E45` |
| `--brand-400` | `#F8A91F` | `#F8A91F` |
| `--brand-100` | `#FDE3CF` | `#3A2417` |

### 2.1 Usos de `brand-400` e `brand-900` — item de checklist da §28

**13 ocorrências, 3 padrões.** A migração é pequena:

- `hover:text-brand-400` sobre `text-brand-600` — 9× (`article-card:47`,
  `news-detail:114`, `[locale]/page:71`, `[locale]/not-found:23`,
  `article/[date]/not-found:19`, `news/[id]/not-found:19`, `about:156`,
  `newsletter/unsubscribe:70`, `app/not-found:32`);
- `from-brand-600 to-brand-400` no fallback de imagem — 2× (`news-card:36`,
  `news-detail:40`);
- `hover:text-brand-400` sobre `text-white/70` — 1× (`footer:37`);
- `bg-brand-900` — 1× (`footer:12`).

`brand-600` tem 33 usos e `brand-100`, 6 — mantêm o nome, mudam de valor.
Destino de cada um em `01-design-tokens.md` §5.

### 2.2 Duas descobertas sobre a camada semântica

1. **As 8 variáveis `--sidebar-*` não são usadas em lugar nenhum.** Não existe
   componente de sidebar no projeto; vieram no boilerplate do shadcn. A Fase 1
   deve removê-las, não traduzi-las.
2. **`--chart-1..5` são usadas de verdade** — `dashboard/category-bars.tsx` monta
   as barras por categoria com elas. Hoje são as 5 cores da marca, o que faz o
   gráfico parecer decoração em vez de dado.

**Nenhum dos 448 testes faz asserção sobre classe de marca.** A troca de tokens
não quebra a suíte — e a suíte também não protege contra regressão visual. É
para isso que existe `baseline-v1/`.

---

## 3. Medições

### 3.1 Lighthouse — produção

Mediana de 3 execuções por rota, runner do GitHub, 20/08/2026
([run 32319787845](https://github.com/tavinholoco/newra-news/actions/runs/32319787845),
relatórios completos no artifact `lighthouse-reports`, 90 dias de retenção).

| Rota | Performance | Acessibilidade | Best practices | SEO |
|---|---|---|---|---|
| `/pt-BR` | 97 | 96 | 96 | 100 |
| `/pt-BR/news` | 95 | 95 | 96 | 100 |
| `/pt-BR/article` | 97 | 94 | 96 | 100 |
| `/pt-BR/about` | 98 | 96 | 96 | 100 |
| `/en` | 98 | 96 | 96 | 100 |

> **Correção à §26 do plano.** O plano afirma que "a V1 já entrega
> 96 · 96 · 96 · 100" e propõe isso como piso da V2. Esse número é **só da
> home** — foi medido em 16/08 contra a raiz, uma URL só. Medindo rota a rota,
> duas já estão abaixo: `/news` tem 95 de performance e 95 de acessibilidade, e
> `/article` tem 94 de acessibilidade. O critério de aceite precisa ser
> **por rota, contra esta tabela**, não um número único — senão a V2 nasce
> reprovada em rotas que a V1 nunca atendeu.

Três defeitos do workflow foram corrigidos nesta fase, todos silenciosos:

- a auditoria apontava para a raiz, que redireciona para `/pt-BR` — o score era
  medido **através de um redirect**, e isso penaliza performance;
- `numberOfRuns: 3` no `.lighthouserc.json` era ignorado: a action sempre repassa
  o próprio input `runs` (default 1) ao `lhci`;
- o `upload-artifact` ignora caminhos ocultos por padrão, então `.lighthouseci/`
  subia vazio — 90 dias de relatórios perdidos a cada execução.

### 3.2 Core Web Vitals

**Não há dado de campo.** O site não tem tráfego para entrar no CrUX, então
LCP/INP/CLS reais de usuário não existem — e não vão existir até a camada de
analytics da §27 ser implementada (`04-analytics-e-slots.md`).

O que existe é laboratório, dentro dos relatórios do artifact acima. Registrar
"Core Web Vitals atuais" como número de campo seria inventar dado.

### 3.3 Acessibilidade — a causa dos 94–96

Auditoria local por rota (Lighthouse, categoria isolada — resultado bate com a
produção dentro de 1 ponto):

| Rota | Score | Auditorias falhando |
|---|---|---|
| `/pt-BR` | 96 | `color-contrast` |
| `/pt-BR/news` | 94 | `color-contrast`, `heading-order` |
| `/pt-BR/article` | 94 | `color-contrast`, `heading-order` |
| `/pt-BR/about` | 96 | `color-contrast` |

São **dois defeitos**, os dois estruturais:

**1. `#FFFFFF` sobre `#EC6426` = 3,27:1.** Reprova AA. Atinge 16 elementos: os
badges de categoria dos cards, os botões do seletor de idioma, o toggle de tema e
o botão de favoritar. É um problema de *token*, não de componente — e a paleta
da V2 o resolve sozinha: branco sobre `brand-700 #A83E1C` dá **6,23:1**.

**2. `text-white/50` sobre `bg-brand-900` = 4,04:1.** Reprova AA. Atinge os
títulos de seção do rodapé (`footer:29,48,60`) e a linha de copyright
(`footer:74`). O `text-white/70` das mesmas seções passa (6,41:1) — o defeito é
só nos dois níveis de 50%.

**3. `heading-order`** — o grid de notícias emite `h3` sem `h2` antecedendo na
sequência. É bug de estrutura semântica, não de estilo, e a reorganização
editorial da Fase 3 precisa corrigir a hierarquia em vez de herdá-la.

### 3.4 JavaScript por rota

Build de produção, `8827d3c`. Compartilhado por todas as rotas: **87,3 kB**.
Middleware: 37,6 kB.

| Rota | First Load JS |
|---|---|
| `/[locale]/news` | 161 kB |
| `/[locale]/favorites` | 158 kB |
| `/[locale]` | 157 kB |
| `/[locale]/news/[id]` | 148 kB |
| `/[locale]/article` | 142 kB |
| `/[locale]/signin` | 139 kB |
| `/[locale]/admin` | 138 kB |
| `/[locale]/dashboard` | 124 kB |
| `/[locale]/article/[date]` | 98,7 kB |
| `/[locale]/newsletter/unsubscribe` | 98,7 kB |
| `/[locale]/about` | 87,5 kB |

É a linha de base contra a qual medir o custo da V2. A home a 157 kB já carrega
TanStack Query, next-auth e next-intl; a Home da §6 acrescenta cinco blocos
novos. A §17 pede vigilância aqui.

### 3.5 Métricas de uso — o baseline é zero

O `DailyMetric` mede **o pipeline**, não o leitor: notícias coletadas, artigo
gerado, provider de IA, duração, erros, contagem por categoria e por fonte.

Nenhum dos 14 eventos de produto da §18.5 existe. Não há pageview, CTR, scroll
depth, artigos por sessão nem taxa de inscrição. As métricas de sucesso da §26
("CTR do hero", "profundidade de scroll", "saves por usuário") **não têm de onde
sair hoje**.

O registro honesto da Fase 0 é este: o baseline de uso da V1 é inexistente, e a
primeira medição de produto do projeto vai ser a da V2. Catálogo de eventos em
`04-analytics-e-slots.md`.

---

## 4. Infraestrutura — dois defeitos encontrados e corrigidos

A §40 declarou as migrations resolvidas em 19/08. A verificação desta fase — a
primeira vez que alguém aplicou o baseline em um banco vazio — encontrou dois
problemas que tornavam essa conclusão falsa.

**1. A migration de baseline estava corrompida.** O
`packages/database/prisma/migrations/0_init/migration.sql` terminava com o banner
"Update available 5.22.0 -> 7.9.1" do CLI do Prisma, 10 linhas de caracteres de
caixa colados no fim do SQL. Foi gerada com `migrate diff` redirecionado para
arquivo, e o aviso do CLI foi junto pelo stdout.

Ninguém percebeu porque em produção o baseline foi aplicado com
`migrate resolve --applied 0_init`, que **marca como aplicada sem executar o
SQL**. O `migrate deploy` do workflow também nunca a executa, pelo mesmo motivo.
O erro só aparece num banco novo — um clone de desenvolvimento, um staging, um
reset. `migrate deploy` falhava com `syntax error at or near "┌───┐"`.

**2. Faltava o `migration_lock.toml`.** O Prisma cria esse arquivo no
`migrate dev`; como o baseline nasceu de um `migrate diff`, ele nunca existiu.
Sem ele, `migrate diff --from-migrations` não consegue determinar o conector —
ou seja, **não havia como checar drift** entre as migrations e o `schema.prisma`.

Os dois foram corrigidos e verificados em banco limpo:

```
$ pnpm --filter @newranews/database db:migrate:deploy
All migrations have been successfully applied.

$ prisma migrate diff --from-migrations prisma/migrations \
    --to-schema-datamodel prisma/schema.prisma --exit-code
No difference detected.
```

Isso importa para a V2 porque a §37-E prevê migrations novas
(`add_daily_briefing_metadata`, entre outras). Elas seriam empilhadas sobre um
baseline que não replica.

---

## 5. O que a baseline visual mostra

`baseline-v1/` tem 42 capturas. O que elas confirmam do diagnóstico da §2.2 do
plano:

- **grade uniforme de três colunas** — todos os cards com o mesmo peso visual,
  a mesma proporção de imagem, o mesmo tamanho de título;
- **nenhuma hierarquia editorial** — a manchete principal não se distingue do
  décimo segundo item do feed;
- **o hero é um card, não uma capa** — o artigo do dia ocupa uma faixa
  `brand-100` de altura fixa;
- **acima de 1280px nada muda** — o `max-w-7xl` congela a coluna e o ganho de
  tela vira margem.

Duas ressalvas ao ler as imagens estão no `baseline-v1/README.md`: o seed local
não tem imagens (todos os cards caem no gradiente laranja, o que exagera a
saturação em relação à produção) e `/favorites` aparece como tela de login,
porque a captura roda sem sessão.

---

## 6. Resumo para quem vai executar a Fase 1

O que está fechado e não precisa mais de decisão:

- paleta, tipografia, escala, radius, sombra, espaço e motion → `01-design-tokens.md`;
- destino de cada uso de `brand-400`/`brand-900` → 13 ocorrências mapeadas;
- mapeamento das 31 variáveis do shadcn, incluindo as 8 que devem sumir;
- números a bater: a tabela por rota da §3.1, não um número único.

O que a Fase 1 vai encontrar de errado e já sabe:

- branco sobre laranja da V1 reprova AA em 16 elementos — o token novo resolve;
- `text-white/50` no rodapé reprova AA — precisa subir de nível;
- `heading-order` quebrado no grid de notícias — precisa de correção estrutural;
- `--sidebar-*` é código morto.
