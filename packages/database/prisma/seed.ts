import {
  PrismaClient,
  Category,
  ErrorOrigin,
  ErrorSeverity,
  PipelineEventLevel,
  PipelineStatus,
  SourceKind,
  SourceOutcome,
} from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const newsItems = [
    {
      title: 'Inteligência Artificial revoluciona diagnósticos médicos no Brasil',
      description: 'Hospitais públicos adotam sistema de IA para análise de exames, reduzindo tempo de diagnóstico em 60%.',
      content: null as string | null,
      source: 'G1',
      sourceUrl: 'https://g1.globo.com/tecnologia/ia-diagnosticos-medicos',
      imageUrl: null as string | null,
      category: Category.TECHNOLOGY,
      publishedAt: new Date(today.getTime() - 2 * 60 * 60 * 1000),
    },
    {
      title: 'Câmara aprova projeto de lei sobre regulamentação das big techs',
      description: 'Texto segue para o Senado e prevê multas de até 2% do faturamento para plataformas que descumprirem regras.',
      content: null as string | null,
      source: 'Folha de S.Paulo',
      sourceUrl: 'https://www.folha.uol.com.br/poder/regulacao-big-techs',
      imageUrl: null as string | null,
      category: Category.POLITICS,
      publishedAt: new Date(today.getTime() - 4 * 60 * 60 * 1000),
    },
    {
      title: 'Banco Central mantém taxa Selic em 10,5% ao ano',
      description: 'Decisão unânime do Copom surpreende mercado que esperava corte de 0,25 ponto percentual.',
      content: null as string | null,
      source: 'Reuters Brasil',
      sourceUrl: 'https://br.reuters.com/economia/selic-2024',
      imageUrl: null as string | null,
      category: Category.ECONOMY,
      publishedAt: new Date(today.getTime() - 6 * 60 * 60 * 1000),
    },
    {
      title: 'Seleção Brasileira convoca novos talentos para amistosos de março',
      description: 'Técnico anuncia lista com três destaques do Brasileirão e dois jogadores que atuam na Europa.',
      content: null as string | null,
      source: 'ESPN Brasil',
      sourceUrl: 'https://www.espn.com.br/selecao-brasileira-convocacao',
      imageUrl: null as string | null,
      category: Category.SPORTS,
      publishedAt: new Date(today.getTime() - 3 * 60 * 60 * 1000),
    },
    {
      title: 'Cientistas brasileiros descobrem novo composto anticancerígeno',
      description: 'Pesquisadores da USP identificaram molécula da biodiversidade amazônica com ação promissora contra tumor de pulmão.',
      content: null as string | null,
      source: 'BBC Brasil',
      sourceUrl: 'https://www.bbc.com/portuguese/ciencia-composto-amazonia',
      imageUrl: null as string | null,
      category: Category.SCIENCE,
      publishedAt: new Date(today.getTime() - 5 * 60 * 60 * 1000),
    },
    {
      title: 'Festival de Música do Recife bate recorde de público com 400 mil visitantes',
      description: 'Edição deste ano reuniu artistas nacionais e internacionais ao longo de cinco dias de programação gratuita.',
      content: null as string | null,
      source: 'G1 Pernambuco',
      sourceUrl: 'https://g1.globo.com/pe/pernambuco/festival-musica-recorde',
      imageUrl: null as string | null,
      category: Category.ENTERTAINMENT,
      publishedAt: new Date(today.getTime() - 7 * 60 * 60 * 1000),
    },
    {
      title: 'ONU alerta para crise humanitária em três países da África subsaariana',
      description: 'Relatório aponta que 12 milhões de pessoas estão em situação de insegurança alimentar severa.',
      content: null as string | null,
      source: 'BBC Brasil',
      sourceUrl: 'https://www.bbc.com/portuguese/mundo-onu-africa',
      imageUrl: null as string | null,
      category: Category.WORLD,
      publishedAt: new Date(today.getTime() - 8 * 60 * 60 * 1000),
    },
    {
      title: 'Ministério da Saúde lança campanha nacional de vacinação contra dengue',
      description: 'Campanha prevê imunizar 3 milhões de crianças e adolescentes em municípios com maior índice de casos.',
      content: null as string | null,
      source: 'G1 Saúde',
      sourceUrl: 'https://g1.globo.com/saude/vacinacao-dengue-campanha',
      imageUrl: null as string | null,
      category: Category.HEALTH,
      publishedAt: new Date(today.getTime() - 1 * 60 * 60 * 1000),
    },
  ];

  // Aponta cada notícia para o placeholder da sua categoria. Sem imagem, todo
  // card cai no fallback `from-brand-600 to-brand-400` e a tela local fica bem
  // mais laranja que a produção — o que atrapalha exatamente quem está
  // conferindo cor e tipografia. Os arquivos saem de
  // `scripts/generate-seed-images.mjs`; se não existirem, o `SafeImage` volta
  // sozinho para o gradiente, então o seed funciona de qualquer jeito.
  for (const item of newsItems) {
    item.imageUrl = `/seed/${item.category.toLowerCase()}.png`;
  }

  let newsCreated = 0;
  for (const item of newsItems) {
    const existing = await prisma.news.findFirst({ where: { sourceUrl: item.sourceUrl } });
    if (!existing) {
      await prisma.news.create({ data: item });
      newsCreated++;
    }
  }
  console.log(`  News: ${newsCreated} created (${newsItems.length - newsCreated} already existed)`);

  const existingArticle = await prisma.article.findUnique({ where: { date: today } });
  if (!existingArticle) {
    await prisma.article.create({
      data: {
        title: 'Panorama do Dia: IA na saúde, política digital e ciência brasileira em destaque',
        summary: 'No cenário de hoje, a inteligência artificial avança nos hospitais públicos, o Congresso debate regulação das big techs e cientistas da USP anunciam descoberta promissora no combate ao câncer.',
        content: `## Tecnologia e Saúde\n\nA inteligência artificial chegou aos hospitais públicos brasileiros com força total. Um novo sistema de análise de exames reduz em 60% o tempo de diagnóstico, demonstrando como a tecnologia pode democratizar o acesso à medicina de qualidade.\n\n## Cenário Político\n\nNo Congresso, avança o projeto de regulação das big techs. O texto aprovado na Câmara prevê multas significativas para plataformas que descumprirem as novas regras, sinalizando uma postura mais firme do Brasil no debate global sobre soberania digital.\n\n## Economia\n\nO Banco Central manteve a Selic estável, surpreendendo analistas. A decisão reflete a cautela do Copom diante de um cenário externo ainda incerto e pressões inflacionárias internas.\n\n## Ciência Nacional\n\nPesquisadores da USP anunciaram a descoberta de uma molécula com potencial anticancerígeno extraída da biodiversidade amazônica. A pesquisa reforça a importância estratégica da proteção da Amazônia.\n\n## Síntese\n\nO dia foi marcado pela intersecção entre tecnologia, ciência e debates institucionais. O Brasil demonstra capacidade de inovar enquanto enfrenta desafios econômicos e políticos que moldarão o país nos próximos meses.`,
        date: today,
        newsCount: newsItems.length,
      },
    });
    console.log('  Article: 1 created for today');
  } else {
    console.log('  Article: already exists for today');
  }

  // 30 dias de métricas do pipeline. Sem elas a `/dashboard` fica inteira em
  // zero e o `category-bars` — que consome `--chart-1..5` — não desenha barra
  // nenhuma, o que esconde justamente o componente que a V2 muda.
  // Determinístico, para o seed ser reprodutível: sem aleatoriedade.
  let metricsCreated = 0;
  for (let daysAgo = 0; daysAgo < 30; daysAgo++) {
    const date = new Date(today);
    date.setUTCDate(date.getUTCDate() - daysAgo);

    const existing = await prisma.dailyMetric.findUnique({ where: { date } });
    if (existing) continue;

    const rssCount = 320 + ((daysAgo * 14) % 120);
    const newsApiCount = 60 + ((daysAgo * 3) % 20);
    await prisma.dailyMetric.create({
      data: {
        date,
        newsCollected: rssCount + newsApiCount,
        newsByCategory: {
          WORLD: 121,
          TECHNOLOGY: 62,
          ECONOMY: 51,
          POLITICS: 44,
          SPORTS: 38,
          HEALTH: 29,
          SCIENCE: 22,
          ENTERTAINMENT: 18,
        },
        articleGenerated: true,
        pipelineDuration: 24_000 + ((daysAgo * 1300) % 12_000),
        aiProvider: daysAgo % 5 === 0 ? 'groq' : 'gemini',
        pipelineErrors: 0,
        newsApiCount,
        rssCount,
        cleanupCount: (daysAgo * 7) % 40,
      },
    });
    metricsCreated++;
  }
  console.log(`  DailyMetric: ${metricsCreated} created (${30 - metricsCreated} already existed)`);

  // ── Observabilidade (Fase 5 do plano, PR 5c) ────────────────────────────
  // As três tabelas que o `admin:capture` fotografa na `/admin` e na
  // `/admin/security`. O 5a e o 5b deixaram a decisão para cá, e ela é sim:
  // sem elas a captura sai com o arco das horas em zero, a rosquinha de erro
  // vazia e a trilha sem linha — e é justamente o estado que ninguém precisa
  // fotografar. Determinístico e idempotente, como o resto: `upsert` pela
  // chave natural (data, `(fingerprint, hora)`) ou por id fixo.

  // DailyUptime: o mês corrente até hoje, ~9 h ligada por dia — o retrato de
  // uma API que dorme e acorda (desde 01/09 não há keep-alive). Hoje é parcial.
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const secondsToday = Math.floor((now.getTime() - today.getTime()) / 1000);
  let uptimeCreated = 0;
  for (let date = new Date(monthStart); date <= today; date.setUTCDate(date.getUTCDate() + 1)) {
    const isToday = date.getTime() === today.getTime();
    const seconds = isToday ? Math.min(32_400, secondsToday) : 32_400;
    const existing = await prisma.dailyUptime.findUnique({ where: { date: new Date(date) } });
    if (existing) continue;
    await prisma.dailyUptime.create({ data: { date: new Date(date), seconds } });
    uptimeCreated++;
  }
  console.log(`  DailyUptime: ${uptimeCreated} created`);

  // ErrorEvent: quatro falhas distintas nas últimas 24 h, com baldes por hora
  // — o suficiente para a rosquinha ter três fatias e a tabela ter o que
  // ordenar. Os códigos são os da taxonomia da API (`utils/errors.ts`).
  const thisHour = new Date(now);
  thisHour.setUTCMinutes(0, 0, 0);
  const hoursAgo = (hours: number) => new Date(thisHour.getTime() - hours * 3_600_000);
  const errorEvents = [
    ...[
      [1, 12],
      [2, 7],
      [5, 3],
    ].map(([hours, count]) => ({
      fingerprint: 'API:WARN:AUTH_TOKEN_INVALID:/api/account',
      windowStart: hoursAgo(hours!),
      origin: ErrorOrigin.API,
      severity: ErrorSeverity.WARN,
      code: 'AUTH_TOKEN_INVALID',
      category: 'authorization',
      count: count!,
      route: '/api/account',
      statusCode: 401,
      message: 'Invalid or missing token',
      firstRequestId: `seed-${hours}-first`,
      lastRequestId: `seed-${hours}-last`,
    })),
    {
      fingerprint: 'API:WARN:NOT_FOUND:unmatched',
      windowStart: hoursAgo(3),
      origin: ErrorOrigin.API,
      severity: ErrorSeverity.WARN,
      code: 'NOT_FOUND',
      category: 'validation',
      count: 25,
      route: 'unmatched',
      statusCode: 404,
      message: 'Route not found',
      firstRequestId: 'seed-404-first',
      lastRequestId: 'seed-404-last',
    },
    {
      fingerprint: 'PIPELINE:WARN:feed-failed:stage-1',
      windowStart: hoursAgo(now.getUTCHours() >= 11 ? now.getUTCHours() - 11 : 13),
      origin: ErrorOrigin.PIPELINE,
      severity: ErrorSeverity.WARN,
      code: 'feed-failed',
      category: 'upstream',
      count: 3,
      route: 'stage-1',
      statusCode: null,
      message: 'Feed Veja Saúde: ETIMEDOUT',
      firstRequestId: null,
      lastRequestId: null,
    },
    {
      fingerprint: 'API:ERROR:INTERNAL:/api/news/:id',
      windowStart: hoursAgo(8),
      origin: ErrorOrigin.API,
      severity: ErrorSeverity.ERROR,
      code: 'INTERNAL',
      category: 'internal',
      count: 1,
      route: '/api/news/:id',
      statusCode: 500,
      message: 'Unexpected error',
      firstRequestId: 'seed-500',
      lastRequestId: 'seed-500',
    },
  ];
  let errorsCreated = 0;
  for (const event of errorEvents) {
    const existing = await prisma.errorEvent.findUnique({
      where: { fingerprint_windowStart: { fingerprint: event.fingerprint, windowStart: event.windowStart } },
    });
    if (existing) continue;
    await prisma.errorEvent.create({
      data: { ...event, firstSeenAt: event.windowStart, lastSeenAt: new Date(event.windowStart.getTime() + 35 * 60_000) },
    });
    errorsCreated++;
  }
  console.log(`  ErrorEvent: ${errorsCreated} created (${errorEvents.length - errorsCreated} already existed)`);

  // AuditEvent: três ações do mesmo ator — o id sintético que o
  // `admin:capture` usa na sessão forjada, para a trilha mostrar "você".
  const actorId = '00000000-0000-4000-8000-000000000000';
  const auditEvents = [
    {
      id: '00000000-0000-4000-8000-00000000a001',
      actorId,
      action: 'pipeline.triggered',
      targetId: '00000000-0000-4000-8000-00000000c001',
      outcome: 'started',
      requestId: 'seed-audit-1',
      context: { pipelineId: '00000000-0000-4000-8000-00000000c001' },
      createdAt: new Date(today.getTime() + 11 * 3_600_000 + 5 * 60_000),
    },
    {
      id: '00000000-0000-4000-8000-00000000a002',
      actorId,
      action: 'pipeline.triggered',
      targetId: null,
      outcome: 'already-succeeded-today',
      requestId: 'seed-audit-2',
      context: { pipelineId: '00000000-0000-4000-8000-00000000c001' },
      createdAt: new Date(today.getTime() + 16 * 3_600_000 + 25 * 60_000),
    },
    {
      id: '00000000-0000-4000-8000-00000000a003',
      actorId,
      action: 'news.deleted',
      targetId: '00000000-0000-4000-8000-00000000d001',
      outcome: 'deleted',
      requestId: 'seed-audit-3',
      context: null,
      createdAt: new Date(today.getTime() - 2 * 24 * 3_600_000 + 14 * 3_600_000),
    },
  ];
  let auditCreated = 0;
  for (const event of auditEvents) {
    const existing = await prisma.auditEvent.findUnique({ where: { id: event.id } });
    if (existing) continue;
    await prisma.auditEvent.create({
      data: { ...event, context: event.context ?? undefined },
    });
    auditCreated++;
  }
  console.log(`  AuditEvent: ${auditCreated} created (${auditEvents.length - auditCreated} already existed)`);

  // ── Pipeline (Fase 8 do plano) ──────────────────────────────────────────
  // Os runs dos últimos 30 dias, com os eventos de que o desfecho precisa.
  // Sem eles a faixa de desfechos da `/admin` fotografa 30 quadrados vazados
  // — o estado que ninguém precisa ver —, e a lista de execuções sai vazia.
  // O retrato é o do produto medido: quase todo dia `SUCCESS`; a cada cinco
  // dias o Gemini caiu e o Groq entregou (o mesmo ritmo do `aiProvider` das
  // métricas acima, para as duas telas contarem a mesma história); um dia em
  // que a newsletter falhou; um dia `FAILED` na etapa 6; e **três dias sem
  // run** (17–19 dias atrás), que é o buraco de 29–31/08/2026 — a API suspensa
  // por horas do plano —, para a faixa ter o que o `NEVER_RAN` existe para
  // mostrar. Determinístico e idempotente: id fixo por dia, `create` só quando
  // não existe.
  //
  // O run de hoje é o `...c001` que a trilha de auditoria acima referencia —
  // é o que faz o link "run existente" da trilha resolver.
  const runId = (daysAgo: number) =>
    `00000000-0000-4000-8000-00000000c0${(daysAgo + 1).toString(16).padStart(2, '0')}`;
  const eventId = (daysAgo: number, index: number) =>
    `00000000-0000-4000-8000-0000000e${(daysAgo + 1).toString(16).padStart(2, '0')}${index.toString(16).padStart(2, '0')}`;
  const NEVER_RAN_DAYS = new Set([17, 18, 19]);
  // O briefing de hoje existe (criado acima); os dos outros dias não, e o
  // resumo diz isso com `null` em vez de inventar um id.
  const todayArticle = await prisma.article.findUnique({ where: { date: today } });
  const FAILED_DAY = 8;
  const NEWSLETTER_FAILED_DAY = 3;

  let runsCreated = 0;
  for (let daysAgo = 0; daysAgo < 30; daysAgo++) {
    if (NEVER_RAN_DAYS.has(daysAgo)) continue;

    const id = runId(daysAgo);
    const existing = await prisma.pipelineLog.findUnique({ where: { id } });
    if (existing) continue;

    const day = new Date(today);
    day.setUTCDate(day.getUTCDate() - daysAgo);
    // O cron das 11:00 UTC; o de hoje às 11:05, que é quando a trilha diz que
    // alguém o disparou.
    const startedAt = new Date(day.getTime() + 11 * 3_600_000 + (daysAgo === 0 ? 5 * 60_000 : 10_000));
    const at = (seconds: number) => new Date(startedAt.getTime() + seconds * 1000);
    const failed = daysAgo === FAILED_DAY;
    const fallback = !failed && daysAgo % 5 === 0;
    const newsletterFailed = daysAgo === NEWSLETTER_FAILED_DAY;
    const collected = 320 + ((daysAgo * 14) % 120) + 60 + ((daysAgo * 3) % 20);
    const durationMs = 24_000 + ((daysAgo * 1300) % 12_000);

    type SeedEvent = { stage: number; level: PipelineEventLevel; message: string; context: object; at: Date };
    const events: SeedEvent[] = [
      { stage: 1, level: PipelineEventLevel.INFO, message: 'News collected', context: { newsDataCount: 60, rssCount: collected - 60, total: collected }, at: at(4) },
      { stage: 3, level: PipelineEventLevel.INFO, message: 'News deduplicated', context: { before: collected, after: collected - 12 }, at: at(5) },
      { stage: 4, level: PipelineEventLevel.INFO, message: 'News persisted', context: { count: collected - 40, skipped: 28 }, at: at(6) },
      { stage: 5, level: PipelineEventLevel.INFO, message: 'Top items selected for AI', context: { count: 15 }, at: at(6) },
    ];

    if (failed) {
      events.push(
        { stage: 6, level: PipelineEventLevel.WARN, message: 'Primary provider failed before fallback', context: { message: 'Gemini API error 503: UNAVAILABLE', provider: 'gemini', statusCode: 503 }, at: at(20) },
        { stage: 6, level: PipelineEventLevel.ERROR, message: 'Groq API error: 404 Not Found', context: { message: 'Groq API error: 404 Not Found', provider: 'groq', statusCode: 404 }, at: at(22) },
      );
    } else {
      if (fallback) {
        events.push({ stage: 6, level: PipelineEventLevel.WARN, message: 'Primary provider failed, fallback served', context: { message: 'Gemini API error 503: UNAVAILABLE', provider: 'gemini', statusCode: 503, fallbackProvider: 'groq' }, at: at(18) });
      }
      events.push(
        { stage: 6, level: PipelineEventLevel.INFO, message: 'Article generated', context: { provider: fallback ? 'groq' : 'gemini', modelVersion: fallback ? 'openai/gpt-oss-20b' : 'gemini-2.5-flash', promptVersion: 'v2' }, at: at(19) },
        { stage: 7, level: PipelineEventLevel.INFO, message: 'Article persisted', context: { sources: 15 }, at: at(20) },
        newsletterFailed
          ? { stage: 7.5, level: PipelineEventLevel.WARN, message: 'Newsletter failed (non-critical)', context: { message: 'Resend API error 500: internal error', provider: 'resend', statusCode: 500 }, at: at(21) }
          : { stage: 7.5, level: PipelineEventLevel.INFO, message: 'Daily newsletter sent', context: { total: 3, sent: 3, failed: 0 }, at: at(21) },
        { stage: 8, level: PipelineEventLevel.INFO, message: 'Cleanup completed', context: { deleted: (daysAgo * 7) % 40, productEvents: 0, errorEvents: 0, auditEvents: 0 }, at: at(22) },
        { stage: 8.5, level: PipelineEventLevel.INFO, message: 'Stored news renormalized', context: { scanned: 8190, textChanged: 0, imageRecovered: 0, categoryChanged: 0, categorySkipped: 0 }, at: at(23) },
        { stage: 9, level: PipelineEventLevel.INFO, message: 'Daily metrics recorded', context: { durationMs }, at: at(24) },
        {
          stage: 9,
          level: PipelineEventLevel.INFO,
          message: 'Pipeline completed successfully',
          context: {
            collected,
            sources: 45,
            deduped: collected - 12,
            persisted: collected - 40,
            selected: 15,
            provider: fallback ? 'groq' : 'gemini',
            model: fallback ? 'openai/gpt-oss-20b' : 'gemini-2.5-flash',
            promptVersion: 'v2',
            briefingId: daysAgo === 0 ? (todayArticle?.id ?? null) : null,
            briefingChars: 6_200 + ((daysAgo * 173) % 900),
            sourcesCited: 15,
            newsletter: newsletterFailed ? 'failed' : { total: 3, sent: 3, failed: 0 },
            renormalized: { scanned: 8190, changed: 0 },
            degradedBy: [...(fallback ? [6] : []), ...(newsletterFailed ? [7.5] : [])],
            durationMs,
          },
          at: at(24),
        },
      );
    }

    await prisma.pipelineLog.create({
      data: {
        id,
        status: failed ? PipelineStatus.FAILED : PipelineStatus.SUCCESS,
        // O `newsCount` e o `articleId` só são gravados na etapa 7: o run que
        // falhou na 6 fica com os dois vazios, como em produção.
        newsCount: failed ? 0 : collected - 12,
        articleId: daysAgo === 0 ? (todayArticle?.id ?? null) : null,
        startedAt,
        completedAt: at(failed ? 22 : Math.round(durationMs / 1000)),
        ...(failed
          ? {
              error: 'Groq API error: 404 Not Found',
              errorStage: 6,
              errorDetail: {
                message: 'Groq API error: 404 Not Found',
                provider: 'groq',
                statusCode: 404,
                primaryError: { message: 'Gemini API error 503: UNAVAILABLE', provider: 'gemini', statusCode: 503 },
              },
            }
          : {}),
        events: {
          create: events.map((event, index) => ({
            id: eventId(daysAgo, index),
            stage: event.stage,
            level: event.level,
            message: event.message,
            context: event.context,
            createdAt: event.at,
          })),
        },
      },
    });
    runsCreated++;
  }
  console.log(`  PipelineLog: ${runsCreated} created (${30 - NEVER_RAN_DAYS.size - runsCreated} already existed)`);

  // ── Saúde por fonte (Fase 11 do plano, PR 11a) ──────────────────────────
  // Uma linha por (fonte, dia) nos mesmos 30 dias dos runs acima — os três
  // dias sem run não têm linha nenhuma (o pipeline não escreveu), e o dia
  // `FAILED` na etapa 6 **tem**, porque a escrita acontece depois da 4: é a
  // distinção que a tela precisa mostrar. Os nomes espelham `rss-sources.ts`
  // (15/09/2026) mais o balde `newsdata`; são texto, não FK, de propósito.
  //
  // As duas histórias que os gatilhos da §15 existem para pegar estão aqui:
  // a Superinteressante em `FAILED` há três dias (o `ETIMEDOUT` de 03/09,
  // que também aparece 12–13 dias atrás com a Veja Saúde e o Drauzio), e a
  // Trivela **definhando** — `kept` de ~12 por dia caindo para ~2 na última
  // semana, sem falhar nunca. Os dois feeds de saúde ficam `EMPTY` no fim de
  // semana, que é o normal que não pode acender luz. Determinístico e
  // idempotente: `createMany` com `skipDuplicates` sobre a chave `(source, day)`.
  type SeedSource = { name: string; kind: SourceKind; fetched: number; keptRatio: number; latencyMs: number };
  const seedSources: SeedSource[] = [
    { name: 'newsdata', kind: SourceKind.AGGREGATOR, fetched: 62, keptRatio: 0.7, latencyMs: 740 },
    { name: 'G1', kind: SourceKind.RSS, fetched: 50, keptRatio: 0.6, latencyMs: 420 },
    { name: 'Folha de S.Paulo', kind: SourceKind.RSS, fetched: 30, keptRatio: 0.55, latencyMs: 610 },
    { name: 'BBC Brasil', kind: SourceKind.RSS, fetched: 24, keptRatio: 0.65, latencyMs: 380 },
    { name: 'TechCrunch', kind: SourceKind.RSS, fetched: 20, keptRatio: 0.5, latencyMs: 890 },
    { name: 'InfoMoney', kind: SourceKind.RSS, fetched: 40, keptRatio: 0.45, latencyMs: 1_150 },
    { name: 'Valor Econômico', kind: SourceKind.RSS, fetched: 35, keptRatio: 0.4, latencyMs: 970 },
    { name: 'ESPN Brasil', kind: SourceKind.RSS, fetched: 25, keptRatio: 0.6, latencyMs: 530 },
    { name: 'Trivela', kind: SourceKind.RSS, fetched: 18, keptRatio: 0.65, latencyMs: 2_100 },
    { name: 'Olhar Digital', kind: SourceKind.RSS, fetched: 22, keptRatio: 0.55, latencyMs: 640 },
    { name: 'Superinteressante', kind: SourceKind.RSS, fetched: 10, keptRatio: 0.8, latencyMs: 1_900 },
    { name: 'Veja Saúde', kind: SourceKind.RSS, fetched: 8, keptRatio: 0.75, latencyMs: 1_400 },
    { name: 'Drauzio Varella', kind: SourceKind.RSS, fetched: 6, keptRatio: 0.8, latencyMs: 1_250 },
  ];
  const FEED_TIMEOUT_MS = 30_000;
  const TIMED_OUT = 'fetch failed: ETIMEDOUT';
  const FAILED_SOURCE_DAYS: Record<string, number[]> = {
    Superinteressante: [0, 1, 2, 12, 13],
    'Veja Saúde': [12, 13],
    'Drauzio Varella': [12, 13],
  };
  const WEEKEND_EMPTY = new Set(['Veja Saúde', 'Drauzio Varella']);

  const sourceRows: {
    source: string;
    kind: SourceKind;
    day: Date;
    fetched: number;
    kept: number;
    outcome: SourceOutcome;
    failureReason: string | null;
    latencyMs: number;
    pipelineLogId: string;
  }[] = [];
  for (let daysAgo = 0; daysAgo < 30; daysAgo++) {
    if (NEVER_RAN_DAYS.has(daysAgo)) continue;
    const day = new Date(today);
    day.setUTCDate(day.getUTCDate() - daysAgo);
    const weekend = day.getUTCDay() === 0 || day.getUTCDay() === 6;

    for (const [index, source] of seedSources.entries()) {
      const failed = FAILED_SOURCE_DAYS[source.name]?.includes(daysAgo) ?? false;
      const empty = !failed && weekend && WEEKEND_EMPTY.has(source.name);
      // A Trivela definha: inteira até 10 dias atrás, e daí a menos de um
      // quarto — é o `kept` médio de 7 dias abaixo de 30% do de 30.
      const withering = source.name === 'Trivela' && daysAgo < 10;
      const wobble = ((daysAgo * 7 + index * 3) % 9) - 4;
      const fetched = failed || empty ? 0 : Math.max(1, source.fetched + wobble - (withering ? 12 : 0));
      const kept = failed || empty ? 0 : Math.min(fetched, Math.round(fetched * source.keptRatio) - (withering ? 2 : 0));

      sourceRows.push({
        source: source.name,
        kind: source.kind,
        day: new Date(day),
        fetched,
        kept: Math.max(0, kept),
        outcome: failed ? SourceOutcome.FAILED : empty ? SourceOutcome.EMPTY : SourceOutcome.OK,
        failureReason: failed ? TIMED_OUT : null,
        latencyMs: failed ? FEED_TIMEOUT_MS : source.latencyMs + wobble * 15,
        pipelineLogId: runId(daysAgo),
      });
    }
  }
  const sourceHealth = await prisma.sourceHealth.createMany({ data: sourceRows, skipDuplicates: true });
  console.log(`  SourceHealth: ${sourceHealth.count} created (${sourceRows.length - sourceHealth.count} already existed)`);

  console.log('Seed completed successfully.');
}

main()
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
