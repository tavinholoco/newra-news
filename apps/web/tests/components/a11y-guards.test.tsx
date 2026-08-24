import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { renderWithIntl } from '../utils';
import { SubscribeForm } from '@/components/newsletter/subscribe-form';

/**
 * **Acessibilidade dentro da suíte, no PR — não na segunda de manhã.**
 *
 * O Lighthouse mede a página montada, uma vez por semana, em **cinco** rotas, e
 * dá 100 em todas. Também é verdade que auditoria automática cobre uma fração
 * do WCAG, e que este projeto já reprovou **duas vezes** em `heading-order` —
 * que é justamente do que ela pega. As verificações aqui são as que o
 * Lighthouse não faz porque dependem de **interação** ou de varrer as 15
 * telas, e não as 5 medidas.
 */

const WEB_ROOT = process.cwd();

function collectSources(dirs: string[]): Array<{ file: string; source: string }> {
  const files: Array<{ file: string; source: string }> = [];

  function walk(dir: string) {
    for (const entry of readdirSync(dir)) {
      const full = path.join(dir, entry);
      if (statSync(full).isDirectory()) walk(full);
      else if (/\.tsx$/.test(entry)) {
        files.push({
          file: path.relative(WEB_ROOT, full).replace(/\\/g, '/'),
          source: readFileSync(full, 'utf8')
            .replace(/\/\*[\s\S]*?\*\//g, '')
            .replace(/^\s*\/\/.*$/gm, ''),
        });
      }
    }
  }

  for (const dir of dirs) walk(path.resolve(WEB_ROOT, dir));
  return files;
}

const SOURCES = collectSources(['app', 'components']);

describe('guardas de acessibilidade', () => {
  describe('movimento', () => {
    it('nenhuma rolagem programática ignora `prefers-reduced-motion`', () => {
      /**
       * **A armadilha que a revisão 10.2 mediu.** O `globals.css` derruba
       * animação e `scroll-behavior` sob `prefers-reduced-motion: reduce`, e
       * isso dava a impressão de que a preferência estava respeitada em todo
       * lugar. Mas `scrollTo({ behavior: 'smooth' })` **passa por cima da
       * regra de CSS** — `behavior` explícito no JavaScript vence o
       * `scroll-behavior: auto !important`. As duas listagens paginadas eram
       * exatamente isso, e eram os dois únicos lugares com rolagem
       * programática no produto.
       *
       * A rolagem agora mora em `useResultsFocus`, que lê a preferência em
       * tempo de execução. Chamada solta de `scrollTo` volta a furar.
       */
      const soltas = SOURCES.filter(({ source }) =>
        /window\.scrollTo\(|scrollIntoView\(/.test(source),
      ).map(({ file }) => file);

      expect(soltas).toEqual([]);
    });

    it('a preferência é lida no hook, e não assumida', () => {
      const hook = readFileSync(
        path.resolve(WEB_ROOT, 'lib/use-results-focus.ts'),
        'utf8',
      );

      expect(hook).toContain("matchMedia('(prefers-reduced-motion: reduce)')");
      expect(hook).toContain("behavior: reduzMovimento ? 'auto' : 'smooth'");
    });
  });

  describe('nível de heading', () => {
    /**
     * Componentes de `components/editorial/` que **fixam** um nível de heading,
     * cada um com a razão de poder fazê-lo. Tudo que não está aqui tem de
     * receber o nível por prop.
     *
     * O nível é decisão da **página**, nunca do componente nem do texto: o
     * mesmo card é `h3` na Home (abaixo do `h2` da seção) e pode ser `h2` numa
     * listagem. `heading-order` já reprovou **duas vezes** neste projeto, e as
     * duas por heading fixo.
     */
    const NIVEL_FIXO_PERMITIDO: Record<string, string> = {
      'components/editorial/article-hero.tsx':
        'h1 — é o título da página de leitura, e só existe um por tela',
      'components/editorial/article-body.tsx':
        'h2 — o `###` que a IA escreve sai um nível abaixo do h1 do título; o nível é da página, e a página já decidiu',
      'components/editorial/hero-story.tsx':
        'h2 — a matéria de abertura fica sempre imediatamente sob o h1 da tela, na Home e na /news',
      'components/editorial/briefing-card.tsx':
        'h2 — não é card de grade: é o bloco do briefing na Home, usado num lugar só, e o `aria-labelledby` da `<section>` aponta para ele',
      'components/editorial/newsletter-cta.tsx':
        'h2 — bloco de seção, nunca aninhado em outra seção',
      'components/editorial/trending-list.tsx':
        'h2 — bloco de seção da Home',
      'components/editorial/section-heading.tsx':
        'h2 — é o próprio título de seção, e recebe o `id` de quem o nomeia',
    };

    it('só os componentes com razão declarada fixam o nível', () => {
      const editoriais = SOURCES.filter(({ file }) =>
        file.startsWith('components/editorial/'),
      );

      const fixos = editoriais
        .filter(({ source }) => /<h[1-6][\s>]/.test(source))
        .map(({ file }) => file)
        .sort();

      expect(fixos).toEqual(Object.keys(NIVEL_FIXO_PERMITIDO).sort());
      // A varredura só vale se houver o que varrer.
      expect(editoriais.length).toBeGreaterThan(15);
    });

    it('os cards de grade recebem o nível por prop', () => {
      const cards = SOURCES.filter(({ file }) =>
        /components\/editorial\/story-card/.test(file),
      );

      const semProp = cards
        .filter(({ source }) => !/headingLevel/.test(source))
        .map(({ file }) => file);

      expect(semProp).toEqual([]);
      expect(cards.length).toBe(3);
    });
  });

  describe('foco', () => {
    it('todo alvo de foco por programa declara `tabIndex={-1}`', () => {
      // `element.focus()` num elemento não-focável não faz nada, e não avisa:
      // o efeito seria a paginação rolando e o foco ficando para trás — o
      // defeito que o hook existe para corrigir, de volta em silêncio.
      const comHook = SOURCES.filter(({ source }) =>
        source.includes('useResultsFocus('),
      );

      const semTabIndex = comHook
        .filter(({ source }) => !/tabIndex=\{-1\}/.test(source))
        .map(({ file }) => file);

      expect(semTabIndex).toEqual([]);
      expect(comHook.length).toBe(2);
    });

    it('a região de resultados tem nome acessível', () => {
      // Uma `region` sem nome não é anunciada como região nenhuma — o foco
      // pousaria num contêiner mudo e a pessoa não saberia o que mudou.
      const comHook = SOURCES.filter(({ source }) =>
        source.includes('useResultsFocus('),
      );

      const semNome = comHook
        .filter(({ source }) => !/aria-labelledby=\{countId\}/.test(source))
        .map(({ file }) => file);

      expect(semNome).toEqual([]);
    });
  });

  describe('erro de formulário', () => {
    beforeEach(() => {
      vi.restoreAllMocks();
    });

    it('a mensagem é anunciada **e** fica amarrada ao campo', async () => {
      /**
       * `role='alert'` anuncia a mensagem **uma vez**, quando ela aparece —
       * era só isso que existia. Quem volta ao campo para corrigir ouvia
       * "e-mail, entrada inválida" e mais nada: `aria-invalid` diz *que* está
       * errado, e nada dizia *o quê*. `aria-describedby` é o que faz a
       * mensagem ser lida toda vez que o foco entra ali.
       */
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('falhou')));
      const user = userEvent.setup();

      renderWithIntl(<SubscribeForm origin='footer' />);

      const campo = screen.getByRole('textbox');
      await user.type(campo, 'leitor@exemplo.com');
      await user.click(screen.getByRole('button'));

      const alerta = await screen.findByRole('alert');

      await waitFor(() => {
        expect(campo).toHaveAttribute('aria-invalid', 'true');
      });
      expect(campo).toHaveAttribute('aria-describedby', alerta.id);
      expect(alerta.id).not.toBe('');
    });

    it('sem erro, o campo não aponta para descrição nenhuma', () => {
      // `aria-describedby` apontando para um id que não está no DOM faz o
      // leitor de tela ler a referência quebrada como silêncio — ou, em alguns,
      // como o id cru.
      renderWithIntl(<SubscribeForm origin='footer' />);

      expect(screen.getByRole('textbox')).not.toHaveAttribute('aria-describedby');
    });

    it('duas instâncias na mesma página não compartilham a descrição', async () => {
      /**
       * O formulário aparece no **rodapé** e no **CTA editorial**, então há
       * duas instâncias na mesma página. Com um id fixo, o
       * `aria-describedby` do segundo campo apontaria para a mensagem de erro
       * do primeiro — e o leitor de tela leria, no campo que está certo, o
       * erro do outro.
       *
       * O que prova o isolamento é errar **um** e o outro continuar sem
       * descrição nenhuma.
       */
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('falhou')));
      const user = userEvent.setup();

      renderWithIntl(
        <>
          <SubscribeForm origin='footer' />
          <SubscribeForm origin='article-cta' />
        </>,
      );

      const [rodape, cta] = screen.getAllByRole('textbox');
      await user.type(rodape as HTMLElement, 'leitor@exemplo.com');
      await user.click(screen.getAllByRole('button')[0] as HTMLElement);

      const alerta = await screen.findByRole('alert');

      expect(rodape).toHaveAttribute('aria-describedby', alerta.id);
      expect(cta).not.toHaveAttribute('aria-describedby');
    });
  });
});
