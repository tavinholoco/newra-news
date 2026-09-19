'use client';

import { useEffect, useRef } from 'react';
import {
  CLIENT_ERROR_DIGEST_MAX_LENGTH,
  CLIENT_ERROR_MESSAGE_MAX_LENGTH,
  type ClientErrorReport,
} from '@newranews/types';

/** A porta anônima da Fase 7c — rota do próprio Next, que repassa para a API. */
const ENDPOINT = '/api/errors/client';

/** O que um error boundary do Next entrega: `Error`, com `digest` quando o erro foi de servidor. */
export interface BoundaryError {
  message?: unknown;
  digest?: unknown;
}

/**
 * Manda um relato para `POST /api/errors/client` — o caminho que a §11.3 do
 * plano de observabilidade abriu, usado pelos error boundaries da §11.2.
 *
 * **Nunca lança, e não é zelo.** Este código roda dentro de um error
 * boundary, e uma segunda exceção ali é a falha dupla que não renderiza
 * nada: o `try` em volta de tudo, o `void` no envio e o `.catch` vazio são a
 * forma de o relato nunca custar mais do que a falha que relata. Pelo mesmo
 * motivo ele **não usa `lib/api.ts`** (lança `ApiError`) nem `track()` (o
 * balde do analytics — armadilha 10).
 *
 * **`keepalive: true`, sem prazo.** O relato sai muitas vezes durante uma
 * navegação que acabou de falhar; `keepalive` é o que o faz sobreviver a ela,
 * e um `signal` com prazo abortaria a única tentativa. É a segunda exceção
 * declarada do `bff-seam` — a primeira é o `fetch` de reserva do analytics.
 *
 * **Sem stack, sem identidade.** `message` truncada no teto do schema,
 * `digest` só quando há (um render que morreu no cliente chega sem ele — e
 * é por isso que o `path` viaja: sem digest, é o único ponteiro), e o
 * `path` é `location.pathname`, nunca a query: ela carregaria o termo de
 * busca. Quem normaliza para o padrão da página é a API.
 */
export function reportClientError(error: BoundaryError | null | undefined): void {
  try {
    if (typeof window === 'undefined' || typeof fetch !== 'function') return;

    const report: ClientErrorReport = {
      message: messageOf(error),
      path: window.location.pathname.slice(0, 512),
    };
    const digest = typeof error?.digest === 'string' ? error.digest.trim() : '';
    if (digest.length > 0) report.digest = digest.slice(0, CLIENT_ERROR_DIGEST_MAX_LENGTH);

    void fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(report),
      keepalive: true,
    }).catch(() => {
      // Falha do relato não pode aparecer para quem já está vendo uma falha.
    });
  } catch {
    // Idem: nada daqui sobe para o boundary.
  }
}

/**
 * A mensagem sempre tem ao menos um caractere — o schema da API exige. O
 * `error.message` de um erro de servidor é a frase genérica do Next (261
 * caracteres, "An error occurred in the Server Components render…"): cabe
 * no teto, não identifica nada, e vai como está — o `digest` é a identidade.
 */
function messageOf(error: BoundaryError | null | undefined): string {
  const raw = typeof error?.message === 'string' ? error.message.trim() : '';
  return (raw || 'Error without message').slice(0, CLIENT_ERROR_MESSAGE_MAX_LENGTH);
}

/**
 * Reporta **uma vez por montagem** do boundary.
 *
 * O `useRef` é a guarda do `PageView`: em desenvolvimento o StrictMode monta
 * duas vezes de propósito, e sem ela todo erro contaria dois em `pnpm dev`.
 * `reset()` remonta o boundary — o mesmo erro no retry é um relato novo,
 * coalescido pela API na mesma linha da hora. É o comportamento certo: a
 * pessoa tentou de novo e falhou de novo.
 *
 * Importável do `global-error.tsx`: não depende de provider nenhum.
 */
export function useReportClientError(error: BoundaryError | null | undefined): void {
  const reported = useRef(false);

  useEffect(() => {
    if (reported.current) return;
    reported.current = true;
    reportClientError(error);
  }, [error]);
}
