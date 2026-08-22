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
├── /favorites                     Salvos                      Fase 6
├── /signin                        Entrar                      Fase 6
└── /admin                         Painel admin                fora do redesign
    └── /metrics                   Métricas do pipeline        fora do redesign
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
| Dados | `GET /api/home` — ✅ **existe** desde 20/08/2026 |
| Fase | 3 |

Blocos, na ordem da §6.1: `hero-story` → `briefing-card` → `top-stories` →
`trending-list` → `category-section` (× N) → `newsletter-cta` → `ad-slot`.

Era: `ArticleCard` (faixa de altura fixa) + `NewsGrid` de 12 cards idênticos.
Dos blocos acima só o `newsletter-cta` existia — entregue na Fase 2. Os outros
seis nasceram na Fase 3, junto da camada de cards da §11 que os alimenta, e o
`ArticleCard` saiu do repositório por ficar sem consumidor. ✅ **21/08/2026**

> **`trending` vem vazia quando nada foi publicado nas últimas 24h.** É
> comportamento correto do endpoint, não defeito: o bloco deve ser **omitido**,
> como já se faz com categoria sem matéria. Renderizar uma seção com título e
> nada dentro é pior que não renderizar. O mesmo vale para `hero` e `briefing`
> nulos — a Home precisa desenhar sem eles.

### `/[locale]/news` — Feed, busca e filtros ✅ entregue (Fase 4)

| | |
|---|---|
| Propósito | navegação por categoria e busca no acervo |
| Render | ISR 3600s (mantido) |
| Auth | pública |
| Indexação | sim |
| Dados | `GET /api/news` (forma inalterada; ganhou `source`, `from`/`to`, `sort`) + **`GET /api/news/facets`** |
| Fase | 4 |

Componentes: `category-nav` + `hero-story` / `story-card-horizontal` +
paginação + estados vazio e skeleton.

> **A previsão de "sem mudança" no dado não se sustentou — e o motivo está uma
> linha abaixo, nesta mesma ficha.** O `category-nav` pede **contagem**, e nada
> a expunha: seriam oito requisições para desenhar oito pílulas. `/api/news/facets`
> é aditivo — a forma do `GET /api/news`, que a admin e os favoritos consomem,
> continua a mesma.

> **`category-nav` não é `editorial-nav`.** O `editorial-nav` da Fase 2 é a
> linha 3 do masthead (§10): a faixa horizontal de categorias que aparece em
> todas as telas. O `category-nav` desta fase é o controle de **filtro** do
> acervo, com estado de categoria selecionada e contagem. A §28 chama o
> primeiro de "category navigation" na Fase 2 — é o do masthead, não este.

> **"Reaproveita `news-filters` e `news-page-client`" era otimista.** A previsão
> era trocar a apresentação e manter a lógica; o que aconteceu foi o contrário —
> a apresentação foi reescrita **e** a lógica saiu de `useState` para a URL.
> `news-filters` e `news-grid` foram removidos; `news-card` ficou só para os
> favoritos. O que se reaproveitou de verdade foram os cards editoriais, que era
> o ponto.

**Correção obrigatória:** o grid emitia `h3` sem `h2` na sequência
(`heading-order` reprovado — `00-diagnostico.md` §3.3). ✅ Corrigida: `h1` é o
título da página, `h2` o hero e o "Últimas", `h3` os cards, com teste que
percorre os headings e falha em qualquer salto de nível.

### `/[locale]/news/[id]` — Notícia ✅ entregue (Fase 5)

| | |
|---|---|
| Render | dinâmica |
| Dados | `GET /api/news/:id` + `GET /api/news/:id/related` |
| Fase | **5** (esta ficha dizia 4 — ver nota) |

Componentes: `article-hero`, `article-body`, `article-meta`, `favorite-button`,
`share-button`, `related-stories`, `newsletter-cta`.

> **A fase estava errada aqui.** A §28 põe `article hero`, `source list`,
> `share/save`, `related stories` e `newsletter CTA` na Fase 5, e os cinco são
> exatamente os componentes desta tela. A Fase 4 seguiu a §28 e deixou a tela de
> fora; a Fase 5 a entregou. Separá-la de `/article/[date]` teria duplicado
> `source-list` e `related-stories`.

> **Sem `source-list` e sem transparência de IA.** Esta matéria tem **uma**
> fonte, e ela cabe na linha de metadata; a lista de fontes é do briefing, que
> tem quinze. E o texto aqui foi escrito por uma redação — declarar IA seria
> mentira. O que a tela declara é que o texto é do veículo e que o Newra News
> coletou.

> **Sem `ad-slot`.** Sem inventário o componente não renderiza nada
> (`NEXT_PUBLIC_ADS_ENABLED`), e hoje é sempre esse o caso — o placement entra
> na Fase 8, com o resto da monetização.

### `/[locale]/article` — Histórico de briefings ✅ entregue (Fase 5)

| | |
|---|---|
| Render | ISR 3600s |
| Dados | `GET /api/articles` |
| Fase | 5 |

Lista cronológica de briefings, agrupada por mês e com o do dia marcado. O
`article-history-card` deixou de ser cartão e virou **item de lista**: data à
esquerda, manchete à direita, régua entre os dias. Uma grade de cartões fazia
cada dia parecer um produto separado.

> **Página em estado local, não na URL** — ao contrário de `/news`. A ficha
> escopa esta tela a ritmo visual, e ler a query string aqui exigiria uma
> fronteira de Suspense numa página que não precisa de nenhuma. Dívida
> consciente, anotada no componente.

### `/[locale]/article/[date]` — Briefing do dia ✅ entregue (Fase 5)

| | |
|---|---|
| Render | dinâmica |
| Dados | `GET /api/articles/:date`, **com** auditoria e fontes |
| Fase | 5 |

Componentes: `article-hero`, `article-body`, `ai-disclosure`, `source-list`,
`share-button`, `newsletter-cta`.

> **A lacuna de dados fechou em duas etapas, e a segunda quase passou.** A
> migration `add_daily_briefing_metadata` entrou na Fase 0.5, mas o schema de
> resposta continuou sendo o da V1 até 21/08 — o serviço lia os campos e o
> `fastify-type-provider-zod` os descartava na serialização. Ver item 20 do
> `progress.md`.

> **A declaração de IA vem antes da lista de fontes**: primeiro a afirmação,
> depois a evidência. E cada linha de auditoria se omite sozinha quando nula, o
> que é o estado normal dos briefings anteriores a 20/08 — a declaração fica, e
> ela não depende de coluna nenhuma.

> **Sem `related-stories` e sem `save`.** As relacionadas do briefing seriam as
> matérias que o originaram, e essas já estão na `source-list` — uma segunda
> lista seria a mesma informação duas vezes. O `save` não existe porque
> `Favorite` referencia `newsId`: favoritar um `Article` é trabalho da Fase 6.

> **Sem imagem de hero.** O briefing não tem uma para chamar de sua — as fotos
> pertencem às matérias que o originaram, e pegar uma delas atribuiria ao
> briefing a foto de um terceiro.

### `/[locale]/newsletter` — Landing ✅ entregue

| | |
|---|---|
| Propósito | peça de aquisição da §20 |
| Render | estática (SSG, 119 kB de First Load JS) |
| Auth | pública |
| Indexação | sim — no sitemap com prioridade 0.6 |
| Dados | `POST /api/newsletter/subscribe` (existe) |
| Fase | **2 — entregue** |

Única rota nova da V2. Traz a proposta de valor, o `newsletter-cta` com a
manchete da §20, três blocos do que o leitor recebe e um FAQ de quatro
perguntas — frequência, uso do e-mail, cancelamento e transparência de IA.

O FAQ é `<dl>` e não acordeão: são quatro respostas curtas, e esconder cada uma
atrás de um clique só acrescentaria trabalho.

Entra na próxima captura da baseline visual (§30) — a de `baseline-v2/` é
anterior à landing existir.

### `/[locale]/newsletter/unsubscribe` — Cancelamento ✅ entregue

| | |
|---|---|
| Indexação | **noindex** (mantida) |
| Dados | `GET /api/newsletter/unsubscribe?token=` |
| Fase | **2 — entregue** |

Só recebe os tokens novos. Os dois estados — cancelado e token inválido —
diferem em ícone, cor e texto, não em estrutura, então saíram de dois blocos de
JSX quase idênticos para um objeto de estado. Duplicar a marcação é como uma
das metades sai do lugar quando alguém mexe só numa.

### `/[locale]/about` — Sobre ✅ entregue

| | |
|---|---|
| Render | estática |
| Fase | **2 — entregue** |

Página de texto, agora na medida editorial de 68ch (`max-w-prose`) com a serif
nas manchetes e a escala nomeada no lugar dos tamanhos crus do Tailwind.

A medida vale para o **corrido**: a grade de etapas e os chips da stack usam a
largura editorial inteira. Espremer três cartões numa coluna de 620 px não
melhoraria leitura nenhuma.

### `/[locale]/admin/metrics` — Métricas do pipeline

| | |
|---|---|
| Render | `force-dynamic` (herdado de `admin/layout.tsx`) |
| Auth | sessão + role **ADMIN**; anônimo → `/signin?callbackUrl=` |
| Indexação | **noindex** |
| Dados | `GET /api/metrics/dashboard` via proxy `/api/admin/metrics` |
| Fase | fora do redesign (junto do painel admin) |

**Era `/[locale]/dashboard`, pública e indexada, até 20/08/2026.** É métrica de
**pipeline** — quantas notícias entraram, qual provider de IA respondeu, quanto
durou a execução, quantos dias falharam. Isso é operação do projeto, não
conteúdo editorial: expor a saúde interna do sistema para o leitor anônimo não
tem função de produto e conta mais do que precisa a quem estiver sondando.

Foi para dentro de `/admin`, atrás do mesmo guard do painel. Esconder só a
página seria cosmético — `GET /api/metrics/dashboard` também passou a exigir
JWT com role ADMIN, e o browser chega nele pela rota proxy do Next, que lê a
sessão e assina o token server-side. `/[locale]/dashboard` responde com um
redirect 308 permanente, porque a URL antiga estava no sitemap.

O que muda visualmente: `category-bars` passa a usar a rampa de `--chart-1..5`
da V2 (`01-design-tokens.md` §6), que distingue categorias em vez de repetir a
marca.

### `/[locale]/favorites` — Salvos

| | |
|---|---|
| Render | `force-dynamic` (**obrigatório** — ver §1.1 do diagnóstico) |
| Auth | sessão; anônimo → `/signin?callbackUrl=` |
| Indexação | **noindex** |
| Fase | 6 — **entregue** |

Usa `story-card-compact` para a notícia e `briefing-card-compact` para o
briefing, numa **lista só**, ordenada por quando o leitor salvou. Estado vazio
editorial, não uma lista vazia.

### `/[locale]/account` + `/account/preferences` + `/account/newsletter` — Conta

| | |
|---|---|
| Render | `force-dynamic` (guard no layout do segmento) |
| Auth | sessão; anônimo → `/signin?callbackUrl=` |
| Indexação | **noindex** |
| Fase | 6 — **entregue** |

Não existiam na V1. Perfil **de leitura** (o provedor de OAuth reescreve nome e
imagem a cada sign-in), assuntos e tema, e a inscrição na newsletter. As quatro
telas — com `/favorites` — dividem a `account-nav`.

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

### Nascem (22)

| Componente | Pasta | Fase |
|---|---|---|
| `article-meta` | `editorial/` | **1 — entregue** |
| `source-badge` | `editorial/` | **1 — entregue** |
| `reading-time` | `editorial/` | **1 — entregue** |
| `top-bar` | `layout/` | **2 — entregue** |
| `masthead` | `layout/` | **2 — entregue** |
| `editorial-nav` | `layout/` | **2 — entregue** |
| `mobile-nav` | `layout/` | **2 — entregue** |
| `logo` | `layout/` | **2 — entregue** (marca inline + wordmark tipográfico) |
| `masthead-search` | `layout/` | **2 — entregue** |
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
| `newsletter-cta` | `monetization/` | **2 — entregue** |
| `premium-cta` | `monetization/` | 8 |
| landing `/newsletter` | `app/` | **2 — entregue** |

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
| 2 — Shell ✅ | shell em todas as telas + `/about` + `/newsletter` (nova) + `/newsletter/unsubscribe` |
| 3 — Home | `/[locale]` |
| 4 — News | `/news`, `/news/[id]` |
| 5 — Article | `/article`, `/article/[date]` |
| 6 — Account | `/favorites`, `/signin`, `/account`, `/account/preferences`, `/account/newsletter` |
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
| `/pt-BR/admin/metrics` | não | atrás de sessão + role ADMIN; a captura da V1 pegou `/pt-BR/dashboard`, que era pública |
| `/pt-BR/signin` | sim | |
| `/pt-BR/favorites` | parcial | anônimo → cai no login |
| `/pt-BR/account*` | não | atrás de sessão; o anônimo é o mesmo sign-in que já está na baseline |
| `/pt-BR/newsletter/unsubscribe` | sim | |
| `/pt-BR/newsletter` | **não** | não existe ainda — entra na Fase 2 |
| `/en` | sim | |
| 404 | sim | fora da lista da §30, incluído por ser barato |
| `/pt-BR/admin` | não | excluído pela §30 |

Duas lacunas conhecidas, ambas registradas no `baseline-v1/README.md`: o estado
**autenticado** de `/favorites` e das métricas não está coberto, e o seed local
não tem imagens de notícia. A captura de `/pt-BR/dashboard` na baseline V1
continua válida como registro histórico — era essa a URL pública na V1.
