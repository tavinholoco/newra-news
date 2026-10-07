'use client';

import { useId, useState, type FormEvent } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import type { Saturation } from '@newranews/types';
import { useRecordPlanHoursReading } from '@/lib/queries';
import { ApiError } from '@/lib/api';
import { formatHours } from '@/lib/format';
import { toDateFormatLocale } from '@/lib/i18n';
import { parseHoursInput } from '@/lib/saturation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

/**
 * **A leitura do Billing — Fase 13 do plano de observabilidade, 13b (§23).**
 *
 * As 750 h do free do Render são do workspace, que o `NetsheetEngine` divide
 * com esta API. O Render não expõe cobrança por API, e a chave da API dele
 * abre a conta inteira — então o número entra digitado: o dono lê o total em
 * Billing → Free instance hours e o registra aqui. O arco acima passa a
 * desenhar o workspace inteiro, e a linha fica na trilha de auditoria.
 *
 * **Duas conferências antes de mandar, e a API repete as duas:** o texto tem
 * de ser um número de horas (`parseHoursInput`, que aceita a vírgula do
 * teclado brasileiro e devolve número — a API recusa texto), e a leitura não
 * pode ser menor que as horas que esta API já registrou no mês (o total do
 * workspace nunca é menor que uma parte dele; menor é o número errado do
 * painel). Conferir aqui poupa a ida; a da API é a que vale — o arco pode
 * estar alguns minutos atrás do banco.
 *
 * Só na `/admin`: escrever é um gesto, e uma superfície que escreve basta. A
 * aba de métricas mostra o mesmo arco, sem o formulário.
 */
export function PlanReadingForm({ plan }: { plan: NonNullable<Saturation['plan']> }) {
  const t = useTranslations('admin');
  const locale = toDateFormatLocale(useLocale());
  const record = useRecordPlanHoursReading();
  const [text, setText] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const inputId = useId();
  const hintId = useId();
  const messageId = useId();

  const belowApi = t('overview.reading.belowApi', { hours: formatHours(plan.hoursUsed, locale) });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const hours = parseHoursInput(text);
    if (hours === null) {
      setProblem(t('overview.reading.invalid'));
      return;
    }
    if (hours < plan.hoursUsed) {
      setProblem(belowApi);
      return;
    }

    setProblem(null);
    record.mutate(hours);
  }

  // A recusa da API (400) é a mesma conferência feita lá, com o banco do
  // momento — o arco pode estar alguns minutos atrás. O resto é falha de ida.
  const serverProblem = record.isError
    ? record.error instanceof ApiError && record.error.status === 400
      ? belowApi
      : t('overview.reading.failed')
    : null;
  const message = problem ?? serverProblem;

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className='mt-6 flex flex-col gap-2 border-t border-line pt-4'
    >
      <label htmlFor={inputId} className='text-sm font-medium text-ink'>
        {t('overview.reading.label')}
      </label>
      <div className='flex max-w-sm gap-2'>
        <Input
          id={inputId}
          inputMode='decimal'
          autoComplete='off'
          placeholder={t('overview.reading.placeholder')}
          value={text}
          onChange={(event) => setText(event.target.value)}
          aria-invalid={message !== null}
          aria-describedby={message !== null ? `${messageId} ${hintId}` : hintId}
          disabled={record.isPending}
          className='h-9'
        />
        <Button type='submit' disabled={record.isPending} className='shrink-0'>
          {record.isPending ? t('overview.reading.saving') : t('overview.reading.submit')}
        </Button>
      </div>
      <p id={hintId} className='max-w-prose text-xs text-muted-foreground'>
        {t('overview.reading.hint')}
      </p>

      {message !== null ? (
        <p id={messageId} role='alert' className='text-sm text-danger'>
          {message}
        </p>
      ) : record.isSuccess ? (
        <p id={messageId} role='status' className='text-sm text-success'>
          {t('overview.reading.saved')}
        </p>
      ) : null}
    </form>
  );
}
