import { Category } from '@newranews/database';
import { env } from '../../config/env';
import { decodeEntities } from '../ai/ai-utils';
import {
  extractImageFromHtml,
  sanitizeContent,
  sanitizeDescription,
  sanitizeTitle,
  splitDekAndBody,
} from './feed-text';
import type { RawNewsItem } from '../types';

const API_URL = 'https://newsdata.io/api/1/news';
const PAGE_SIZE = 10; // max size on the free tier

/**
 * **Prazo, pela mesma razão que o provider de RSS tem o seu.** Uma requisição
 * que abre a conexão e não responde prenderia a etapa 1 sem teto — e aqui são
 * oito em paralelo, então basta uma. O RSS ganhou o dele na Fase 9 e este
 * ficou para trás; a assimetria não tinha motivo.
 *
 * Quinze segundos é folga larga sobre o medido em 02/09/2026, quando as oito
 * categorias responderam entre 0,52 s e 0,84 s.
 */
const CATEGORY_TIMEOUT_MS = 15_000;

// No tier gratuito, o conteudo completo vem com este placeholder.
const PAID_CONTENT_PLACEHOLDER = /ONLY AVAILABLE IN PAID PLANS/i;

// NewsData.io category names (https://newsdata.io/documentation)
const CATEGORY_MAP: Record<Category, string> = {
  TECHNOLOGY: 'technology',
  POLITICS: 'politics',
  ECONOMY: 'business',
  SPORTS: 'sports',
  SCIENCE: 'science',
  ENTERTAINMENT: 'entertainment',
  WORLD: 'world',
  HEALTH: 'health',
};

interface NewsDataArticle {
  article_id: string;
  link: string;
  title: string;
  description: string | null;
  content: string | null;
  pubDate: string;
  image_url: string | null;
  source_id: string;
  source_name: string;
  category: string[];
  country: string[];
  language: string;
  duplicate: boolean;
}

interface NewsDataError {
  message: string;
  code: string;
}

interface NewsDataResponse {
  status: string;
  totalResults?: number;
  results?: NewsDataArticle[] | NewsDataError;
}

export async function fetchFromNewsData(categories: Category[]): Promise<RawNewsItem[]> {
  if (!env.NEWSDATA_API_KEY) {
    throw new Error('NEWSDATA_API_KEY is not configured');
  }

  // **`allSettled`, e não `all`.** Com `Promise.all` uma única categoria que
  // rejeita descarta a colheita inteira da NewsData — as outras sete já tinham
  // respondido e iam para o lixo junto. É a mesma escolha que o provider de RSS
  // faz por feed, e pela mesma razão: fonte fora do ar não derruba o dia.
  const results = await Promise.allSettled(
    categories.map((category) => fetchCategory(category)),
  );

  // Categoria que falha ou vem vazia avisa, uma a uma — espelha `fetchFromRss`.
  // Sem isto, oito respostas viram um número só e a que sumiu não deixa rastro.
  results.forEach((result, index) => {
    const name = categories[index] ?? 'desconhecida';
    if (result.status === 'rejected') {
      console.warn(`[newsdata] ${name}: falhou —`, result.reason);
    } else if (result.value.length === 0) {
      console.warn(`[newsdata] ${name}: zero itens`);
    }
  });

  return results
    .filter((r): r is PromiseFulfilledResult<RawNewsItem[]> => r.status === 'fulfilled')
    .flatMap((r) => r.value);
}

async function fetchCategory(category: Category): Promise<RawNewsItem[]> {
  const apiCategory = CATEGORY_MAP[category];
  const url = `${API_URL}?apikey=${env.NEWSDATA_API_KEY}&country=br&language=pt&category=${apiCategory}&size=${PAGE_SIZE}`;

  const response = await fetch(url, { signal: AbortSignal.timeout(CATEGORY_TIMEOUT_MS) });

  if (!response.ok) {
    throw new Error(`NewsData error: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as NewsDataResponse;

  if (data.status !== 'success' || !Array.isArray(data.results)) {
    const message = Array.isArray(data.results)
      ? data.status
      : data.results?.message ?? data.status;
    throw new Error(`NewsData returned status: ${message}`);
  }

  return data.results
    .filter(
      (article): article is NewsDataArticle & { description: string } =>
        Boolean(article.title && article.description && article.link) &&
        !article.duplicate,
    )
    .map((article): RawNewsItem => {
      const title = sanitizeTitle(decodeEntities(article.title));
      // O texto inteiro, sem teto: `splitDekAndBody` decide quanto dele é
      // subtítulo e quanto é corpo. Mesma higiene do provider de RSS.
      const fullText = sanitizeDescription(
        decodeEntities(article.description),
        title,
      );
      const excerpt =
        article.content && !PAID_CONTENT_PLACEHOLDER.test(article.content)
          ? sanitizeContent(article.content, fullText)
          : null;
      const { dek, body } = splitDekAndBody(fullText, excerpt);

      return {
      title,
      description: dek,
      content: body,
      // `decodeEntities` também aqui: o acervo tem "Jornal Do Com&eacute;rcio"
      // porque só título e descrição eram decodificados, e o nome do veículo
      // aparece cru no crédito de toda matéria dessa fonte.
      //
      // `source_name` pode vir ausente na API; nunca deixar source indefinido
      // (Prisma rejeita createMany com campo ausente).
      source: decodeEntities(
        article.source_name || article.source_id || 'Unknown source',
      ),
      sourceUrl: article.link,
      // A NewsData declara `image_url`; quando ela vem vazia, o corpo ainda
      // pode trazer uma — o mesmo caminho que recupera a foto da InfoMoney.
      imageUrl: article.image_url ?? extractImageFromHtml(article.content),
      category,
      publishedAt: new Date(article.pubDate),
      };
    });
}
