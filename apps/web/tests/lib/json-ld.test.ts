import { describe, it, expect } from 'vitest';
import { Category, type ArticleWithSources, type News } from '@newranews/types';
import {
  ORGANIZATION_ID,
  breadcrumbJsonLd,
  briefingJsonLd,
  newsArticleJsonLd,
  organizationJsonLd,
  webSiteJsonLd,
  type BreadcrumbStep,
} from '@/lib/json-ld';
import { SITE_URL } from '@/lib/seo';

const news: News = {
  id: 'news-1',
  title: 'Manchete da matéria',
  description: 'O resumo que o feed trouxe.',
  content: 'Um trecho do texto.',
  source: 'Folha de S.Paulo',
  sourceUrl: 'https://folha.example/materia',
  imageUrl: 'https://cdn.example/foto.jpg',
  category: Category.POLITICS,
  publishedAt: '2026-08-22T09:00:00.000Z',
  createdAt: '2026-08-22T09:05:00.000Z',
  updatedAt: '2026-08-22T09:30:00.000Z',
};

const article: ArticleWithSources = {
  id: 'article-1',
  title: 'O briefing do dia',
  content: '### Bloco\n\nTexto.',
  summary: 'O que aconteceu hoje.',
  date: '2026-08-22T00:00:00.000Z',
  newsCount: 15,
  createdAt: '2026-08-22T06:00:00.000Z',
  updatedAt: '2026-08-22T06:10:00.000Z',
  generatedAt: '2026-08-22T05:55:00.000Z',
  promptVersion: 'v3',
  modelVersion: 'gemini-2.0',
  status: 'PUBLISHED' as ArticleWithSources['status'],
  sources: [
    {
      id: 'src-1',
      position: 1,
      title: 'Matéria de origem',
      source: 'G1',
      sourceUrl: 'https://g1.example/materia',
      newsId: 'news-1',
    },
  ],
};

describe('newsArticleJsonLd', () => {
  const node = newsArticleJsonLd({
    news,
    locale: 'pt-BR',
    sectionLabel: 'Política',
  });

  it('atribui a autoria à redação da fonte, não ao Newra News', () => {
    // O texto é do veículo; a página é nossa. Trocar isso carimbaria matéria de
    // terceiro como conteúdo próprio no lugar onde o buscador acredita.
    expect(node.author).toEqual({
      '@type': 'Organization',
      name: 'Folha de S.Paulo',
    });
    expect((node.publisher as Record<string, unknown>)['@id']).toBe(
      ORGANIZATION_ID,
    );
  });

  it('declara a matéria original em isBasedOn', () => {
    // O par honesto de o corpo ser um trecho: a página deriva de outra URL.
    expect(node.isBasedOn).toBe('https://folha.example/materia');
  });

  it('usa a URL canônica do idioma como mainEntityOfPage', () => {
    const url = `${SITE_URL}/pt-BR/news/news-1`;
    expect(node.url).toBe(url);
    expect(node.mainEntityOfPage).toEqual({ '@type': 'WebPage', '@id': url });
  });

  it('leva as duas datas e a seção traduzida', () => {
    expect(node.datePublished).toBe(news.publishedAt);
    expect(node.dateModified).toBe(news.updatedAt);
    expect(node.articleSection).toBe('Política');
  });

  it('omite image quando a matéria não tem imagem', () => {
    // ~30% do acervo não tem — `image: [null]` seria pior que ausência.
    const semFoto = newsArticleJsonLd({
      news: { ...news, imageUrl: null },
      locale: 'en',
      sectionLabel: 'Politics',
    });
    expect(semFoto).not.toHaveProperty('image');
  });
});

describe('briefingJsonLd', () => {
  const node = briefingJsonLd({ article, locale: 'pt-BR' });

  it('atribui o briefing ao próprio site', () => {
    // Aqui o texto é nosso: quem o escreveu foi a redação automatizada.
    expect(node.author).toEqual({ '@id': ORGANIZATION_ID });
  });

  it('prefere generatedAt como datePublished', () => {
    expect(node.datePublished).toBe('2026-08-22T05:55:00.000Z');
  });

  it('cai em date nos briefings sem auditoria', () => {
    const antigo = briefingJsonLd({
      article: { ...article, generatedAt: null },
      locale: 'pt-BR',
    });
    expect(antigo.datePublished).toBe(article.date);
  });

  it('a URL usa o slug de data da rota, não o ISO inteiro', () => {
    expect(node.url).toBe(`${SITE_URL}/pt-BR/article/2026-08-22`);
  });

  it('as fontes viram citation — a contraparte da SourceList', () => {
    expect(node.citation).toEqual([
      {
        '@type': 'CreativeWork',
        name: 'Matéria de origem',
        url: 'https://g1.example/materia',
        publisher: { '@type': 'Organization', name: 'G1' },
      },
    ]);
  });

  it('omite citation quando o briefing é anterior ao registro de fontes', () => {
    const semFontes = briefingJsonLd({
      article: { ...article, sources: [] },
      locale: 'pt-BR',
    });
    expect(semFontes).not.toHaveProperty('citation');
  });
});

describe('breadcrumbJsonLd', () => {
  const steps: BreadcrumbStep[] = [
    { name: 'Home', path: '' },
    { name: 'Notícias', path: '/news' },
    { name: 'Manchete' },
  ];

  it('numera a partir de 1 e omite item no degrau atual', () => {
    // O último é a página: dar-lhe URL faria a trilha apontar para si mesma.
    expect(breadcrumbJsonLd('pt-BR', steps).itemListElement).toEqual([
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Home',
        item: `${SITE_URL}/pt-BR`,
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Notícias',
        item: `${SITE_URL}/pt-BR/news`,
      },
      { '@type': 'ListItem', position: 3, name: 'Manchete' },
    ]);
  });
});

describe('organização e site', () => {
  it('a organização tem @id estável, que é o que os outros nós referenciam', () => {
    expect(organizationJsonLd()['@id']).toBe(ORGANIZATION_ID);
  });

  it('a SearchAction aponta para a busca que existe', () => {
    // `/news?search=` é a mesma URL que o campo do masthead submete. Declarar
    // uma que a tela não atende seria prometer o que o clique não devolve.
    const action = webSiteJsonLd('pt-BR', 'descrição').potentialAction as {
      target: { urlTemplate: string };
    };

    expect(action.target.urlTemplate).toBe(
      `${SITE_URL}/pt-BR/news?search={search_term_string}`,
    );
  });
});
