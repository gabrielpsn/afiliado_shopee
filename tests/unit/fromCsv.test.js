import { describe, it, expect } from 'vitest'

import {
  parseCsv,
  parseBooleano,
  parseNumero,
  parseLista,
  avaliarLinha,
  buildProducts,
  carregarLinksResolvidosDoTexto,
  COLUNAS_CATALOGO,
} from '../../scripts/from-csv.js'
import { CATEGORIAS } from '../../src/data/categories.js'

describe('parseCsv', () => {
  it('detecta ";" sozinho, que é o padrão do Excel pt-BR', () => {
    const { separador, linhas } = parseCsv('a;b;c\n1;2;3')
    expect(separador).toBe(';')
    expect(linhas).toEqual([{ a: '1', b: '2', c: '3' }])
  })

  it('detecta "," quando é esse o separador', () => {
    const { separador, linhas } = parseCsv('a,b\n1,2')
    expect(separador).toBe(',')
    expect(linhas).toEqual([{ a: '1', b: '2' }])
  })

  it('respeita aspas com vírgula e ponto-e-vírgula dentro', () => {
    const { linhas } = parseCsv('nome;descricao\n"Cadeira, gamer";"100%;#100"')
    expect(linhas[0].nome).toBe('Cadeira, gamer')
    expect(linhas[0].descricao).toBe('100%;#100')
  })

  it('aceita aspas duplicadas para escapar aspas', () => {
    const { linhas } = parseCsv('nome\n"Dou""ble"')
    expect(linhas[0].nome).toBe('Dou"ble')
  })

  it('junta campo com quebra de linha dentro das aspas', () => {
    const { linhas } = parseCsv('nome;descricao\n"X";"linha1\nlinha2"')
    expect(linhas[0].descricao).toBe('linha1\nlinha2')
  })

  it('descarta linha totalmente vazia', () => {
    const { linhas } = parseCsv('nome\nX\n\n\nY\n')
    expect(linhas).toHaveLength(2)
  })

  it('ignora BOM e CRLF do Excel', () => {
    const { linhas } = parseCsv('﻿nome;preco\r\nX;10\r\n')
    expect(linhas).toEqual([{ nome: 'X', preco: '10' }])
  })
})

describe('parseNumero', () => {
  it('lê o formato brasileiro com milhar e vírgula decimal', () => {
    expect(parseNumero('1.299,90')).toBe(1299.9)
    expect(parseNumero('129,90')).toBe(129.9)
    expect(parseNumero('R$ 89,90')).toBe(89.9)
    expect(parseNumero('89,00')).toBe(89)
  })

  it('trata ponto sozinho como decimal quando tem 1 ou 2 casas', () => {
    // Se "89.90" fosse lido como milhar, viraria 8.990 — um preço absurdo que
    // passaria pelo validador. O mesmo precisa valer para a nota, que tem 1 casa.
    expect(parseNumero('89.90')).toBe(89.9)
    expect(parseNumero('4.8')).toBe(4.8)
  })

  it('trata ponto sozinho como milhar a partir de 3 casas', () => {
    expect(parseNumero('1.299')).toBe(1299)
    expect(parseNumero('12.500')).toBe(12500)
  })

  it('devolve null para vazio ou texto', () => {
    expect(parseNumero('')).toBeNull()
    expect(parseNumero(undefined)).toBeNull()
    expect(parseNumero('a,b')).toBeNull()
  })

  it('distingue zero de ausente', () => {
    // Preço 0 é dado suspecto e precisa reprovar no validador, não virar null.
    expect(parseNumero('0')).toBe(0)
  })
})

describe('parseBooleano', () => {
  it('aceita as grafias de sim', () => {
    expect(parseBooleano('sim')).toBe(true)
    expect(parseBooleano('S')).toBe(true)
    expect(parseBooleano('TRUE')).toBe(true)
    expect(parseBooleano('1')).toBe(true)
  })

  it('trata nao e falsos como false', () => {
    expect(parseBooleano('nao')).toBe(false)
    expect(parseBooleano('0')).toBe(false)
  })

  it('usa o padrão quando o campo está vazio', () => {
    expect(parseBooleano('', true)).toBe(true)
    expect(parseBooleano(undefined, false)).toBe(false)
  })
})

describe('parseLista', () => {
  it('separa por pipe e descarta espaços vazios', () => {
    expect(parseLista('a | b |c')).toEqual(['a', 'b', 'c'])
    expect(parseLista('')).toEqual([])
    expect(parseLista('a||b')).toEqual(['a', 'b'])
  })
})

describe('avaliarLinha', () => {
  const hoje = '2026-10-02'

  it('considera pronto o produto com nome, categoria, preço e imagem', () => {
    const info = avaliarLinha(
      {
        nome: 'Fone',
        categoria: 'eletronicos',
        preco: '99,90',
        imagens: 'https://down.shopee.com.br/a.jpg',
      },
      hoje
    )
    expect(info.pendente).toBe(false)
    expect(info.faltando).toEqual([])
  })

  it('lista exatamente o que falta', () => {
    const info = avaliarLinha({ nome: 'Fone', preco: '99,90' }, hoje)
    expect(info.pendente).toBe(true)
    expect(info.faltando).toEqual(['categoria', 'imagens'])
  })

  it('usa a data de hoje quando atualizadoEm está vazio', () => {
    expect(avaliarLinha({}, hoje).atualizadoEm).toBe(hoje)
  })

  it('preserva atualizadoEm preenchido no CSV', () => {
    const info = avaliarLinha({ atualizadoEm: '2026-09-01' }, hoje)
    expect(info.atualizadoEm).toBe('2026-09-01')
  })
})

describe('carregarLinksResolvidosDoTexto', () => {
  it('monta o mapa com o link de afiliado já pronto', () => {
    const mapa = carregarLinksResolvidosDoTexto(
      'linkCurto,status,itemId,shopId,loja,urlPublica\n' +
        'abc123,OK,111,222,loja,https://shopee.com.br/loja/222/111\n' +
        'err999,ERRO,,,,'
    )

    expect(mapa.size).toBe(1)
    expect(mapa.get('abc123')).toEqual({
      urlPublica: 'https://shopee.com.br/loja/222/111',
      itemId: '111',
      shopId: '222',
      linkAfiliado: 'https://s.shopee.com.br/abc123',
    })
  })
})

describe('buildProducts', () => {
  const hoje = '2026-10-02'
  const links = new Map([
    [
      'abc123',
      {
        urlPublica: 'https://shopee.com.br/loja/222/111',
        itemId: '111',
        shopId: '222',
        linkAfiliado: 'https://s.shopee.com.br/abc123',
      },
    ],
  ])

  const linhaCompleta = {
    linkCurto: 'abc123',
    nome: 'Fone Bluetooth ANC',
    categoria: 'eletronicos',
    preco: '129,90',
    imagens: 'https://down.shopee.com.br/a.jpg|https://down.shopee.com.br/b.jpg',
    tags: 'fone|anc',
    destaques: 'Cancelamento de ruído|Bateria de 30h',
  }

  it('gera produto completo e ativo', () => {
    const { produtos, pendentes } = buildProducts({
      linhas: [linhaCompleta],
      linksResolvidos: links,
      hoje,
    })

    expect(produtos).toHaveLength(1)
    const p = produtos[0]
    expect(p.slug).toBe('fone-bluetooth-anc')
    expect(p.preco).toBe(129.9)
    expect(p.tags).toEqual(['fone', 'anc'])
    expect(p.imagens).toHaveLength(2)
    expect(p.destaques).toEqual(['Cancelamento de ruído', 'Bateria de 30h'])
    expect(p.linkAfiliado).toBe('https://s.shopee.com.br/abc123')
    expect(p.urlPublica).toBe('https://shopee.com.br/loja/222/111')
    expect(p.ativo).toBe(true)
    expect(p.pendente).toBe(false)
    expect(pendentes).toHaveLength(0)
  })

  it('usa slug provisório com o itemId quando falta o nome', () => {
    const { produtos } = buildProducts({
      linhas: [{ linkCurto: 'abc123' }],
      linksResolvidos: links,
      hoje,
    })
    expect(produtos[0].slug).toBe('item-111')
    expect(produtos[0].pendente).toBe(true)
    expect(produtos[0].ativo).toBe(false)
  })

  it('respeita ativo=nao mesmo com produto completo', () => {
    const { produtos } = buildProducts({
      linhas: [{ ...linhaCompleta, ativo: 'nao' }],
      linksResolvidos: links,
      hoje,
    })
    expect(produtos[0].pendente).toBe(false)
    expect(produtos[0].ativo).toBe(false)
  })

  it('reprova categoria que não existe em categories.js', () => {
    const { produtos, pendentes } = buildProducts({
      linhas: [{ ...linhaCompleta, categoria: 'inexistente' }],
      linksResolvidos: links,
      hoje,
    })
    expect(produtos[0].pendente).toBe(true)
    expect(pendentes[0].faltando.join()).toMatch(/inexistente/)
  })

  it('avisa sobre link ainda não resolvido, sem quebrar o produto', () => {
    const { produtos, semLink } = buildProducts({
      linhas: [{ ...linhaCompleta, linkCurto: 'novo999' }],
      linksResolvidos: links,
      hoje,
    })

    expect(semLink[0].linkCurto).toBe('novo999')
    expect(produtos[0].linkAfiliado).toBe('https://s.shopee.com.br/novo999')
    expect(produtos[0].urlPublica).toBeNull()
  })

  it('sufixa slug duplicado para não colidir na URL', () => {
    const { produtos, avisos } = buildProducts({
      linhas: [linhaCompleta, linhaCompleta],
      linksResolvidos: links,
      hoje,
    })

    expect(produtos[0].slug).toBe('fone-bluetooth-anc')
    expect(produtos[1].slug).toBe('fone-bluetooth-anc-2')
    expect(avisos.some((a) => a.motivo.includes('slug duplicado'))).toBe(true)
  })

  it('ignora linha sem linkCurto', () => {
    const { produtos, semLink } = buildProducts({
      linhas: [{ ...linhaCompleta, linkCurto: '' }],
      linksResolvidos: links,
      hoje,
    })
    expect(produtos).toHaveLength(0)
    expect(semLink).toHaveLength(1)
  })
})

describe('COLUNAS_CATALOGO', () => {
  it('cobre o que o build exige: link, nome, categoria, preço e imagem', () => {
    for (const coluna of ['linkCurto', 'nome', 'categoria', 'preco', 'imagens']) {
      expect(COLUNAS_CATALOGO).toContain(coluna)
    }
  })

  it('toda categoria padrão é referenciável pelo CSV', () => {
    // Se alguém criar uma categoria nova com id, o CSV já aceita sem mudar nada.
    for (const c of CATEGORIAS) {
      expect(c.id).toMatch(/^[a-z0-9-]+$/)
    }
  })
})
