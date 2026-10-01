'use client';

import { useId, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import type { ErrorGroup, ErrorSeverity } from '@newranews/types';
import { formatCount, formatDateTime } from '@/lib/format';
import { toDateFormatLocale } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { SortableHeader, sortBy, useSort } from './sortable-header';

/**
 * As três severidades do `ErrorSeverity`. Escritas aqui porque o tipo
 * compartilhado é uma união, não um valor — o compilador reprova se uma sair
 * do tipo, e é ele quem mantém as duas listas iguais.
 */
const SEVERITIES: readonly ErrorSeverity[] = ['WARN', 'ERROR', 'FATAL'];

/** `WARN` usa `--link` e não `--brand-accent`: há texto na linha (§ tokens). */
const SEVERITY_TONE: Record<ErrorSeverity, string> = {
  WARN: 'border-line-strong text-link',
  ERROR: 'border-danger/40 text-danger',
  FATAL: 'border-danger text-danger',
};

type SortKey = 'count' | 'hours' | 'lastSeenAt';

const SORT_HEADER_KEY = {
  count: 'security.errors.colCount',
  hours: 'security.errors.colHours',
  lastSeenAt: 'security.errors.colLastSeen',
} as const;

function compare(a: ErrorGroup, b: ErrorGroup, key: SortKey): number {
  if (key === 'lastSeenAt') return a.lastSeenAt.localeCompare(b.lastSeenAt);
  return a[key] - b[key];
}

interface ErrorGroupsTableProps {
  groups: ErrorGroup[];
  /** As categorias da taxonomia, na ordem dela — vêm das fatias fixas do `byCategory`. */
  categories: string[];
}

/**
 * A tabela de falhas da aba de segurança (§9 do plano de observabilidade), no
 * formato da referência (§4.2, item 4): busca, dois filtros, colunas ordenáveis
 * e a severidade por linha.
 *
 * **A "tabela de eventos de segurança" e a "lista de erros por fingerprint"
 * da §9 são esta tabela, uma só.** O dado é o mesmo: os eventos da §3.2
 * (`authz_fail`, `authn_token_reuse`, `excess_rate_limit_exceeded`…) nascem
 * como `AppError` com categoria `authorization` e vivem no `ErrorEvent`, que é
 * o que o `/api/admin/errors` agrupa. Duas tabelas sobre as mesmas linhas
 * seriam as "duas caixas vermelhas sobre o mesmo run" da Fase 2, em outra
 * forma — o filtro por categoria é o que separa uma leitura da outra.
 *
 * O `lastRequestId` sai como texto selecionável (`select-all`): é ele que
 * torna um relato de fora pesquisável no log, e é a coluna que existe para ser
 * copiada. A busca casa código, rota e mensagem.
 */
export function ErrorGroupsTable({ groups, categories }: ErrorGroupsTableProps) {
  const t = useTranslations('admin');
  const locale = toDateFormatLocale(useLocale());
  const searchId = useId();
  const severityId = useId();
  const categoryId = useId();

  const [search, setSearch] = useState('');
  const [severity, setSeverity] = useState<ErrorSeverity | ''>('');
  const [category, setCategory] = useState('');
  const { sort, toggle } = useSort<SortKey>({ key: 'count', direction: 'desc' });

  const rows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const filtered = groups.filter((group) => {
      if (severity && group.severity !== severity) return false;
      if (category && group.category !== category) return false;
      if (!needle) return true;
      return [group.code, group.route ?? '', group.message]
        .join(' ')
        .toLowerCase()
        .includes(needle);
    });
    return sortBy(filtered, sort, compare);
  }, [groups, search, severity, category, sort]);

  const sortHeader = (key: SortKey) => (
    <SortableHeader sortKey={key} label={t(SORT_HEADER_KEY[key])} sort={sort} onToggle={toggle} />
  );

  if (groups.length === 0) {
    return <p className='text-sm text-muted-foreground'>{t('security.errors.empty')}</p>;
  }

  return (
    <div className='flex flex-col gap-4'>
      <div className='flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end'>
        <div className='flex min-w-0 flex-1 flex-col gap-1'>
          <label htmlFor={searchId} className='text-xs font-medium text-ink-secondary'>
            {t('security.errors.search')}
          </label>
          <input
            id={searchId}
            type='search'
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t('security.errors.searchPlaceholder')}
            className='h-9 rounded-md border border-input bg-surface px-3 text-sm text-ink placeholder:text-ink-muted'
          />
        </div>
        <div className='flex flex-col gap-1'>
          <label htmlFor={severityId} className='text-xs font-medium text-ink-secondary'>
            {t('security.errors.severity')}
          </label>
          <select
            id={severityId}
            value={severity}
            onChange={(event) => setSeverity(event.target.value as ErrorSeverity | '')}
            className='h-9 rounded-md border border-input bg-surface px-2 text-sm text-ink'
          >
            <option value=''>{t('security.errors.all')}</option>
            {SEVERITIES.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
        <div className='flex flex-col gap-1'>
          <label htmlFor={categoryId} className='text-xs font-medium text-ink-secondary'>
            {t('security.errors.category')}
          </label>
          <select
            id={categoryId}
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            className='h-9 rounded-md border border-input bg-surface px-2 text-sm text-ink'
          >
            <option value=''>{t('security.errors.all')}</option>
            {categories.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/**
        * `relative` no contêiner que rola: os `sr-only` das células são
        * `position: absolute`, e sem um ancestral posicionado o bloco de
        * contenção deles é o documento — a 375 px eles pousavam em x = 853,
        * fora da tabela, e a página inteira ganhava rolagem horizontal.
        * Achado pela captura da Fase 9, com a janela de 24 h populada.
        */}
      <div className='relative overflow-x-auto rounded-lg border border-border'>
        <table className='w-full text-sm' aria-label={t('security.errors.tableTitle')}>
          <thead className='bg-surface-raised text-xs text-muted-foreground'>
            <tr>
              <th scope='col' className='px-3 py-2 text-left font-medium uppercase tracking-wider'>
                {t('security.errors.colSeverity')}
              </th>
              <th scope='col' className='px-3 py-2 text-left font-medium uppercase tracking-wider'>
                {t('security.errors.colFailure')}
              </th>
              <th scope='col' className='px-3 py-2 text-left font-medium uppercase tracking-wider'>
                {t('security.errors.colRoute')}
              </th>
              {sortHeader('count')}
              {sortHeader('hours')}
              {sortHeader('lastSeenAt')}
            </tr>
          </thead>
          <tbody className='divide-y divide-border'>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className='px-3 py-6 text-center text-muted-foreground'>
                  {t('security.errors.noMatch')}
                </td>
              </tr>
            ) : (
              rows.map((group) => (
                <tr key={group.fingerprint} className='align-top'>
                  <td className='px-3 py-2'>
                    <span
                      className={cn(
                        'inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-xs font-semibold uppercase tracking-wider',
                        SEVERITY_TONE[group.severity],
                      )}
                    >
                      {group.severity}
                    </span>
                  </td>
                  <td className='min-w-64 px-3 py-2'>
                    <p className='font-mono text-xs text-ink'>{group.code}</p>
                    <p className='mt-0.5 text-xs text-ink-secondary'>
                      <span className='uppercase tracking-wider'>{group.category}</span>
                      {' · '}
                      {group.origin}
                      {group.statusCode !== null && ` · HTTP ${group.statusCode}`}
                    </p>
                    <p className='mt-1 max-w-prose text-ink'>{group.message}</p>
                  </td>
                  <td className='px-3 py-2 font-mono text-xs text-ink-secondary'>
                    {group.route ?? '—'}
                    {/**
                      * O run em que a etapa falhou por último — é o que leva
                      * da falha ao diário do run na `/admin`. Vinha na
                      * resposta desde o 5b e a tela descartava (pós-merge, item 68).
                      */}
                    {group.pipelineLogId && (
                      <p className='mt-0.5 text-ink-muted'>
                        <span className='sr-only'>{t('security.errors.runId')} </span>
                        <code className='select-all'>{group.pipelineLogId}</code>
                      </p>
                    )}
                  </td>
                  <td className='px-3 py-2 text-right tabular-nums text-ink'>
                    {formatCount(group.count, locale)}
                  </td>
                  <td className='px-3 py-2 text-right tabular-nums text-ink-secondary'>
                    {formatCount(group.hours, locale)}
                  </td>
                  <td className='px-3 py-2 text-right'>
                    <p className='whitespace-nowrap tabular-nums text-ink'>
                      {formatDateTime(group.lastSeenAt, locale)}
                    </p>
                    {/**
                      * "Desde quando" só na falha que atravessou mais de uma
                      * hora: é o que separa um pico de uma falha crônica sem
                      * ler a coluna de horas. Num balde só, primeira e última
                      * diferem por minutos e a linha seria ruído.
                      */}
                    {group.hours > 1 && (
                      <p className='mt-0.5 whitespace-nowrap text-xs tabular-nums text-ink-secondary'>
                        {t('security.errors.sinceHint', { since: formatDateTime(group.firstSeenAt, locale) })}
                      </p>
                    )}
                    {group.lastRequestId && (
                      <p className='mt-0.5 text-xs text-ink-muted'>
                        <span className='sr-only'>{t('security.errors.requestId')} </span>
                        <code className='select-all font-mono'>{group.lastRequestId}</code>
                      </p>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
