import { describe, it, expect, vi, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { redactEmails, REDACTED_EMAIL } from '../../src/utils/redact';
import { sendEmailWithResend } from '../../src/providers/newsletter/resend.provider';

/**
 * **O dado pessoal que saía do produto e voltava para dentro de um log.**
 *
 * A varredura de LGPD da §11.S tem uma pergunta só — *algum log guarda dado
 * pessoal que ninguém precisa?* — e a resposta era sim, por um caminho que só
 * aparece quando algo dá errado:
 *
 * ```
 * Resend recusa o destinatário  →  o corpo de erro ecoa o endereço
 *   →  sendEmailWithResend cola os 200 primeiros caracteres na exceção
 *     →  sendDailyNewsletter guarda a mensagem em NewsletterLog.error
 * ```
 *
 * E aquela coluna é o pior lugar possível para um e-mail parar: **ninguém a
 * lê** (nenhuma rota, nenhuma tela, nenhum job), **o cleanup do pipeline não a
 * expurga** — ele cobre `News`, `PipelineLog`, `Article` e `ProductEvent` —, e
 * ela **sobrevive ao cancelamento da inscrição**, porque cancelar mexe no
 * `Subscriber` e em log nenhum.
 *
 * A regra desta fase é que achado de segurança sai com o teste que o mantém
 * fechado, e não com o que prova que existiu. É este.
 */

/**
 * **O `env` é lido na carga do módulo, e `process.env` num `beforeAll` chega
 * tarde.** Sem este mock, `RESEND_API_KEY` sai vazio, o provider aborta com
 * "Newsletter disabled" antes de chegar ao `fetch`, e a asserção de redação
 * passaria **pelo motivo errado** — a mensagem não conteria o e-mail porque
 * requisição nenhuma foi feita. Foi exatamente o que aconteceu na primeira
 * execução deste arquivo, e é a armadilha que o `CLAUDE.md` registra desde a
 * Fase 9. A asserção de que o `422` está na frase é o que prova que o harness
 * exercita o caminho que diz exercitar.
 */
vi.mock('../../src/config/env', () => ({
  env: {
    RESEND_API_KEY: 'chave-de-teste',
    NEWSLETTER_FROM: 'Newra News <news@newranews.com>',
  },
}));

const PIPELINE_SOURCE = join(__dirname, '../../src/services/pipeline.service.ts');

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('redactEmails', () => {
  it('removes an address from text that will become a log line', () => {
    expect(redactEmails('Invalid `to` field: leitor@exemplo.com.br')).toBe(
      `Invalid \`to\` field: ${REDACTED_EMAIL}`,
    );
  });

  it('removes every address, not just the first', () => {
    const redacted = redactEmails('de a@b.com para c@d.org');

    expect(redacted).not.toMatch(/@/);
    expect(redacted.split(REDACTED_EMAIL)).toHaveLength(3);
  });

  it('keeps the diagnosis readable — that is why the body is not simply dropped', () => {
    // "Resend API error 422" sozinho não separa domínio não verificado de
    // destinatário inválido, e é isso que alguém quer saber às sete da manhã.
    const redacted = redactEmails(
      'The newranews.com domain is not verified. Recipient: alguem@exemplo.com',
    );

    expect(redacted).toContain('domain is not verified');
    expect(redacted).not.toContain('alguem@exemplo.com');
  });

  it('leaves text without an address untouched', () => {
    const text = 'Resend API error 500: internal';
    expect(redactEmails(text)).toBe(text);
  });
});

describe('o erro do Resend não carrega o destinatário', () => {
  it('redacts the address the provider echoed back', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 422,
        text: vi
          .fn()
          .mockResolvedValue('{"message":"Invalid `to` field: assinante@exemplo.com"}'),
      }),
    );

    const failure = await sendEmailWithResend({
      to: 'assinante@exemplo.com',
      subject: 'Newra News',
      html: '<p>x</p>',
      text: 'x',
    }).catch((error: unknown) => error as Error);

    expect(failure).toBeInstanceOf(Error);
    // O status continua na frase — é o que diz o que aconteceu.
    expect(failure.message).toContain('422');
    expect(failure.message).not.toContain('assinante@exemplo.com');
    expect(failure.message).toContain(REDACTED_EMAIL);
  });
});

describe('o pipeline não registra dado pessoal no contexto das etapas', () => {
  it('logs counts for the newsletter stage, never a recipient', () => {
    /**
     * Guarda **estática**, e de propósito: o contexto do `logPipelineEvent`
     * termina numa coluna `Json` que o `/api/dev/logs` e o painel dev exibem.
     * O que ele carrega na etapa da newsletter são três números — total,
     * enviados, falhados —, e é isso que tem de continuar sendo. Um
     * `subscriber.email` acrescentado ali "para saber quem falhou" é a mesma
     * deriva que a rota de eventos tem guarda para impedir.
     */
    const source = readFileSync(PIPELINE_SOURCE, 'utf8');
    const stage = /Daily newsletter sent',\s*\{([^}]*)\}/.exec(source);

    expect(stage).not.toBeNull();
    expect((stage?.[1] as string).trim()).toMatch(
      /^total:\s*newsletter\.total,\s*sent:\s*newsletter\.sent,\s*failed:\s*newsletter\.failed,$/,
    );
  });

  it('finds the stage at all — a regex that matches nothing would pass everything', () => {
    const source = readFileSync(PIPELINE_SOURCE, 'utf8');

    expect(source).toContain("'Daily newsletter sent'");
    expect(source).toContain('logPipelineEvent');
  });
});
