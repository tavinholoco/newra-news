import { PrismaClient, Category } from '@prisma/client';

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
        aiTokensUsed: 8_200 + ((daysAgo * 310) % 3_000),
        pipelineErrors: 0,
        newsApiCount,
        rssCount,
        cleanupCount: (daysAgo * 7) % 40,
      },
    });
    metricsCreated++;
  }
  console.log(`  DailyMetric: ${metricsCreated} created (${30 - metricsCreated} already existed)`);

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
