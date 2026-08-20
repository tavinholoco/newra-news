# Sitemap de telas da V2.0

Entregável da Fase 0 (plano V2 §28). Cruza as rotas que existem hoje com a
árvore de componentes da §23 e com os blocos editoriais das §§6–11.

Serve para duas coisas: garantir que nenhuma rota da V1 seja esquecida no
redesign, e dizer a cada fase exatamente quais telas ela entrega.

**Nada de rota nova além de `/[locale]/newsletter`.** A V2 é uma reescrita de
composição, não de arquitetura de informação — as 11 rotas atuais sobrevivem.

---

## 1. Mapa geral

```
/[locale]                          Home editorial              Fase 3
├── /news                          Feed + busca + filtros      Fase 4
│   └── /[id]                      Notícia                     Fase 4
├── /article                       Histórico de briefings      Fase 5
│   └── /[date]                    Briefing do dia             Fase 5
├── /newsletter                    Landing (NOVA)              Fase 2
│   └── /unsubscribe               Cancelamento                Fase 2
├── /about                         Sobre o projeto             Fase 2
├── /dashboard                     Métricas do pipeline        Fase 6
├── /favorites                     Salvos                      Fase 6
├── /signin                        Entrar                      Fase 6
└── /admin                         Painel admin                fora do redesign
```

O shell (`top-bar`, `masthead`, `editorial-nav`, `footer`, `mobile-nav`) é da
Fase 2 e vale para todas as telas.

---

## 2. Tela a tela

### `/[locale]` — Home editorial

| | |
|---|---|
| Propósito | mostrar em uma tela o que aconteceu hoje, com hierarquia |
| Render | ISR 3600s (manter) |
| Auth | pública |
| Indexação | sim |
| Dados | `GET /api/home` (§18.1) — hoje são 2 chamadas separadas |
| Fase | 3 |

Blocos, na ordem da §6.1: `hero-story` → `briefing-card` → `top-stories` →
`trending-list` → `category-section` (× N) → `newsletter-cta` → `ad-slot`.

Hoje: `ArticleCard` (faixa `brand-100` de altura fixa) + `NewsGrid` de 12 cards
idênticos. **Nenhum dos componentes da V2 existe.** É a fase mais pesada.

### `/[locale]/news` — Feed, busca e filtros

| | |
|---|---|
| Propósito | navegação por categoria e busca no acervo |
| Render | ISR 3600s (manter) |
| Auth | pública |
| Indexação | sim |
| Dados | `GET /api/news` (existe, sem mudança) |
| Fase | 4 |

Componentes: `category-nav` + `story-card` / `story-card-horizontal` +
paginação + estados vazio e skeleton.

> **`category-nav` não é `editorial-nav`.** O `editorial-nav` da Fase 2 é a
> linha 3 do masthead (§10): a faixa horizontal de categorias que aparece em
> todas as telas. O `category-nav` desta fase é o controle de **filtro** do
> acervo, com estado de categoria selecionada e contagem. A §28 chama o
> primeiro de "category navigation" na Fase 2 — é o do masthead, não este.

Reaproveita: `news-search`, `news-filters` e `news-page-client` já resolvem
estado de busca e filtro — a Fase 4 troca a apresentação, não a lógica.

**Correção obrigatória:** o grid emite `h3` sem `h2` na sequência
(`heading-order` reprovado — `00-diagnostico.md` §3.3).

### `/[locale]/news/[id]` — Notícia

| | |
|---|---|
| Render | dinâmica |
| Dados | `GET /api/news/:id` + **`GET /api/news/:id/related`** (§18.3, não existe) |
| Fase | 4 |

Componentes: hero de imagem, `source-list`, `reading-time`, `favorite-button`,
`related-stories`, `ad-slot`.

### `/[locale]/article` — Histórico de briefings

| | |
|---|---|
| Render | ISR 3600s |
| Dados | `GET /api/articles` |
| Fase | 5 |

Lista cronológica de briefings. `article-history-card` continua sendo o
primitivo; muda o ritmo visual (agrupar por mês, marcar o de hoje).

### `/[locale]/article/[date]` — Briefing do dia

| | |
|---|---|
| Render | dinâmica |
| Dados | `GET /api/articles/:date` + campos de auditoria (§18.4, **não existem**) |
| Fase | 5 |

É a tela mais afetada pela lacuna de dados: a §8 pede transparência de IA
(modelo, versão do prompt, fontes consultadas, horário de geração) e o modelo
`Article` só tem `title`, `content`, `summary`, `date` e `newsCount`. Sem a
migration da §37-E, a seção de transparência não tem o que exibir.

Componentes: hero do briefing, corpo em serif com medida de 68ch,
`source-list`, bloco de divulgação de IA, `share`/`save`, `related-stories`,
`newsletter-cta`.

### `/[locale]/newsletter` — Landing **(não existe)**

| | |
|---|---|
| Propósito | peça de aquisição da §20 — hoje a newsletter é só um form no rodapé |
| Render | estática |
| Auth | pública |
| Indexação | sim |
| Dados | `POST /api/newsletter/subscribe` (existe) |
| Fase | **2** |

Única rota nova da V2. Conteúdo: proposta de valor, exemplo do briefing,
frequência, form de inscrição, política de privacidade. Entra na baseline visual
da §30 assim que existir.

### `/[locale]/newsletter/unsubscribe` — Cancelamento

| | |
|---|---|
| Indexação | **noindex** (manter) |
| Dados | `GET /api/newsletter/unsubscribe?token=` |
| Fase | 2 |

Só recebe os tokens novos. Estados: cancelado, token inválido.

### `/[locale]/about` — Sobre

| | |
|---|---|
| Render | estática |
| Fase | 2 |

Página de texto. Ganha a medida editorial de 68ch e a tipografia serif.

### `/[locale]/dashboard` — Métricas do pipeline

| | |
|---|---|
| Render | ISR 3600s |
| Dados | `GET /api/metrics/dashboard` |
| Fase | 6 |

É métrica **de pipeline**, não de produto — é o painel de operação do projeto, e
o plano não pede que mude de natureza. O que muda: `category-bars` passa a usar
a rampa de `--chart-1..5` da V2 (`01-design-tokens.md` §6), que distingue
categorias em vez de repetir a marca.

### `/[locale]/favorites` — Salvos

| | |
|---|---|
| Render | `force-dynamic` (**obrigatório** — ver §1.1 do diagnóstico) |
| Auth | sessão; anônimo → `/signin?callbackUrl=` |
| Indexação | **noindex** |
| Fase | 6 |

Passa a usar `story-card-compact`. Precisa de estado vazio editorial, não de
uma lista vazia.

### `/[locale]/signin` — Entrar

| | |
|---|---|
| Render | `force-dynamic` |
| Indexação | **noindex** |
| Fase | 6 |

Google + GitHub, erro do OAuth via `?error=`, `callbackUrl` preservado.
Redesign apenas visual — **não mexer no fluxo**: o `pages.signIn` apontando para
`/` já causou um loop de redirect, corrigido em 16/08.

### `/[locale]/admin` — Painel admin

| | |
|---|---|
| Render | `force-dynamic` |
| Auth | role ADMIN |
| Indexação | **noindex** |
| Fase | — |

**Fora do redesign.** É ferramenta interna, fica fora da baseline visual (§30) e
não recebe trabalho editorial. Só precisa continuar funcionando depois da troca
de tokens.

---

## 3. Componentes: o que nasce, o que é renomeado, o que só muda de estilo

### Nascem (20)

| Componente | Pasta | Fase |
|---|---|---|
| `article-meta` | `editorial/` | **1 — entregue** |
| `source-badge` | `editorial/` | **1 — entregue** |
| `reading-time` | `editorial/` | **1 — entregue** |
| `top-bar` | `layout/` | 2 |
| `masthead` | `layout/` | 2 |
| `editorial-nav` | `layout/` | 2 |
| `mobile-nav` | `layout/` | 2 |
| `hero-story` | `editorial/` | 3 |
| `briefing-card` | `editorial/` | 3 |
| `story-card-horizontal` | `editorial/` | 3 |
| `story-card-compact` | `editorial/` | 3 |
| `trending-list` | `editorial/` | 3 |
| `category-section` | `editorial/` | 3 |
| `category-nav` | `editorial/` | 4 |
| `source-list` | `editorial/` | 5 |
| `related-stories` | `editorial/` | 5 |
| `ad-slot` | `monetization/` | 3 |
| `newsletter-cta` | `monetization/` | 2 |
| `premium-cta` | `monetization/` | 8 |
| landing `/newsletter` | `app/` | 2 |

### Renomeados a partir do que existe

| Hoje | Vira | Observação |
|---|---|---|
| `news/news-card` | `editorial/story-card` | perde o peso uniforme; ganha variantes |
| `news/news-grid` | absorvido por `category-section` e `top-stories` | |
| `article/article-card` | `editorial/briefing-card` | deixa de ser faixa de altura fixa |
| `article/article-history-card` | `editorial/story-card-compact` | |
| `layout/header` | `layout/masthead` + `top-bar` | vira três linhas (§10) |
| `layout/navbar` | `layout/editorial-nav` + `mobile-nav` | |

### Só mudam de estilo

`ui/*` (badge, button, card, input, safe-image, skeleton), `theme/*`,
`auth/*`, `favorites/favorites-list`, `dashboard/*`, `newsletter/subscribe-form`,
`admin/admin-panel`, `news/favorite-button`, `news/news-search`,
`news/news-filters`.

Os `*-page-client` e `*-detail` mantêm a lógica de dados e trocam a composição.

---

## 4. O que cada fase entrega, em telas

| Fase | Telas |
|---|---|
| 1 — Foundation | nenhuma; tokens e primitivos |
| 2 — Shell | shell em todas as telas + `/about` + `/newsletter` (nova) + `/newsletter/unsubscribe` |
| 3 — Home | `/[locale]` |
| 4 — News | `/news`, `/news/[id]` |
| 5 — Article | `/article`, `/article/[date]` |
| 6 — Account | `/favorites`, `/dashboard`, `/signin` |
| 7 — SEO/perf/a11y | todas (auditoria) |
| 8 — Monetização | `ad-slot` nas telas da 3, 4 e 5 |

---

## 5. Cobertura da baseline visual (§30)

| Rota | Na baseline V1 | Observação |
|---|---|---|
| `/pt-BR` | sim | + dark |
| `/pt-BR/news` | sim | + dark |
| `/pt-BR/news/[id]` | sim | id resolvido em runtime |
| `/pt-BR/article` | sim | |
| `/pt-BR/article/[date]` | sim | + dark |
| `/pt-BR/about` | sim | |
| `/pt-BR/dashboard` | sim | |
| `/pt-BR/signin` | sim | |
| `/pt-BR/favorites` | parcial | anônimo → cai no login |
| `/pt-BR/newsletter/unsubscribe` | sim | |
| `/pt-BR/newsletter` | **não** | não existe ainda — entra na Fase 2 |
| `/en` | sim | |
| 404 | sim | fora da lista da §30, incluído por ser barato |
| `/pt-BR/admin` | não | excluído pela §30 |

Duas lacunas conhecidas, ambas registradas no `baseline-v1/README.md`: o estado
**autenticado** de `/favorites` e `/dashboard` não está coberto, e o seed local
não tem imagens de notícia.
