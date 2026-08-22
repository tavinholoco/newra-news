# Analytics e slots de monetização

Entregável da Fase 0 (plano V2 §35: "definir eventos de analytics" e "definir
slots de monetização"). Especificação — nada implementado.

Os dois estão no mesmo documento porque compartilham a mesma restrição: a §22 é
explícita em que os espaços de anúncio precisam ser **reservados no design
system antes** de o layout fechar, e as métricas da §26 precisam de eventos
instrumentados desde a primeira tela da V2, não retroativamente.

---

# Parte 1 — Analytics

## 1. Ponto de partida: zero

O `DailyMetric` mede o pipeline (notícias coletadas, artigo gerado, provider de
IA, duração, erros). **Nenhum evento de leitor existe.**

As métricas de sucesso da §26 — CTR do hero, CTR do Daily Brief, profundidade de
scroll, artigos por sessão, saves por usuário, sessões recorrentes, taxa de
inscrição, share rate — não têm origem hoje. A primeira medição de produto do
projeto vai ser a da V2.

## 2. Desenho da camada

A §27 pede uma camada desacoplada, com os eventos centralizados em um único
serviço para evitar analytics espalhado pelo JSX.

```
apps/web/lib/analytics/
├── index.ts        track() e a fila
├── events.ts       o catálogo tipado da §3
└── providers/      destino: console em dev, endpoint próprio em produção
```

```ts
// components/editorial/hero-story.tsx
track('story_open', { storyId, category, position: 0, source: 'hero' });
```

Quatro regras:

1. **`track()` nunca lança e nunca bloqueia.** Falha de analytics não pode
   quebrar navegação. Envio com `navigator.sendBeacon`, com `fetch(keepalive)`
   de reserva.
2. **Nenhum componente importa provider.** Só `track`. Trocar o destino não
   toca em componente nenhum.
3. **Eventos só em client components.** Server component não tem sessão de
   usuário para atribuir.
4. **Payload é tipado.** `events.ts` define a união discriminada; TypeScript
   recusa evento inventado ou campo faltando.

## 3. Catálogo de eventos

Os 14 da §18.5, com payload fechado. `EventBase` (`sessionId`, `locale`,
`timestamp`, `path`) é anexado por `track()` — nunca pelo componente.

| Evento | Payload | Onde dispara | Métrica que alimenta |
|---|---|---|---|
| `homepage_view` | — | Home, no mount | sessões, base dos CTRs |
| `story_open` | `storyId`, `category`, `position`, `source` | clique em qualquer card | **CTR do hero**, artigos/sessão |
| `briefing_open` | `briefingId`, `date`, `source` | clique no briefing | **CTR do Daily Brief** |
| `category_view` | `category`, `origin` | `/news?category=`, seção da Home | interesse por editoria |
| `search` | `query`, `resultCount` | submit da busca | lacunas de conteúdo |
| `article_scroll_25` | `contentId`, `contentType` | 25% do corpo | **profundidade de scroll** |
| `article_scroll_50` | idem | 50% | idem |
| `article_scroll_90` | idem | 90% | leitura completa |
| `favorite_add` | `storyId`, `category`, `origin` | clique no marcador de salvar | **saves por usuário** |
| `share` | `contentId`, `contentType`, `channel` | menu de compartilhar | **share rate** |
| `newsletter_signup` | `origin` | inscrição confirmada | **taxa de inscrição** |
| `ad_view` | `placement`, `format` | slot ≥50% visível por ≥1s | **viewability** |
| `ad_click` | `placement`, `format` | clique no slot | **CTR de anúncios** |
| `subscription_intent` | `origin`, `plan` | clique no CTA premium | funil do Newra Plus |

Valores fechados:

- `source` / `origin`: `hero`, `briefing`, `top-stories`, `trending`,
  `category-section`, `latest`, `related`, `search`, `favorites`, `footer`,
  `newsletter-landing`, `article-cta`;
- `contentType`: `story` | `briefing`;
- `channel`: `copy-link`, `whatsapp`, `x`, `linkedin`, `native-share`;
- `format`: `leaderboard`, `rectangle`, `in-article`, `mobile-banner`.

Os eventos de scroll disparam **uma vez por página**, no cruzamento do limiar —
não a cada evento de rolagem.

## 4. Privacidade

A §27 pede anonimização e retenção compatíveis com a LGPD. O que isso significa
em regras concretas:

- **nunca** enviar `userId`, e-mail ou qualquer identificador de conta;
  `sessionId` é aleatório, de sessão, e não persiste entre visitas;
- **nunca** enviar IP bruto nem User-Agent completo;
- `search.query` é dado do usuário: truncar em 100 caracteres e descartar se
  tiver `@` ou parecer credencial;
- retenção de 90 dias no nível de evento; agregados diários ficam;
- a camada respeita **Do Not Track** e a decisão de consentimento (§5 abaixo).

## 5. Consentimento

Nenhum evento sai antes da decisão de consentimento. Os que não dependem dela —
`homepage_view` e os de scroll, sem identificador entre sessões — podem ficar em
fila e ser enviados agregados, ou simplesmente descartados. Descartar é o
padrão; medir menos é melhor que medir errado.

O banner de consentimento é entregável da Fase 8 ("privacy/consent layer"), mas
a camada de analytics já nasce respeitando a resposta.

## 6. Destino dos eventos

`POST /api/events` na API própria, gravando em tabela de eventos com agregação
diária — mesmo caminho que o `DailyMetric` já usa. Fica sob o guarda-chuva de
privacidade do projeto, sem terceiro, sem cookie de rastreio, e reaproveita a
infraestrutura de métricas.

Custo: uma migration e um endpoint. É trabalho da Fase 8; o contrato do evento
está fechado aqui para a Fase 3 já poder chamar `track()`.

---

# Parte 2 — Slots de monetização

## 7. Por que agora

A §22 é direta: "não deixar para colocar AdSense depois". Espaço de anúncio
adicionado a um layout pronto empurra conteúdo, muda altura de bloco e destrói
CLS — que é justamente uma das métricas de aceite da V2.

A solução é o `<AdSlot>` reservar altura **desde a Fase 3**, mesmo sem inventário.

## 8. O componente

```tsx
<AdSlot placement="home-after-hero" format="leaderboard" />
```

```ts
type AdPlacement =
  | 'home-after-hero'
  | 'home-between-sections'
  | 'news-list-inline'
  | 'article-in-content'
  | 'article-after-content';

type AdFormat = 'leaderboard' | 'rectangle' | 'in-article' | 'mobile-banner';
```

Comportamento:

- **sem inventário, não renderiza nada** — nem caixa vazia, nem "publicidade";
- **com inventário, a altura é reservada antes de o anúncio carregar**, via
  `min-height` do formato. É isso que impede o salto de layout;
- rótulo "Publicidade" visível, conforme as boas práticas do AdSense;
- dispara `ad_view` (≥50% visível por ≥1s, via IntersectionObserver) e `ad_click`;
- respeita a decisão de consentimento: sem consentimento, sem anúncio.

## 9. Inventário

Cinco posições, o mínimo da §21 ("publicidade leve").

| Placement | Formato desktop | Formato mobile | Altura reservada | Fase |
|---|---|---|---|---|
| `home-after-hero` | leaderboard 728×90 | mobile-banner 320×100 | 90 / 100 px | 3 |
| `home-between-sections` | leaderboard 728×90 | mobile-banner 320×100 | 90 / 100 px | 3 |
| `news-list-inline` | rectangle 300×250 | rectangle 300×250 | 250 px | 4 |
| `article-in-content` | in-article fluido | in-article fluido | 250 px mín. | 5 |
| `article-after-content` | rectangle 300×250 | rectangle 300×250 | 250 px | 5 |

Regras de densidade, derivadas dos "nunca" da §21:

- **no máximo 2 slots por tela** — a Home tem dois, e nenhum acima da dobra;
- `news-list-inline` aparece **uma vez**, depois do 6º card, nunca a cada N;
- `article-in-content` entra em um limite de parágrafo, nunca no meio de uma
  frase, e só em artigos com mais de 6 parágrafos;
- nada de anúncio sobre conteúdo, pop-up, interstitial ou conteúdo patrocinado
  disfarçado.

## 10. Ordem na página

A hierarquia da §22 vale como regra de composição — o anúncio vem **depois** do
módulo editorial, nunca antes:

```
largura de conteúdo
      ↓
módulo editorial
      ↓
slot de anúncio (reservado, pode estar vazio)
      ↓
CTA de newsletter
      ↓
CTA de assinatura
```

## 11. O que fica fora desta fase

Newsletter patrocinada (§21 fase 2), Newra Plus (fase 3) e API B2B (fase 4) não
recebem especificação agora — dependem de base de usuários que não existe. O
`premium-cta` entra no design system na Fase 8 apenas como componente, e
`subscription_intent` já está no catálogo de eventos para medir interesse antes
de qualquer coisa ser construída.
