import { describe, it, expect } from 'vitest'

import { parseShopeeUrl, resolveLink, toCsvRow } from '../../scripts/resolve-links.js'

describe('parseShopeeUrl', () => {
  it('extrai loja, shopId e itemId da URL de redirecionamento', () => {
    expect(
      parseShopeeUrl(
        'https://shopee.com.br/opaanlp/408715442/22499247158?sp_atk=abc&__mobile__=1'
      )
    ).toEqual({ shopName: 'opaanlp', shopId: '408715442', itemId: '22499247158' })
  })

  it('devolve null para URL fora do formato', () => {
    expect(parseShopeeUrl('https://exemplo.com/produto')).toBeNull()
    expect(parseShopeeUrl('https://shopee.com.br/sem-numeros')).toBeNull()
    expect(parseShopeeUrl('')).toBeNull()
  })
})

describe('resolveLink', () => {
  const respostaCom = (location) => ({
    status: 301,
    headers: { get: (nome) => (nome === 'location' ? location : null) },
  })

  it('segue o redirecionamento e monta a URL pública limpa', async () => {
    const fetchImpl = async () =>
      respostaCom('https://shopee.com.br/opaanlp/1/2?sp_atk=x&utm_source=an_1')

    const r = await resolveLink('https://s.shopee.com.br/abc', fetchImpl)

    expect(r.ok).toBe(true)
    expect(r.itemId).toBe('2')
    // Os parâmetros de rastreamento do painel não devem ir para o catálogo.
    expect(r.urlPublica).toBe('https://shopee.com.br/opaanlp/1/2')
  })

  it('acusa quando não há redirecionamento', async () => {
    const fetchImpl = async () => respostaCom(null)
    const r = await resolveLink('https://s.shopee.com.br/abc', fetchImpl)
    expect(r.ok).toBe(false)
    expect(r.motivo).toMatch(/sem redirect/)
  })

  it('acusa redirecionamento fora do formato esperado', async () => {
    const fetchImpl = async () => respostaCom('https://exemplo.com/oferta')
    const r = await resolveLink('https://s.shopee.com.br/abc', fetchImpl)
    expect(r.ok).toBe(false)
    expect(r.motivo).toMatch(/formato/)
  })

  it('acusa erro de rede em vez de estourar', async () => {
    const fetchImpl = async () => {
      throw new Error('ECONNREFUSED')
    }
    const r = await resolveLink('https://s.shopee.com.br/abc', fetchImpl)
    expect(r).toEqual({ ok: false, motivo: 'ECONNREFUSED' })
  })
})

describe('toCsvRow', () => {
  it('escreve a linha de sucesso com o itemId', () => {
    expect(
      toCsvRow({
        link: 'https://s.shopee.com.br/abc',
        ok: true,
        itemId: '2',
        shopId: '1',
        shopName: 'loja',
        urlPublica: 'https://shopee.com.br/loja/1/2',
      })
    ).toBe('abc,OK,2,1,loja,https://shopee.com.br/loja/1/2')
  })

  it('escreve a linha de erro sem deslocar as colunas', () => {
    expect(
      toCsvRow({ link: 'https://s.shopee.com.br/abc', ok: false, motivo: 'morto' })
    ).toBe('abc,ERRO,"morto",,')
  })
})
