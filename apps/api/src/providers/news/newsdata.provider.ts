import { Category } from '@newranews/database';
import { env } from '../../config/env';
import { decodeEntities } from '../ai/ai-utils';
import { sanitizeDescription, sanitizeTitle } from './feed-text';
import type { RawNewsItem } from '../types';

const API_URL = 'https://newsdata.io/api/1/news';
const PAGE_SIZE = 10; // max size on the free tier

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

  const results = await Promise.all(categories.map((category) => fetchCategory(category)));
  return results.flat();
}

async function fetchCategory(category: Category): Promise<RawNewsItem[]> {
  const apiCategory = CATEGORY_MAP[category];
  const url = `${API_URL}?apikey=${env.NEWSDATA_API_KEY}&country=br&language=pt&category=${apiCategory}&size=${PAGE_SIZE}`;

  const response = await fetch(url);

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
      return {
      title,
      description: sanitizeDescription(decodeEntities(article.description), title),
      content:
        article.content && !PAID_CONTENT_PLACEHOLDER.test(article.content)
          ? decodeEntities(article.content)
          : null,
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
      imageUrl: article.image_url,
      category,
      publishedAt: new Date(article.pubDate),
      };
    });
}
