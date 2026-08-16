# Apresentação — Newra News (Portfólio)

> Material de apoio para apresentar o projeto em entrevistas, code reviews e
> portfólio. Complementa o README (setup) e o PRD (escopo); aqui o foco é o
> **pitch** e o **roteiro de apresentação**.

---

## 🎤 Pitch (30 segundos)

> "Newra News é um portal de notícias que entrega um **artigo diário gerado por IA**:
> todas as manhãs, um pipeline coleta centenas de notícias de múltiplas fontes,
> deduplica, classifica por categoria e usa o Gemini para escrever um resumo em
> português das principais notícias do dia. É um projeto fullstack completo —
> monorepo, API REST, frontend com ISR, CI/CD, observabilidade e deploy em
> produção — construído para demonstrar engenharia de software de ponta a ponta."

---

## 💡 Problema e solução

| | |
|---|---|
| **Problema** | Sobrecarga informacional: dezenas de portais, centenas de manchetes, pouco tempo para absorver. |
| **Solução** | Duas experiências: (1) **feed de notícias** atualizado diariamente, navegável por categoria e busca; (2) **artigo-resumo do dia** gerado por IA, contextualizando o cenário em poucos minutos. |
| **Público** | Recrutadores e desenvolvedores que avaliam o portfólio; usuários finais que consomem notícias resumidas. |

---

## 🏗️ Arquitetura (resumo)

```
Navegador
   │  HTTPS
   ▼
Vercel (Next.js 14 — ISR/SSG) ──► cron diário ──► API Route (CRON_SECRET)
   │                                                    │ POST Bearer
   ▼                                                    ▼
                          Render (Fastify + TypeScript + Prisma)
                              │            │            │
                              ▼            ▼            ▼
                        NewsData.io   Gemini/Groq   PostgreSQL (Neon)
                        + 13 feeds    (artigo do     + UptimeRobot
                          RSS         dia)           keep-alive
```

Diagramas Mermaid completos: [`docs/diagrams/`](diagrams/) (arquitetura, ER, sequência do pipeline, fluxo de dados).

### Decisões que valem destacar

- **Monorepo Turborepo + pnpm** — 4 packages compartilhados (`database`, `types`, `eslint-config`, `tsconfig`), tipagem única sem duplicação.
- **Pipeline de 9 estágios** — coleta → normalização → dedup (por URL) → persistência → seleção → geração IA → artigo → cleanup (retenção de dados ~10-15MB) → métricas.
- **IA com fallback automático** — Gemini principal, Groq de reserva; se ambos falham, o pipeline continua só com notícias.
- **Resiliência de fontes** — NewsData.io + 13 feeds RSS independentes; o sistema funciona mesmo se uma fonte cair.
- **ISR para performance** — todas as páginas dinâmicas revalidam a cada hora; sitemap e Open Graph automáticos.
- **Qualidade de código** — 247 testes, cobertura do backend 94%, Lighthouse 96/96/96/100, typecheck no CI, sem `any`.

---

## 📊 Números reais de produção (2026-08)

- **Pipeline diário:** 89 artigos em 90 dias (17/mai → 14/ago/2026), 1 gap, **0 falhas no último mês** (100% de sucesso)
- **Volume:** ~491 notícias/dia coletadas; 8/8 categorias preenchidas
- **Confiabilidade:** backend no Render com ~92 dias de uptime; UptimeRobot mantém o servidor ativo
- **Qualidade:** Lighthouse mobile — Performance 96 · Accessibility 96 · Best Practices 96 · SEO 100
- **Testes:** 247 testes em 25 suites; cobertura backend 94,3% linhas (threshold 70% no CI)

---

## 🧱 Stack e por quê

| Camada | Escolha | Motivo |
|---|---|---|
| Frontend | Next.js 14 + Tailwind + shadcn/ui + TanStack Query | App Router com ISR, DX madura, ecossistema grande |
| Backend | Fastify + Zod + Prisma | Leve e rápido no free tier, validação em runtime ponta a ponta, ORM type-safe |
| Banco | PostgreSQL (Neon) | Serverless, gratuito, separado do backend (migração de host sem tocar dados) |
| IA | Gemini 2.5-flash + Groq (fallback) | Qualidade pt-BR + redundância e custo zero |
| Notícias | NewsData.io + RSS | Free tier amplo + independência de provedores |
| Infra | Vercel + Render + GitHub Actions | Deploy automático, CI completo (lint, typecheck, testes, coverage, Lighthouse) |

---

## 🗺️ Roteiro de apresentação (walkthrough)

1. **Abra a home** (https://newra-news-web.vercel.app) — mostre o artigo do dia em destaque e o feed.
2. **Mostre a listagem** `/news` — filtros por categoria e busca em tempo real (cliente), paginação.
3. **Abra um artigo do histórico** — conteúdo gerado por IA, datas navegáveis.
4. **Explore o código** na ordem: `docs/diagrams/system-architecture.mmd` → `apps/api/src/services/pipeline.service.ts` (os 9 estágios) → providers (`newsdata`, `rss`, `gemini`, `groq`) → `apps/web/app/(home)/page.tsx` (ISR).
5. **Fale de qualidade**: `docs/api.md` (Swagger), testes (cobertura 94%), CI (`.github/workflows/ci.yml`), Lighthouse (`.lighthouserc.json`).
6. **Conte os desafios reais** resolvidos:
   - NewsAPI → NewsData.io: provider novo + fallback para `source_name` ausente e remoção do placeholder de tier pago (o pipeline abortava sem isso)
   - Sitemap com URLs de localhost e artigos faltando → fallback para `VERCEL_PROJECT_PRODUCTION_URL` + paginação
   - Encoding ISO-8859-1 e imagens quebradas nos feeds RSS
   - Dark mode sem FOUC (script anti-flash + `suppressHydrationWarning`)

---

## ❓ Possíveis perguntas (e direção da resposta)

- **"Por que Next.js + Fastify e não um framework só?"** — Frontend e backend desacoplados permitem escalar/rebuildar cada um independentemente, e mostram proficiência em REST puro, não só em server actions.
- **"Como o artigo é gerado?"** — `config/ai-prompts.ts` define o prompt (ajustável sem tocar lógica); o `ai.service` tenta Gemini e cai para Groq; saída validada (tamanho mínimo, seções).
- **"E se a API de notícias cair?"** — RSS é fonte independente; cada provider reporta falha sem abortar o pipeline (log + segue).
- **"Como garante qualidade?"** — CI com lint + typecheck + 247 testes + cobertura mínima 70%; Lighthouse semanal com gate <90; endpoint protegido `/api/health/providers` diagnostica as chaves ao vivo.
- **"Próximos passos?"** — Dashboard público de métricas no frontend (Item 8 do plano), newsletter do artigo diário, observabilidade estruturada do pipeline (Item 9).

---

## 🔗 Links úteis

- **Produção:** https://newra-news-web.vercel.app (frontend) · https://newra-news-api.onrender.com/api/docs (Swagger)
- **Código:** monorepo no GitHub — branch `dev` é a fonte da verdade de desenvolvimento
- **Docs:** PRD (`docs/PRD-NewraNews_V1.1.md`) · progresso (`docs/progress.md`) · setup (`docs/setup.md`) · API (`docs/api.md`)
