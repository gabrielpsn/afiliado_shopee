import { describe, it, expect } from 'vitest'

import {
  ORDENS,
  buscarProdutos,
  filtrarProdutos,
  nomeCurto,
  ordenarProdutos,
  pontuarBusca,
  vendasNumericas,
} from '../../src/engine/busca.js'
import { PRODUCTS } from '../../src/data/products.js'

const produto = (over) => ({
  nome: 'Produto',
  preco: 10,
  categoria: 'outros',
  vendas: '0',
  loja: '',
  tags: [],
  ...over,
})

describe('vendasNumericas', () => {
  it('lê os dois formatos que a Shopee usa', () => {
    // A exportação só produz "Nmil+" e "Nmi+"; nenhum valor do catálogo tem
    // vírgula decimal, então não há o que converter nesse formato.
    expect(vendasNumericas('10mil+')).toBe(10_000)
    expect(vendasNumericas('400mil+')).toBe(400_000)
    expect(vendasNumericas('1mi+')).toBe(1_000_000)
    expect(vendasNumericas('313')).toBe(313)
  })

  it('trata "mil" antes de "mi", senão 1mi vira 1000', () => {
    // "mi" está contido em "mil": testar o inverso faz 1mi+ virar 1.000.
    expect(vendasNumericas('1mi+')).toBe(1_000_000)
    expect(vendasNumericas('2mil')).toBe(2000)
  })

  it('devolve -1 para o que não é número, para o produto ir para o fim', () => {
    expect(vendasNumericas('')).toBe(-1)
    expect(vendasNumericas(null)).toBe(-1)
    expect(vendasNumericas('muitos')).toBe(-1)
  })
})

describe('pontuarBusca', () => {
  it('exige todos os termos: busca por palavra ausente não é resultado', () => {
    const p = produto({ nome: 'Fone de Ouvido Bluetooth TWS' })
    expect(pontuarBusca(p, ['fone', 'bluetooth'])).toBeGreaterThan(0)
    expect(pontuarBusca(p, ['fone', 'furadeira'])).toBe(0)
  })

  it('normaliza acento e caixa dos dois lados', () => {
    const p = produto({ nome: 'Fone MÁXIMO' })
    expect(pontuarBusca(p, ['maximo'])).toBeGreaterThan(0)
  })

  it('acha por palavra dentro do nome, não por prefixo do slug', () => {
    const p = produto({ nome: 'Kit 6 Formas de Silicone para Fritadeira' })
    expect(pontuarBusca(p, ['silicone'])).toBeGreaterThan(0)
  })

  it('prefere quem começa com o termo buscado', () => {
    const noComeco = produto({ nome: 'Fone Bluetooth' })
    const noMeio = produto({ nome: 'Kit Compatível com Fone Bluetooth' })
    expect(pontuarBusca(noComeco, ['fone'])).toBeGreaterThan(pontuarBusca(noMeio, ['fone']))
  })

  it('considera o nome da loja, porque é o que o visitante digita', () => {
    const p = produto({ nome: 'Garrafa Térmica', loja: 'Morando Store' })
    expect(pontuarBusca(p, ['morando'])).toBeGreaterThan(0)
  })

  it('não quebra com produto sem tags, loja ou vendas', () => {
    const cru = { nome: 'Fone Simples', preco: 1 }
    expect(pontuarBusca(cru, ['fone'])).toBeGreaterThan(0)
  })
})

describe('filtrarProdutos', () => {
  const lista = [
    produto({ nome: 'Fone Bluetooth TWS', categoria: 'eletronicos', preco: 50 }),
    produto({ nome: 'Fone com Fio', categoria: 'eletronicos', preco: 20 }),
    produto({ nome: 'Furadeira', categoria: 'ferramentas', preco: 90 }),
  ]

  it('sem busca devolve tudo da categoria', () => {
    expect(filtrarProdutos(lista, { categoria: 'eletronicos' })).toHaveLength(2)
  })

  it('filtra por categoria e busca ao mesmo tempo', () => {
    const r = filtrarProdutos(lista, { busca: 'fone', categoria: 'eletronicos' })
    expect(r).toHaveLength(2)
    expect(filtrarProdutos(lista, { busca: 'furadeira', categoria: 'eletronicos' })).toHaveLength(0)
  })

  it('não mexe na lista recebida', () => {
    const original = [...lista]
    filtrarProdutos(lista, { busca: 'fone' })
    expect(lista).toEqual(original)
  })

  it('acha produtos reais do catálogo por termo', () => {
    const achados = filtrarProdutos(PRODUCTS, { busca: 'fone' })
    expect(achados.length).toBeGreaterThan(0)
    expect(achados.every((p) => /fone/i.test(p.nome))).toBe(true)
  })
})

describe('ordenarProdutos', () => {
  const lista = [
    produto({ nome: 'B', preco: 30, vendas: '10mil+' }),
    produto({ nome: 'A', preco: 10, vendas: '10mil+' }),
    produto({ nome: 'C', preco: 20, vendas: '400mil+' }),
  ]

  it('mais vendidos primeiro, e no empate o mais barato', () => {
    const r = ordenarProdutos(lista, 'vendidos').map((p) => p.nome)
    expect(r).toEqual(['C', 'A', 'B'])
  })

  it('ordena por preço nas duas pontas', () => {
    expect(ordenarProdutos(lista, 'menor-preco').map((p) => p.nome)).toEqual(['A', 'C', 'B'])
    expect(ordenarProdutos(lista, 'maior-preco').map((p) => p.nome)).toEqual(['B', 'C', 'A'])
  })

  it('relevância devolve a lista como veio', () => {
    expect(ordenarProdutos(lista, 'relevancia').map((p) => p.nome)).toEqual(['B', 'A', 'C'])
    expect(ordenarProdutos(lista, 'ordem-inexistente').map((p) => p.nome)).toEqual(['B', 'A', 'C'])
  })

  it('junta as duas etapas sem perder produto', () => {
    const r = buscarProdutos(PRODUCTS, { busca: 'kit', ordem: 'menor-preco' })
    expect(r.length).toBeGreaterThan(0)
    for (let i = 1; i < r.length; i++) expect(r[i - 1].preco).toBeLessThanOrEqual(r[i].preco)
  })
})

describe('nomeCurto', () => {
  it('não mexe em nome que já cabe', () => {
    expect(nomeCurto('Fone TWS')).toBe('Fone TWS')
  })

  it('corta na última palavra inteira, sem deixar pedaços soltos', () => {
    const r = nomeCurto('Kit 6 Formas de Silicone Compatível para Fritadeira Air Fryer', 30)
    expect(r.endsWith('…')).toBe(true)
    expect(r).not.toMatch(/\b(de|para|com)$/)
  })

  it('não quebra palavra única que não cabe', () => {
    expect(nomeCurto('Supercalifragilisticexpialidocious', 10)).toBe('Supercalif…')
  })

  it('aceita nome ausente sem estourar', () => {
    expect(nomeCurto(null)).toBe('')
    expect(nomeCurto(undefined)).toBe('')
  })
})

describe('ORDENS', () => {
  it('toda ordem de UI tem implementação, senão o select filtra por engano', () => {
    // O select de ordenação é gerado a partir daqui. Se alguém acrescentar uma
    // opção sem caso no switch, ela sai sem aviso e o filtro "não funciona".
    const lista = [produto({ nome: 'X', preco: 10, vendas: '5mil+' })]
    for (const { id } of ORDENS) {
      const r = ordenarProdutos(lista, id)
      expect(Array.isArray(r), id).toBe(true)
      expect(r).toHaveLength(1)
    }
  })
})