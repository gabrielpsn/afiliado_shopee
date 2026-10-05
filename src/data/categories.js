// Taxonomia inicial. Os ids são o que o CSV de produtos referencia na coluna
// `categoria`, então mudar um id aqui invalida os produtos que o usavam.
//
// Estes são categorias genéricas para vitrine de afiliados: uma taxonomia de
// partida, não definitiva. Assim que os produtos estiverem preenchidos no
// `data/produtos.csv`, vale conferir quais sobraram vazias e renomear as que
// precisarem — `scripts/check-links.js` acusa categoria com id inexistente.

export const CATEGORIAS = [
  {
    id: 'eletronicos',
    nome: 'Eletrônicos',
    descricao: 'Fones, carregadores, caixas de som e acessórios',
    icone: '📱',
    ordem: 1,
  },
  {
    id: 'informatica',
    nome: 'Informática',
    descricao: 'Teclado, mouse, notebook, monitor e acessórios',
    icone: '💻',
    ordem: 2,
  },
  {
    id: 'casa-e-cozinha',
    nome: 'Casa e Cozinha',
    descricao: 'Utensílios, organização, travesseiros e decoração',
    icone: '🏠',
    ordem: 3,
  },
  {
    id: 'moda',
    nome: 'Moda e Acessórios',
    descricao: 'Roupas, calçados, bolsas e óculos',
    icone: '👟',
    ordem: 4,
  },
  {
    id: 'beleza',
    nome: 'Beleza e Cuidados',
    descricao: 'Skincare, haircare, maquilhagem e perfumes',
    icone: '💄',
    ordem: 5,
  },
  {
    id: 'esportes',
    nome: 'Esportes e Fitness',
    descricao: 'Treino, corrida, musculação e yoga',
    icone: '🏋️',
    ordem: 6,
  },
  {
    id: 'ferramentas',
    nome: 'Ferramentas',
    descricao: 'Ferramentas manuais, elétricas e medição',
    icone: '🔧',
    ordem: 7,
  },
  {
    id: 'baby',
    nome: 'Bebê e Criança',
    descricao: 'Carrinhos, brinquedos, fraldas e cuidado',
    icone: '🧸',
    ordem: 8,
  },
  {
    id: 'pet',
    nome: 'Pet Shop',
    descricao: 'Petiscos, brinquedos, acessórios e higiene',
    icone: '🐾',
    ordem: 9,
  },
  {
    id: 'outros',
    nome: 'Outros',
    descricao: 'Tudo o que não se encaixa nas demais categorias',
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
