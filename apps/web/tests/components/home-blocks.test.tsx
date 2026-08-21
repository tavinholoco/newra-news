import { describe, it, expect, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import type { Category } from '@newranews/types';
import { HeroStory } from '@/components/editorial/hero-story';
import { BriefingCard } from '@/components/editorial/briefing-card';
import { TopStories } from '@/components/editorial/top-stories';
import { TrendingList } from '@/components/editorial/trending-list';
import { LatestStories } from '@/components/editorial/latest-stories';
import { CategorySection } from '@/components/editorial/category-section';
import { renderWithIntl } from '@/tests/utils';
import { makeBriefing, makeStories, makeStory } from '@/tests/fixtures/editorial';

vi.mock('next/image', async () => ({
  default: (await import('@/tests/mocks/next-image')).MockNextImage,
}));

describe('HeroStory', () => {
  it('should render the headline as h2 with the dek and a read CTA', () => {
    renderWithIntl(<HeroStory story={makeStory()} />);

    expect(
      screen.getByRole('heading', { level: 2, name: /Matéria de teste/ }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Resumo da matéria de teste/)).toBeInTheDocument();
    expect(screen.getByText('Ler a matéria')).toBeInTheDocument();
  });

  it('should mark the hero image as priority — it is the LCP of the Home', () => {
    renderWithIntl(
      <HeroStory story={makeStory({ imageUrl: 'https://cdn.test/hero.jpg' })} />,
    );

    // `priority` é prop do componente do Next, não atributo de DOM — o mock a
    // expõe como `data-priority`. Num Image real ela vira `fetchpriority=high`.
    expect(screen.getByRole('img', { name: /Matéria de teste/ })).toHaveAttribute(
      'data-priority',
      'true',
    );
  });

  // O `updatedAt` do contrato é o `@updatedAt` do Prisma — muda quando o
  // pipeline reclassifica a categoria, não quando a redação revisa o texto.
  it('should not advertise an "updated" state from the row timestamp', () => {
    renderWithIntl(
      <HeroStory
        story={makeStory({ updatedAt: '2024-06-01T00:00:00.000Z' })}
      />,
    );

    expect(screen.queryByText(/Atualizado/i)).toBeNull();
  });

  it('should expose exactly one link, so the CTA is not a second tab stop', () => {
    renderWithIntl(<HeroStory story={makeStory()} />);

    expect(screen.getAllByRole('link')).toHaveLength(1);
  });

  // O `dek` do contrato é a `description` da News, e boa parte dos feeds põe
  // ali a matéria inteira — 1.876 caracteres no hero de produção. Sem clamp o
  // parágrafo vira o elemento de LCP da Home.
  it('should clamp the dek, however long the feed made it', () => {
    renderWithIntl(<HeroStory story={makeStory({ dek: 'palavra '.repeat(400) })} />);

    const dek = screen.getByText(/palavra/);
    expect(dek.className).toMatch(/\bline-clamp-\d\b/);
  });
});

describe('BriefingCard', () => {
  it('should show the brand seal, source count, reading time and AI disclosure', () => {
    renderWithIntl(<BriefingCard briefing={makeBriefing()} />);

    expect(screen.getByText('Newra Daily Brief')).toBeInTheDocument();
    expect(screen.getByText('12 fontes consultadas')).toBeInTheDocument();
    expect(screen.getByText('4 min de leitura')).toBeInTheDocument();
    expect(
      screen.getByText(/Resumo produzido por IA a partir das fontes listadas/),
    ).toBeInTheDocument();
  });

  it('should link the CTA to the dated article page', () => {
    renderWithIntl(<BriefingCard briefing={makeBriefing()} />);

    expect(
      screen.getByRole('link', { name: /Ler o briefing completo/ }),
    ).toHaveAttribute('href', '/pt-BR/article/2024-01-01');
  });

  // Briefings anteriores à migration `add_daily_briefing_metadata` não têm
  // fontes registradas; a contagem ainda existe e o bloco tem de renderizar.
  it('should render for a legacy briefing with no sources', () => {
    renderWithIntl(
      <BriefingCard
        briefing={makeBriefing({ generatedAt: null, sources: [], sourceCount: 0 })}
      />,
    );

    // "0 fonte consultada", no singular: em pt-BR o CLDR põe o zero na regra
    // `one` (i = 0..1), ao contrário do inglês.
    expect(screen.getByText('0 fonte consultada')).toBeInTheDocument();
  });
});

describe('TopStories', () => {
  it('should render an ordered list of the stories', () => {
    renderWithIntl(<TopStories stories={makeStories(3)} />);

    const list = screen.getByRole('list');
    expect(within(list).getAllByRole('listitem')).toHaveLength(3);
  });

  it('should render nothing when the block is empty', () => {
    const { container } = renderWithIntl(<TopStories stories={[]} />);

    expect(container).toBeEmptyDOMElement();
  });
});

describe('TrendingList', () => {
  it('should number the items in the order the API returned them', () => {
    renderWithIntl(<TrendingList stories={makeStories(3)} />);

    const items = screen.getAllByRole('listitem');
    expect(items[0]).toHaveTextContent('Matéria 1');
    expect(items[2]).toHaveTextContent('Matéria 3');
  });

  // Trending vazio é resultado correto do endpoint quando nada foi publicado
  // nas últimas 24h — não é defeito, e seção com título e nada dentro é pior.
  it('should render nothing when nothing is trending', () => {
    const { container } = renderWithIntl(<TrendingList stories={[]} />);

    expect(container).toBeEmptyDOMElement();
  });
});

describe('LatestStories', () => {
  it('should link the section heading to the full archive', () => {
    renderWithIntl(<LatestStories stories={makeStories(2)} />);

    expect(screen.getByRole('link', { name: /Ver todas/ })).toHaveAttribute(
      'href',
      '/pt-BR/news',
    );
  });

  it('should render nothing when there are no stories left', () => {
    const { container } = renderWithIntl(<LatestStories stories={[]} />);

    expect(container).toBeEmptyDOMElement();
  });
});

describe('CategorySection', () => {
  const section = {
    category: 'SPORTS' as Category,
    stories: makeStories(3),
  };

  it('should point "view all" at the URL the editorial nav already uses', () => {
    renderWithIntl(<CategorySection section={section} />);

    expect(
      screen.getByRole('link', { name: /Ver tudo em Esportes/ }),
    ).toHaveAttribute('href', '/pt-BR/news?category=SPORTS');
  });

  it('should give the first story the lead treatment and list the rest', () => {
    renderWithIntl(<CategorySection section={section} />);

    // Só o lead tem imagem; os demais são cards horizontais com miniatura.
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
  });

  it('should render the lead alone when the category has a single story', () => {
    renderWithIntl(
      <CategorySection section={{ ...section, stories: makeStories(1) }} />,
    );

    expect(screen.queryByRole('list')).toBeNull();
    expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent(
      'Matéria 1',
    );
  });

  it('should render nothing when the category has no stories', () => {
    const { container } = renderWithIntl(
      <CategorySection section={{ ...section, stories: [] }} />,
    );

    expect(container).toBeEmptyDOMElement();
  });
});
