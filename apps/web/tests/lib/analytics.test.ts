import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Category } from '@newranews/types';
import {
  track,
  flushEvents,
  __resetAnalyticsForTests,
} from '@/lib/analytics';
import { isTrackingAllowed } from '@/lib/analytics/consent';
import { SESSION_STORAGE_KEY, getSessionId } from '@/lib/analytics/session';
import { sanitizeSearchQuery } from '@/lib/analytics/sanitize';

const beacon = vi.fn(() => true);

function sentBatch(): Array<Record<string, unknown>> {
  const [, blob] = beacon.mock.calls.at(-1) as unknown as [string, Blob];
  // `Blob.text()` não existe em jsdom antigo; o corpo é gravado pelo stub.
  const body = (blob as unknown as { __body: string }).__body;
  return (JSON.parse(body) as { events: Array<Record<string, unknown>> }).events;
}

beforeEach(() => {
  __resetAnalyticsForTests();
  beacon.mockClear();
  beacon.mockReturnValue(true);
  window.sessionStorage.clear();
  window.localStorage.clear();

  vi.stubGlobal(
    'Blob',
    class {
      __body: string;
      type: string;
      constructor(parts: string[], options?: { type?: string }) {
        this.__body = parts.join('');
        this.type = options?.type ?? '';
      }
    },
  );
  vi.stubGlobal('navigator', {
    sendBeacon: beacon,
    doNotTrack: undefined,
  } as unknown as Navigator);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('sessão', () => {
  it('vive em sessionStorage, não em localStorage', () => {
    // Em `localStorage` o id viraria identificador estável entre visitas — e é
    // justamente isso que separa medição anônima de dado pessoal.
    const id = getSessionId();

    expect(id).toBeTruthy();
    expect(window.sessionStorage.getItem(SESSION_STORAGE_KEY)).toBe(id);
    expect(window.localStorage.getItem(SESSION_STORAGE_KEY)).toBeNull();
  });

  it('reaproveita o mesmo id na mesma sessão', () => {
    expect(getSessionId()).toBe(getSessionId());
  });

  it('gera um UUID que a API aceita', () => {
    expect(getSessionId()).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });
});

describe('oposição pelo navegador', () => {
  it('mede por padrão — é o legítimo interesse desta camada', () => {
    // Cookieless, sem identificador entre sessões e sem terceiro: não há
    // consentimento a pedir, e por isso não há banner nem decisão guardada.
    expect(isTrackingAllowed()).toBe(true);
  });

  it('respeita Do Not Track', () => {
    vi.stubGlobal('navigator', {
      sendBeacon: beacon,
      doNotTrack: '1',
    } as unknown as Navigator);

    expect(isTrackingAllowed()).toBe(false);
  });

  it('respeita Global Privacy Control', () => {
    vi.stubGlobal('navigator', {
      sendBeacon: beacon,
      globalPrivacyControl: true,
    } as unknown as Navigator);

    expect(isTrackingAllowed()).toBe(false);
  });
});

describe('sanitizeSearchQuery', () => {
  it('deixa passar um assunto de notícia', () => {
    expect(sanitizeSearchQuery('  eleições 2026 ')).toBe('eleições 2026');
  });

  it('descarta o que tem arroba', () => {
    expect(sanitizeSearchQuery('fulano@exemplo.com')).toBeNull();
  });

  it('descarta o que se parece com segredo', () => {
    expect(sanitizeSearchQuery('minha senha do banco')).toBeNull();
    // A fixture **não** imita o prefixo de provedor nenhum: a proteção de push
    // do GitHub barrou o commit quando ela começava como uma chave de gateway
    // de pagamento, e o scanner tem razão — não dá para distinguir chave falsa
    // de chave vazada. O que a regra mede é a **forma**: cadeia longa, sem
    // espaço, misturando letra e dígito.
    expect(sanitizeSearchQuery('zZ4bC7dEf9GhJ2kLm5NpQ8rStU')).toBeNull();
  });

  it('descarta dígitos demais — CPF, telefone, cartão', () => {
    // Assunto de notícia é nomeado por palavras; onze dígitos é onde começa o
    // que não deve ser gravado.
    expect(sanitizeSearchQuery('123.456.789-00')).toBeNull();
    expect(sanitizeSearchQuery('11 98765-4321')).toBeNull();
  });

  it('trunca em 100', () => {
    expect(sanitizeSearchQuery('a'.repeat(200))).toHaveLength(100);
  });

  it('deixa passar palavra longa sem dígito', () => {
    // A regra de "parece chave" exige mistura de letra e dígito: sem isso ela
    // descartaria "anticonstitucionalissimamente", que tem 29 letras.
    expect(sanitizeSearchQuery('anticonstitucionalissimamente')).toBe(
      'anticonstitucionalissimamente',
    );
  });

  it('descarta o vazio', () => {
    expect(sanitizeSearchQuery('   ')).toBeNull();
  });
});

describe('track', () => {
  it('anexa sessão, locale, path e horário — nunca o componente', () => {
    document.documentElement.lang = 'pt-BR';
    track('homepage_view');
    flushEvents();

    const [event] = sentBatch();
    expect(event).toMatchObject({
      type: 'homepage_view',
      locale: 'pt-BR',
      path: window.location.pathname,
    });
    expect(event?.sessionId).toBe(getSessionId());
    expect(typeof event?.occurredAt).toBe('string');
  });

  it('nunca manda `path` com query string', () => {
    // A query carrega o termo de busca, e a API recusa `path` com `?`.
    track('homepage_view');
    flushEvents();

    expect(String(sentBatch()[0]?.path)).not.toContain('?');
  });

  it('não mede quando o navegador pediu para não medir', () => {
    vi.stubGlobal('navigator', {
      sendBeacon: beacon,
      globalPrivacyControl: true,
    } as unknown as Navigator);

    track('homepage_view');
    flushEvents();

    expect(beacon).not.toHaveBeenCalled();
  });

  it('agrupa em lote e despacha uma vez só', () => {
    track('homepage_view');
    track('story_open', {
      storyId: 's1',
      category: Category.HEALTH,
      position: 0,
      source: 'hero',
    });
    flushEvents();

    expect(beacon).toHaveBeenCalledTimes(1);
    expect(sentBatch()).toHaveLength(2);
  });

  it('descarrega sozinho ao encher o lote', () => {
    // 20 é o teto que a API aceita; segurar o 21º seria perder o lote inteiro.
    for (let i = 0; i < 20; i += 1) track('homepage_view');

    expect(beacon).toHaveBeenCalledTimes(1);
    expect(sentBatch()).toHaveLength(20);
  });

  it('manda para a rota do próprio Next, não para a API', () => {
    // `sendBeacon` não sabe fazer preflight, e `application/json` cross-origin
    // exigiria um — o beacon falharia em silêncio.
    track('homepage_view');
    flushEvents();

    const [url] = beacon.mock.calls.at(-1) as unknown as [string, Blob];
    expect(url).toBe('/api/events');
  });

  it('esvazia a fila antes de enviar — nada é reenviado', () => {
    track('homepage_view');
    flushEvents();
    flushEvents();

    expect(beacon).toHaveBeenCalledTimes(1);
  });

  it('não lança quando o transporte falha', () => {
    beacon.mockImplementation(() => {
      throw new Error('beacon morreu');
    });

    expect(() => {
      track('homepage_view');
      flushEvents();
    }).not.toThrow();
  });

  it('não lança quando não há sessão disponível', () => {
    const getItem = vi
      .spyOn(Storage.prototype, 'getItem')
      .mockImplementation(() => {
        throw new Error('modo privativo');
      });

    expect(() => track('homepage_view')).not.toThrow();
    flushEvents();
    expect(beacon).not.toHaveBeenCalled();

    getItem.mockRestore();
  });
});
