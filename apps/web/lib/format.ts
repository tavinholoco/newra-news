import type { Category } from '@newranews/types';

// Rótulos padrão pt-BR (fallback). Os componentes localizados usam as chaves
// `categories.*` de messages/{locale}.json — ver lib/i18n.ts.
export const CATEGORY_LABELS: Record<Category, string> = {
  TECHNOLOGY: 'Tecnologia',
  POLITICS: 'Política',
  ECONOMY: 'Economia',
  SPORTS: 'Esportes',
  SCIENCE: 'Ciência',
  ENTERTAINMENT: 'Entretenimento',
  WORLD: 'Mundo',
  HEALTH: 'Saúde',
};

export function formatDate(dateString: string, locale = 'pt-BR'): string {
  return new Date(dateString).toLocaleDateString(locale, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Data **e hora**, para o "gerado em" da transparência de IA (§8).
 *
 * Existe separado de `formatDate` porque ali a hora seria ruído — a data já
 * responde "quando saiu". Aqui é o contrário: o briefing é do dia inteiro, então
 * um "gerado em 21 de ago." repete a data do artigo e não diz nada. O que a §8
 * pede é o **horário** da geração.
 */
export function formatDateTime(dateString: string, locale = 'pt-BR'): string {
  return new Date(dateString).toLocaleString(locale, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * O **dia coberto** por um briefing, por extenso.
 *
 * **Lê em UTC, e é o que conserta um dia inteiro de diferença.** `Article.date`
 * não é um instante: é uma data de calendário, gravada à meia-noite UTC. Lida no
 * fuso local, meia-noite UTC do dia 22 vira 21h do dia **21** em qualquer fuso
 * negativo — e o Brasil é um. O resultado, medido em 22/08: a URL dizia
 * `/article/2026-08-22` (o `toDateSlug` abaixo já usava UTC) e a página dizia
 * "sexta-feira, 21 de agosto". O mesmo card do histórico levava a um dia e
 * rotulava outro.
 *
 * E não era só cosmético: o servidor da Vercel roda em UTC e o navegador não,
 * então a mesma data saía diferente dos dois lados — a divergência de
 * hidratação da armadilha do relógio, agora vinda do dado em vez do `Date.now`.
 *
 * Para um **instante** (quando alguém se cadastrou, quando o modelo rodou), o
 * fuso local é o certo e quem serve são `formatDate` e `formatDateTime`.
 */
export function formatArticleDate(dateString: string, locale = 'pt-BR'): string {
  return new Date(dateString).toLocaleDateString(locale, {
    timeZone: 'UTC',
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

export function toDateSlug(dateString: string): string {
  return new Date(dateString).toISOString().slice(0, 10);
}

/** Taxa 0–1 → percentual inteiro (ex.: 0.956 → "96%"). */
export function formatPercent(rate: number): string {
  return `${Math.round(rate * 100)}%`;
}

/**
 * Duração do pipeline em **milissegundos** → "27s" ou "1m 05s";
 * null/undefined → "—".
 *
 * A unidade é milissegundos porque é o que o backend grava:
 * `pipelineDuration = Date.now() - startedAt` em `pipeline.service.ts`, e o
 * mesmo vale para a média (`avgPipelineDuration`). Esta função interpretava o
 * valor como segundos, então um run real de ~26.500 ms aparecia como
 * "441m 40s" em vez de "26s".
 */
export function formatPipelineDuration(ms: number | null | undefined): string {
  if (ms === null || ms === undefined) return '—';
  const seconds = ms / 1000;
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const minutes = Math.floor(seconds / 60);
  const rest = String(Math.round(seconds % 60)).padStart(2, '0');
  return `${minutes}m ${rest}s`;
}

/**
 * Duração de um run do pipeline em **segundos** → "45s" ou "1m 05s".
 *
 * **Existe porque as duas unidades convivem no produto e nada as distingue na
 * chamada.** O `pipelineDuration` do `/api/metrics/dashboard` está em
 * milissegundos; o `durationSeconds` de `/api/admin/pipeline/runs` está em
 * segundos, porque é o `PipelineLog` que o serviço já dividia por 1000. Passar
 * o segundo direto ao `formatPipelineDuration` renderiza **"45 ms"** para um
 * run de 45 s — sem erro de tipo, sem aviso, e plausível o bastante para
 * ninguém desconfiar.
 *
 * Converter aqui, num nome que diz a unidade que recebe, é o que torna a
 * confusão impossível de escrever por engano.
 */
export function formatRunDuration(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined) return '—';
  return formatPipelineDuration(seconds * 1000);
}

/**
 * A hora de um evento de pipeline, **com segundos e sem a data**.
 *
 * **Existe porque `formatDateTime` colapsa um run inteiro num valor só.** Ele
 * para no minuto, e um run acontece em segundos: as cinco etapas do run de
 * 16/08 caíram entre 11:00:06,607 e 11:00:07,314 — 706 ms —, então a coluna
 * inteira imprimia "16 de ago. de 2026, 08:00" cinco vezes. Cinco strings
 * idênticas, ocupando espaço em toda linha e **sem informação nenhuma**, sob um
 * cabeçalho de linha que já dizia a mesma data e a mesma hora.
 *
 * Com segundos, ela volta a responder o que a coluna existe para responder:
 * **onde o run gastou o tempo** — e, neste caso, que ele fez tudo em menos de um
 * segundo e morreu.
 *
 * A data sai junto: quem lê está dentro de uma linha que já a declara, e
 * repeti-la ~19 vezes é a mesma redundância por outro caminho.
 */
export function formatEventTime(dateString: string, locale = 'pt-BR'): string {
  return new Date(dateString).toLocaleTimeString(locale, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

/** Número com separador do locale (ex.: 3484 → "3.484" em pt-BR, "3,484" em en-US). */
export function formatCount(value: number, locale = 'pt-BR'): string {
  return value.toLocaleString(locale);
}

/**
 * Uma lista em prosa, com a conjunção do locale: `6 e 7.5`, `6, 7.5 e 8.5`
 * (`6 and 7.5` em inglês).
 *
 * Para o `degradedBy` de um run (Fase 8): as etapas são identificadores, não
 * quantidades — `7.5` é "a newsletter" e fica escrito assim nos dois idiomas,
 * então quem chama passa a lista já em texto.
 */
export function formatList(items: string[], locale = 'pt-BR'): string {
  return new Intl.ListFormat(locale, { style: 'long', type: 'conjunction' }).format(items);
}

/** 'gemini' → 'Gemini' (primeira letra maiúscula, resto intacto). */
export function formatProviderName(provider: string | null | undefined): string {
  if (!provider) return '—';
  return provider.charAt(0).toUpperCase() + provider.slice(1);
}

/**
 * Corpo do texto → minutos de leitura, arredondando para cima (mínimo 1).
 *
 * 200 palavras por minuto é a taxa usual de texto editorial. Existe porque o
 * `readingTimeMinutes` do contrato da §24 ainda não vem da API: até a branch
 * `feat/v2-editorial-api` entrar, o frontend deriva o valor do `content`.
 */
export function readingTimeFromText(
  text: string | null | undefined,
  wordsPerMinute = 200,
): number {
  if (!text) return 0;
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  if (words === 0) return 0;
  return Math.ceil(words / wordsPerMinute);
}

// ── Observabilidade (Fase 5 do plano, PR 5c) ──────────────────────────────

/**
 * A variação entre dois números, para o chip de KPI (§4.2 do plano de
 * observabilidade): `+12,5%`, `−3%`, `0%`.
 *
 * **Devolve `null` quando não há como comparar** — sem linha de base, ou linha
 * de base zero. É o chip que **não** aparece, e não um "+∞%": um número sem
 * comparação honesta é pior que nenhum, e a §9 já mediu que o medidor que
 * mente para o otimista é o caso ruim.
 *
 * O sinal sai sempre (`signDisplay: 'exceptZero'`), porque é ele que carrega a
 * informação — `12,5%` sozinho não diz se subiu ou caiu.
 */
export function formatDeltaPercent(
  current: number | null | undefined,
  baseline: number | null | undefined,
  locale = 'pt-BR',
): string | null {
  if (current === null || current === undefined) return null;
  if (baseline === null || baseline === undefined || baseline === 0) return null;
  const ratio = (current - baseline) / Math.abs(baseline);
  if (!Number.isFinite(ratio)) return null;

  return new Intl.NumberFormat(locale, {
    style: 'percent',
    signDisplay: 'exceptZero',
    maximumFractionDigits: 1,
  }).format(ratio);
}

/** Bytes → megabytes inteiros com unidade (`98 MB`). Para a saturação de memória. */
export function formatMegabytes(bytes: number, locale = 'pt-BR'): string {
  return `${Math.round(bytes / 1_048_576).toLocaleString(locale)} MB`;
}

/**
 * Milissegundos de latência → `42 ms` ou `4,9 s`.
 *
 * Diferente de `formatPipelineDuration`, que arredonda ao segundo: aqui a
 * escala útil começa em dezenas de milissegundos (p50 de rota), e "0s" para um
 * p95 de 250 ms apagaria justamente o número que a tela existe para mostrar.
 */
export function formatMilliseconds(ms: number, locale = 'pt-BR'): string {
  if (ms >= 1000) {
    return `${(ms / 1000).toLocaleString(locale, { maximumFractionDigits: 1 })} s`;
  }
  return `${Math.round(ms).toLocaleString(locale)} ms`;
}

/** Horas do plano → `305 h`. Sem casa decimal: a folga do plano se mede em horas. */
export function formatHours(hours: number, locale = 'pt-BR'): string {
  return `${Math.round(hours).toLocaleString(locale)} h`;
}

/**
 * Uma razão 0–1 → percentual inteiro, **com teto visual em 999%**.
 *
 * `formatPercent` serve para taxa (0–1 por construção). Uma razão de
 * saturação pode passar de 1 — foi exatamente o que suspendeu a API em
 * 29/08/2026 — e é essencial que a tela diga "104%" em vez de "100%".
 */
export function formatRatio(ratio: number, locale = 'pt-BR'): string {
  const clamped = Math.min(Math.max(ratio, 0), 9.99);
  return new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 0 }).format(
    clamped,
  );
}

/**
 * Segundos de processo de pé → `3 h 12 min`, `45 min`, `30 s`.
 *
 * `formatRunDuration` fala de um run (segundos a minutos); o `uptimeSeconds`
 * do `/api/metrics/http` fala de horas, e "192m 03s" não é como ninguém lê
 * uma instância que acordou de manhã.
 */
export function formatUptime(seconds: number, locale = 'pt-BR'): string {
  const total = Math.max(0, Math.round(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  if (hours > 0) return `${hours.toLocaleString(locale)} h ${minutes} min`;
  if (minutes > 0) return `${minutes} min`;
  return `${total} s`;
}

/** Taxa 0–1 → percentual com até duas casas (`0,08%`), para taxa de erro de HTTP. */
export function formatRate(rate: number, locale = 'pt-BR'): string {
  return new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 2 }).format(rate);
}

/**
 * Um **dia de calendário** (`YYYY-MM-DD`) → `01 de set.`, curto, para o eixo
 * de uma série.
 *
 * Lê em UTC pela mesma razão do `formatArticleDate`: o `byDay` do
 * `/api/metrics/product` agrupa por `toISOString().slice(0, 10)`, então a
 * chave é o dia UTC, e `new Date('2026-09-01')` lido no fuso local vira
 * 31/08 em qualquer fuso negativo — o Brasil é um. A série inteira deslocaria
 * um dia para trás, em silêncio.
 */
export function formatCalendarDay(dateString: string, locale = 'pt-BR'): string {
  return new Date(dateString).toLocaleDateString(locale, {
    timeZone: 'UTC',
    day: '2-digit',
    month: 'short',
  });
}
