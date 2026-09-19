import type { ClientErrorReport } from '@newranews/types';
import { webRoutePatternOf } from '../utils/web-route';
import { CLIENT_ERROR_CODE, recordError } from './error-event.service';

/**
 * **O relato de um error boundary do web vira uma linha de `ErrorEvent`** —
 * §11.3 do plano de observabilidade (Fase 7c).
 *
 * O que a fase fecha: um crash de render mostrava "algo deu errado", descartava
 * o `digest` que localizaria o stack do servidor, e não era contado em lugar
 * nenhum. Este é o primeiro produtor de `origin: WEB`, que estava no enum
 * desde a Fase 4 sem ninguém escrever nele.
 *
 * ## O que entra em cada campo, e por quê
 *
 * - **`route` é o padrão da página** (`/[locale]/news/[id]`), normalizado por
 *   `webRoutePatternOf` — nunca o `path` cru, que seria uma linha por notícia.
 *   O que não casa com página nenhuma vai para o `unmatched`.
 * - **`code` é um só** (`CLIENT_ERROR`) e **`severity` é `ERROR`**: um render
 *   que morreu não é degradação. O fingerprint fica
 *   `WEB:ERROR:CLIENT_ERROR:<padrão>`, e dois erros distintos na mesma página
 *   colapsam numa linha por hora, com o `message` da primeira — o teto vale
 *   mais que a distinção, e a tabela de falhas tem busca por mensagem.
 * - **`digest` e `path` vão no `context`**, não no fingerprint. O `digest` é a
 *   chave para o stack no log do servidor (só existe em erro de server
 *   component); o `path` cru é o ponteiro quando não há digest. Os dois são
 *   diagnóstico, não identidade.
 * - **`requestId` é o da requisição que ingeriu o relato**, não o da que
 *   falhou — a correlação com o log do servidor é o `digest`, e o id do
 *   relato é o que liga esta linha à linha de acesso do `POST`.
 * - **`category: 'internal'`**: quebrou no nosso código, no navegador do
 *   leitor.
 *
 * ## O que não se confia
 *
 * `message` vem do navegador e pode carregar o que o erro quiser — uma URL
 * com token, um e-mail num estado de formulário. O schema da rota limita a
 * **forma** (300/64, `path` sem query); quem limita o **conteúdo** é o
 * `scrubMessage`/`scrubErrorContext` que o `recordError` já aplica a tudo o
 * que entra no buffer. A função é síncrona e nunca lança pelo mesmo contrato
 * do `recordError`.
 */
export function recordClientError(report: ClientErrorReport, requestId: string | null): void {
  recordError({
    origin: 'WEB',
    severity: 'ERROR',
    code: CLIENT_ERROR_CODE,
    category: 'internal',
    message: report.message,
    route: webRoutePatternOf(report.path),
    statusCode: null,
    requestId,
    context: { digest: report.digest ?? null, path: report.path },
  });
}
