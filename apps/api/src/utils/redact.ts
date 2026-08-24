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
