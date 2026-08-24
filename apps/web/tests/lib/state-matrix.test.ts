import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

/**
 * **A matriz de estado da §10.4, como guarda e não como tabela.**
 *
 * A pergunta que abriu o eixo era simples e ninguém sabia responder sem abrir o
 * componente: *o que cada uma das 15 telas mostra enquanto carrega, quando
 * falha, quando não há nada, e quando o endereço não existe?* Seis rotas têm
 * `loading.tsx`/`error.tsx` e nove não têm — e **a ausência pode estar certa**:
 * se o componente desenha o próprio esqueleto e o próprio erro, a fronteira de
 * rota seria redundante.
 *
 * O que não podia continuar é a resposta não estar escrita em lugar nenhum. Ela
 * está aqui, e como asserção: **tela que promete esqueleto e não desenha
 * esqueleto reprova**. Tabela em Markdown envelhece em silêncio; esta não.
 */

const WEB_ROOT = process.cwd();
const APP = path.resolve(WEB_ROOT, 'app/[locale]');

type Onde =
  | 'rota' // arquivo loading.tsx / error.tsx / not-found.tsx do segmento
  | 'componente' // o próprio componente desenha
  | 'servidor' // resolvido antes de renderizar (redirect, notFound)
  | 'n/a'; // o estado não existe nesta tela, e há motivo

interface Linha {
  /** Segmento sob `app/[locale]`; `''` é a Home. */
  segmento: string;
  carregando: Onde;
  erro: Onde;
  vazio: Onde;
  naoEncontrado: Onde;
  /** Onde o estado mora, quando não é arquivo de rota. */
  nota: string;
}

/**
 * As quinze rotas. **A ordem das colunas é a da §10.4**: carregando, erro,
 * vazio, não encontrado.
 */
const MATRIZ: Linha[] = [
  {
    segmento: '',
    carregando: 'rota',
    erro: 'rota',
    vazio: 'componente',
    naoEncontrado: 'rota',
    nota: 'a Home vazia é estado normal (dia sem briefing) e tem título e texto próprios; sem `catch` no `getHome`, falha de API mantém a página anterior no ar',
  },
  {
    segmento: 'news',
    carregando: 'rota',
    erro: 'rota',
    vazio: 'componente',
    naoEncontrado: 'n/a',
    nota: 'NewsListSkeleton + NewsEmptyState; a rota não tem id para não encontrar',
  },
  {
    segmento: 'news/[id]',
    carregando: 'rota',
    erro: 'n/a',
    vazio: 'n/a',
    naoEncontrado: 'rota',
    nota: 'detalhe existe ou não existe; erro sobe para o boundary de [locale]',
  },
  {
    segmento: 'article',
    carregando: 'rota',
    erro: 'rota',
    vazio: 'componente',
    naoEncontrado: 'n/a',
    nota: 'ArticlePageClient desenha erro e vazio do histórico',
  },
  {
    segmento: 'article/[date]',
    carregando: 'rota',
    erro: 'n/a',
    vazio: 'n/a',
    naoEncontrado: 'rota',
    nota: 'mesma forma da /news/[id]',
  },
  {
    segmento: 'favorites',
    carregando: 'componente',
    erro: 'componente',
    vazio: 'componente',
    naoEncontrado: 'n/a',
    nota: 'favorites-list tem Skeleton, role=alert e estado vazio; a rota é force-dynamic e redireciona sem sessão',
  },
  {
    segmento: 'account',
    carregando: 'componente',
    erro: 'componente',
    vazio: 'n/a',
    naoEncontrado: 'n/a',
    nota: 'profile-card: Skeleton + role=alert. Conta sempre tem perfil',
  },
  {
    segmento: 'account/preferences',
    carregando: 'componente',
    erro: 'componente',
    vazio: 'n/a',
    naoEncontrado: 'n/a',
    nota: 'preferences-form: Skeleton + role=alert',
  },
  {
    segmento: 'account/newsletter',
    carregando: 'componente',
    erro: 'componente',
    vazio: 'n/a',
    naoEncontrado: 'n/a',
    nota: 'newsletter-settings: Skeleton + role=alert',
  },
  {
    segmento: 'admin',
    carregando: 'componente',
    erro: 'componente',
    vazio: 'n/a',
    naoEncontrado: 'n/a',
    nota: 'admin-panel: Skeleton na lista e role=alert no disparo do pipeline',
  },
  {
    segmento: 'admin/metrics',
    carregando: 'rota',
    erro: 'rota',
    vazio: 'componente',
    naoEncontrado: 'n/a',
    nota: 'dashboard-client e product-metrics-client desenham DashboardSkeleton e role=alert por conta própria',
  },
  {
    segmento: 'newsletter',
    carregando: 'n/a',
    erro: 'componente',
    vazio: 'n/a',
    naoEncontrado: 'n/a',
    nota: 'landing estática; o único estado é o erro de submissão do subscribe-form',
  },
  {
    segmento: 'newsletter/unsubscribe',
    carregando: 'n/a',
    erro: 'servidor',
    vazio: 'n/a',
    naoEncontrado: 'n/a',
    nota: 'três desfechos resolvidos no servidor — cancelado, token inválido e API indisponível',
  },
  {
    segmento: 'about',
    carregando: 'n/a',
    erro: 'n/a',
    vazio: 'n/a',
    naoEncontrado: 'n/a',
    nota: 'estática pura: não busca dado nenhum, e é por isso que mede 87,5 kB de first-load',
  },
  {
    segmento: 'signin',
    carregando: 'componente',
    erro: 'componente',
    vazio: 'n/a',
    naoEncontrado: 'n/a',
    nota: 'sign-in-form: estado de envio no botão e erro do provedor vindo da query string',
  },
];

function pageSegments(): string[] {
  const found: string[] = [];

  function walk(dir: string) {
    for (const entry of readdirSync(dir)) {
      const full = path.join(dir, entry);
      if (statSync(full).isDirectory()) walk(full);
      else if (entry === 'page.tsx') {
        found.push(path.relative(APP, dir).replace(/\\/g, '/').replace(/^\.$/, ''));
      }
    }
  }

  walk(APP);
  return found;
}

const SEGMENTOS = pageSegments();

describe('a matriz de estado das rotas', () => {
  it('a matriz cobre exatamente as rotas que existem', () => {
    // O modo de falha de uma matriz é envelhecer: rota nova que ninguém
    // acrescenta aqui é justamente a que não teve o estado decidido.
    expect(SEGMENTOS.sort()).toEqual(MATRIZ.map((l) => l.segmento).sort());
    expect(MATRIZ).toHaveLength(15);
  });

  it('toda linha que diz `n/a` explica por quê', () => {
    const semNota = MATRIZ.filter(
      (linha) =>
        [linha.carregando, linha.erro, linha.vazio, linha.naoEncontrado].includes('n/a') &&
        linha.nota.trim().length < 20,
    ).map((l) => l.segmento || '(home)');

    expect(semNota).toEqual([]);
  });

  it('quem promete `rota` tem o arquivo, e quem não promete não tem', () => {
    const arquivo = { carregando: 'loading.tsx', erro: 'error.tsx', naoEncontrado: 'not-found.tsx' } as const;

    const divergencias: string[] = [];
    for (const linha of MATRIZ) {
      const dir = path.join(APP, linha.segmento);
      for (const [coluna, nome] of Object.entries(arquivo)) {
        const prometido = linha[coluna as keyof typeof arquivo] === 'rota';
        const existe = existsSync(path.join(dir, nome));
        if (prometido !== existe) {
          divergencias.push(
            `${linha.segmento || '(home)'}: ${nome} ${existe ? 'existe' : 'não existe'}, matriz diz "${linha[coluna as keyof typeof arquivo]}"`,
          );
        }
      }
    }

    expect(divergencias).toEqual([]);
  });

  it('quem promete `componente` desenha esqueleto e erro no próprio componente', () => {
    // A prova é fraca de propósito — procura por `Skeleton`/`animate-pulse` e
    // por `role='alert'`/`loadError` nos componentes do segmento. O que ela
    // impede é a regressão silenciosa: componente que perde o esqueleto numa
    // refatoração e passa a piscar em branco.
    const COMPONENTES: Record<string, string[]> = {
      favorites: ['components/favorites/favorites-list.tsx'],
      account: ['components/account/profile-card.tsx'],
      'account/preferences': ['components/account/preferences-form.tsx'],
      'account/newsletter': ['components/account/newsletter-settings.tsx'],
      admin: ['components/admin/admin-panel.tsx'],
      'admin/metrics': [
        'components/dashboard/dashboard-client.tsx',
        'components/dashboard/product-metrics-client.tsx',
      ],
      news: ['components/news/news-page-client.tsx'],
      article: ['components/article/article-page-client.tsx'],
    };

    const faltando: string[] = [];
    for (const [segmento, arquivos] of Object.entries(COMPONENTES)) {
      const linha = MATRIZ.find((l) => l.segmento === segmento);
      const fonte = arquivos
        .map((f) => readFileSync(path.resolve(WEB_ROOT, f), 'utf8'))
        .join('\n');

      if (linha?.carregando === 'componente' && !/Skeleton|animate-pulse/.test(fonte)) {
        faltando.push(`${segmento}: promete esqueleto e não desenha`);
      }
      if (linha?.erro === 'componente' && !/role='alert'|loadError|isError/.test(fonte)) {
        faltando.push(`${segmento}: promete erro e não desenha`);
      }
    }

    expect(faltando).toEqual([]);
  });

  it('o caminho de "não encontrada" é `noindex`, e é ele que segura o soft 404', () => {
    /**
     * **Medido na revisão 10.4, em produção e local:** `notFound()` dentro de
     * uma rota com `revalidate` e `not-found.tsx` **aninhado** responde
     * **HTTP 200**, não 404. A tela certa aparece — `<title>Notícia não
     * encontrada</title>` —, mas o status mente. Conferido que não é o
     * middleware: `/pt-BR/rota-que-nao-existe` passa pela mesma reescrita do
     * `next-intl` e responde 404 corretamente; o que perde o status é o
     * `not-found.tsx` de segmento. Só é corrigido no Next 15, e por isso a
     * dívida é a mesma das advisories.
     *
     * **O que impede o estrago é o `noindex` no `generateMetadata` do caminho
     * de falta** — sem ele, o buscador indexaria a página de "não encontrada"
     * sob toda URL digitada errada. Ou seja: a mitigação inteira mora numa
     * linha que ninguém lembraria de manter. Esta é a linha.
     */
    const rotas = ['news/[id]', 'article/[date]'];

    const semNoindex = rotas.filter((segmento) => {
      const source = readFileSync(path.join(APP, segmento, 'page.tsx'), 'utf8');
      // O bloco de metadata do caso ausente: `if (!x) return { ... robots ... }`
      return !/if \(!\w+\) \{?\s*return \{[\s\S]{0,220}robots: \{ index: false/.test(source);
    });

    expect(semNoindex).toEqual([]);
  });

  it('as telas atrás de sessão são dinâmicas', () => {
    // `redirect()` de sessão numa página SSG seria assado no HTML estático e
    // valeria para todo mundo. O guard vive no layout do segmento.
    const dinamicas = ['account', 'favorites', 'admin', 'signin'];

    const semForceDynamic = dinamicas.filter((segmento) => {
      const candidatos = [
        path.join(APP, segmento, 'layout.tsx'),
        path.join(APP, segmento, 'page.tsx'),
      ].filter(existsSync);

      return !candidatos.some((f) =>
        /export const dynamic = 'force-dynamic'/.test(readFileSync(f, 'utf8')),
      );
    });

    expect(semForceDynamic).toEqual([]);
  });
});
