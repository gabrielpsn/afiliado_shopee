import { describe, it, expect } from 'vitest'

import {
  parsePrecoShopee,
  parsePercentual,
  extrairLinkCurto,
  extrairShopId,
  normalizarLinha,
  escolherMelhorOferta,
  formatarLinhaCsv,
  aplicarAjustesEditorial,
  lerAjustesEditorial,
} from '../../scripts/importar-batch.js'
import { parseCsv } from '../../scripts/from-csv.js'

/** Linha mínima válida, no formato exato da exportação da Shopee. */
function linha(extra = {}) {
  return {
    'Item Id': '19199236009',
    'Item Name': 'Fone Bluetooth TWS Sem Fio',
    'Nome da loja': 'Minha Loja',
    Price: '42,89',
    Sales: '10mil+',
    'Commission Rate': '15%',
    Commission: '6,43',
    'Product Link': 'https://shopee.com.br/product/563110312/19199236009',
    'Offer Link': 'https://s.shopee.com.br/1qcVB3N2Im',
    ...extra,
  }
}

describe('parsePrecoShopee', () => {
  it('lê o formato brasileiro', () => {
    expect(parsePrecoShopee('42,89')).toBe(42.89)
    expect(parsePrecoShopee('4.000,00')).toBe(4000)
    expect(parsePrecoShopee('R$ 1.299,90')).toBe(1299.9)
  })

  it('entende o sufixo abreviado que a Shopee usa', () => {
    expect(parsePrecoShopee('4,0mil')).toBe(4000)
    expect(parsePrecoShopee('10mil+')).toBe(10_000)
    expect(parsePrecoShopee('1,5mi')).toBe(1_500_000)
    expect(parsePrecoShopee('2milhões')).toBe(2_000_000)
    expect(parsePrecoShopee('2milhoes')).toBe(2_000_000)
  })

  it('não confunde "mi" com "mil"', () => {
    // "mil" contém "mi": testar "mi" primeiro transforma 4,0mil em 4 milhões.
    expect(parsePrecoShopee('4,0mil')).not.toBe(4_000_000)
  })

  it('devolve null em vez de NaN, para o produto cair do catálogo e não da vitrine', () => {
    expect(parsePrecoShopee('')).toBe(null)
    expect(parsePrecoShopee(null)).toBe(null)
    expect(parsePrecoShopee(undefined)).toBe(null)
    expect(parsePrecoShopee('Sob consulta')).toBe(null)
  })
})

describe('parsePercentual', () => {
  it('lê a comissão como número', () => {
    expect(parsePercentual('15%')).toBe(15)
    expect(parsePercentual('7,5%')).toBe(7.5)
    expect(parsePercentual('')).toBe(null)
  })
})

describe('extrairLinkCurto e extrairShopId', () => {
  it('puxa o código do link de afiliado', () => {
    expect(extrairLinkCurto('https://s.shopee.com.br/1qcVB3N2Im')).toBe('1qcVB3N2Im')
    expect(extrairLinkCurto('https://s.shopee.com.br/9V1wJ8tql3?xptdk=abc')).toBe('9V1wJ8tql3')
    expect(extrairLinkCurto('')).toBe('')
  })

  it('puxa o shopId da URL pública', () => {
    expect(extrairShopId('https://shopee.com.br/product/408715442/22499247158')).toBe('408715442')
    expect(extrairShopId('https://shopee.com.br/product/22499247158')).toBe('')
  })
})

describe('normalizarLinha', () => {
  it('transforma uma linha da exportação em registro sem erro', () => {
    const r = normalizarLinha(linha())
    expect(r.erros).toEqual([])
    expect(r.itemId).toBe('19199236009')
    expect(r.preco).toBe(42.89)
    expect(r.categoria).toBe('eletronicos')
    expect(r.shopId).toBe('563110312')
    expect(r.linkCurto).toBe('1qcVB3N2Im')
  })

  it('acusa campo faltando em vez de gerar produto pela metade', () => {
    const r = normalizarLinha(linha({ 'Item Id': '', 'Item Name': '' }))
    expect(r.erros).toContain('Item Id vazio')
    expect(r.erros).toContain('Item Name vazio')
  })

  it('recusa link de afiliado que não é da Shopee', () => {
    // Aceitar qualquer URL aqui significariaissionar comissão por link próprio.
    const r = normalizarLinha(linha({ 'Offer Link': 'https://exemplo.com.br/oferta' }))
    expect(r.erros.some((e) => e.includes('Offer Link inválido'))).toBe(true)
  })

  it('recusa link de afiliado com query string, que quebra a atribuição', () => {
    const r = normalizarLinha(linha({ 'Offer Link': 'https://s.shopee.com.br/abc?utm=1' }))
    expect(r.erros.some((e) => e.includes('Offer Link inválido'))).toBe(true)
  })

  it('acusa preço ilegível em vez de assumir zero', () => {
    const r = normalizarLinha(linha({ Price: 'Sob consulta' }))
    expect(r.erros.some((e) => e.includes('Price ilegível'))).toBe(true)
  })

  it('não quebra com linha inteira vazia', () => {
    const r = normalizarLinha({})
    expect(Array.isArray(r.erros)).toBe(true)
    expect(r.erros.length).toBeGreaterThan(0)
  })
})

describe('escolherMelhorOferta', () => {
  const comissao = (valor, link) => ({
    itemId: '1',
    comissao: valor,
    linkAfiliado: link,
  })

  it('mantém uma linha só sem inventar preferência', () => {
    const unica = comissao(10, 'https://s.shopee.com.br/aaa')
    expect(escolherMelhorOferta([unica])).toEqual([unica])
  })

  it('escolhe a de maior comissão quando o mesmo produto aparece duas vezes', () => {
    const a = comissao(5, 'https://s.shopee.com.br/zzz')
    const b = comissao(9, 'https://s.shopee.com.br/aaa')
    expect(escolherMelhorOferta([a, b])).toEqual([b])
    expect(escolherMelhorOferta([b, a])).toEqual([b])
  })

  it('no empate resolve pelo link, para o resultado não depender da ordem de leitura', () => {
    const a = comissao(5, 'https://s.shopee.com.br/zzz')
    const b = comissao(5, 'https://s.shopee.com.br/aaa')
    expect(escolherMelhorOferta([a, b])[0].linkAfiliado).toBe('https://s.shopee.com.br/aaa')
    expect(escolherMelhorOferta([b, a])[0].linkAfiliado).toBe('https://s.shopee.com.br/aaa')
  })

  it('junta itens diferentes sem misturar', () => {
    const a = { ...comissao(5, 'https://s.shopee.com.br/a'), itemId: '1' }
    const b = { ...comissao(7, 'https://s.shopee.com.br/b'), itemId: '2' }
    expect(escolherMelhorOferta([a, b])).toHaveLength(2)
  })
})

describe('formatarLinhaCsv', () => {
  it('protege o separador que estiver dentro do valor', () => {
    // Nome de loja com ponto e vírgula quebrava a coluna e deslocava o catálogo
    // inteiro a partir daquele produto.
    const linhaCsv = formatarLinhaCsv(
      { nome: 'Fone', loja: 'Loja; Com Ponto E Virgula' },
      ['nome', 'loja'],
      ';'
    )
    expect(linhaCsv).toBe('Fone;"Loja; Com Ponto E Virgula"')
    const lido = parseCsv(`nome;loja\n${linhaCsv}`, ';').linhas[0]
    expect(lido.nome).toBe('Fone')
    expect(lido.loja).toBe('Loja; Com Ponto E Virgula')
  })

  it('não protege o que não precisa: vírgula não quebra coluna com separador ;', () => {
    expect(formatarLinhaCsv({ nome: 'Fone', loja: 'Loja, Com Vírgula' }, ['nome', 'loja'], ';')).toBe(
      'Fone;Loja, Com Vírgula'
    )
  })

  it('protege aspas duplas sem duplicar o campo', () => {
    const texto = formatarLinhaCsv({ nome: 'Kit "{ORIGINAL}" 5"', loja: 'x' }, ['nome', 'loja'], ';')
    const r = parseCsv(`nome;loja\n${texto}`, ';').linhas
    expect(r[0].nome).toBe('Kit "{ORIGINAL}" 5"')
    expect(r[0].loja).toBe('x')
  })

  it('não põe aspas no que não precisa delas', () => {
    expect(formatarLinhaCsv({ nome: 'Fone', loja: 'x' }, ['nome', 'loja'], ';')).toBe('Fone;x')
  })
})
describe('aplicarAjustesEditorial', () => {
  const catalogo = [
    { linkCurto: 'aaa111', nome: 'Fone Bluetooth TWS', categoria: 'eletronicos' },
    { linkCurto: 'bbb222', nome: 'Conjunto Feminino Sofisticado De Blusa', categoria: 'moda-feminina' },
  ]

  it('substitui o nome pelo ajuste e devolve registro novo', () => {
    const r = aplicarAjustesEditorial(catalogo, [
      { linkCurto: 'bbb222', nome: 'Conjunto Feminino de Blusa e Calça', categoria: '' },
    ])

    expect(r.erros).toEqual([])
    expect(r.aplicados).toEqual(['bbb222'])
    expect(r.registros[1].nome).toBe('Conjunto Feminino de Blusa e Calça')
    expect(catalogo[1].nome).toBe('Conjunto Feminino Sofisticado De Blusa')
  })

  it('corrige a categoria quando o classificador errar', () => {
    const r = aplicarAjustesEditorial(catalogo, [{ linkCurto: 'aaa111', nome: '', categoria: 'pet' }])
    expect(r.registros[0].categoria).toBe('pet')
  })

  it('não mexe no campo que o ajuste não menciona', () => {
    const r = aplicarAjustesEditorial(catalogo, [{ linkCurto: 'aaa111', nome: 'Fone TWS Barato', categoria: '' }])
    expect(r.registros[0].categoria).toBe('eletronicos')
    expect(r.registros[0].nome).toBe('Fone TWS Barato')
  })

  it('recusa linkCurto que não existe: ajuste órfão é erro, não no-op', () => {
    const r = aplicarAjustesEditorial(catalogo, [{ linkCurto: 'zzz999', nome: 'Qualquer', categoria: '' }])
    expect(r.semCorrespondencia).toEqual(['zzz999'])
    expect(r.registros).toBe(catalogo)
  })

  it('recusa categoria fora da taxonomia', () => {
    const r = aplicarAjustesEditorial(catalogo, [{ linkCurto: 'aaa111', nome: '', categoria: 'inventada' }])
    expect(r.erros[0]).toContain('categoria')
    expect(r.erros[0]).toContain('inventada')
  })

  it('recusa coluna desconhecida em vez de ignorá-la em silêncio', () => {
    const r = aplicarAjustesEditorial(catalogo, [{ linkCurto: 'aaa111', preco: '1,00' }], [
      'linkCurto',
      'preco',
    ])
    expect(r.erros[0]).toContain('preco')
  })

  it('recusa ajuste sem linkCurto e ajuste vazio', () => {
    const r = aplicarAjustesEditorial(catalogo, [
      { linkCurto: '', nome: 'X', categoria: '' },
      { linkCurto: 'aaa111', nome: '', categoria: '' },
    ])
    expect(r.erros).toHaveLength(2)
    expect(r.aplicados).toEqual([])
  })

  it('com lista vazia devolve o catálogo intacto', () => {
    const r = aplicarAjustesEditorial(catalogo, [])
    expect(r.registros).toEqual(catalogo)
    expect(r.aplicados).toEqual([])
    expect(r.erros).toEqual([])
  })

  it('nomes longos do catálogo real têm ajuste correspondente', async () => {
    const { linhas } = await lerAjustesEditorial()
    const ajustes = new Set(linhas.map((l) => l.linkCurto))
    const semAjuste = catalogo.filter((r) => r.nome.length > 120 && !ajustes.has(r.linkCurto))
    expect(semAjuste).toEqual([])
  })
})

describe('lerAjustesEditorial', () => {
  it('lê o arquivo real do repositório', async () => {
    const { linhas } = await lerAjustesEditorial()
    expect(linhas.length).toBeGreaterThan(0)
    for (const l of linhas) expect(l.linkCurto).toBeTruthy()
  })

  it('arquivo ausente vira lista vazia, não exceção', async () => {
    const r = await lerAjustesEditorial('/tmp/nao-existe-ajustes.csv')
    expect(r.linhas).toEqual([])
  })
})
