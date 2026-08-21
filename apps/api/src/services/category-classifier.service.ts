import { Category } from '@newranews/database';

/**
 * Palavras-chave por categoria (pt-BR, já normalizadas: minúsculas e sem acentos).
 * Usadas para classificar notícias de feeds RSS genéricos que não declaram categoria.
 *
 * **Critério para uma palavra entrar aqui:** ela tem de dizer do que a matéria
 * *trata*, não como ela foi apurada. Foi essa distinção que faltou na primeira
 * versão e encheu a seção "Tecnologia" da Home de matéria policial — ver o
 * comentário de `classifyCategory`.
 */
const CATEGORY_KEYWORDS: Record<Exclude<Category, typeof Category.WORLD>, string[]> = {
  TECHNOLOGY: [
    // Fora daqui desde 21/08: `internet`, `digital`, `celular`, `redes sociais`,
    // `aplicativo(s)`, `computador`, `chip`, `ia` e `programacao`. Nenhuma delas
    // diz do que a matéria trata no jornalismo brasileiro de hoje — "procurou
    // nas redes sociais", "o celular da vítima", "a programação do festival" e
    // "ele ia" (`\bia\b` casa com o imperfeito de "ir") aparecem em qualquer
    // pauta. `redes sociais` sozinha classificou 5 matérias policiais como
    // Tecnologia, e `programacao` deu 7 e 8 pontos a duas agendas culturais.
    'tecnologia', 'tech', 'startup', 'startups', 'software', 'smartphone',
    'inteligencia artificial', 'eletronicos', 'informatica',
    'linguagem de programacao', 'desenvolvedor', 'desenvolvedores', 'hacker',
    'ciberataque', 'ciber', 'robot', 'robos', 'chips', 'nvidia', 'intel', 'apple',
    'google', 'microsoft', 'samsung', 'streaming', '5g', 'openai',
    'chatgpt', 'gpt', 'metaverso', 'realidade virtual',
  ],
  POLITICS: [
    'politica', 'eleicao', 'eleicoes', 'governo', 'presidente', 'senado', 'congresso',
    'camara dos deputados', 'camara', 'ministro', 'ministerio', 'partido', 'partidos',
    'deputado', 'deputados', 'vereador', 'vereadores', 'prefeito', 'prefeitura', 'stf',
    'supremo', 'votacao', 'legislacao', 'diplomacia', 'embaixada', 'brasilia', 'urnas',
    'urna', 'candidato', 'candidatos', 'projeto de lei', 'emenda', 'plebiscito', 'referendo',
  ],
  ECONOMY: [
    // `fundo`/`fundos` saíram: "poço sem fundo" e "fundo do mar" classificaram
    // matéria policial como Economia. `empresa`/`empresas`, `banco` (singular) e
    // `taxa`/`taxas` idem — "a empresa de ônibus informou" aparece em toda
    // matéria de trânsito. As formas compostas abaixo mantêm o sentido econômico.
    'economia', 'economico', 'economica', 'bolsa de valores', 'bolsa', 'dolar', 'euro',
    'inflacao', 'juros', 'pib', 'mercado financeiro', 'banco central', 'bancos',
    'investimento', 'investimentos', 'investidor', 'investidores',
    'fundo de investimento', 'fundos de investimento', 'fundo imobiliario',
    'imposto', 'impostos', 'taxa de juros', 'taxa selic', 'salario', 'salarios',
    'emprego', 'desemprego', 'industria', 'comercio', 'negocios', 'financas',
    'orcamento', 'renda', 'lucro', 'lucros', 'prejuizo', 'divida', 'dividas',
    'credito', 'recessao', 'ibovespa', 'criptomoeda', 'criptomoedas', 'bitcoin',
    'tarifa', 'tarifas', 'cambio', 'exportacao', 'importacao', 'fgts', 'poupanca',
    'poupar', 'contas publicas',
    // Acrescentadas em 21/08: sem `empresa` e `fundos`, matéria de negócios de
    // verdade ("Braskem negocia com credores", "aprova dividendos") ficava sem
    // nenhuma palavra e caía em WORLD. Estas não são ambíguas.
    'credor', 'credores', 'dividendo', 'dividendos', 'acionista', 'acionistas',
    'fusao', 'aquisicao', 'balanco financeiro', 'faturamento', 'receita liquida',
    'reorganizacao societaria', 'societaria', 'falencia', 'recuperacao judicial',
  ],
  SPORTS: [
    // `clube`/`clubes` saíram: "clube de tiro" e "clube social" são vocabulário
    // de matéria policial. As outras palavras de esporte são fortes o bastante.
    'futebol', 'esporte', 'esportes', 'campeonato', 'campeonatos', 'partida', 'partidas',
    'gol', 'gols', 'golo', 'selecao', 'selecoes', 'brasileirao', 'libertadores', 'champions',
    'copa do mundo', 'olimpiadas', 'olimpico', 'tenis', 'formula 1', 'basquete', 'volei',
    'natacao', 'atleta', 'atletas', 'time', 'times', 'torneio',
    'torneios', 'jogador', 'jogadores', 'treinador', 'arbitro', 'estadio', 'nfl', 'nba',
    'maratona', 'ginastica', 'boxe', 'mma', 'esports', 'goleada', 'goleiro',
  ],
  SCIENCE: [
    // `espaco` saiu — "espaço público", "no espaço de dois dias" — e `especie`
    // no singular também, por causa de "uma espécie de". `espacial` e
    // `especies` seguram o sentido científico.
    'ciencia', 'cientifico', 'cientifica', 'cientista', 'cientistas', 'pesquisa',
    'pesquisas', 'pesquisador', 'pesquisadores', 'estudo', 'estudos', 'espacial',
    'nasa', 'universidade', 'universidades', 'fisica', 'quimica', 'biologia', 'genetica',
    'astronomia', 'astronauta', 'planeta', 'planetas', 'descoberta', 'descobertas',
    'laboratorio', 'especies', 'arqueologia', 'fossil', 'dna', 'celula',
    'celulas', 'foguete', 'telescopio', 'satelite', 'marte', 'mudancas climaticas',
    'aquecimento global', 'climaticas',
  ],
  ENTERTAINMENT: [
    'filme', 'filmes', 'serie', 'series', 'musica', 'musicas', 'cantor', 'cantora',
    'cantores', 'cinema', 'celebridade', 'celebridades', 'famoso', 'famosa', 'artista',
    'artistas', 'show', 'shows', 'festival', 'festivais', 'novela', 'novelas', 'ator',
    'atriz', 'atores', 'oscar', 'grammy', 'netflix', 'spotify', 'disney', 'entretenimento',
    'youtuber', 'influenciador', 'influenciadora', 'reality', 'estreia', 'bilheteria',
    'album', 'banda',
  ],
  HEALTH: [
    // `obito`/`obitos` saíram: são vocabulário de matéria policial e de trânsito,
    // não de pauta de saúde.
    'saude', 'medico', 'medicos', 'medica', 'hospital', 'hospitais', 'doenca', 'doencas',
    'vacina', 'vacinacao', 'covid', 'coronavirus', 'pandemia', 'tratamento', 'tratamentos',
    'remedio', 'remedios', 'medicamento', 'medicamentos', 'sus', 'clinica', 'paciente',
    'pacientes', 'sintoma', 'sintomas', 'cirurgia', 'diagnostico',
    'epidemia', 'virus', 'dengue', 'gripe', 'saude publica', 'psicologia', 'oncologia',
    'cardiologia', 'pesquisa medica',
  ],
};

/** Ordem de desempate quando duas categorias empatam em pontuação. */
const CATEGORY_PRIORITY: Exclude<Category, typeof Category.WORLD>[] = [
  Category.TECHNOLOGY,
  Category.POLITICS,
  Category.ECONOMY,
  Category.SPORTS,
  Category.SCIENCE,
  Category.ENTERTAINMENT,
  Category.HEALTH,
];

/**
 * Um acerto no título vale três na descrição.
 *
 * O título é escrito para dizer do que a matéria trata; a descrição é o corpo,
 * e o corpo fala de tudo.
 */
const TITLE_WEIGHT = 3;

/**
 * Quantas palavras **distintas** a descrição precisa casar para decidir sozinha.
 *
 * Cinco, e o número saiu de medição. Contra as 3.688 linhas do acervo de
 * produção, com um gabarito de 24 decisões conferidas à mão, dez regras
 * candidatas foram comparadas em 21/08:
 *
 * | regra | acerto |
 * |---|---|
 * | corpo inteiro, piso 3 (a anterior) | 54% |
 * | lide de 600 ou 800 caracteres, piso 3 | 63% |
 * | **corpo inteiro, piso 5** | **67%** |
 * | lide de 600, piso 5 | 58% |
 * | só o título classifica | 54% |
 *
 * A hipótese de partida era o **lide** — ler só os primeiros 600–800
 * caracteres, porque um lide diz do que a matéria trata e o parágrafo 14
 * divaga. Ela perdeu: cortar o texto tira tanto sinal bom quanto ruim, e o
 * ganho veio de exigir mais evidência, não de ler menos. A maquinaria do lide
 * saiu do código — não se guarda o que a medição rejeitou.
 *
 * **67% é o teto deste método.** Dez regras, intervalo de 54% a 67%: não é
 * falta de ajuste fino, é o limite de casar palavra-chave em corpo de notícia.
 * Subir disso pede classificação por IA — o pipeline já fala com Gemini e Groq
 * —, e isso é trabalho próprio, não mais uma volta no piso.
 */
const MIN_DESCRIPTION_SIGNALS = 5;

/**
 * Quantas vezes a **mesma** palavra ainda conta.
 *
 * Existe porque o extremo oposto também erra. Contar só palavras distintas
 * achata a intensidade: uma matéria com "doença" cinco vezes, "tratamento"
 * três e "diagnóstico" três empatava com uma que cita "série" e "música" uma
 * vez cada, e o desempate por prioridade mandava uma pauta de saúde para
 * Entretenimento. Com teto 2, densidade real de vocabulário ainda pontua, e
 * "redes sociais" nove vezes num texto de 14 mil caracteres não decide nada.
 */
const MAX_OCCURRENCES_PER_KEYWORD = 2;

/**
 * Regex por palavra-chave, compilado uma vez.
 *
 * O pipeline classifica centenas de itens por execução e a versão anterior
 * construía ~400 `RegExp` por notícia.
 */
const KEYWORD_PATTERNS: Record<string, RegExp[]> = Object.fromEntries(
  Object.entries(CATEGORY_KEYWORDS).map(([category, keywords]) => [
    category,
    // A flag `g` é obrigatória: sem ela `String.match` devolve só o primeiro
    // acerto, e a contagem de ocorrências viraria sempre 1. Usar `.match()` e
    // não `.test()` também evita o `lastIndex` pegajoso de um regex global.
    keywords.map((keyword) => new RegExp(`\\b${keyword}\\b`, 'g')),
  ]),
);

/** Normaliza o texto: minúsculas e sem acentos, para casar com as keywords. */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

interface Evidence {
  /** Palavras-chave **distintas** que apareceram — é o que mede abrangência. */
  distinct: number;
  /** Ocorrências somadas, cada palavra contando no máximo `MAX_OCCURRENCES…`. */
  weighted: number;
}

function collectEvidence(patterns: RegExp[], text: string): Evidence {
  let distinct = 0;
  let weighted = 0;

  for (const pattern of patterns) {
    const matches = text.match(pattern)?.length ?? 0;
    if (matches === 0) continue;
    distinct++;
    weighted += Math.min(matches, MAX_OCCURRENCES_PER_KEYWORD);
  }

  return { distinct, weighted };
}

/**
 * Classifica uma notícia pelas palavras-chave do título e da descrição.
 * Retorna `Category.WORLD` quando não há evidência suficiente.
 *
 * **Conta palavras distintas, não ocorrências.** Repetir "redes sociais" nove
 * vezes num texto de 14 mil caracteres não é mais evidência de assunto — é só
 * um texto longo. A versão anterior somava ocorrências, e foi assim que uma
 * matéria sobre moda em Sorocaba virou Tecnologia.
 *
 * **Exige sinal no título ou evidência farta na descrição.** Medido contra as
 * 36 matérias da Home de produção em 21/08: *toda* classificação errada tinha
 * pontuação zero no título e vinha de uma ou duas palavras soltas no corpo, e
 * *toda* classificação certa tinha o título pontuando. Sem esse piso, qualquer
 * matéria policial longa o bastante acaba em alguma categoria — e a Home da V2
 * passou a agrupar por categoria, então o erro foi da grade indiferenciada da
 * V1 para a primeira dobra.
 *
 * O que sobra sem evidência vai para `WORLD`, que é o balde genérico. Não há
 * categoria de polícia/trânsito no enum, e é para lá que esse gênero — o mais
 * comum nos feeds regionais brasileiros — deve cair até existir uma.
 */
export function classifyCategory(title: string, description: string): Category {
  const normalizedTitle = normalize(title);
  const normalizedDescription = normalize(description);

  let best: Category = Category.WORLD;
  let bestScore = 0;
  let bestFromTitle = false;

  for (const category of CATEGORY_PRIORITY) {
    const patterns = KEYWORD_PATTERNS[category] as RegExp[];
    const inTitle = collectEvidence(patterns, normalizedTitle);
    const inDescription = collectEvidence(patterns, normalizedDescription);

    // Abrangência decide **se** a categoria concorre; intensidade decide quem
    // ganha entre as que concorrem.
    const fromTitle = inTitle.distinct > 0;
    const decides = fromTitle || inDescription.distinct >= MIN_DESCRIPTION_SIGNALS;
    if (!decides) continue;

    const score = inTitle.weighted * TITLE_WEIGHT + inDescription.weighted;

    // Título antes de pontuação, pontuação antes de prioridade.
    //
    // Sem a primeira regra, "Justiça concede habeas corpus a **influenciador**
    // PTK" empatava 5 a 5 — Entretenimento pelo título, Política por quatro
    // palavras soltas no corpo — e a ordem de `CATEGORY_PRIORITY` entregava a
    // matéria para Política. Empate entre evidência de título e evidência de
    // corpo não é empate; a prioridade só decide entre iguais.
    //
    // `bestScore === 0` significa "nada escolhido ainda": toda categoria que
    // passa em `decides` pontua no mínimo 3.
    const better =
      bestScore === 0
        ? true
        : bestFromTitle === fromTitle
          ? score > bestScore
          : fromTitle;

    if (better) {
      best = category;
      bestScore = score;
      bestFromTitle = fromTitle;
    }
  }

  return best;
}
