import { env } from '../config/env';
import { baseLogger } from '../utils/logger';

export type ProviderStatus = 'ok' | 'invalid' | 'not_configured';

export interface ProvidersHealth {
  newsdata: ProviderStatus;
  gemini: ProviderStatus;
  groq: ProviderStatus;
}

const REQUEST_TIMEOUT_MS = 5_000;

const NEWS_DATA_URL = 'https://newsdata.io/api/1/news';
const GEMINI_MODELS_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
const GROQ_MODELS_URL = 'https://api.groq.com/openai/v1/models';

/**
 * Faz uma requisição leve com timeout. Retorna `null` em caso de erro de rede
 * ou timeout — nunca lança, para que um provider fora do ar não quebre o endpoint.
 *
 * ## O status responde "não deu"; o log responde "por quê"
 *
 * `ProviderStatus` tem três valores, e `invalid` colapsava três situações com
 * **ações opostas**: chave recusada (rotacione a chave), provedor fora do ar
 * (espere), e timeout (pode ser a nossa rede). Quem lê o `/api/health/providers`
 * ou o painel dev via a mesma palavra nos três casos.
 *
 * O status **não muda** — ele é contrato declarado, serializado por schema, e um
 * quarto valor mexeria em `docs/api.md`, no tipo compartilhado e na tela. O que
 * a auditoria pós-merge da Fase 3 fechou é o outro lado: a razão passou a
 * existir no log, que é onde diagnóstico mora.
 *
 * **A URL não entra na linha.** Ela carrega a chave (`?apikey=`, `?key=`), e
 * depender do redator para tirá-la seria depender de ele conhecer aquele valor.
 * O que identifica a sonda é o nome do provider.
 */
async function fetchWithTimeout(
  provider: string,
  url: string,
  options?: RequestInit,
): Promise<Response | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    if (!response.ok) {
      // Chave recusada tem status; provider inalcançável não tem. É a distinção
      // que separa "rotacione a chave" de "espere".
      baseLogger.warn(
        { provider, statusCode: response.status },
        'provider health check refused',
      );
    }
    return response;
  } catch (error) {
    // `AbortError` é o timeout de {@link REQUEST_TIMEOUT_MS}; o resto é rede.
    // O `err` passa pelo serializer, que redige e segue o `cause` — onde o
    // undici guarda o `ENOTFOUND`/`ECONNREFUSED`.
    baseLogger.warn({ err: error, provider }, 'provider health check could not reach');
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Checa a chave da NewsData.io com uma busca mínima (size=1).
 * A API responde HTTP 200 mesmo com chave inválida — o status vem no corpo,
 * então é preciso validar `status === 'success'`.
 */
export async function checkNewsData(): Promise<ProviderStatus> {
  if (!env.NEWSDATA_API_KEY) {
    return 'not_configured';
  }

  const url = `${NEWS_DATA_URL}?apikey=${env.NEWSDATA_API_KEY}&size=1`;
  const response = await fetchWithTimeout('newsdata', url);

  if (!response || !response.ok) {
    return 'invalid';
  }

  try {
    const data = (await response.json()) as { status?: string };
    if (data.status !== 'success') {
      // A NewsData responde **200 com a chave errada** — o status vem no corpo.
      // Sem esta linha, "chave recusada" e "corpo ilegível" eram o mesmo
      // `invalid` vindo de um HTTP 200.
      baseLogger.warn({ provider: 'newsdata', bodyStatus: data.status ?? null },
        'provider health check answered 200 without success');
    }
    return data.status === 'success' ? 'ok' : 'invalid';
  } catch (error) {
    baseLogger.warn({ err: error, provider: 'newsdata' }, 'provider health check body is unreadable');
    return 'invalid';
  }
}

/** Checa a chave da Gemini listando os modelos disponíveis. */
export async function checkGemini(): Promise<ProviderStatus> {
  if (!env.GEMINI_API_KEY) {
    return 'not_configured';
  }

  const url = `${GEMINI_MODELS_URL}?key=${env.GEMINI_API_KEY}`;
  const response = await fetchWithTimeout('gemini', url);

  return response?.ok ? 'ok' : 'invalid';
}

/** Checa a chave da Groq listando os modelos disponíveis. */
export async function checkGroq(): Promise<ProviderStatus> {
  if (!env.GROQ_API_KEY) {
    return 'not_configured';
  }

  const response = await fetchWithTimeout('groq', GROQ_MODELS_URL, {
    headers: {
      Authorization: `Bearer ${env.GROQ_API_KEY}`,
    },
  });

  return response?.ok ? 'ok' : 'invalid';
}

/** Testa as três chaves em paralelo e reporta apenas os status, sem expor as chaves. */
export async function checkAllProviders(): Promise<ProvidersHealth> {
  const [newsdata, gemini, groq] = await Promise.all([
    checkNewsData(),
    checkGemini(),
    checkGroq(),
  ]);

  return { newsdata, gemini, groq };
}
