// Taxonomia da vitrine. O `id` é o que o `data/produtos.csv` referencia na coluna
// `categoria`, então trocar um id aqui invalida os produtos que o usavam.
//
// Os ids foram escolhidos para casar 1:1 com as regras de `src/engine/categorizar.js`.
// A ordem é de leitura, não alfabética: as categorias mais cheias vêm primeiro para
// que o usuário não Role 600 px para achar algo. `papelaria` e `livros` vieram sem
// produto nesta exportação, mas ficam no lugar porque são ids válidos para quando
// entrar algo — `getCategoriasComContagem()` esconde as vazias da vitrine.

export const CATEGORIAS = [
  {
    id: 'casa-e-cozinha',
    nome: 'Cozinha e utilidades',
    descricao: 'Panela, pote hermético, organizador e limpeza do dia a dia',
    icone: '🍳',
    ordem: 1,
  },
  {
    id: 'moda-feminina',
    nome: 'Moda feminina',
    descricao: 'Roupa, calça, lingerie e acessório feminino',
    icone: '👗',
    ordem: 2,
  },
  {
    id: 'eletronicos',
    nome: 'Eletrônicos',
    descricao: 'Fone, carregador, power bank, relógio inteligente e acessório',
    icone: '🎧',
    ordem: 3,
  },
  {
    id: 'casa-e-decoracao',
    nome: 'Casa e decoração',
    descricao: 'Móvel, cama, banho, tapete e decoração',
    icone: '🛋️',
    ordem: 4,
  },
  {
    id: 'eletrodomesticos',
    nome: 'Eletrodomésticos',
    descricao: 'Air fryer, cafeteira, fritadeira, ventilador e linha branca',
    icone: '⚡',
    ordem: 5,
  },
  {
    id: 'beleza',
    nome: 'Beleza e cuidados',
    descricao: 'Shampoo, skincare, perfume, secador e manicure',
    icone: '💄',
    ordem: 6,
  },
  {
    id: 'automotivo',
    nome: 'Automotivo e moto',
    descricao: 'Peça, acessórios e cuidado para carro e moto',
    icone: '🚗',
    ordem: 7,
  },
  {
    id: 'pet',
    nome: 'Pet',
    descricao: 'Petisco, brinquedo e cuidado para cachorro e gato',
    icone: '🐾',
    ordem: 8,
  },
  {
    id: 'calcados',
    nome: 'Calçados e meias',
    descricao: 'Tênis, chinelo, bota, meia e palmilha',
    icone: '👟',
    ordem: 9,
  },
  {
    id: 'moda-masculina',
    nome: 'Moda masculina',
    descricao: 'Camiseta, calça, cueca e polo',
    icone: '👕',
    ordem: 10,
  },
  {
    id: 'infantil',
    nome: 'Infantil e brinquedos',
    descricao: 'Brinquedo, carrinho, pijama e acessório kids',
    icone: '🧸',
    ordem: 11,
  },
  {
    id: 'ferramentas',
    nome: 'Ferramentas',
    descricao: 'Jogo de chave, furadeira, disco de corte e medição',
    icone: '🔧',
    ordem: 12,
  },
  {
    id: 'fitness',
    nome: 'Fitness e esportes',
    descricao: 'Treino, corrida, bicicleta e acessórios esportivos',
    icone: '🏋️',
    ordem: 13,
  },
  {
    id: 'camping-viagem',
    nome: 'Camping, praia e viagem',
    descricao: 'Cooler, barraca, piscina inflável e guarda-chuva',
    icone: '⛺',
    ordem: 14,
  },
  {
    id: 'saude',
    nome: 'Saúde e suplementos',
    descricao: 'Creatina, psylium, vitaminas e chá verde',
    icone: '💊',
    ordem: 15,
  },
  {
    id: 'papelaria',
    nome: 'Papelaria e escritório',
    descricao: 'Caderno, caneta, agenda e organização de mesa',
    icone: '✏️',
    ordem: 16,
  },
  {
    id: 'livros',
    nome: 'Livros',
    descricao: 'Livro, devocional e leitura em geral',
    icone: '📚',
    ordem: 17,
  },
  {
    id: 'outros',
    nome: 'Outros',
    descricao: 'Tudo que não se encaixa nas categorias acima',
    icone: '📦',
    ordem: 99,
  },
]

export function getCategoria(id) {
  return CATEGORIAS.find((c) => c.id === id) || null
}

export function categoriasOrdenadas() {
  return [...CATEGORIAS].sort((a, b) => a.ordem - b.ordem)
}