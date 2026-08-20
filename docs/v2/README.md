# V2.0 — Discovery técnico (Fase 0)

Entregáveis da Fase 0 do
[plano de redesign](../Newra-News-V2-Frontend-Redesign-Plan.md) (§28).
A fase não escreve interface: ela fecha as decisões para que as Fases 1–7 não
parem no meio para escolher paleta, fonte ou contrato de API.

| Documento | O que fecha |
|---|---|
| [`00-diagnostico.md`](00-diagnostico.md) | rotas, componentes, consumo das APIs, uso de `brand-400`/`brand-900`, Lighthouse, acessibilidade, bundle, baseline de uso |
| [`01-design-tokens.md`](01-design-tokens.md) | **a paleta e a tipografia da V2**, claro e escuro, com contraste medido e o mapeamento das 31 variáveis do shadcn |
| [`02-sitemap-telas.md`](02-sitemap-telas.md) | as 11 rotas cruzadas com os componentes da §23 e a fase que entrega cada tela |
| [`03-contratos-api.md`](03-contratos-api.md) | `GET /api/home`, `/api/trending`, `/api/news/:id/related` e a migration de auditoria do briefing |
| [`04-analytics-e-slots.md`](04-analytics-e-slots.md) | os 14 eventos de produto e o inventário de 5 slots de anúncio |
| [`baseline-v1/`](baseline-v1/) | 42 capturas da V1 antes de os tokens mudarem |

## Decisões tomadas nesta fase

1. **Tipografia: Newsreader (manchetes) + Inter (interface).** A §5 listava
   opções sem escolher, e o wordmark da §40.3 depende da fonte de interface.
   Sai o Bricolage Grotesque.
2. **Tokens em duas camadas** — paleta fixa e camada semântica que inverte no
   tema. Resolve a incompatibilidade entre os nomes da §4.1 e os da §4.2.
3. **`brand-700`, não `brand-600`, para texto e links.** Medição: `#C94F22` só
   passa AA sobre branco puro; sobre o fundo editorial `paper` cai para 4,32:1.
4. **Baseline visual capturada agora**, não na Fase 1 — a Fase 1 troca os tokens
   globalmente e a V1 deixa de existir.

## O que a fase encontrou de quebrado

- **A migration de baseline não replicava** — corrigida ([diagnóstico §4](00-diagnostico.md#4-infraestrutura--dois-defeitos-encontrados-e-corrigidos)).
- **O workflow do Lighthouse media uma URL só, através de um redirect, uma vez
  por execução, e descartava os relatórios** — corrigido.
- **Branco sobre o laranja da V1 reprova AA** em 16 elementos, e o rodapé usa
  `text-white/50` a 4,04:1. É a causa dos scores de acessibilidade em 94–96.
- **O piso "96/96/96/100" da §26 era só da home.** A tabela por rota está no
  diagnóstico.
- **A paleta do plano não tinha token de sucesso**, e o código já usa verde cru
  do Tailwind em 4 lugares. Par nomeado e medido acrescentado.
- **Os componentes usam os tokens com opacidade** (`token/NN`, 11 variantes), e
  três composições de `--text-muted` reprovam AA mesmo com a paleta nova.

## O que continua em aberto

Nada bloqueia a Fase 1. Duas coisas dependem de fases posteriores:

- **Core Web Vitals de campo** não existem — o site não tem tráfego para o CrUX,
  e só a camada de analytics vai produzir o dado.
- **Trending completo** depende dos eventos de clique e compartilhamento; a
  etapa 1 usa só recência e favoritos.
