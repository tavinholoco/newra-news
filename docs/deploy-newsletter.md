# Deploy da Newsletter — Checklist

> Passo 6 do plano (`docs/newsletter-plan.md`). Backend, pipeline e frontend já
> estão implementados e commitados; falta colocar em produção.
> **Pré-requisito:** domínio próprio (ou subdomínio) para verificar no Resend.

---

## 0. Visão geral

```
Resend (API de e-mail)
   ▲  RESEND_API_KEY
   │
Render (backend) ──► envia e-mail do artigo do dia para os assinantes
   │  NEWSLETTER_FROM (domínio verificado no Resend)
   │  SITE_URL → https://newra-news-web.vercel.app (links do e-mail)
   ▼
Vercel (frontend) — form de inscrição no footer + página /newsletter/unsubscribe
```

Fluxo de teste rápido (sem domínio): `onboarding@resend.dev` envia **apenas para
o seu próprio e-mail** — suficiente para validar o pipeline antes de comprar DNS.

---

## 1. Resend — criar conta e verificar domínio

1. Criar conta em https://resend.com (plano free: 3.000 e-mails/mês, 100/dia, 1 domínio).
2. **Domains → Add Domain**.
   - Recomendação do Resend: usar um **subdomínio** (ex.: `news.newranews.com`,
     `newsletter.soudominio.com.br`) para isolar a reputação de envio.
3. Copiar os **registros DNS** exibidos para o seu provedor de DNS:
   - **SPF** — registro TXT com `include:amazonses.com` (autoriza o Resend a enviar pelo domínio)
   - **DKIM** — 3 registros TXT (assinatura; o dashboard mostra os valores exatos)
   - **DMARC** (opcional, recomendado) — TXT `v=DMARC1; p=none; rua=mailto:...` para melhor entrega
4. Aguardar a propagação (minutos a ~1h) e clicar em **Verify** no dashboard.
5. Status deve ficar **Verified** (verde). Sem domínio verificado, o envio real falha.
   - ⚠️ `NEWSLETTER_FROM` precisa usar um endereço **no domínio verificado**
     (ex.: `Newra News <news@news.newranews.com>`).

**Modo de teste sem domínio (opcional):** use `onboarding@resend.dev` como from
— o Resend entrega apenas para o e-mail da conta que criou a API key.

---

## 2. Render — variáveis de ambiente

No dashboard do serviço `newra-news-api` (**Environment → Edit**), adicionar:

| Variável | Valor | Obrigatória? | Observação |
|---|---|---|---|
| `RESEND_API_KEY` | chave criada em https://resend.com/api-keys | opcional* | Sem ela, o estágio 7.5 pula o envio e o pipeline continua normal |
| `SITE_URL` | `https://newra-news-web.vercel.app` | sim | Usada nos links do e-mail (artigo + unsubscribe); sem ela os links apontam para `localhost` |
| `NEWSLETTER_FROM` | `Newra News <news@news.SEUDOMINIO>` | sim (após domínio) | Deve estar no domínio verificado do Resend |

\* `RESEND_API_KEY` opcional por design: dá para fazer o deploy e testar o restante
sem ela; o envio começa quando a chave entra.

O blueprint `render.yaml` já foi atualizado com as 3 variáveis (documentação);
as de `sync: false` precisam ser **digitadas no dashboard** — o push para `main`
dispara o redeploy automático.

> ⚠️ Depois de salvar, confirmar o redeploy em **Events** no Render e o
> `/api/health` respondendo `{"status":"ok"}`.

---

## 3. Roteiro de teste em produção

> URL base: `https://newra-news-api.onrender.com` · Frontend: `https://newra-news-web.vercel.app`

### 3.1 Smoke básico
```bash
curl https://newra-news-api.onrender.com/api/health
# {"status":"ok", ...}

# Providers ao vivo (Bearer = JOB_SECRET do Render)
curl -H "Authorization: Bearer $JOB_SECRET" \
  https://newra-news-api.onrender.com/api/health/providers
```

### 3.2 Inscrição (form do footer em produção)
1. Abrir a home de produção → footer → digitar um e-mail real seu → **Assinar**.
2. Esperado: mensagem "Você receberá o artigo do dia no seu e-mail!".
3. Conferir no banco (Neon) se quiser:
   ```sql
   SELECT email, status, token FROM "Subscriber" ORDER BY "createdAt" DESC LIMIT 5;
   ```

### 3.3 Envio manual (antes do pipeline diário)
```bash
curl -X POST -H "Authorization: Bearer $JOB_SECRET" \
  https://newra-news-api.onrender.com/api/newsletter/send
# Esperado: {"data":{"total":1,"sent":1,"failed":0}}
```
- `sent:0, failed:1` → confere se `RESEND_API_KEY` está setada e válida.
- `total:0` → sem assinantes ativos (ou artigo do dia ainda não gerado; rode após o pipeline).

### 3.4 Recebimento e conteúdo
- Verificar a **caixa de entrada e a pasta de spam**.
- Conferir: título, resumo, botão "Ler artigo completo" apontando para
  `https://newra-news-web.vercel.app/article/AAAA-MM-DD` e link de cancelamento
  no rodapé.
- Se cair em spam: revisar SPF/DKIM no `mxtoolbox.com` e considerar DMARC.

### 3.5 Idempotência
- Rodar o `POST /api/newsletter/send` de novo → retorna as contagens do log do
  dia (**não** reenvia). Confere a proteção do `NewsletterLog.date` unique.

### 3.6 Unsubscribe e reativação
- Clicar no link "Cancelar inscrição" do e-mail → página "Inscrição cancelada".
- Assinar de novo no footer → mesmo registro volta a `ACTIVE` (reativação).
- Testar token inválido → "Link inválido ou já utilizado".

### 3.7 Pipeline diário
- No dia seguinte ao deploy (8h BRT), conferir nos **logs do Render** a linha:
  `[pipeline] newsletter: 1/1 sent (0 failed)` e o `PipelineLog` com `SUCCESS`.
- Confirmar que o artigo do dia foi enviado para o e-mail de teste.

### 3.8 Fallback (validação de resiliência)
- Remover temporariamente `RESEND_API_KEY` e rodar o pipeline → deve terminar
  em `SUCCESS` com o envio contabilizado como `failed` (nunca quebra o pipeline).

---

## 4. Verificações pós-deploy

- [ ] Domínio **Verified** no Resend (em modo de teste: `onboarding@resend.dev`)
- [x] `RESEND_API_KEY`, `SITE_URL`, `NEWSLETTER_FROM` no Render (redeploy ok — validado 2026-08-16)
- [x] `POST /api/newsletter/send` → `sent ≥ 1` — `{total:1, sent:1, failed:0}` em 2026-08-16
- [x] E-mail recebido com links corretos (artigo + unsubscribe) — confirmado pelo dono em 2026-08-16
- [x] Unsubscribe + reativação funcionando — validado em produção 2026-08-16 (página "Inscrição cancelada" → `UNSUBSCRIBED` → subscribe reativa o mesmo registro → `ACTIVE`; token inválido → "Link inválido ou já utilizado"; token real volta a funcionar após reativação)
- [ ] Pipeline do dia com `SUCCESS` e linha `newsletter:` nos logs (próximo run: 8h BRT)
- [x] `docs/setup.md` e `docs/presentation.md` atualizados (passo 7 do plano)
- [x] Nota de deploy validado adicionada no `docs/progress.md` (item 8)

---

## 5. Rollback / segurança

- **Sempre reversível:** remover `RESEND_API_KEY` → newsletter desabilitada,
  pipeline e site intactos (design de graceful degradation).
- Chave nunca em `NEXT_PUBLIC_*` — só no backend.
- Rate limits já aplicados nas rotas (subscribe 5/min, send 10/min, global 100/min).
- Free tier: 100 e-mails/dia — limite realista ~100 assinantes; se a base crescer,
  plano pago do Resend ($20/mês) ou troca de provider (interface única).
