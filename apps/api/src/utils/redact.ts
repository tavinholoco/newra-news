import { env } from '../config/env';

/**
 * Endereço de e-mail sai de texto que vai virar log.
 *
 * **Achado da §11.S: "algum log guarda dado pessoal que ninguém precisa?"** — e
 * guardava. O `sendEmailWithResend` colava os primeiros 200 caracteres do corpo
 * de erro do Resend na mensagem da exceção; o `sendDailyNewsletter` guardava a
 * primeira dessas mensagens em `NewsletterLog.error`. Em falha de destinatário,
 * o corpo de erro do provedor **ecoa o endereço** — então o e-mail de um
 * assinante podia acabar gravado numa coluna que:
 *
 * - **ninguém lê** (nenhuma rota, nenhuma tela, nenhum job consulta `error`);
 * - **não tem retenção** — o cleanup do pipeline expurga `News`, `PipelineLog`,
 *   `Article` e `ProductEvent`, e `NewsletterLog` não está na lista;
 * - **sobrevive ao cancelamento da inscrição**, porque o `unsubscribe` mexe no
 *   `Subscriber` e não em log nenhum.
 *
 * A alternativa de não guardar corpo nenhum foi descartada: "Resend API error
 * 422" sozinho não distingue domínio não verificado de destinatário inválido, e
 * é justamente isso que alguém quer saber às sete da manhã. Redigir mantém a
 * frase e tira o dado.
 *
 * O padrão é deliberadamente largo — qualquer coisa com `@` entre caracteres
 * plausíveis de endereço. Falso positivo aqui apaga texto de diagnóstico;
 * falso negativo grava dado pessoal, e o erro caro é o segundo.
 */
const EMAIL_PATTERN = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;

export const REDACTED_EMAIL = '[email redigido]';

export function redactEmails(text: string): string {
  return text.replace(EMAIL_PATTERN, REDACTED_EMAIL);
}

/**
 * Segredo sai de texto que vai virar log. Irmão do `redactEmails`, e o conserto
 * do vazamento que a inspeção de 01/09/2026 mediu (§1 do plano de
 * observabilidade): `request.log.error({ err })` sem serializer manda para o
 * stdout do Render o `err.message` inteiro, e a falha de conexão do Prisma
 * carrega **a DSN com senha** ali dentro.
 *
 * **O `redact` do pino não alcança isso.** Ele trabalha por *caminho*
 * (`req.headers.authorization`), e uma senha no meio de uma frase não é
 * caminho nenhum. Por isso a redação de texto livre existe, e por isso ela é
 * chamada do serializer de `err` em `utils/logger.ts`.
 *
 * ## Três camadas, e a terceira é a que fecha
 *
 * 1. **o valor literal de cada segredo conhecido do ambiente** — não é preciso
 *    adivinhar o *formato* de um segredo quando se conhece o valor. É o que
 *    tira esta função da corrida armamentista de regex: um segredo que vaze em
 *    formato nenhum reconhecível continua sendo pego, desde que seja um dos
 *    que o processo carrega;
 * 2. **a senha de uma DSN de Postgres** — cobre a string de conexão que chega
 *    de um lugar que não é o `env` (a mensagem do Prisma cita a DSN efetiva,
 *    que pode trazer parâmetro acrescentado pelo driver);
 * 3. **o token de um `Authorization: Bearer`** — o `JOB_SECRET` de quem chamou
 *    errado, a chave do provedor de IA ecoada num 401.
 *
 * **O que sobrevive é de propósito:** o host da DSN e a palavra `Bearer`. Os
 * dois são diagnóstico — dizem *qual* banco não respondeu e *qual* cabeçalho
 * foi recusado —, e é o mesmo argumento que o `redactEmails` já faz sobre o 422
 * do Resend: redigir mantém a frase e tira o dado.
 */
const SECRET_ENV_KEYS = [
  'DATABASE_URL',
  'JOB_SECRET',
  'AUTH_JWT_SECRET',
  'GEMINI_API_KEY',
  'GROQ_API_KEY',
  'RESEND_API_KEY',
  'NEWSDATA_API_KEY',
] as const;

/**
 * Abaixo disto o valor não é tratado como segredo.
 *
 * Sem o piso, uma variável opcional configurada com algo curto e comum (ou com
 * string vazia, que casa em toda posição de todo texto) transformaria o log
 * inteiro em `[segredo redigido]`. Segredo de verdade tem folga sobrando sobre
 * este número.
 */
const MIN_SECRET_LENGTH = 8;

/** `postgres://user:` + senha + `@` — a senha é a única parte que não fica. */
const DSN_PASSWORD_PATTERN = /(postgres(?:ql)?:\/\/[^\s:/@]+):[^\s@]+@/gi;

/** `Bearer <token>` — a palavra fica, o token não. */
const BEARER_PATTERN = /\b(Bearer)\s+[\w.\-+/=~]{8,}/gi;

export const REDACTED_SECRET = '[segredo redigido]';

export function redactSecrets(text: string): string {
  let out = text;

  // Os valores primeiro: quando o segredo que vazou é o do ambiente, o que sai
  // é a linha inteira, e não só a parte que um padrão reconheceria.
  for (const key of SECRET_ENV_KEYS) {
    const value = env[key];
    if (typeof value === 'string' && value.length >= MIN_SECRET_LENGTH) {
      // `split`/`join` e não `replace`: substituição literal, sem escapar
      // regex sobre um valor que ninguém controla.
      out = out.split(value).join(REDACTED_SECRET);
    }
  }

  return out
    .replace(DSN_PASSWORD_PATTERN, `$1:${REDACTED_SECRET}@`)
    .replace(BEARER_PATTERN, `$1 ${REDACTED_SECRET}`);
}
