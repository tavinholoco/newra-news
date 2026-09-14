import { describe, it, expect } from 'vitest';
import { screen, within } from '@testing-library/react';
import { DonutChart } from '@/components/dashboard/donut-chart';
import { SeriesBars } from '@/components/dashboard/series-bars';
import { SaturationArc } from '@/components/dashboard/saturation-arc';
import { CHART_COLORS, chartColor } from '@/components/dashboard/chart-colors';
import { renderWithIntl } from '@/tests/utils';

/**
 * Os três desenhos da Fase 5 do plano de observabilidade (§4.3), cada um pela
 * regra que o plano escreveu para ele — e pela armadilha que a regra evita.
 */

describe('DonutChart', () => {
  it('draws one arc per slice with a legend carrying value and percentage', () => {
    renderWithIntl(
      <DonutChart
        label='Notícias por categoria'
        slices={[
          { key: 'WORLD', label: 'Mundo', value: 3484 },
          { key: 'TECH', label: 'Tecnologia', value: 345 },
          { key: 'ECON', label: 'Economia', value: 128 },
        ]}
      />,
    );

    const svg = screen.getByRole('img', { name: 'Notícias por categoria' });
    expect(svg.querySelectorAll('circle')).toHaveLength(3);

    // Cor sozinha não codifica informação: a legenda tem o valor e a parte.
    const legend = screen.getByRole('list');
    const items = within(legend).getAllByRole('listitem').map((li) => li.textContent);
    expect(items).toEqual(['Mundo3.48488%', 'Tecnologia3459%', 'Economia1283%']);
  });

  it('sorts by value unless told to keep the order — fixed slices keep their color', () => {
    const slices = [
      { key: 'upstream', label: 'upstream', value: 2 },
      { key: 'database', label: 'database', value: 0 },
      { key: 'authorization', label: 'authorization', value: 40 },
    ];

    const { unmount } = renderWithIntl(<DonutChart label='a' slices={slices} />);
    expect(screen.getAllByRole('listitem').map((li) => li.textContent?.slice(0, 5))).toEqual([
      'autho',
      'upstr',
      'datab',
    ]);
    unmount();

    renderWithIntl(<DonutChart label='b' slices={slices} keepOrder />);
    expect(screen.getAllByRole('listitem').map((li) => li.textContent?.slice(0, 5))).toEqual([
      'upstr',
      'datab',
      'autho',
    ]);
  });

  it('draws a single 100% slice as a full circle, without stroke-dasharray', () => {
    // Armadilha 15 do §17: `stroke-dasharray` com o arco inteiro não desenha
    // em alguns navegadores. Uma fatia só é o círculo sem recorte.
    renderWithIntl(
      <DonutChart
        label='IA utilizada'
        slices={[
          { key: 'gemini', label: 'Gemini', value: 7 },
          { key: 'groq', label: 'Groq', value: 0 },
        ]}
      />,
    );

    const circles = screen.getByRole('img', { name: 'IA utilizada' }).querySelectorAll('circle');
    expect(circles).toHaveLength(1);
    expect(circles[0]?.getAttribute('stroke-dasharray')).toBeNull();
    // A fatia em zero continua na legenda: a parte dela é 0%, e isso é dado.
    expect(screen.getByText('Groq')).toBeInTheDocument();
    expect(screen.getByText('0%')).toBeInTheDocument();
  });

  it('shows the empty state — the same one as CategoryBars by default', () => {
    const { unmount } = renderWithIntl(
      <DonutChart label='x' slices={[{ key: 'a', label: 'A', value: 0 }]} />,
    );
    expect(screen.getByText('Sem dados no período.')).toBeInTheDocument();
    expect(screen.queryByRole('img')).toBeNull();
    unmount();

    renderWithIntl(<DonutChart label='x' slices={[]} emptyText='Nenhuma falha.' />);
    expect(screen.getByText('Nenhuma falha.')).toBeInTheDocument();
  });

  it('puts the number that matters in the middle', () => {
    renderWithIntl(
      <DonutChart
        label='x'
        slices={[{ key: 'a', label: 'A', value: 1 }, { key: 'b', label: 'B', value: 1 }]}
        center={{ value: '2', caption: 'total' }}
      />,
    );

    const svg = screen.getByRole('img', { name: 'x' });
    expect(svg.textContent).toContain('2');
    expect(svg.textContent).toContain('total');
  });
});

describe('SeriesBars', () => {
  it('keeps the order it was given and names every bar for a screen reader', () => {
    renderWithIntl(
      <SeriesBars
        label='Sessões por dia'
        points={[
          { key: '2026-09-03', label: '03 de set.', value: 5 },
          { key: '2026-09-01', label: '01 de set.', value: 20 },
          { key: '2026-09-02', label: '02 de set.', value: 10 },
        ]}
      />,
    );

    const list = screen.getByRole('list', { name: 'Sessões por dia' });
    const items = within(list).getAllByRole('listitem');
    // Ordem dada, não ordem de valor — é o que separa esta série do CategoryBars.
    expect(items.map((li) => li.textContent)).toEqual([
      '03 de set.: 5',
      '01 de set.: 20',
      '02 de set.: 10',
    ]);

    const heights = items.map((li) => (li.querySelector('div') as HTMLElement).style.height);
    expect(heights).toEqual(['25%', '100%', '50%']);
  });

  it('shows the empty state when there is nothing, or when everything is zero', () => {
    const { unmount } = renderWithIntl(<SeriesBars label='x' points={[]} />);
    expect(screen.getByText('Sem dados no período.')).toBeInTheDocument();
    unmount();

    renderWithIntl(<SeriesBars label='x' points={[{ key: 'a', label: 'a', value: 0 }]} />);
    expect(screen.getByText('Sem dados no período.')).toBeInTheDocument();
  });
});

describe('SaturationArc', () => {
  it('names the measure, the percentage and the value', () => {
    renderWithIntl(
      <SaturationArc
        ratio={0.4067}
        label='Horas do plano'
        value='305 h / 750 h'
        unavailableText='Indisponível'
      />,
    );

    expect(
      screen.getByRole('img', { name: 'Horas do plano: 41% (305 h / 750 h)' }),
    ).toBeInTheDocument();
    expect(screen.getByText('305 h / 750 h')).toBeInTheDocument();
  });

  it('draws "unavailable" for a null ratio — never zero', () => {
    // A verificação pós-merge do 5b: `saturation.plan` é `null` com o banco
    // fora, e zero diria que o mês está folgado justamente quando não há como
    // saber.
    renderWithIntl(
      <SaturationArc ratio={null} label='Horas do plano' value={null} unavailableText='Indisponível' />,
    );

    const svg = screen.getByRole('img', { name: 'Horas do plano: Indisponível' });
    expect(svg.querySelectorAll('circle')).toHaveLength(1); // só o trilho
    expect(svg.textContent).toContain('—');
    expect(svg.textContent).not.toContain('0%');
    expect(screen.getByText('Indisponível')).toBeInTheDocument();
  });

  it('changes the accent by tone: neutral, then orange, then red past the ceiling', () => {
    const fill = (ratio: number) => {
      const { unmount } = renderWithIntl(
        <SaturationArc ratio={ratio} label='x' value='v' unavailableText='—' />,
      );
      const circles = screen.getByRole('img').querySelectorAll('circle');
      const className = circles[1]?.getAttribute('class') ?? '';
      unmount();
      return className;
    };

    expect(fill(0.41)).toContain('stroke-chart-4');
    expect(fill(0.85)).toContain('stroke-brand-accent');
    expect(fill(1.04)).toContain('stroke-danger');
  });

  it('caps the fill at the ceiling while the number keeps going', () => {
    renderWithIntl(
      <SaturationArc ratio={1.04} label='x' value='780 h / 750 h' unavailableText='—' />,
    );

    const circles = screen.getByRole('img').querySelectorAll('circle');
    const track = circles[0]?.getAttribute('stroke-dasharray')?.split(' ')[0];
    const filled = circles[1]?.getAttribute('stroke-dasharray')?.split(' ')[0];
    expect(filled).toBe(track);
    expect(screen.getByRole('img').textContent).toContain('104%');
  });
});

describe('chart-colors', () => {
  it('repeats the five token colors from the sixth slice on', () => {
    expect(CHART_COLORS).toHaveLength(5);
    expect(chartColor(5)).toBe(CHART_COLORS[0]);
    expect(chartColor(7)).toBe(CHART_COLORS[2]);
  });
});
