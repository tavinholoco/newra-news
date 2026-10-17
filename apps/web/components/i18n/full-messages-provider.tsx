import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';

/**
 * **O dicionário inteiro, para as telas atrás de sessão.**
 *
 * O layout de idioma manda ao navegador só `PUBLIC_CLIENT_NAMESPACES`
 * (`lib/i18n.ts`) — o resto pesava em toda página da ISR sem nenhuma página
 * pública o ler. `/admin`, `/account` e `/favorites` leem `admin`,
 * `dashboard`, `productMetrics` e `account` em componentes cliente, e
 * recebem o dicionário de novo aqui.
 *
 * **Um provider aninhado substitui o de fora, não soma a ele** — o
 * `IntlProvider` do `use-intl@3` monta o contexto só com as mensagens que
 * recebe. Por isso ele leva tudo, e não só os quatro namespaces.
 *
 * Só em segmento `force-dynamic`: lá a página é renderizada por requisição e
 * não grava na ISR, então o peso não entra na cota. A guarda
 * (`tests/lib/client-messages.test.ts`) recusa este componente fora deles.
 * `locale` e `now` vêm da configuração da requisição pelo provider de
 * servidor do next-intl — o mesmo `STATIC_NOW` do layout.
 */
export async function FullMessagesProvider({ children }: { children: React.ReactNode }) {
  const messages = await getMessages();

  return <NextIntlClientProvider messages={messages}>{children}</NextIntlClientProvider>;
}
