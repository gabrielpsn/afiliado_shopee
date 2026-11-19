import { describe, it, expect } from 'vitest'

import {
  corpoBuscaOfertas,
  corpoOfertaPorItem,
  extrairOfertas,
  precoDaOferta,
  comissaoPercentual,
  ofertaVencendo,
  formatarVendas,
  ofertaParaLinhaLote,
  COLUNAS_LOTE,
} from '../../src/engine/shopee-api.js'
import { validarBusca, selecionarOfertas, linhaDePreco, lerArgumentos } from '../../scripts/catalogo-api.js'
import { normalizarLinha } from '../../scripts/importar-batch.js'

// Formato real devolvido pela API em 19/11/2026.
const oferta = (extra = {}) => ({
  itemId: 55260497129,
  productName: 'Kit Estética Automotiva Vonixx V-Floc',
  priceMin: '93.58',
  priceMax: '93.58',
  commissionRate: '0.14',
  commission: '13.1012',
  sales: 6123,
  shopName: 'Yamase Loja Oficial',
  shopId: 316945044,
  productLink: 'https://shopee.com.br/product/316945044/55260497129',
  offerLink: 'https://s.shopee.com.br/40iDgMY9iF',
  imageUrl: 'https://cf.shopee.com.br/file/abc',
  periodEndTime: 32503651199,
  ...extra,
})

describe('corpoBuscaOfertas', () => {
  it('é JSON válido com a query que a API entende', () => {
    const corpo = corpoBuscaOfertas({ busca: 'fone bluetooth', ordem: 'comissao', pagina: 2, limite: 10 })
    const { query } = JSON.parse(corpo)
    expect(query).toContain('keyword: "fone bluetooth"')
    expect(query).toContain('sortType: 5')
    expect(query).toContain('page: 2')
    expect(query).toContain('limit: 10')
    expect(query).toContain('offerLink')
  })

  it('aspas na busca não quebram a query nem abrem injeção', () => {
    const { query } = JSON.parse(corpoBuscaOfertas({ busca: 'tv 50" } ) { x' }))
    expect(query).toContain('keyword: "tv 50\\" } ) { x"')
  })

  it('limite passa de 50 nunca: a API devolve erro em vez de cortar', () => {
    const { query } = JSON.parse(corpoBuscaOfertas({ busca: 'x', limite: 500 }))
    expect(query).toContain('limit: 50')
  })

  it('ignora categoria e loja que não são número', () => {
    const { query } = JSON.parse(corpoBuscaOfertas({ busca: 'x', categoriaShopee: 'abc', lojaId: '-1' }))
    expect(query).not.toContain('productCatId:')
    expect(query).not.toContain('shopId:')
  })

  it('por item consulta só aquele id', () => {
    expect(JSON.parse(corpoOfertaPorItem('123')).query).toContain('productOfferV2(itemId: 123)')
  })
})

describe('extrairOfertas', () => {
  it('lê nós e paginação', () => {
    const r = extrairOfertas({ data: { productOfferV2: { nodes: [oferta()], pageInfo: { hasNextPage: true } } } })
    expect(r.ofertas).toHaveLength(1)
    expect(r.temMais).toBe(true)
  })

  it('resposta torta vira lista vazia', () => {
    expect(extrairOfertas(null)).toEqual({ ofertas: [], temMais: false })
    expect(extrairOfertas({ data: { productOfferV2: { nodes: [null, {}] } } }).ofertas).toEqual([])
  })
})

describe('preço e comissão da oferta', () => {
  it('marca faixa quando há variação de preço', () => {
    expect(precoDaOferta(oferta({ priceMin: '18.99', priceMax: '30.99' }))).toEqual({ preco: 18.99, precoMax: 30.99, faixa: true })
    expect(precoDaOferta(oferta()).faixa).toBe(false)
    expect(precoDaOferta(oferta({ priceMin: '0' }))).toBe(null)
  })

  it('converte a taxa fracionária em porcentagem sem erro de float', () => {
    expect(comissaoPercentual(oferta({ commissionRate: '0.075' }))).toBe(7.5)
    expect(comissaoPercentual(oferta({ commissionRate: '0.14' }))).toBe(14)
    expect(comissaoPercentual(oferta({ commissionRate: '' }))).toBe(null)
  })

  it('oferta que vence na semana fica de fora', () => {
    const agora = Date.UTC(2026, 10, 19)
    expect(ofertaVencendo(oferta({ periodEndTime: agora / 1000 + 86400 }), { agora })).toBe(true)
    expect(ofertaVencendo(oferta(), { agora })).toBe(false)
  })

  it('vendas no formato do painel', () => {
    expect(formatarVendas(6123)).toBe('6mil+')
    expect(formatarVendas(33)).toBe('33')
    expect(formatarVendas(2_400_000)).toBe('2mi+')
    expect(formatarVendas(null)).toBe('')
  })
})

describe('ofertaParaLinhaLote', () => {
  it('gera uma linha que o importador lê sem erro e com os mesmos valores', () => {
    const { linha, erros } = ofertaParaLinhaLote(oferta())
    expect(erros).toEqual([])
    expect(Object.keys(linha)).toEqual(COLUNAS_LOTE)

    const r = normalizarLinha(linha)
    expect(r.erros).toEqual([])
    expect(r.itemId).toBe('55260497129')
    expect(r.preco).toBe(93.58)
    expect(r.comissaoPct).toBe(14)
    expect(r.comissao).toBeCloseTo(13.1, 2)
    expect(r.linkCurto).toBe('40iDgMY9iF')
    expect(r.shopId).toBe('316945044')
  })

  it('não completa nome, preço ou link com palpite', () => {
    expect(ofertaParaLinhaLote(oferta({ productName: '' })).linha).toBe(null)
    expect(ofertaParaLinhaLote(oferta({ priceMin: null })).linha).toBe(null)
    expect(ofertaParaLinhaLote(oferta({ offerLink: 'https://shopee.com.br/x' })).linha).toBe(null)
  })

  it('monta o Product Link pelos ids quando a API não manda', () => {
    const { linha } = ofertaParaLinhaLote(oferta({ productLink: '' }))
    expect(linha['Product Link']).toBe('https://shopee.com.br/product/316945044/55260497129')
  })
})

describe('validarBusca', () => {
  it('aplica padrões', () => {
    const b = validarBusca({ busca: 'fone' })
    expect(b).toMatchObject({ ordem: 'vendas', quantidade: 20, comissaoMinima: 0, erros: [] })
  })

  it('recusa linha que consultaria a Shopee inteira', () => {
    expect(validarBusca({}).erros[0]).toMatch(/sem busca/)
  })

  it('recusa ordem e quantidade inválidas', () => {
    expect(validarBusca({ busca: 'x', ordem: 'barato' }).erros.join()).toMatch(/ordem/)
    expect(validarBusca({ busca: 'x', quantidade: '0' }).erros.join()).toMatch(/quantidade/)
  })

  it('aceita comissão mínima com %', () => {
    expect(validarBusca({ busca: 'x', comissaoMinima: '8%' }).comissaoMinima).toBe(8)
  })
})

describe('selecionarOfertas', () => {
  it('pula item que já está no catálogo, para não dar um segundo link ao mesmo produto', () => {
    const conhecidos = new Set(['55260497129'])
    const r = selecionarOfertas([oferta()], { conhecidos })
    expect(r.aceitas).toEqual([])
    expect(r.recusadas.jaNoCatalogo).toBe(1)
  })

  it('recusa faixa de preço por padrão e aceita com a opção', () => {
    const faixa = oferta({ priceMin: '10', priceMax: '20' })
    expect(selecionarOfertas([faixa], { conhecidos: new Set() }).recusadas.faixaDePreco).toBe(1)
    expect(selecionarOfertas([faixa], { conhecidos: new Set(), aceitarFaixa: true }).aceitas).toHaveLength(1)
  })

  it('aplica comissão mínima', () => {
    const r = selecionarOfertas([oferta({ commissionRate: '0.05' })], { conhecidos: new Set(), comissaoMinima: 8 })
    expect(r.recusadas.comissaoBaixa).toBe(1)
  })

  it('o mesmo item em duas buscas entra uma vez só', () => {
    const conhecidos = new Set()
    selecionarOfertas([oferta()], { conhecidos })
    expect(selecionarOfertas([oferta()], { conhecidos }).aceitas).toEqual([])
  })
})

describe('linhaDePreco', () => {
  it('grava preço conferido', () => {
    expect(linhaDePreco('1', oferta(), '2026-11-19')).toMatchObject({ preco: 93.58, situacao: 'ok', comissaoPct: 14 })
  })

  it('sem oferta é fora-da-oferta, sem preço', () => {
    expect(linhaDePreco('1', undefined, '2026-11-19')).toMatchObject({ preco: '', situacao: 'fora-da-oferta' })
  })
})

describe('lerArgumentos', () => {
  it('escolhe a tarefa e as opções', () => {
    expect(lerArgumentos(['precos', '--limite', '20'])).toMatchObject({ tarefa: 'precos', limite: 20 })
    expect(lerArgumentos(['--simular', '--aceitar-faixa'])).toMatchObject({ tarefa: 'buscar', simular: true, aceitarFaixa: true })
  })
})
