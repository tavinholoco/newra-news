import { Category } from '@newranews/database';

/**
 * Palavras-chave por categoria (pt-BR, já normalizadas: minúsculas e sem acentos).
 * Usadas para classificar notícias de feeds RSS genéricos que não declaram categoria.
 */
const CATEGORY_KEYWORDS: Record<Exclude<Category, typeof Category.WORLD>, string[]> = {
  TECHNOLOGY: [
    'tecnologia', 'tech', 'startup', 'startups', 'software', 'aplicativo', 'aplicativos',
    'celular', 'smartphone', 'inteligencia artificial', 'internet', 'digital', 'computador',
    'eletronicos', 'informatica', 'programacao', 'desenvolvedor', 'desenvolvedores', 'hacker',
    'ciberataque', 'ciber', 'robot', 'robos', 'chip', 'chips', 'nvidia', 'intel', 'apple',
    'google', 'microsoft', 'samsung', 'redes sociais', 'streaming', '5g', 'ia', 'openai',
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
    'economia', 'economico', 'economica', 'bolsa de valores', 'bolsa', 'dolar', 'euro',
    'inflacao', 'juros', 'pib', 'mercado financeiro', 'banco central', 'banco', 'bancos',
    'investimento', 'investimentos', 'investidor', 'investidores', 'fundo', 'fundos',
    'imposto', 'impostos', 'taxa', 'taxas', 'salario', 'salarios', 'emprego', 'desemprego',
    'industria', 'comercio', 'negocios', 'empresa', 'empresas', 'financas', 'orcamento',
    'renda', 'lucro', 'lucros', 'prejuizo', 'divida', 'dividas', 'credito', 'recessao',
    'ibovespa', 'criptomoeda', 'criptomoedas', 'bitcoin', 'tarifa', 'tarifas', 'cambio',
    'exportacao', 'importacao', 'fgts', 'poupanca', 'poupar', 'contas publicas',
  ],
  SPORTS: [
    'futebol', 'esporte', 'esportes', 'campeonato', 'campeonatos', 'partida', 'partidas',
    'gol', 'gols', 'golo', 'selecao', 'selecoes', 'brasileirao', 'libertadores', 'champions',
    'copa do mundo', 'olimpiadas', 'olimpico', 'tenis', 'formula 1', 'basquete', 'volei',
    'natacao', 'atleta', 'atletas', 'time', 'times', 'clube', 'clubes', 'torneio',
    'torneios', 'jogador', 'jogadores', 'treinador', 'arbitro', 'estadio', 'nfl', 'nba',
    'maratona', 'ginastica', 'boxe', 'mma', 'esports', 'goleada', 'goleiro',
  ],
  SCIENCE: [
    'ciencia', 'cientifico', 'cientifica', 'cientista', 'cientistas', 'pesquisa',
    'pesquisas', 'pesquisador', 'pesquisadores', 'estudo', 'estudos', 'espaco', 'espacial',
    'nasa', 'universidade', 'universidades', 'fisica', 'quimica', 'biologia', 'genetica',
    'astronomia', 'astronauta', 'planeta', 'planetas', 'descoberta', 'descobertas',
    'laboratorio', 'especie', 'especies', 'arqueologia', 'fossil', 'dna', 'celula',
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
    'saude', 'medico', 'medicos', 'medica', 'hospital', 'hospitais', 'doenca', 'doencas',
    'vacina', 'vacinacao', 'covid', 'coronavirus', 'pandemia', 'tratamento', 'tratamentos',
    'remedio', 'remedios', 'medicamento', 'medicamentos', 'sus', 'clinica', 'paciente',
    'pacientes', 'obito', 'obitos', 'sintoma', 'sintomas', 'cirurgia', 'diagnostico',
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

/** Normaliza o texto: minúsculas e sem acentos, para casar com as keywords. */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/**
 * Classifica uma notícia por palavras-chave no título (peso 2) e na descrição (peso 1).
 * Retorna `Category.WORLD` quando nenhuma keyword casa.
 */
export function classifyCategory(title: string, description: string): Category {
  const normalizedTitle = normalize(title);
  const normalizedDescription = normalize(description);

  let best: Category = Category.WORLD;
  let bestScore = 0;

  for (const category of CATEGORY_PRIORITY) {
    let score = 0;
    for (const keyword of CATEGORY_KEYWORDS[category]) {
      const regex = new RegExp(`\\b${keyword}\\b`, 'g');
      const titleMatches = normalizedTitle.match(regex)?.length ?? 0;
      const descriptionMatches = normalizedDescription.match(regex)?.length ?? 0;
      score += titleMatches * 2 + descriptionMatches;
    }
    if (score > bestScore) {
      best = category;
      bestScore = score;
    }
  }

  return best;
}
