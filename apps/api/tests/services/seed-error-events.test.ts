import { describe, it, expect } from 'vitest';
import ts from 'typescript';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { AppError, ERROR_CODES, logLevelFor, type ErrorCategory, type ErrorCode } from '../../src/utils/errors';
import {
  AUDIT_WRITE_FAILED_CODE,
  CLIENT_ERROR_CODE,
  INVARIANT_VIOLATED_CODE,
  PIPELINE_DEGRADED_CODE,
  PIPELINE_FAILED_CODE,
  PIPELINE_GATE_BLOCKED_CODE,
  UNHANDLED_CODE,
} from '../../src/services/error-event.service';

/**
 * **O seed só mostra falha que o produto grava.** (Fase 12 do plano de
 * observabilidade, M5.)
 *
 * O `packages/database/prisma/seed.ts` popula o `ErrorEvent` para a
 * `/admin/security` ter o que desenhar na captura — e tinha três linhas que o
 * produto nunca escreveria: um `NOT_FOUND` em `WARN` (404 sai em `debug`, e
 * `debug` não vira linha — o ensaio acabara de provar isso), um código
 * `feed-failed` (a etapa 1 degradada é `PIPELINE_STAGE_DEGRADED`) e um
 * `INTERNAL` num 500 de rota (o 500 cru é `UNHANDLED`). Na tabela de falhas,
 * lado a lado com as reais, eram indistinguíveis — e a captura existe para
 * mostrar o que um admin vai ver.
 *
 * Pelo parser: todo literal de objeto do seed com `fingerprint` e `code`.
 */

const SEED = join(__dirname, '../../../../packages/database/prisma/seed.ts');

const RECORDED_CODES = new Set<string>([
  ...ERROR_CODES,
  UNHANDLED_CODE,
  PIPELINE_FAILED_CODE,
  PIPELINE_DEGRADED_CODE,
  PIPELINE_GATE_BLOCKED_CODE,
  AUDIT_WRITE_FAILED_CODE,
  INVARIANT_VIOLATED_CODE,
  CLIENT_ERROR_CODE,
]);

interface SeededRow {
  line: number;
  fingerprint: string;
  code: string;
  origin: string;
  severity: string;
  route: string | null;
  category: string | null;
  statusCode: number | null;
}

function seededRows(): SeededRow[] {
  const source = ts.createSourceFile(SEED, readFileSync(SEED, 'utf8'), ts.ScriptTarget.Latest, true);
  const rows: SeededRow[] = [];

  const valueOf = (node: ts.ObjectLiteralExpression, key: string): ts.Expression | undefined =>
    node.properties.find(
      (p): p is ts.PropertyAssignment => ts.isPropertyAssignment(p) && p.name.getText(source) === key,
    )?.initializer;
  const text = (e: ts.Expression | undefined): string | null =>
    e && (ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e)) ? e.text : null;
  // `ErrorOrigin.API` → `API`.
  const member = (e: ts.Expression | undefined): string =>
    e && ts.isPropertyAccessExpression(e) ? e.name.text : (e?.getText(source) ?? '');

  const visit = (node: ts.Node): void => {
    if (ts.isObjectLiteralExpression(node)) {
      const fingerprint = text(valueOf(node, 'fingerprint'));
      const code = text(valueOf(node, 'code'));
      if (fingerprint !== null && code !== null) {
        const status = valueOf(node, 'statusCode');
        rows.push({
          line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1,
          fingerprint,
          code,
          origin: member(valueOf(node, 'origin')),
          severity: member(valueOf(node, 'severity')),
          route: text(valueOf(node, 'route')),
          category: text(valueOf(node, 'category')),
          statusCode: status && ts.isNumericLiteral(status) ? Number(status.text) : null,
        });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return rows;
}

describe('o seed do ErrorEvent — só a forma que o produto grava', () => {
  it('finds the seeded rows at all — a scan that finds nothing would pass everything', () => {
    expect(seededRows().length).toBeGreaterThanOrEqual(5);
  });

  it('seeds only codes that something in the API records', () => {
    const strange = seededRows()
      .filter((row) => !RECORDED_CODES.has(row.code))
      .map((row) => `seed.ts:${row.line} ${row.code}`);

    expect(strange).toEqual([]);
  });

  it('writes the fingerprint the way fingerprintFor does — origin:severity:code:route', () => {
    const wrong = seededRows()
      .filter((row) => row.fingerprint !== [row.origin, row.severity, row.code, row.route ?? '-'].join(':'))
      .map((row) => `seed.ts:${row.line} ${row.fingerprint}`);

    expect(wrong).toEqual([]);
  });

  it('gives an API row the severity logLevelFor would — and never one that stays in debug', () => {
    const wrong = seededRows()
      .filter((row) => row.origin === 'API' && (ERROR_CODES as readonly string[]).includes(row.code))
      .filter((row) => {
        const level = logLevelFor(
          new AppError('seed', row.statusCode ?? 500, {
            code: row.code as ErrorCode,
            category: (row.category ?? 'internal') as ErrorCategory,
          }),
        );
        return level === 'debug' || level.toUpperCase() !== row.severity;
      })
      .map((row) => `seed.ts:${row.line} ${row.fingerprint}`);

    expect(wrong).toEqual([]);
  });
});
