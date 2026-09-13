# API Guide — Newra News Backend

Base URL (local): `http://localhost:3001/api`  
Documentação interativa: `http://localhost:3001/api/docs`

---

## Notícias

### GET /api/news

Lista notícias com paginação e filtros.

**Query Params:**

| Param | Tipo | Default | Descrição |
|-------|------|---------|-----------|
| `page` | number | 1 | Página |
| `limit` | number | 20 | Itens por página (máx: 100) |
| `category` | Category | — | Filtro por categoria |
| `search` | string | — | Busca no título/descrição |
| `date` | string (ISO) | — | Um dia exato de publicação |
| `from` | string (ISO) | — | Início do período, inclusivo |
| `to` | string (ISO) | — | Fim do período, inclusivo |
| `source` | string | — | Fonte exata, sem diferenciar maiúsculas |
| `sort` | `recent` \| `oldest` | `recent` | Ordem por data de publicação |

> `date` e `from`/`to` cobrem a mesma coluna. Quando os dois chegam, o período
> ganha — é o controle que o leitor acabou de mexer, e `date` costuma ser
> sobra de uma URL anterior.

**Categorias:** `TECHNOLOGY`, `POLITICS`, `ECONOMY`, `SPORTS`, `SCIENCE`, `ENTERTAINMENT`, `WORLD`, `HEALTH`

**Resposta 200:**
```json
{
  "data": [
    {
      "id": "uuid",
      "title": "string",
      "description": "string",
      "content": "string | null",
      "source": "string",
      "sourceUrl": "string",
      "imageUrl": "string | null",
      "category": "TECHNOLOGY",
      "publishedAt": "ISO string",
      "createdAt": "ISO string",
      "updatedAt": "ISO string"
    }
  ],
  "meta": {
    "total": 150,
    "page": 1,
    "limit": 20,
    "totalPages": 8
  }
}
```

> **`description` é um subtítulo e `content` é o corpo — e até a Fase 12 os dois
> campos não significavam isso.** Medido sobre as 6.669 linhas de produção em
> 25/08/2026: a `description` tinha **mediana de 594 caracteres**, p90 de 5.613
> e **máximo de 33.073** — metade do acervo usava o campo de subtítulo para
> guardar a matéria inteira —, e o `content` vinha **cru**, com HTML em 63,7%
> das linhas e um `<img>` abrindo 51,9% delas.
>
> A ingestão agora separa os dois (`splitDekAndBody`, em
> `providers/news/feed-text.ts`), e o resultado é o contrato:
>
> - **`description`** nunca passa de **320 caracteres** e termina em fronteira
>   de parágrafo ou de frase. Medido depois: p50 111, p90 281, máximo 320.
> - **`content`** é texto puro com os parágrafos preservados — sem tag, sem o
>   rodapé do veículo, sem aviso de paywall.
> - **`content: null` é normal e quer dizer "não há corpo além do subtítulo"**,
>   não "faltou dado". Vale para 40% do acervo: BBC, ESPN e TechCrunch mandam só
>   um resumo. A tela de leitura desenha esse caso e leva o leitor à fonte.
> - **Nada de texto se perde na separação.** Quando os dois campos traziam o
>   mesmo texto longo, ele vira o corpo e o subtítulo passa a ser a abertura
>   dele — `description` é sempre um prefixo de `content` quando os dois
>   existem por essa via.

---

### GET /api/news/facets

Contagem por categoria e por fonte do acervo **sob o recorte atual** — é o que
o `category-nav` da `/news` usa para mostrar o número ao lado de cada categoria
sem disparar uma consulta por categoria.

Aceita as mesmas dimensões de filtro do `GET /api/news` (`category`, `search`,
`date`, `from`, `to`, `source`); não aceita paginação, porque descreve o acervo
e não uma página dele.

**Cada lista ignora a própria dimensão.** Com `?category=SPORTS`, `categories`
ainda traz as outras sete com os seus números — do contrário o leitor não teria
como saber para onde trocar. `sources` idem em relação a `?source=`.

**Não há um total do recorte.** Esse número é o `meta.total` do `GET /api/news`,
que sai da mesma consulta que trouxe as matérias visíveis; um segundo total, por
outro caminho e com outro tempo de chegada, discordaria do primeiro enquanto um
dos dois ainda estivesse no ar.

`Cache-Control: public, s-maxage=300, stale-while-revalidate=3600`.

**Resposta 200:**
```json
{
  "data": {
    "categories": [
      { "category": "WORLD", "count": 41 },
      { "category": "ECONOMY", "count": 33 }
    ],
    "sources": [
      { "source": "G1", "count": 52 }
    ]
  }
}
```

`categories` vem ordenada por contagem decrescente e omite categoria sem
matéria. `sources` traz no máximo 30 fontes, as mais frequentes primeiro.

---

### GET /api/news/:id

Retorna uma notícia específica por UUID.

**Resposta 200:**
```json
{ "data": { ...news } }
```

**Resposta 404:**
```json
{ "error": "News not found" }
```

### DELETE /api/news/:id (admin)

Remove uma notícia. Exige `Authorization: Bearer <jwt>` com `role: ADMIN` no
payload (o JWT é assinado pelo frontend com o role vindo da sessão, que segue
`ADMIN_EMAILS`). Usada pelo painel `/admin` do frontend via rota proxy
(`/api/admin/news/:id`).

**Resposta 200:**
```json
{ "data": { "deleted": true, "id": "uuid" } }
```

**Resposta 401:** token ausente ou inválido.  
**Resposta 403:** token válido mas role ≠ `ADMIN`.  
**Resposta 404:** `{ "error": "News not found" }` — notícia inexistente.  
**Resposta 400:** `id` não é UUID válido.

> **Deixa rastro desde a Fase 5 do plano de observabilidade.** Cada chamada
> grava um `AuditEvent` com `action: "news.deleted"`, o `sub` da sessão como
> `actorId`, o id pedido como `targetId` e `outcome: "deleted" | "not-found"`
> — o 404 também é ação de admin. Lê-se em `GET /api/admin/audit`. A gravação
> nunca falha a resposta: a exclusão já aconteceu quando ela roda.

---

## Editorial

Os três endpoints que a Home e as telas de matéria da V2 consomem. Contratos
fechados na Fase 0 em `docs/v2/03-contratos-api.md`.

**São as únicas rotas da API que definem `Cache-Control`**
(`public, s-maxage=300, stale-while-revalidate=3600`). O `s-maxage` vale para o
CDN, não para o browser: a ISR de 3600s da home continua, e os 300s existem para
o `revalidatePath` on-demand do cron surtir efeito em minutos. Nenhuma rota
autenticada recebe o cabeçalho — num proxy compartilhado isso seria vazamento
entre sessões, não otimização.

### GET /api/home

Resposta agregada da Home. Existe porque a Home da V2 tem hero, briefing, top
stories, trending, seções por categoria e newsletter: composta bloco a bloco,
seriam 6+ chamadas em sequência a partir de um Server Component.

| Param | Tipo | Default | Limites |
|---|---|---|---|
| `locale` | `pt-BR` \| `en` | `pt-BR` | reservado; o acervo é único hoje |
| `categories` | number | 4 | 1–8 |

**Nenhuma notícia aparece duas vezes na resposta.** A precedência é
`hero` → `topStories` → `trending` → `categories` → `latest`; um bloco que
perde a disputa continua descendo o próprio ranking até preencher.

**Resposta 200:**
```json
{
  "data": {
    "hero": { "...EditorialStory": "...", "isFeatured": true },
    "briefing": {
      "id": "uuid",
      "date": "2026-08-20",
      "title": "...",
      "summary": "...",
      "sourceCount": 15,
      "readingTimeMinutes": 4,
      "generatedAt": "2026-08-20T08:02:11.000Z",
      "aiDisclosure": true,
      "sources": [{ "id": "uuid", "position": 0, "title": "...", "source": "G1", "sourceUrl": "...", "newsId": null }]
    },
    "topStories": ["...EditorialStory"],
    "trending": ["...EditorialStory com isTrending"],
    "latest": ["...EditorialStory"],
    "categories": [{ "category": "ECONOMY", "stories": ["...EditorialStory"] }]
  }
}
```

Regras que a resposta garante:

- `hero` é a mais recente **com imagem** — a §6.2 quer capa, e cerca de 30% do
  acervo vem de RSS sem imagem. `null` se nenhuma tiver;
- `briefing` é `null` quando o pipeline do dia ainda não rodou. A Home renderiza
  sem ele;
- categorias vazias são **omitidas**, não devolvidas com lista vazia;
- `sourceCount` cai para `newsCount` nos artigos anteriores à migration de
  auditoria, que não têm `sources`.

Sem campo `newsletter`: o bloco é estático (texto + formulário) e não depende de
dado do servidor.

### GET /api/trending

| Param | Tipo | Default | Limites |
|---|---|---|---|
| `limit` | number | 5 | 1–20 |
| `window` | `24h` \| `7d` | `24h` | |

Resposta: `{ data: EditorialStory[] }`, todas com `isTrending: true`.

**Etapa 1.** A §18.2 do plano propõe `recency + clicks + saves + shares`.
Destes, só `saves` existe — é a tabela `Favorite`. Cliques e compartilhamentos
dependem da camada de analytics da §27, que ainda não foi construída.

```
etapa 1 (atual)          score = recência + saves × 2
etapa 2 (após a Fase 8)  score = recência + saves × 2 + clicks × 0,5 + shares × 3
```

A recência decai por meia-vida de 12h: peso 1,0 na publicação, 0,5 doze horas
depois. **O que este endpoint devolve hoje é "recentes mais favoritadas"**, e
está dito assim de propósito — um "trending" cujo critério não está escrito vira
mito.

### GET /api/news/:id/related

| Param | Tipo | Default | Limites |
|---|---|---|---|
| `limit` | number | 4 | 1–12 |

Resposta: `{ data: EditorialStory[] }`. **404** se a notícia base não existir.

Critério, em ordem de precedência: mesma categoria em ±72h → mesma categoria
fora da janela → mais recentes de qualquer categoria. O terceiro nível existe
para uma categoria pouco povoada nunca devolver lista vazia.

Sem embeddings nem busca semântica: o acervo é de notícia diária, a categoria já
é sinal forte, e a §9 pede relacionadas úteis, não relevância de estado da arte.

### EditorialStory

O formato que os três endpoints devolvem — a notícia na perspectiva da
**composição**, não da coleta.

```json
{
  "id": "uuid",
  "title": "...",
  "dek": "a description da News, no vocabulário editorial",
  "imageUrl": null,
  "category": "ECONOMY",
  "source": "G1",
  "sourceUrl": "https://...",
  "publishedAt": "2026-08-20T12:00:00.000Z",
  "updatedAt": "2026-08-20T12:00:00.000Z",
  "readingTimeMinutes": 3,
  "isFeatured": true,
  "isTrending": true
}
```

`readingTimeMinutes` é calculado (200 ppm, do `content` e caindo para o `dek`) e
é `null` quando não há texto — zero seria uma afirmação, e ausência de conteúdo
é outra coisa. `isFeatured` e `isTrending` são **posicionais**, só aparecem
quando verdadeiros, e nenhum dos três é coluna no banco.

---

## Artigos

### GET /api/articles

Lista artigos diários com paginação.

**Query Params:** `page` (default: 1), `limit` (default: 10)

**Resposta 200:**
```json
{
  "data": [
    {
      "id": "uuid",
      "title": "string",
      "summary": "string",
      "content": "string (Markdown)",
      "date": "ISO string",
      "newsCount": 15,
      "createdAt": "ISO string",
      "updatedAt": "ISO string",
      "generatedAt": "ISO string | null",
      "promptVersion": "v1-ebb73b75 | null",
      "modelVersion": "gemini-2.5-flash | null",
      "status": "PUBLISHED"
    }
  ],
  "meta": { "total": 30, "page": 1, "limit": 10, "totalPages": 3 }
}
```

> A listagem **não** traz `sources` — seriam 15 linhas por artigo sem nada as
> exibindo. Elas acompanham só os endpoints de detalhe abaixo.

---

### Campos de auditoria da geração

Presentes em todo artigo (plano V2 §18.4). São **nulos nos artigos publicados
antes da migration `add_daily_briefing_metadata`** — não há como preenchê-los
retroativamente, porque nada registrava quais notícias entraram no briefing.

| Campo | Descrição |
|---|---|
| `generatedAt` | quando a IA gerou o texto (≠ `createdAt`, que é a linha do banco) |
| `promptVersion` | época do prompt + impressão digital do conteúdo (ex.: `v1-ebb73b75`) |
| `modelVersion` | modelo que de fato gerou (ex.: `gemini-2.5-flash`, `openai/gpt-oss-20b`) |
| `status` | `DRAFT` \| `PUBLISHED` \| `FAILED` |

---

### GET /api/articles/latest

Retorna o artigo mais recente, com a lista de fontes.

**Resposta 200:** `{ "data": { ...article, "sources": [...] } }`  
**Resposta 404:** `{ "error": "Article not found" }`

---

### GET /api/articles/:date

Retorna o artigo de uma data específica, com a lista de fontes.

**Param:** `:date` — formato `YYYY-MM-DD`

**Resposta 200:**
```json
{
  "data": {
    "...": "campos do artigo",
    "sources": [
      {
        "id": "uuid",
        "position": 0,
        "title": "string",
        "source": "G1",
        "sourceUrl": "https://...",
        "newsId": "uuid | null"
      }
    ]
  }
}
```

**Resposta 404:** `{ "error": "Article not found" }`

`sources` vem ordenado por `position` — a ordem em que as notícias foram
enviadas à IA. Os campos de exibição são cópias, não joins: o cleanup do
pipeline apaga `News` com mais de 30 dias e o artigo vive 90, então um join
deixaria dois terços dos briefings retidos sem lista de fontes. Por isso
`newsId` é um ponteiro fraco — nulo quando não resolveu, e obsoleto depois que
a notícia é removida.

---

## Jobs

### POST /api/jobs/daily-pipeline

Dispara o pipeline de coleta de notícias e geração do artigo.

**Rate limit:** 20 req/min  
**Header obrigatório:** `Authorization: Bearer <JOB_SECRET>`  
**Header opcional:** `x-actor-id: <User.id>` — o admin que clicou, quando o
disparo é manual (ver abaixo)

O processamento é assíncrono — o endpoint retorna imediatamente com o ID do
pipeline, **e com o que ele de fato fez**.

**É idempotente por dia.** Havendo um run de hoje em `SUCCESS` ou `RUNNING`, o
serviço devolve o id **daquele** run e não dispara nada — dois runs no mesmo dia
gerariam o briefing duas vezes e gastariam duas chamadas de IA.

**Resposta 200:**
```json
{
  "outcome": "started",
  "pipelineId": "uuid",
  "startedAt": "2026-08-25T11:00:00.000Z"
}
```

| `outcome` | O que aconteceu |
|---|---|
| `started` | este chamado criou o run, e ele está correndo agora |
| `already-running` | já havia um run de hoje em andamento; **nada foi disparado** |
| `already-succeeded-today` | o run de hoje já fechou com sucesso; **nada foi disparado** |

`startedAt` é de quem o `pipelineId` aponta: o run criado agora, ou o que já
existia.

> **O campo era `status: "started"`, sempre, e isso mentia.** O literal era
> devolvido nos três casos, o BFF do web traduzia para `success: true`, e o
> painel de admin imprimia "Pipeline disparado com sucesso". Medido em
> 25/08/2026: o botão foi clicado às ~16:25 UTC, a tela confirmou o disparo, e
> nada rodou — o run das 11:00 já tinha fechado. Levou uma investigação inteira
> para descobrir que a tela tinha dito mais do que sabia.
>
> O nome saiu de `status` de propósito: `PipelineLog.status` é outra coisa
> (`SUCCESS`/`RUNNING`/`FAILED`), e as duas no mesmo corpo se confundiriam.
>
> **Quem quer forçar a renormalização do acervo sem esperar o dia virar não usa
> esta rota** — usa `POST /api/jobs/renormalize-news`, logo abaixo, que não tem
> trava por dia.

**Resposta 401:**
```json
{ "error": "Invalid or missing token" }
```

**Resposta 400:** `{ "error": "Invalid x-actor-id header" }` — o cabeçalho
veio e não é UUID.

> **Quem disparou, e como a API fica sabendo (Fase 5 do plano de
> observabilidade).** A API não vê sessão nenhuma nesta rota: a cadeia do
> botão do painel é BFF (sessão ADMIN) → `GET /api/cron/daily-news`
> (`CRON_SECRET`) → esta rota (`JOB_SECRET`), e o disparo chegava sem usuário.
> O BFF passou a mandar `x-actor-id` com o `User.id` da sessão, o cron do Next
> o repassa, e esta rota grava um `AuditEvent` com `action:
> "pipeline.triggered"`, o `outcome` acima, `targetId` igual ao `pipelineId`
> **só quando `outcome` é `started`** (nos outros dois desfechos o id é de um
> run que já existia, e vai no `context`). O cron da Vercel não manda o
> cabeçalho e **não** produz linha — só um humano com sessão ADMIN produz.
>
> A confiança é a do `JOB_SECRET`: só quem o tem chega a ler o cabeçalho, e
> quem o tem já dispara o pipeline à vontade. Valor malformado é bug do BFF, e
> responde 400 em vez de disparar e perder a linha em silêncio.

---

### POST /api/jobs/renormalize-news

Reaplica as regras de ingestão às notícias **já gravadas**: decodifica
entidades, higieniza título, descrição **e corpo**, recupera a imagem que
estava escondida dentro do HTML do corpo, e reclassifica a categoria — nesta
ordem, porque a classificação lê o texto higienizado.

**O pipeline já faz isso sozinho, todo dia, na etapa 8.5.** Esta rota é para
*inspecionar* — `dryRun` é o padrão e devolve o relatório sem gravar nada — e
para casos pontuais em que não se quer esperar a próxima execução. Ela não é o
mecanismo: mecanismo que depende de alguém lembrar de rodar volta a divergir na
primeira mudança de regra.

**Rate limit:** 20 req/min
**Header obrigatório:** `Authorization: Bearer <JOB_SECRET>`

**Corpo (todos opcionais):**

| Campo | Tipo | Default | Descrição |
|---|---|---|---|
| `dryRun` | boolean | **`true`** | Sem `false` explícito, nada é gravado |
| `limit` | number | — | Teto de linhas examinadas, das mais recentes para as mais antigas |
| `sources` | string[] | **todas** | Restringe a varredura inteira a estas fontes |
| `categoryMode` | `clear-only` \| `all` | **`clear-only`** | Quais mudanças de categoria aplicar |

> **`dryRun` é o padrão de propósito.** É mutação em massa de conteúdo
> publicado; a resposta do ensaio traz `transitions` e uma amostra de até 25
> reclassificações justamente para ser lida antes de aplicar.

> **`categoryMode` também tem o padrão conservador, e por medição.** O ensaio
> contra as 3.688 linhas do acervo em 21/08 deu **320 demoções** (rótulo →
> `WORLD`) e **1.240 promoções** (`WORLD` → rótulo), e a qualidade das duas
> metades não é a mesma: as demoções conferidas na amostra estavam todas certas
> — matéria policial, trânsito, obituário e loteria saindo de "Tecnologia" e
> "Economia" —, enquanto as promoções erravam perto de metade das vezes, porque
> um corpo de milhares de caracteres cita "prefeitura" ou "festival" de
> passagem e limpa o piso de 3 palavras distintas do classificador. "Carnaval
> 2027" virava Política; "Festival da Juventude oferece vagas de estágio"
> virava Entretenimento.
>
> `clear-only` aplica só as demoções: remover um rótulo que a evidência não
> sustenta. `all` aplica tudo, e hoje isso consertaria 320 erros para criar
> perto de 500. O que precisa melhorar antes é o piso do classificador para
> texto longo — e isso é mudança de regra, não de backfill.
>
> `categorySkipped` na resposta conta o que o modo corrente **não** aplicou.
> Reparo de texto acontece nos dois modos: são independentes.

**Há dois recortes, e eles não são o mesmo.** A **varredura** é o acervo
inteiro, e `sources` a restringe. A **reclassificação**, dentro de qualquer
varredura, continua valendo só para as fontes **sem `category` fixa** em
`rss-sources.ts` — as únicas cuja categoria o classificador decidiu. Fonte
especializada (TechCrunch, InfoMoney, ESPN…) teve a categoria escolhida pela
configuração, e recalcular ali destruiria dado correto: ela recebe higiene de
texto e nunca troca de categoria.

> **A varredura passou a ser o acervo inteiro na Fase 12, e o motivo foi
> medição.** O filtro antigo era o das fontes do classificador, e ele existia
> para proteger a categoria. Só que o HTML cru no corpo estava concentrado
> justamente nas fontes de categoria fixa — **InfoMoney, Olhar Digital e
> Drauzio Varella com 100% do corpo em HTML**, a ESPN com a palavra `null` em
> 158 itens —, então varrer só as genéricas deixava de fora quase todo o
> defeito. O argumento do filtro sempre foi sobre categoria; ele agora está
> aplicado ao campo certo.

`imageRecovered` conta as linhas que ganharam `imageUrl` a partir de uma
`<img>` dentro do corpo. Só entra onde não havia foto declarada — a do veículo
nunca é sobrescrita.

**Resposta 200:**
```json
{
  "data": {
    "dryRun": true,
    "scanned": 3688,
    "textChanged": 1974,
    "imageRecovered": 107,
    "categoryChanged": 320,
    "categorySkipped": 1272,
    "transitions": [
      { "from": "TECHNOLOGY", "to": "WORLD", "count": 94 },
      { "from": "POLITICS", "to": "WORLD", "count": 78 }
    ],
    "sample": [
      {
        "id": "uuid",
        "title": "Primas desaparecidas no PR: principal suspeito é morto",
        "from": "TECHNOLOGY",
        "to": "WORLD"
      }
    ]
  }
}
```

**Resposta 401:** `{ "error": "Invalid or missing token" }`

**Ensaio, depois aplicação:**
```bash
# 1. ensaio — lê `transitions` e `sample`, não grava nada
curl -X POST "$API/api/jobs/renormalize-news" -H "Authorization: Bearer $JOB_SECRET" -H 'Content-Type: application/json' -d '{}'

# 2. aplicação — só depois de conferir a amostra acima
curl -X POST "$API/api/jobs/renormalize-news" -H "Authorization: Bearer $JOB_SECRET" -H 'Content-Type: application/json' -d '{"dryRun": false}'
```

É idempotente: a segunda execução sobre o mesmo acervo relata zero mudanças.

---

### GET /api/jobs/:pipelineId

Consulta o status de execução de um pipeline. **Requer o `JOB_SECRET`**, como o
disparo.

> **Era pública até a revisão da Fase 9**, e devolvia `error` — a mensagem crua
> da falha, com o que quer que o provider de IA ou o Prisma tenham dito. Fechar
> não custou acesso a ninguém: o `pipelineId` só sai da resposta do
> `POST /api/jobs/daily-pipeline`, que já exigia o segredo, e nada no browser
> chama esta rota.

**Resposta 200:**
```json
{
  "data": {
    "id": "uuid",
    "status": "RUNNING | SUCCESS | FAILED",
    "newsCount": 42,
    "articleId": "uuid | null",
    "error": "string | null",
    "startedAt": "ISO string",
    "completedAt": "ISO string | null"
  }
}
```

**Resposta 404:** `{ "error": "Pipeline not found" }`

---

## Métricas

### GET /api/metrics/weekly

Retorna métricas agregadas dos últimos 7 dias.

**Query Params:** `date` (opcional, `YYYY-MM-DD`) — data de referência (default: hoje)

**Resposta 200:**
```json
{
  "data": {
    "period": { "start": "ISO string", "end": "ISO string" },
    "totalDays": 7,
    "avgNewsPerDay": 45.3,
    "totalArticlesGenerated": 6,
    "pipelineSuccessRate": 0.857,
    "avgPipelineDuration": 12000,
    "newsByCategory": { "TECHNOLOGY": 90, "WORLD": 60 },
    "aiProviderUsage": { "gemini": 5, "groq": 1 }
  }
}
```

---

### GET /api/metrics/monthly

Retorna métricas do mês completo.

**Query Params:** `month` (opcional, `YYYY-MM`) — default: mês atual

**Resposta 200:**
```json
{
  "data": {
    "period": { "month": "2024-01" },
    "totalNewsCollected": 1400,
    "totalArticlesGenerated": 29,
    "avgNewsPerDay": 45.2,
    "topCategories": [{ "category": "TECHNOLOGY", "count": 350 }],
    "failureDays": 2,
    "newsApiTotal": 700,
    "rssTotal": 700
  }
}
```

---

### GET /api/metrics/dashboard (admin)

Retorna um resumo com métricas de hoje, última semana e último mês.

**Era pública até 20/08/2026.** Passou a exigir `Authorization: Bearer <jwt>`
com `role: ADMIN` no payload — mesmo desenho de `DELETE /api/news/:id`. Métrica
de pipeline é dado operacional, e a página que a consome saiu de
`/[locale]/dashboard` para `/[locale]/admin/metrics`; o browser chega aqui pela
rota proxy `/api/admin/metrics`, que lê a sessão e assina o token server-side.

`GET /api/metrics/weekly` e `/monthly` seguem públicas.

**Resposta 401:** token ausente ou inválido.
**Resposta 403:** `{ "error": "Admin access required" }` — autenticado sem role
ADMIN.

**Resposta 200:**
```json
{
  "data": {
    "today": {
      "newsCollected": 50,
      "articleGenerated": true,
      "aiProvider": "gemini",
      "pipelineDuration": 11000,
      "pipelineErrors": 0,
      "newsApiCount": 30,
      "rssCount": 20,
      "cleanupCount": 7
    },
    "lastWeek": { ...weeklyMetrics },
    "lastMonth": {
      "totalNewsCollected": 1400,
      "totalArticlesGenerated": 29,
      "avgNewsPerDay": 45.2,
      "failureDays": 2
    }
  }
}
```

> **`newsApiCount`, `rssCount` e `cleanupCount` saem desde a Fase 5 do plano
> de observabilidade.** O `DailyMetric` as grava desde a V1 e o schema nunca
> as declarou — o serializador as descartava em silêncio. São a rosquinha
> "ingestão por fonte" (§4.3) e o cartão do expurgo. `pipelineDuration` é
> **milissegundo**; o `durationSeconds` de `/api/admin/pipeline/runs` é segundo.

---

### GET /api/metrics/product (admin)

Métricas de **produto** — comportamento de gente. O `/dashboard` acima mede o
pipeline. Mesmo guarda: JWT com role ADMIN.

**Query:** `days` (1 a 90, padrão 30). O teto é a retenção do evento cru — uma
janela maior mostraria queda onde houve **apagamento**.

**Resposta 200:**

```json
{
  "data": {
    "period": { "start": "...", "end": "...", "days": 30 },
    "audience": { "sessions": 12, "newsletterSubscribers": 42, "accounts": 7 },
    "byDay": [{ "date": "2026-08-22", "sessions": 3, "events": 9 }],
    "byType": [{ "type": "homepage_view", "count": 9 }],
    "storyOpensBySource": [{ "source": "hero", "count": 4 }],
    "categoryViews": [{ "category": "HEALTH", "count": 2 }],
    "readingDepth": { "opened": 6, "scroll25": 4, "scroll50": 3, "scroll90": 1 },
    "searchesWithoutResults": [{ "query": "eclipse", "count": 2 }]
  }
}
```

> **`sessions` é volume de visita, não gente recorrente.** O `sessionId` morre ao
> fechar a aba — é isso que mantém a medição anônima. Quem mede audiência
> recorrente são `newsletterSubscribers` e `accounts`, que não vêm do
> `ProductEvent`: são estado persistente.

`searchesWithoutResults` traz **texto digitado por leitor** (higienizado na
origem, truncado em 100). É mais uma razão para a rota ser admin-only. Teto de
20 termos, do mais frequente.

**Resposta 400:** `days` fora de 1–90. **401/403:** sem token ou sem role ADMIN.

---

## Saúde

### GET /api/metrics/http (admin)

Os **quatro sinais de ouro** (§3.1 do plano de observabilidade). Latência,
tráfego e erro existem desde a Fase 9, na única forma em que existem: a janela
do processo que está no ar. **Saturação** entrou na Fase 5 — memória residente,
atraso do event loop e as horas do plano no mês —, e é o sinal que faltava nos
três incidentes (29/08, 03/09 e o gatilho da `/metrics/product`).

**Resposta 200:**
```json
{
  "data": {
    "since": "ISO string",
    "uptimeSeconds": 3600,
    "totalRequests": 1284,
    "errorRate": 0.0008,
    "clientErrorRate": 0.012,
    "latencyMs": { "avg": 42, "p50": 50, "p95": 250, "p99": 500, "max": 4903 },
    "routes": [
      { "route": "GET /api/news", "count": 812, "errorRate": 0, "avgMs": 38, "p95Ms": 100, "maxMs": 940 }
    ],
    "saturation": {
      "memory": { "rssBytes": 98304000, "heapUsedBytes": 41000000, "heapTotalBytes": 60000000, "limitBytes": 536870912, "ratio": 0.1831 },
      "eventLoop": { "resolutionMs": 10, "samples": 35912, "lagMs": { "p50": 0, "p95": 2, "p99": 11, "max": 45210 } },
      "plan": { "month": "2026-09", "monthStart": "2026-09-01T00:00:00.000Z", "secondsUsed": 1098000, "hoursUsed": 305, "limitHours": 750, "ratio": 0.4067 }
    }
  }
}
```

> **`saturation.plan` é a única parte que vem do banco, e a única que fala do
> mês — e por isso a única que pode vir `null`.** Com o banco fora (ou nos
> primeiros minutos de uma promoção, antes de o `migrate.yml` aplicar), a rota
> continua respondendo os outros três sinais e `plan: null`; ela é em memória
> de propósito, para responder justamente quando o banco é o problema. É a
> soma do `DailyUptime` no mês de calendário UTC — a tabela que um
> heartbeat de cinco minutos incrementa enquanto o processo está de pé, e que o
> `SIGTERM` fecha. `process.uptime()` não serve: desde 01/09 a API dorme e
> acorda várias vezes por dia, e cada acordada zera o contador. `ratio` acima
> de 1 é o que suspendeu a API em 29/08/2026. `memory.ratio` é RSS sobre os
> 512 MB do plano; `eventLoop.lagMs` é o atraso **além** da resolução do timer
> (10 ms), então em regime o p50 é ~0 e o `max` guarda a pior parada que esta
> instância viu.

> **`since` e `uptimeSeconds` não são enfeite.** A janela é em memória: **zera a
> cada deploy e a cada hibernação** (o plano free do Render dorme com ~15 min
> sem tráfego), e com mais de uma instância cada uma responde a sua. Sem esses
> dois campos, um `errorRate: 0` logo depois de um deploy pareceria saúde e
> seria só ausência de amostra.
>
> **Por que em memória:** a alternativa era uma escrita no Prisma por
> requisição para responder a uma pergunta que se faz uma vez por semana — a
> armadilha da tabela sem leitor, de novo. **O gatilho para persistir** é mais
> de uma instância no Render, ou a primeira pergunta que exija comparar duas
> semanas.

> Os percentis vêm de histograma, então são **o teto do bucket** em que o
> percentil cai (`50, 100, 250, 500, 1000, 2500, 5000` ms), não o valor exato.
> Guardar amostra para responder exato seria memória proporcional ao tráfego.

**Resposta 401/403:** sem token, ou sem `role: ADMIN`.

---

### GET /api/health

Healthcheck do servidor (usado pelo UptimeRobot).

**Resposta 200:**
```json
{ "status": "ok", "timestamp": "ISO string", "uptime": 3600.5 }
```

### GET /api/health/providers

Diagnóstico de chaves dos providers (NewsData.io, Gemini e Groq). Faz uma requisição leve ao vivo contra cada API e reporta apenas o status — as chaves nunca são expostas na resposta.

**Auth:** `Authorization: Bearer <JOB_SECRET>`

**Rate limit:** 10 req/min (além do limite global de 100 req/min).

**Resposta 200:**
```json
{
  "newsdata": "ok",
  "gemini": "ok",
  "groq": "ok"
}
```

**Status possíveis por provider:**

| Status | Significado |
|--------|------------|
| `ok` | Chave válida, API respondendo |
| `invalid` | Chave inválida, erro HTTP ou timeout |
| `not_configured` | Chave não configurada no ambiente (ex.: `NEWSDATA_API_KEY` ausente) |

**Resposta 401:** token ausente ou inválido.

---

## Newsletter

### POST /api/newsletter/subscribe

Inscreve um e-mail na newsletter do artigo diário. Idempotente: se o e-mail já está ativo, retorna o assinante existente; se estava cancelado, **reativa**.

**Body:** `{ "email": "assinante@example.com" }`

**Rate limit:** 5 req/min (além do limite global).

**Resposta 200:**
```json
{
  "data": {
    "id": "uuid",
    "email": "assinante@example.com",
    "status": "ACTIVE",
    "createdAt": "ISO string",
    "updatedAt": "ISO string"
  }
}
```

**Resposta 400:** e-mail inválido ou body ausente.

### GET /api/newsletter/unsubscribe

Cancela a assinatura via token (link presente no rodapé de cada e-mail). Não requer autenticação — o token UUID é o segredo.

**Query:** `?token=<uuid>`

**Resposta 200:**
```json
{ "data": { "unsubscribed": true } }
```

`unsubscribed: false` quando o token é desconhecido ou a assinatura já está cancelada.

**Resposta 400:** token ausente.

### POST /api/newsletter/send

Dispara manualmente o envio da newsletter do dia (idempotente — um envio por dia via `NewsletterLog`). O pipeline já chama isso internamente após gerar o artigo; este endpoint serve para reprocessamento manual após falha.

**Auth:** `Authorization: Bearer <JOB_SECRET>`

**Rate limit:** 10 req/min.

**Resposta 200:**
```json
{ "data": { "total": 12, "sent": 11, "failed": 1 } }
```

> Sem `RESEND_API_KEY` o envio é pulado (contado como `failed`) — o pipeline não quebra.

**Resposta 401:** token ausente ou inválido.

---

## Favoritos

> Requer autenticação: `Authorization: Bearer <jwt>` — JWT assinado pelo frontend com o `AUTH_JWT_SECRET` compartilhado (ver plano de auth). O `sub` do token identifica o usuário.
>
> **Nenhuma rota daqui leva `Cache-Control`.** A resposta é por usuário; um `s-maxage` num proxy compartilhado serviria o recorte de um leitor para o próximo.

Um favorito alcança **duas** coisas — a notícia coletada (`NEWS`) e o briefing do dia (`ARTICLE`) —, e por isso o item é identificado por `itemType` + `itemId`.

### GET /api/favorites

Lista o que o usuário salvou, mais recentes primeiro. A lista é **única**: notícias e briefings juntos, na ordem em que foram salvos.

**Query Params:**

| Parâmetro | Valores | Nota |
|---|---|---|
| `page` / `limit` | default 1 / 20 (máx 100) | |
| `type` | `NEWS` \| `ARTICLE` | sem ele, os dois tipos |
| `category` | as oito categorias | dimensão só da notícia — com ela, briefing nenhum entra |
| `source` | nome da fonte | idem |
| `search` | texto | notícia: título/descrição · briefing: título/resumo |
| `from` / `to` | ISO | notícia: `publishedAt` · briefing: `date` |
| `sort` | `saved` (default) \| `recent` \| `oldest` | `saved` = quando o leitor salvou; os outros = data do conteúdo |

> São **as mesmas dimensões de `GET /api/news`**, lidas pelo mesmo schema — é o que faz o "somente salvos" do acervo filtrar exatamente como o acervo.

> `meta.total` conta **o que a lista consegue mostrar**. Favorito cujo conteúdo o cleanup do Stage 8 já apagou não entra na conta nem aparece: contar a linha do favorito prometeria um card que nunca vem.

**Resposta 200:**
```json
{
  "data": [
    {
      "id": "uuid (do favorito)",
      "itemType": "NEWS",
      "itemId": "uuid",
      "createdAt": "ISO string",
      "news": { "...": "news" }
    },
    {
      "id": "uuid (do favorito)",
      "itemType": "ARTICLE",
      "itemId": "uuid",
      "createdAt": "ISO string",
      "article": {
        "id": "uuid",
        "title": "string",
        "summary": "string",
        "date": "ISO string",
        "newsCount": 15
      }
    }
  ],
  "meta": { "total": 3, "page": 1, "limit": 20, "totalPages": 1 }
}
```

> O briefing vem **sem o corpo**: o card de salvos não o usa, e `content` é o campo mais pesado do banco.

### GET /api/favorites/ids

Só os ids do que está salvo, sem conteúdo nenhum. É o que o botão de salvar lê para saber se **este** item já está salvo — uma consulta por sessão, compartilhada por todos os botões da página.

**Resposta 200:**
```json
{ "data": { "news": ["uuid"], "articles": ["uuid"] } }
```

### POST /api/favorites

Salva um item. **Idempotente**: salvar de novo devolve o mesmo favorito (200).

**Body:** `{ "itemType": "NEWS" | "ARTICLE", "itemId": "uuid" }` — `itemType` é opcional e vale `NEWS`.

**Resposta 200:**
```json
{
  "data": {
    "id": "uuid",
    "userId": "uuid",
    "itemType": "NEWS",
    "itemId": "uuid",
    "createdAt": "ISO string"
  }
}
```

**Resposta 404:** `{ "error": "News not found" }` ou `{ "error": "Article not found" }` — conteúdo inexistente.

### DELETE /api/favorites/:itemType/:itemId

Remove um item salvo. `itemType` na URL é minúsculo: `news` ou `article`.

**Resposta 200:** `{ "data": { "removed": true } }`  
**Resposta 400:** tipo fora do enum.  
**Resposta 404:** `{ "error": "Favorite not found" }` — não estava salvo.

**Resposta 401 (todas):** token ausente ou inválido.

---

## Autenticação

> A API não tem sessão própria: quem autentica é o frontend (next-auth), e o
> que atravessa a fronteira é um **JWT HS256 assinado com o `AUTH_JWT_SECRET`
> compartilhado**. Todas as rotas protegidas o exigem em
> `Authorization: Bearer <jwt>`.

### POST /api/auth/upsert

Cria (ou atualiza) o usuário na primeira vez que ele entra. É chamada pelo
callback `jwt` do next-auth, server-side, **não pelo browser**.

**Requer um token com `purpose: "auth-upsert"`** — e é o único endpoint que o
aceita. O token de sessão (que não carrega `purpose`) é recusado aqui com 401, e
o de `auth-upsert` é recusado em todas as outras rotas protegidas. Até a revisão
da Fase 9 essa checagem existia só dentro deste handler, e o token de upsert
passava no `/api/favorites` como se fosse de sessão.

**Body:** `{ "email": string, "name"?: string | null, "image"?: string | null }`

**Resposta 200:**
```json
{
  "data": {
    "id": "uuid",
    "email": "string",
    "name": "string | null",
    "image": "string | null",
    "role": "USER | ADMIN"
  }
}
```

> O `role` sai de `ADMIN_EMAILS`: o e-mail listado ali nasce `ADMIN`. É este
> valor que o frontend grava na sessão e reassina nos tokens seguintes, e é por
> ele que o `DELETE /api/news/:id` e as métricas de admin decidem.

**Resposta 401:** token ausente, inválido, com o `purpose` errado, ou com um
`email` que não bate com o do corpo — sem essa amarração, um token válido
criaria usuário para outro e-mail.

---

## Conta

> Requer autenticação, como os favoritos — e, pelo mesmo motivo, **sem `Cache-Control` em nenhuma rota**.

### GET /api/account

Tudo que a tela de conta precisa numa chamada: perfil, preferências, estado da inscrição na newsletter e quantos itens de cada tipo o leitor salvou.

**Resposta 200:**
```json
{
  "data": {
    "user": {
      "id": "uuid",
      "email": "string",
      "name": "string | null",
      "image": "string | null",
      "role": "USER | ADMIN",
      "createdAt": "ISO string"
    },
    "preferences": { "categories": ["WORLD"], "theme": "SYSTEM" },
    "newsletter": { "subscribed": true, "email": "string | null" },
    "saved": { "news": 4, "articles": 1 }
  }
}
```

> `newsletter.email` pode **não ser** o e-mail do login: a inscrição não exige conta. A rota procura por `userId` e, só então, pelo e-mail — amarrando o `userId` quando acha, para a resposta parar de depender de os dois coincidirem.

**Resposta 404:** `{ "error": "User not found" }` — sessão válida apontando para conta removida.

### GET /api/account/preferences

**Resposta 200:** `{ "data": { "categories": [], "theme": "SYSTEM" } }`

> A linha só nasce no primeiro `PUT`. A leitura devolve o padrão em vez de gravar escolha que o leitor não fez.

### PUT /api/account/preferences

**Body:** `{ "categories"?: Category[], "theme"?: "LIGHT" | "DARK" | "SYSTEM" }` — pelo menos um dos dois.

> **Campo ausente não é campo apagado**: a tela salva só o que o leitor mexeu, e a categoria escolhida ontem não some porque hoje ele trocou o tema.

**Resposta 200:** as preferências resultantes.  
**Resposta 400:** corpo vazio, ou categoria fora do enum.

> A §19 do plano pede mais dimensões (temas, fontes, horário do briefing, tipo de alerta). Só entra aqui o que a interface consegue honrar: o pipeline roda num cron único, então "horário do briefing" seria um controle que o sistema não atende; e "receber por e-mail" é a inscrição da newsletter, que tem tabela própria.

### PUT /api/account/newsletter

Inscreve ou cancela pela sessão — sem o token que vai no e-mail, que continua sendo o caminho de quem cancela sem estar logado.

**Body:** `{ "subscribed": boolean }`

**Resposta 200:** `{ "data": { "subscribed": false, "email": "string | null" } }`

**Resposta 401 (todas):** token ausente ou inválido.

---

## Eventos de produto

> A camada de analytics da §27 do plano e da parte 1 de
> `docs/v2/04-analytics-e-slots.md`. **Pública e anônima**: não há sessão para
> autenticar — a §4 proíbe justamente o identificador que serviria para isso —,
> então o que separa evento de lixo é o schema.

### POST /api/events

Ingestão em lote. Rate limit próprio: **30 req/min** por IP (o global é 100),
porque `track()` despacha em blocos e não uma requisição por clique.

**Body:**

```json
{
  "events": [
    {
      "sessionId": "uuid",
      "locale": "pt-BR",
      "path": "/pt-BR/news",
      "occurredAt": "2026-08-22T12:00:00.000Z",
      "type": "story_open",
      "storyId": "uuid",
      "category": "HEALTH",
      "position": 0,
      "source": "hero"
    }
  ]
}
```

Os quatro campos de base vêm em todo evento e são anexados por `track()`, nunca
pelo componente. O resto depende do `type` — são os 14 do catálogo, cada um com
o seu payload fechado, validados por união discriminada.

| Regra | Por quê |
|---|---|
| `sessionId` é UUID de **sessão** | não persiste entre visitas e não identifica pessoa (§4) |
| `path` **recusa query string** | a query carrega o termo de busca, que tem regra de higiene própria |
| `query` de `search` cabe em 100 caracteres | o truncamento acontece no cliente; aqui é o teto, porque o cliente é editável |
| lote de 1 a 20 eventos | acima disso é script, não leitor |

**Resposta 201:** `{ "data": { "accepted": 2 } }`

`201` porque a requisição criou linhas, e o corpo diz **quantas** — um
`{ ok: true }` não deixaria descobrir que metade do lote sumiu.

**Resposta 400:** tipo fora do catálogo, `source` inventado, campo que o próprio
tipo exige faltando, `sessionId` que não é UUID, `path` com query, lote vazio ou
acima do teto. **Nada é gravado** — a validação é do lote inteiro.

**Não leva `Cache-Control`**, pela mesma razão que as rotas de conta não levam: a
resposta é da requisição, não do recurso.

**Retenção:** 90 dias no nível de evento, cortando por `occurredAt`. Quem executa
é a **etapa 8 do pipeline diário**, junto do cleanup que já apaga notícia aos 30
dias e briefing aos 90 — não há job manual a disparar.

---

## Pipeline (admin)

> **A mesma consulta do `/api/dev/logs`, por outra porta.** As rotas abaixo
> exigem sessão com `role: ADMIN` (JWT assinado pelo BFF do Next), e é o que o
> painel `/admin` lê. Entregam **zero tabela nova e zero consulta nova**: o que
> a Fase 2 do plano de observabilidade acrescentou foi o acesso — até ela, o
> dono do produto não conseguia ver de nenhuma superfície em que conseguisse
> entrar que o run de ontem falhou na etapa 6.
>
> **Tudo sob `/api/admin` é admin-only por construção**: o `authPlugin` e o
> `requireAdmin` registram uma vez no grupo, e há guarda enumerando o roteador
> (`authorization-matrix.test.ts`).
>
> O `/api/dev/*` continua existindo e continua atrás do `JOB_SECRET` — acesso
> por segredo é o caminho que funciona quando **não há sessão**, e isso importa
> mais justamente quando o que quebrou é o provedor de sessão.

### GET /api/admin/pipeline/runs

Últimos runs do pipeline + os que falharam, com filtros opcionais.

**Auth:** `Authorization: Bearer <JWT>` com `role: ADMIN`
**Rate limit:** o global, 100 req/min
**Query Params:**

| Param | Tipo | Default | Descrição |
|-------|------|---------|-----------|
| `status` | `RUNNING \| SUCCESS \| FAILED` | — | Filtro por status |
| `since` | number (dias) | — | Apenas runs iniciados nos últimos N dias (1–90) |
| `limit` | number | 30 | Máx. de runs retornados (1–100) |

**Resposta 200:** idêntica à de `GET /api/dev/logs` — mesmo schema
(`devLogsResponseSchema`), tipado em `packages/types` como
`PipelineRunsResponse`.

```json
{
  "data": {
    "runs": [
      {
        "id": "uuid",
        "status": "SUCCESS",
        "newsCount": 42,
        "articleId": "uuid | null",
        "error": "string | null",
        "errorStage": 6,
        "errorDetail": { "message": "Gemini API error 500: boom", "provider": "gemini", "statusCode": 500 },
        "startedAt": "ISO string",
        "completedAt": "ISO string | null",
        "durationSeconds": 90,
        "eventCount": 5
      }
    ],
    "recentErrors": [ "...runs com status FAILED" ]
  },
  "meta": { "total": 31 }
}
```

`recentErrors` **não** é um recorte de `runs`: é o mesmo filtro com
`status: 'FAILED'`, então uma falha de três dias atrás aparece ali mesmo quando
os últimos 20 runs foram todos verdes. **Ele tem teto próprio** —
`Math.min(limit, 20)` —, então o tamanho da lista é "falhas recentes", nunca o
total de falhas; o único total que a resposta traz é `meta.total`, que conta o
recorte inteiro sem filtrar por status.

⚠️ **`durationSeconds` é segundo**, não milissegundo — o campo homônimo do
`/api/metrics/dashboard` (`pipelineDuration`) é que está em milissegundos.

**Erros:** `401` sem sessão · `403` com sessão sem `role: ADMIN`

### GET /api/admin/pipeline/runs/:pipelineId

Detalhe de um run: o resumo mais os **eventos por etapa** (Stage 1–9, nível
INFO/WARN/ERROR, mensagem e contexto JSON).

**Auth:** `Authorization: Bearer <JWT>` com `role: ADMIN`
**Rate limit:** o global, 100 req/min

**Resposta 200:** idêntica à de `GET /api/dev/logs/:pipelineId` — mesmo schema
(`devLogDetailResponseSchema`), tipado como `ApiResponse<PipelineRunDetail>`.

```json
{
  "data": {
    "log": { "...": "resumo igual ao de /api/admin/pipeline/runs" },
    "events": [
      {
        "id": "uuid",
        "stage": 6,
        "level": "ERROR",
        "message": "Gemini API error 500: boom",
        "context": { "provider": "gemini", "statusCode": 500 },
        "createdAt": "ISO string"
      }
    ]
  }
}
```

**Erros:** `401` sem sessão · `403` sem `role: ADMIN` · `404` id inexistente ·
`400` id fora do formato UUID

### GET /api/admin/errors

O `ErrorEvent` da Fase 4, **agrupado por fingerprint** na janela — a primeira
leitura da tabela, e o que a aba de segurança (`/admin/security`) desenha.

**Auth:** `Authorization: Bearer <JWT>` com `role: ADMIN`
**Rate limit:** o global, 100 req/min
**Query:** `window` = `24h` (padrão) | `7d`

**Resposta 200:** tipada em `packages/types` como `ApiResponse<ErrorSummary>`.

```json
{
  "data": {
    "window": { "key": "24h", "hours": 24, "since": "ISO string", "until": "ISO string" },
    "total": 1042,
    "distinctFingerprints": 6,
    "byCategory": [
      { "category": "upstream", "count": 1000 },
      { "category": "database", "count": 0 },
      { "category": "validation", "count": 0 },
      { "category": "authorization", "count": 40 },
      { "category": "contract", "count": 0 },
      { "category": "internal", "count": 2 }
    ],
    "bySeverity": [ { "severity": "WARN", "count": 1040 }, { "severity": "ERROR", "count": 2 }, { "severity": "FATAL", "count": 0 } ],
    "byOrigin": [ { "origin": "API", "count": 42 }, { "origin": "PIPELINE", "count": 1000 }, { "origin": "WEB", "count": 0 }, { "origin": "INVARIANT", "count": 0 } ],
    "groups": [
      {
        "fingerprint": "API:WARN:AUTH_TOKEN_INVALID:/api/account",
        "origin": "API",
        "severity": "WARN",
        "code": "AUTH_TOKEN_INVALID",
        "category": "authorization",
        "route": "/api/account",
        "statusCode": 401,
        "message": "Invalid or missing token",
        "count": 40,
        "hours": 3,
        "firstSeenAt": "ISO string",
        "lastSeenAt": "ISO string",
        "lastRequestId": "uuid",
        "pipelineLogId": null
      }
    ],
    "truncated": false
  }
}
```

**A janela é alinhada à hora cheia.** A tabela guarda um balde por hora, então
`since` é a hora cheia que contém `until − 24 h` (ou `− 7 d`): "as últimas N
horas, mais o que sobrar da hora em que começam". Comparar contra `until −
24 h` cru deixava o primeiro balde de fora inteiro — até 59 min de "24h"
sumiam (verificação pós-merge do 5b). O `since` da resposta é o valor de fato
usado.

Um grupo é a soma das linhas horárias do mesmo fingerprint: `count` é a soma,
`hours` é em quantas horas distintas a falha apareceu (1 é pico, 24 é
crônico), e `message`, `lastSeenAt` e `lastRequestId` são da hora mais
recente. `byCategory` traz **sempre as seis** categorias da taxonomia, na
ordem dela, com zero onde não houve — a rosquinha tem fatias fixas. `groups`
vem mais recente primeiro.

> **A agregação é em memória, com teto de 5.000 linhas lidas** (`truncated`
> avisa). A tabela é coalescida por construção — uma linha por
> `(fingerprint, hora)` —, então 7 dias são no máximo *fingerprints × 168*
> linhas, e o §16 do plano já dá o gatilho de fingerprint granular demais em
> 2.000 linhas em 14 dias. **Gatilho para mudar a leitura:** p95 desta rota
> acima de 1.000 ms no `/api/metrics/http`.

**Erros:** `400` `window` fora de `24h`/`7d` · `401` sem sessão · `403` sem
`role: ADMIN`

### GET /api/admin/audit

A trilha de ação de admin: quem disparou o pipeline, quem apagou o quê. Uma
linha por ocorrência, mais recente primeiro.

**Auth:** `Authorization: Bearer <JWT>` com `role: ADMIN`
**Rate limit:** o global, 100 req/min
**Query:** `days` (1 a 365, padrão 30 — o teto é a retenção) · `limit` (1 a
200, padrão 50)

**Resposta 200:** tipada como `ApiResponse<AuditTrail>`.

```json
{
  "data": {
    "window": { "days": 30, "since": "ISO string" },
    "total": 312,
    "events": [
      {
        "id": "uuid",
        "actorId": "uuid",
        "action": "pipeline.triggered",
        "targetId": "uuid | null",
        "outcome": "started",
        "requestId": "uuid | null",
        "context": { "pipelineId": "uuid", "startedAt": "ISO string" },
        "createdAt": "ISO string"
      }
    ]
  }
}
```

`total` conta a janela inteira, não o tamanho de `events`. **Só o `actorId`
sai** — nenhum e-mail, como a tabela: quem precisar do nome junta com `User`
na tela. As ações existentes são `pipeline.triggered` (`outcome` = o do
disparo; `targetId` só quando `started`) e `news.deleted` (`outcome` =
`deleted` | `not-found`); o conjunto fechado mora em
`services/audit.service.ts`, com guarda.

**Erros:** `400` `days`/`limit` fora do intervalo · `401` sem sessão · `403`
sem `role: ADMIN`

---

## Observabilidade (dev-only)

> Painel de logs e erros do pipeline, **apenas para o dev** — todas as rotas
> exigem `Authorization: Bearer <JOB_SECRET>` (ou `?secret=` na página HTML) e
> têm rate limit próprio. Não são expostas ao público.

### GET /api/dev/logs

Últimos runs do pipeline + erros recentes, com filtros opcionais.

**Auth:** `Authorization: Bearer <JOB_SECRET>`  
**Rate limit:** 60 req/min  
**Query Params:**

| Param | Tipo | Default | Descrição |
|-------|------|---------|-----------|
| `status` | `RUNNING \| SUCCESS \| FAILED` | — | Filtro por status |
| `since` | number (dias) | — | Apenas runs iniciados nos últimos N dias (1–90) |
| `limit` | number | 30 | Máx. de runs retornados (1–100) |

**Resposta 200:**
```json
{
  "data": {
    "runs": [
      {
        "id": "uuid",
        "status": "SUCCESS",
        "newsCount": 42,
        "articleId": "uuid | null",
        "error": "string | null",
        "errorStage": 6,
        "errorDetail": { "message": "Gemini API error 500: boom", "provider": "gemini", "statusCode": 500 },
        "startedAt": "ISO string",
        "completedAt": "ISO string | null",
        "durationSeconds": 90,
        "eventCount": 5
      }
    ],
    "recentErrors": [ ...runs com status FAILED ]
  },
  "meta": { "total": 31 }
}
```

### GET /api/dev/logs/:pipelineId

Detalhe completo de um run: log resumido + **eventos por etapa** (Stage 1–9,
nível INFO/WARN/ERROR, mensagem e contexto JSON).

**Auth:** `Authorization: Bearer <JOB_SECRET>`  
**Rate limit:** 60 req/min

**Resposta 200:**
```json
{
  "data": {
    "log": { ...resumo igual ao de /api/dev/logs },
    "events": [
      {
        "id": "uuid",
        "stage": 6,
        "level": "ERROR",
        "message": "Gemini API error 500: boom",
        "context": { "provider": "gemini", "statusCode": 500 },
        "createdAt": "ISO string"
      }
    ]
  }
}
```

**Resposta 404:** `{ "error": "Pipeline not found" }`  
**Resposta 400:** `pipelineId` não é UUID válido.

### GET /dev/dashboard

Página HTML auto-contida servida pela API (auto-refresh a cada 30s): histórico
de runs (status, duração, contagens, etapa da falha, erro), erros recentes e
status dos providers (mesma checagem do `GET /api/health/providers`).

**Auth:** `Authorization: Bearer <JOB_SECRET>` **ou** `?secret=<JOB_SECRET>`
(para abrir direto no browser).  
**Rate limit:** 60 req/min

**Resposta 200:** `Content-Type: text/html`  
**Resposta 401:** secret ausente ou inválido.

---

## Erros

Todos os erros seguem o formato:
```json
{ "error": "Mensagem descritiva do erro" }
```

| Código | Situação |
|--------|---------|
| 400 | Validação falhou (query param ou body inválido) |
| 401 | Token ausente ou inválido |
| 404 | Recurso não encontrado |
| 415 | `Content-Type` com caractere de controle |
| 429 | Rate limit excedido |
| 500 | Erro interno do servidor |

**Caminho que não é rota** responde `404 { "error": "Not Found" }`. Até a Fase 3
do plano de observabilidade era a única resposta de erro da API **fora deste
formato**: o handler padrão do Fastify devolvia três campos
(`{ "message": "Route GET:/api/x not found", "error": "Not Found", "statusCode": 404 }`)
e ecoava o caminho pedido de volta no corpo. Nenhuma rota declara schema para o
que não é rota, então nada acusava.

**O 500 é a exceção declarada, e traz um campo a mais:**

```json
{ "error": "Internal server error", "requestId": "…" }
```

A mensagem é fixa de propósito — erro de Prisma carrega nome de tabela, trecho
de SQL e, em falha de conexão, a string de conexão. O `requestId` é o mesmo
`x-request-id` que **toda** resposta devolve no header, e é por ele que um
relato de fora encontra a linha do log.

### O que o corpo não diz, e o log diz

Desde a Fase 3 todo erro que o servidor escolheu devolver carrega, **do lado de
dentro**, um `code` de um conjunto fechado e uma `category`
(`upstream` · `database` · `validation` · `authorization` · `contract` ·
`internal`). Isso não aparece no fio: dois 401 com a mesma frase — token
expirado e `AUTH_JWT_SECRET` ausente — são `AUTH_TOKEN_INVALID` e
`AUTH_NOT_CONFIGURED` no log, e a resposta continua idêntica, porque quem chamou
não precisa saber qual porta bateu.

**Gatilho para o `code` entrar no corpo:** a primeira tela que precise ramificar
por qual falha foi. Hoje nenhuma ramifica, e o campo seria contrato sem leitor.
