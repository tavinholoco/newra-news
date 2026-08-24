import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  REQUIRED_HEADERS,
  apiOrigin,
  contentSecurityPolicy,
  securityHeaders,
} from '@/lib/security-headers';

/**
 * A guarda do 10.S: **o site tem cabeçalho de defesa, e ele não some sozinho.**
 *
 * Antes desta fase, a `vercel.app` respondia sem `x-content-type-options`, sem
 * `x-frame-options`, sem `referrer-policy`, sem `cross-origin-opener-policy` e
 * sem CSP — medido em produção em 23/08/2026, enquanto a API tinha o conjunto
 * inteiro. O que torna esse defeito reincidente é que **nada acusa**: sem
 * `headers()` o build passa, o lint passa, a suíte passa e as 15 páginas
 * renderizam igual. Só um `curl -I` conta.
 *
 * Por isso a asserção é sobre a **presença de cada diretiva**, e não sobre a
 * string inteira: a política pode evoluir, mas `object-src` não pode
 * desaparecer sem alguém decidir que ela vai.
 */

const WEB_ROOT = process.cwd();

function parseCsp(policy: string): Map<string, string[]> {
  return new Map(
    policy
      .split(';')
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const [name, ...values] = part.split(/\s+/);
        return [name ?? '', values] as [string, string[]];
      }),
  );
}

const PRODUCTION = {
  apiUrl: 'https://newra-news-api.onrender.com/api',
  isProduction: true,
  isVercelPreview: false,
};

describe('cabeçalhos de segurança do site', () => {
  it('o next.config.js usa a lista deste módulo, e não uma cópia', () => {
    // Uma segunda lista escrita no `next.config.js` passaria neste arquivo
    // inteiro sem nunca chegar numa resposta. O que prova o vínculo é o
    // config importar a função — a guarda testa a fonte que o build lê.
    const config = readFileSync(path.resolve(WEB_ROOT, 'next.config.js'), 'utf8');

    expect(config).toContain("require('./lib/security-headers')");
    expect(config).toContain('securityHeaders()');
    expect(config).toMatch(/async headers\(\)/);
  });

  it('todo cabeçalho obrigatório sai, e com valor', () => {
    const headers = securityHeaders({ ...process.env, NODE_ENV: 'production' });
    const byKey = new Map(headers.map((h) => [h.key, h.value]));

    const faltando = REQUIRED_HEADERS.filter((key) => !byKey.get(key));
    expect(faltando).toEqual([]);
  });

  it('os valores fixos são os esperados', () => {
    const byKey = new Map(
      securityHeaders({ ...process.env, NODE_ENV: 'production' }).map((h) => [
        h.key,
        h.value,
      ]),
    );

    expect(byKey.get('X-Content-Type-Options')).toBe('nosniff');
    expect(byKey.get('X-Frame-Options')).toBe('DENY');
    expect(byKey.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
    expect(byKey.get('Cross-Origin-Opener-Policy')).toBe('same-origin');
    // Permissions-Policy sem `=()` não desliga nada — seria cabeçalho de
    // enfeite. A asserção é sobre a forma que de fato nega.
    expect(byKey.get('Permissions-Policy')).toMatch(/camera=\(\)/);
    expect(byKey.get('Permissions-Policy')).toMatch(/microphone=\(\)/);
    expect(byKey.get('Permissions-Policy')).toMatch(/geolocation=\(\)/);
  });

  describe('a CSP de produção', () => {
    const csp = parseCsp(contentSecurityPolicy(PRODUCTION));

    it('declara as diretivas que fecham porta sem depender de inline', () => {
      expect(csp.get('default-src')).toEqual(["'self'"]);
      expect(csp.get('object-src')).toEqual(["'none'"]);
      expect(csp.get('base-uri')).toEqual(["'self'"]);
      expect(csp.get('frame-ancestors')).toEqual(["'none'"]);
      expect(csp.get('form-action')).toEqual(["'self'"]);
      expect(csp.get('frame-src')).toEqual(["'none'"]);
    });

    it('nenhuma diretiva aceita host curinga', () => {
      // `https:` ou `*` em `script-src` devolveria justamente o que a política
      // existe para tirar: um `<script src>` injetado voltaria a executar.
      const curinga = [...csp.entries()]
        .filter(([, values]) => values.some((v) => v === '*' || v === 'https:' || v === 'http:'))
        .map(([name]) => name);

      expect(curinga).toEqual([]);
    });

    it('o script inline é permitido, e o script de host externo não', () => {
      // A dupla é a decisão escrita em `lib/security-headers.js`: os 61 chunks
      // de Flight do App Router não são hasháveis e o nonce tornaria as 15
      // páginas dinâmicas. Se um dia o `'unsafe-inline'` sair daqui, é porque
      // alguém resolveu o problema — e este teste é onde a decisão aparece.
      const scriptSrc = csp.get('script-src') ?? [];

      expect(scriptSrc).toContain("'self'");
      expect(scriptSrc).toContain("'unsafe-inline'");
      expect(scriptSrc).not.toContain("'unsafe-eval'");
      expect(scriptSrc.filter((v) => v.startsWith('http'))).toEqual([]);
    });

    it('o `connect-src` alcança a API, porque o navegador fala com ela direto', () => {
      // Sem isto, toda consulta do TanStack Query depois da hidratação seria
      // bloqueada: a `/news` filtrada, as facetas, o briefing. O sintoma seria
      // a tela travada no esqueleto — em produção, e só em produção.
      expect(csp.get('connect-src')).toContain('https://newra-news-api.onrender.com');
      expect(csp.get('connect-src')).not.toContain('ws:');
    });

    it('a imagem é só same-origin, porque tudo passa pelo otimizador', () => {
      expect(csp.get('img-src')).toEqual(["'self'", 'data:', 'blob:']);
    });

    it('força HTTPS', () => {
      expect(contentSecurityPolicy(PRODUCTION)).toContain('upgrade-insecure-requests');
    });
  });

  describe('fora de produção', () => {
    it('o dev ganha `unsafe-eval` e WebSocket, e produção não', () => {
      // O webpack de desenvolvimento compila com `eval` e o HMR fala por
      // WebSocket. Sem a distinção, ou o `next dev` quebra ou produção afrouxa.
      const dev = parseCsp(
        contentSecurityPolicy({ ...PRODUCTION, isProduction: false }),
      );

      expect(dev.get('script-src')).toContain("'unsafe-eval'");
      expect(dev.get('connect-src')).toContain('ws:');
      expect(contentSecurityPolicy({ ...PRODUCTION, isProduction: false })).not.toContain(
        'upgrade-insecure-requests',
      );
    });

    it('a barra da Vercel só é liberada em preview', () => {
      const preview = parseCsp(
        contentSecurityPolicy({ ...PRODUCTION, isVercelPreview: true }),
      );

      expect(preview.get('script-src')).toContain('https://vercel.live');
      expect(preview.get('frame-src')).toContain('https://vercel.live');

      const producao = parseCsp(contentSecurityPolicy(PRODUCTION));
      expect(producao.get('script-src')).not.toContain('https://vercel.live');
    });
  });

  describe('a origem da API', () => {
    it('descarta o caminho e fica com a origem', () => {
      expect(apiOrigin('https://newra-news-api.onrender.com/api')).toBe(
        'https://newra-news-api.onrender.com',
      );
    });

    it('env ausente ou malformada não derruba o build', () => {
      // A CSP é montada na carga do `next.config.js`. Uma exceção aqui não
      // apareceria como "env errada" — apareceria como build quebrado.
      expect(apiOrigin(undefined)).toBeNull();
      expect(apiOrigin('nao-e-uma-url')).toBeNull();
      expect(() =>
        contentSecurityPolicy({ isProduction: true, isVercelPreview: false }),
      ).not.toThrow();
    });
  });
});
