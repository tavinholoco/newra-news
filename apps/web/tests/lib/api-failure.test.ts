import { describe, it, expect, vi, afterEach } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import {
  ApiError,
  fetchApi,
  nullIfNotFound,
  nullUnlessPublishing,
  prefetch,
} from '@/lib/api';

/**
 * **"A API disse que não" × "a API não respondeu".**
 *
 * A revisão 10.4 auditou os pontos onde uma falha vira tela e achou quatro
 * lugares colapsando as duas coisas na resposta pessimista — porque
 * `fetchApi` lançava um `Error` de texto corrido e não havia como perguntar.
 * O caro não era o erro em si, era o que a tela **afirmava** depois dele: a
 * Home dizendo que não houve notícia (e a ISR guardando isso por uma hora), o
 * detalhe chamando `notFound()` numa matéria que existe, e o cancelamento da
 * newsletter dizendo "link inválido" para quem só pegou a API dormindo.
 *
 * É a mesma lição do `prefetch`, que este projeto pagou uma vez em produção:
 * **valor vazio é uma afirmação, e "não deu" não é.**
 */

const WEB_ROOT = process.cwd();

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('ApiError', () => {
  it('resposta de erro carrega o status', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 404, statusText: 'Not Found' }),
    );

    const erro = await fetchApi('/news/nao-existe').catch((e: unknown) => e);

    expect(erro).toBeInstanceOf(ApiError);
    expect((erro as ApiError).status).toBe(404);
    expect((erro as ApiError).isNotFound).toBe(true);
    expect((erro as ApiError).isUnreachable).toBe(false);
  });

  it('falha de transporte não tem status, e não é 404', async () => {
    // É o caso do plano free do Render hibernando, e é justamente ele que
    // virava "não existe" nas telas de detalhe.
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('fetch failed')));

    const erro = (await fetchApi('/news/uuid').catch((e: unknown) => e)) as ApiError;

    expect(erro).toBeInstanceOf(ApiError);
    expect(erro.status).toBeNull();
    expect(erro.isUnreachable).toBe(true);
    expect(erro.isNotFound).toBe(false);
    // A causa original sobrevive para o log do servidor.
    expect(erro.cause).toBeInstanceOf(TypeError);
  });

  it('500 não é 404 nem indisponível — a API respondeu, e respondeu errado', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 500, statusText: 'Server Error' }),
    );

    const erro = (await fetchApi('/home').catch((e: unknown) => e)) as ApiError;

    expect(erro.isNotFound).toBe(false);
    expect(erro.isUnreachable).toBe(false);
  });
});

describe('nullIfNotFound', () => {
  it('devolve null quando o recurso não existe', () => {
    expect(nullIfNotFound(new ApiError('nao existe', 404))).toBeNull();
  });

  it('devolve null quando o identificador nem é válido', () => {
    // Medido contra a API: id fora do formato UUID devolve **400** com o erro
    // do Zod, não 404. `/news/banana` não é uma matéria — mandar isso para a
    // página de erro responderia 200 dizendo "algo deu errado" onde o certo é
    // "não encontrada", e o buscador leria o mesmo.
    expect(nullIfNotFound(new ApiError('uuid invalido', 400))).toBeNull();
  });

  it('relança indisponibilidade — senão a tela diria "não encontrada"', () => {
    expect(() => nullIfNotFound(new ApiError('sem resposta', null))).toThrow(ApiError);
    expect(() => nullIfNotFound(new ApiError('erro', 500))).toThrow(ApiError);
    expect(() => nullIfNotFound(new Error('outro erro qualquer'))).toThrow();
  });
});

describe('prefetch', () => {
  it('continua falhando em `undefined`, nunca em valor vazio', async () => {
    // A regra que a `/news` ensinou em produção. Está aqui de novo porque o
    // `ApiError` mexeu no que é lançado, e a promessa do `prefetch` é sobre o
    // que ele **devolve**.
    await expect(prefetch(Promise.reject(new ApiError('x', null)))).resolves.toBeUndefined();
    await expect(prefetch(Promise.resolve({ data: [] }))).resolves.toEqual({ data: [] });
  });
});

describe('nullUnlessPublishing', () => {
  /**
   * **"Build" não é uma coisa só, e o CI foi quem ensinou isso.** A primeira
   * versão desta correção simplesmente não capturava a falha do `getHome`, e o
   * job Build reprovou com `ECONNREFUSED` — porque ele roda **sem API de
   * propósito**, como o `CLAUDE.md` afirma para `lint`, `typecheck` e `build`.
   * O build da Vercel é o outro caso: ele recebe a URL da API e produz o que
   * vai ao ar, e ali falhar é o comportamento desejado.
   */
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('devolve null quando nada será publicado — é o build do CI', async () => {
    vi.stubEnv('VERCEL', '');

    await expect(
      nullUnlessPublishing(Promise.reject(new ApiError('sem resposta', null))),
    ).resolves.toBeNull();
  });

  it('relança onde o resultado é publicado', async () => {
    // Vale para o build da Vercel **e** para a revalidação da ISR em runtime —
    // e é o segundo que mais importa, porque é o único que acontece com gente
    // lendo: a exceção mantém a última página boa no ar.
    vi.stubEnv('VERCEL', '1');

    await expect(
      nullUnlessPublishing(Promise.reject(new ApiError('sem resposta', null))),
    ).rejects.toBeInstanceOf(ApiError);
  });

  it('não interfere no caminho feliz', async () => {
    vi.stubEnv('VERCEL', '1');

    await expect(nullUnlessPublishing(Promise.resolve({ hero: null }))).resolves.toEqual({
      hero: null,
    });
  });
});

describe('a guarda: nenhum `catch` volta a afirmar o pessimista', () => {
  /**
   * Comentário fora. O `app/[locale]/page.tsx` **explica** o padrão que a
   * guarda proíbe — ele cita o `.catch(() => null)` que havia ali —, e sem
   * isto a varredura reprovaria a própria explicação.
   */
  function stripComments(source: string): string {
    return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  }

  function collect(dir: string, out: Array<{ file: string; source: string }> = []) {
    for (const entry of readdirSync(dir)) {
      const full = path.join(dir, entry);
      if (statSync(full).isDirectory()) collect(full, out);
      else if (/\.tsx?$/.test(entry)) {
        out.push({
          file: path.relative(WEB_ROOT, full).replace(/\\/g, '/'),
          source: stripComments(readFileSync(full, 'utf8')),
        });
      }
    }
    return out;
  }

  const PAGINAS = collect(path.resolve(WEB_ROOT, 'app/[locale]'));

  it('nenhuma página troca uma falha por `null` sem olhar o motivo', () => {
    /**
     * `.catch(() => null)` numa página é o padrão exato dos dois 404 falsos.
     * O substituto é `nullIfNotFound`, que devolve `null` só no 404 real e
     * relança o resto — e relançar é o que faz a ISR manter a página boa no ar
     * em vez de assar a errada.
     */
    const pessimistas = PAGINAS.filter(({ source }) =>
      /\.catch\(\s*\(\)\s*=>\s*(null|\{|\[)/.test(source),
    ).map(({ file }) => file);

    expect(pessimistas).toEqual([]);
  });

  it('quem chama `notFound()` passou por `nullIfNotFound`', () => {
    // So conta quem chama a API: o `notFound()` do `layout.tsx` e para locale
    // fora de `routing.locales`, que nao passa por rede nenhuma.
    const semTriagem = PAGINAS.filter(
      ({ source }) =>
        source.includes('notFound()') &&
        /from '@\/lib\/api'/.test(source) &&
        !source.includes('nullIfNotFound'),
    ).map(({ file }) => file);

    expect(semTriagem).toEqual([]);
  });

  it('a Home não engole a falha do `getHome` onde ela é publicada', () => {
    // Era `.catch(() => null)`, e o efeito não era degradar: era **afirmar**
    // que não houve notícia, e guardar essa afirmação por uma hora.
    const home = readFileSync(path.resolve(WEB_ROOT, 'app/[locale]/page.tsx'), 'utf8');

    expect(home).toContain('nullUnlessPublishing(getHome())');
    expect(home).not.toMatch(/getHome\(\)\s*\.catch/);
  });
});
