import { describe, it, expect } from 'vitest'

import {
  REGRAS_CATEGORIA,
  categorizar,
  categorizarTodos,
  tokenizar,
  CATEGORIA_PADRAO,
} from '../../src/engine/categorizar.js'
import { CATEGORIAS } from '../../src/data/categories.js'
import { normalizar } from '../../src/engine/format.js'
import { PRODUCTS } from '../../src/data/products.js'

const idsDeCategoria = new Set(CATEGORIAS.map((c) => c.id))

describe('tokenizar', () => {
  it('tira acento, pontuação e caixa', () => {
    expect(tokenizar('Fone Bluetooth TWS — Sem Fio, 2ª Geração')).toEqual([
      'fone',
      'bluetooth',
      'tws',
      'sem',
      'fio',
      '2',
      'geracao',
    ])
  })
})

describe('categorizar', () => {
  it('classifica produto de exemplo para a categoria certa', () => {
    const casos = [
      ['DESINFETANTE HERBAL PET CONCENTRADO 1L', 'pet'],
      ['Camisa Masculina Polo Estampada Preta', 'moda-masculina'],
      ['Blusa Feminina Ribana Canelada', 'moda-feminina'],
      ['Cadeira de Musculação Ajustável', 'fitness'],
      ['Tênis de Corrida Masculino Carbono', 'calcados'],
      ['Air Fryer 3,5 Litros 1400w', 'eletrodomesticos'],
      ['Impressora Multifuncional HP 2975 Wifi', 'eletronicos'],
      ['Kit 6 Forma de Silicone para Fritadeira Air Fryer', 'casa-e-cozinha'],
      ['SACHÊ MÁSCARA FACIAL PEEL OFF', 'beleza'],
      ['Fone Bluetooth Gamer E-sports', 'eletronicos'],
      ['Kit Completo para Estética Automotiva', 'automotivo'],
      ['Capa Colchão Impermeável Casal', 'casa-e-decoracao'],
      ['Carrinho Controle Remoto Infantil', 'infantil'],
      ['Barraca Camping 2 Lugares', 'camping-viagem'],
      ['Jogo de Chave Catraca 46 Peças', 'ferramentas'],
      ['Caderno Executivo Agenda', 'papelaria'],
      ['Kit Creativity 1000 Exercícios Para Colorir', CATEGORIA_PADRAO],
    ]

    for (const [nome, esperado] of casos) {
      expect(categorizar(nome), nome).toBe(esperado)
    }
  })

  it('não deixa "casa" casar com "casaco"', () => {
    // A palavra "casa" é a origem do erro mais caro aqui: um casacoclassificado
    // como cozinha some da vitrine de moda e aparece na prateleira errada.
    expect(categorizar('Casaco de Inverno')).not.toBe('casa-e-cozinha')
  })

  it('classifica frase com acento em modo texto', () => {
    // O modo texto compara termo normalizado contra token normalizado; se um dos
    // lados não for normalizado, "máscara facial" nunca casa e a categoria
    // some em silêncio.
    expect(categorizar('Sachê Máscara Facial Limpeza Profunda')).toBe('beleza')
    expect(categorizar('Papel Toalha Interfolhado 2 Rolos')).toBe('casa-e-cozinha')
  })

  it('pega plural e gênero que a palavra exata deixaria passar', () => {
    expect(categorizar('Camisetas Femininas Cristãs')).toBe('moda-feminina')
    expect(categorizar('Kit 3 Camisetas Masculinas Proteção UV')).toBe('moda-masculina')
    expect(categorizar('Shorts de Exercício para Mulheres')).toBe('moda-feminina')
  })

  it('devolve a categoria padrão para entrada inútil, em vez de inventar', () => {
    expect(categorizar('')).toBe(CATEGORIA_PADRAO)
    expect(categorizar(null)).toBe(CATEGORIA_PADRAO)
    expect(categorizar('Seringa Insulina 0,5ml Estéril')).toBe(CATEGORIA_PADRAO)
  })

  it('é determinístico: mesmo nome, mesma categoria, sempre', () => {
    const nomes = [
      'Fone Bluetooth TWS',
      'Kit Panela Pressurizada 5 Peças',
      'Meia Masculina Esportiva',
    ]
    const primeira = nomes.map((n) => categorizar(n))
    for (let i = 0; i < 20; i++) {
      expect(nomes.map((n) => categorizar(n))).toEqual(primeira)
    }
  })

  it('toda regra aponta para uma categoria que existe em categories.js', () => {
    const ids = new Set(CATEGORIAS.map((c) => c.id))
    for (const regra of REGRAS_CATEGORIA) {
      expect(ids.has(regra.id), `categoria "${regra.id}" não está em categories.js`).toBe(true)
    }
  })

  it('toda categoria de categories.js tem regra, senão vira beco sem saída', () => {
    const comRegra = new Set(REGRAS_CATEGORIA.map((r) => r.id))
    for (const c of CATEGORIAS) {
      if (c.id === CATEGORIA_PADRAO) continue
      expect(comRegra.has(c.id), `categoria "${c.id}" não tem regra`).toBe(true)
    }
  })

  it('não repete o mesmo termo em duas regras, senão a segunda é morta', () => {
    // A primeira regra vence sempre, então um termo repetido mais abaixo nunca
    // roda — e ler o arquivo sem saber disso dá a impressão de que ele conta.
    //
    // A chave passa pela mesma normalização que `casa()` faz. Comparar o texto
    // cru deixaria passar par como 'cinturao'/'cinturão', que depois de
    // normalizar são o mesmo termo: um dead weight silencioso.
    const vistos = new Map()
    const repetidos = []

    for (const regra of REGRAS_CATEGORIA) {
      for (const [termo] of regra.termos) {
        const chave = normalizar(termo).replace(/[^a-z0-9]+/g, ' ').trim()
        if (vistos.has(chave)) repetidos.push(`${chave} (${vistos.get(chave)} e ${regra.id})`)
        else vistos.set(chave, regra.id)
      }
    }

    expect(repetidos).toEqual([])
  })

  it('nenhum termo degenera para vazio depois de normalizar', () => {
    // 'po:' (que era resto de "TAMANHO: P/M/G") vira o substring 'po' e passa a
    // casar com "Polo" e "Imposto". Um termo vazio é sempre erro de digitação.
    const degenerados = []

    for (const regra of REGRAS_CATEGORIA) {
      for (const [termo] of regra.termos) {
        const alvo = normalizar(termo).replace(/[^a-z0-9]+/g, ' ').trim()
        if (!alvo) degenerados.push(`${termo} (em ${regra.id})`)
      }
    }

    expect(degenerados).toEqual([])
  })

  it('classifica o catálogo inteiro sem categoria desconhecida quando existe regra', () => {
    // Rede de segurança: o classificador pode deixar cair em `outros`, mas
    // nunca num id que não existe — esse viraria card sem categoria na vitrine.
    const invalidos = PRODUCTS.filter(
      (p) => !idsDeCategoria.has(p.categoria)
    )

    expect(invalidos.map((p) => p.slug)).toEqual([])
  })

  it('categorizaTodos preserva a ordem de entrada', () => {
    const nomes = ['Fone Bluetooth', 'Kit 3 Camisetas Masculinas', 'Cadeira de Musculação']
    expect(categorizarTodos(nomes)).toEqual(['eletronicos', 'moda-masculina', 'fitness'])
  })
})