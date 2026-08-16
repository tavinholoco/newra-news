# Plano — Newsletter com o Artigo Diário

> Sub-item 2 do Item 8 (Pós-MVP) do plano de ação (`docs/progress.md`).
> Status: **implementado até o frontend** (passos 1–5) — falta apenas o deploy (passos 6–7).
> Referência: PRD §2.2 ("Newsletter por e-mail com o artigo diário").

---

## 1. Objetivo

Toda manhã, após o artigo do dia ser gerado pelo pipeline, enviar um e-mail para
os assinantes com o título, o resumo e o link para o artigo completo — com
cancelamento de assinatura em 1 clique.

Não é um sistema de marketing: é um **newsletter transacional de baixo volume**
(1 e-mail/dia por assinante), alinhado ao porte do projeto (portfólio).

---

## 2. Provedor de e-mail: **Resend** ✅

| Critério | Resend | Brevo | SendGrid |
|---|---|---|---|
| Free tier | 3.000/mês · **100/dia** | 300/dia | 100/dia |
| API | REST simples (`POST /emails`), sem SMTP | REST + SMTP | REST + SMTP |
| Verificação de domínio | 1 domínio grátis | 1 remetente grátis | 1 remetente (Twilio) |
| Logs/entrega | Logs 30 dias, webhooks | Painel rico | Webhooks |
| DX para portfólio | **Excelente** — docs claras, SDK oficial | Boa | Média (cadastro Twilio) |

**Decisão: Resend** — free tier cobre com folga (100/dia ≈ 100 assinantes), API
minimalista, sem configuração SMTP, e o SDK oficial (`resend` npm) é opcional
(um `fetch` basta). Alternativas citadas caso o usuário prefira painel pt-BR
(Brevo) — a interface de envio fica atrás de um provider com contrato idêntico
(mesmo padrão de `providers/news/` e `providers/ai/`).

**Envs novas (backend):**
- `RESEND_API_KEY` — **opcional**; sem ela o estágio de envio é pulado (log de warning) e o pipeline não quebra (graceful degradation)
- `SITE_URL` — URL pública do frontend usada no link do artigo no e-mail (default `http://localhost:3000`)
- `NEWSLETTER_FROM` — remetente com domínio verificado no Resend, ex. `Newra News <news@newranews.com>` (default sensato em dev)

---

## 3. Modelo de dados (Prisma — `packages/database`)

```prisma
model Subscriber {
  id        String           @id @default(uuid())
  email     String           @unique
  status    SubscriberStatus @default(ACTIVE)
  token     String           @unique @default(uuid()) // unsubscribe em 1 clique
  createdAt DateTime         @default(now())
  updatedAt DateTime         @updatedAt

  @@index([status])
}

model NewsletterLog {
  id        String   @id @default(uuid())
  date      DateTime @unique  // idempotência: 1 envio por dia
  articleId String?
  total     Int      @default(0)
  sent      Int      @default(0)
  failed    Int      @default(0)
  error     String?
  createdAt DateTime @default(now())

  @@index([date])
}

enum SubscriberStatus {
  ACTIVE
  UNSUBSCRIBED
}
```

Decisões:
- **`token` UUID por assinante** — unsubscribe stateless no link (`?token=...`), revogável e não-adivinhável. Alternativa HMAC(email+secret) evita a coluna, mas perde revogação simples; fica UUID.
- **`NewsletterLog.date` unique** — idempotência: se o pipeline rodar 2x no mesmo dia (retry manual), o envio não duplica.
- **Opt-in**: único (sem confirmação por e-mail) para o porte do projeto; LGPD atendida com unsubscribe fácil e dados mínimos. Doble opt-in documentado como evolução se a base crescer.

---

## 4. Fluxo de envio (integração com o pipeline)

Novo estágio no pipeline (`pipeline.service.ts`), entre o Stage 7 (persistir artigo)
e o Stage 8 (cleanup) — **não-crítico**: falha registra erro e não aborta o
pipeline (mesmo padrão de cleanup/metrics).

```
Stage 7 → Artigo persistido
  ↓
Stage 7.5 — Newsletter
  1. Busca artigo de hoje (já salvo no banco)
  2. NewsletterLog do dia já existe? → pula (idempotente)
  3. Busca Subscriber ACTIVE; se 0 → log info e termina
  4. Para cada assinante: monta e-mail (HTML + texto plano) e envia via Resend
     - to: email único (contagem precisa de sent/failed)
     - subject: "Newra News — {título curto}"
     - HTML: header, título, summary, CTA "Ler artigo completo" → {SITE_URL}/article/AAAA-MM-DD
     - rodapé: "Cancelar inscrição" → {SITE_URL}/newsletter/unsubscribe?token=...
  5. Grava NewsletterLog { date, articleId, total, sent, failed, error? }
```

- **Quem dispara**: nada novo — o Vercel Cron (11h UTC = 8h BRT) já dispara o
  pipeline, e o envio acontece dentro dele. Sem cron extra.
- **Fallback manual**: `POST /api/newsletter/send` (protegido com `JOB_SECRET`)
  reexecuta só o estágio de newsletter (útil para reprocessar após falha).

---

## 5. API (backend — Fastify + Zod)

| Rota | Método | Auth | Descrição |
|---|---|---|---|
| `/api/newsletter/subscribe` | POST | pública (rate limit 5/min/IP) | `{ email }` → cria assinante. Upsert: ACTIVE já existente → 200 idempotente; UNSUBSCRIBED → reativa (200) |
| `/api/newsletter/unsubscribe` | GET | pública | `?token=...` → marca UNSUBSCRIBED; responde JSON + página HTML de confirmação |
| `/api/newsletter/send` | POST | `Bearer JOB_SECRET` (rate limit 10/min) | dispara o estágio de envio manualmente |

Schemas Zod: `email` (z.string().email()), `token` (uuid), respostas tipadas com
`errorResponseSchema` — padrão das rotas existentes.

**Provider** (`providers/newsletter/resend.provider.ts`): client fino com `fetch`
na `https://api.resend.com/emails`; interface `sendNewsletterEmail({ to, subject, html, text })`
mockável nos testes — mesmo padrão de `providers/ai/` e `providers/news/`.

---

## 6. Frontend

- **Form de inscrição no footer** (`components/newsletter/subscribe-form.tsx`,
  client component): input de e-mail + botão "Assinar", validação (regex + mensagem
  de erro), estados sucesso ("Você receberá o artigo do dia!") / erro (rede) /
  loading (botão desabilitado). Sem nova env var (chama a API pública).
- **Página `/newsletter/unsubscribe`**: lê `?token=`, chama a API, mostra
  "Inscrição cancelada" / "Token inválido". SSG com metadata.
- Opcional: página `/newsletter/confirm` para feedback pós-inscrição.

---

## 7. Segurança

- `RESEND_API_KEY` apenas no backend (nunca em `NEXT_PUBLIC_*`).
- Rate limit restritivo no subscribe (5/min) e no send (10/min) — plugin já ativo.
- Token UUID aleatório no unsubscribe (impede cancelamento de terceiros).
- Validação Zod em todas as rotas; sem `any`.

---

## 8. Testes (Vitest)

- **Provider Resend** — sucesso / erro HTTP / timeout (mock de `fetch`).
- **Service newsletter** — montagem do HTML (contém título, link do artigo, link de
  unsubscribe), geração de texto plano, filtro ACTIVE, contagem sent/failed.
- **Rotas** — subscribe (validação de e-mail, idempotência, reativação), unsubscribe
  (token válido/inválido), send (auth 401 sem `JOB_SECRET`).
- **Pipeline** — estágio 7.5: sucesso, sem assinantes (no-op), falha não aborta.
- **Frontend** — form de inscrição (validação, sucesso, erro), página de unsubscribe.

---

## 9. Documentação

- `docs/api.md` — 3 novas rotas.
- `docs/setup.md` — env vars Resend + verificação de domínio no painel.
- `docs/progress.md` — marcar sub-item ao concluir (com commit).
- `docs/presentation.md` — adicionar newsletter ao roteiro de portfólio.

---

## 10. Sequência de implementação

- [x] **1. Prisma** — modelos `Subscriber` + `NewsletterLog` + enum `SubscriberStatus` (`packages/database/prisma/schema.prisma`); schema aplicado localmente (`prisma db push`)
- [x] **2. Provider Resend** (`src/providers/newsletter/resend.provider.ts`) + service `newsletter.service` (subscribe/unsubscribe/sendDaily + builders HTML/text com escape) + 18 testes
- [x] **3. Rotas** subscribe/unsubscribe/send + schemas Zod + testes de rota (10) — validadas localmente via curl
- [x] **4. Pipeline**: estágio 7.5 no `pipeline.service.ts` (chama `sendDailyNewsletter` após persistir o artigo, antes do cleanup; try/catch não-crítico; log `[pipeline] newsletter: sent/total`; **não** incrementa `pipelineErrors` — newsletter é opcional e não deve marcar o dia como falha) + 2 testes de integração no `pipeline.test.ts`
- [x] **5. Frontend**: `SubscribeForm` no footer (client component com validação, estados sucesso/erro/loading e `aria-invalid`/roles) + página `/newsletter/unsubscribe` (server component com metadata noindex, estados cancelado/inválido) + 6 testes (api client + form)
- [ ] **6. Deploy**: env vars no Render (RESEND_API_KEY, SITE_URL, NEWSLETTER_FROM) + domínio verificado no Resend; validação em produção
- [ ] **7. Docs**: setup.md, presentation.md; marcar item no progress.md

---

## 11. Riscos e mitigações

- **Resend free tier 100/dia** — suficiente para portfólio; se a base crescer, provider é plugável (interface única) e o plano pago custa $20/mês.
- **Entrega caindo em spam** — domínio verificado + e-mail transacional (não marketing) + unsubscribe fácil mitigam.
- **Falha de envio** — estágio não-crítico; `NewsletterLog` registra failed; `POST /api/newsletter/send` reprocessa manualmente.
- **E-mail inválido no subscribe** — validação Zod + normalização (trim/lowercase).
