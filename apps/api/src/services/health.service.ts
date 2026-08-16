import { env } from '../config/env';

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
 */
async function fetchWithTimeout(
  url: string,
  options?: RequestInit,
): Promise<Response | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch {
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
  const response = await fetchWithTimeout(url);

  if (!response || !response.ok) {
    return 'invalid';
  }

  try {
    const data = (await response.json()) as { status?: string };
    return data.status === 'success' ? 'ok' : 'invalid';
  } catch {
    return 'invalid';
  }
}

/** Checa a chave da Gemini listando os modelos disponíveis. */
export async function checkGemini(): Promise<ProviderStatus> {
  if (!env.GEMINI_API_KEY) {
    return 'not_configured';
  }

  const url = `${GEMINI_MODELS_URL}?key=${env.GEMINI_API_KEY}`;
  const response = await fetchWithTimeout(url);

  return response?.ok ? 'ok' : 'invalid';
}

/** Checa a chave da Groq listando os modelos disponíveis. */
export async function checkGroq(): Promise<ProviderStatus> {
  if (!env.GROQ_API_KEY) {
    return 'not_configured';
  }

  const response = await fetchWithTimeout(GROQ_MODELS_URL, {
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
