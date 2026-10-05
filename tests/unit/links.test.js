import { describe, it, expect } from 'vitest'

import {
  isValidAffiliateLink,
  validateAffiliateLink,
  buildAffiliateLink,
  buildShopeeUrl,
  buildShareText,
  trackOutboundClick,
  REL_AFILIADO,
} from '../../src/engine/links.js'

describe('isValidAffiliateLink', () => {
  it('aceita o link curto e a URL completa da Shopee', () => {
    expect(isValidAffiliateLink('https://s.shopee.com.br/1gJ4vKhJO2').valido).toBe(true)
    expect(
      isValidAffiliateLink('https://shopee.com.br/opaanlp/408715442/22499247158').valido
    ).toBe(true)
  })

  it('rejeita http', () => {
    const r = isValidAffiliateLink('http://s.shopee.com.br/1gJ4vKhJO2')
    expect(r.valido).toBe(false)
    expect(r.motivo).toMatch(/https/)
  })

  it('rejeita domínio que só contém "shopee"', () => {
    // `endsWith('.shopee.com.br')` não pode ser satisfeito por
    // `shopee.com.br.evil.com`, nem por `evilshopee.com.br`.
    expect(isValidAffiliateLink('https://shopee.com.br.evil.com/x').valido).toBe(false)
    expect(isValidAffiliateLink('https://evilshopee.com.br/x').valido).toBe(false)
    expect(isValidAffiliateLink('https://notshopee.com.br/x').valido).toBe(false)
  })

  it('aceita subdomínio real da Shopee', () => {
    expect(isValidAffiliateLink('https://down-abc.shopee.com.br/a.jpg').valido).toBe(true)
  })

  it('devolve motivo legível para entrada inválida', () => {
    expect(isValidAffiliateLink('').motivo).toBe('link vazio')
    expect(isValidAffiliateLink(null).motivo).toBe('link vazio')
    expect(isValidAffiliateLink('nao é url').motivo).toBe('URL inválida')
  })

  it('validateAffiliateLink é o atalho booleano', () => {
    expect(validateAffiliateLink('https://s.shopee.com.br/abc')).toBe(true)
    expect(validateAffiliateLink('javascript:alert(1)')).toBe(false)
  })
})

describe('buildAffiliateLink', () => {
  it('devolve o link do catálogo sem reescrever a URL', () => {
    // A atribuição de afiliado mora dentro da URL. Qualquer normalização aqui
    // quebraria a comissão silenciosamente.
    const produto = { linkAfiliado: 'https://s.shopee.com.br/1gJ4vKhJO2' }
    expect(buildAffiliateLink(produto)).toBe('https://s.shopee.com.br/1gJ4vKhJO2')
  })

  it('devolve null quando falta o link', () => {
    expect(buildAffiliateLink({})).toBeNull()
    expect(buildAffiliateLink(null)).toBeNull()
  })
})

describe('buildShopeeUrl', () => {
  it('devolve a URL pública do produto', () => {
    expect(buildShopeeUrl({ urlPublica: 'https://shopee.com.br/loja/1/2' })).toBe(
      'https://shopee.com.br/loja/1/2'
    )
    expect(buildShopeeUrl({})).toBeNull()
  })
})

describe('buildShareText', () => {
  it('monta texto com nome, preço e o aviso de afiliado', () => {
    const texto = buildShareText(
      { nome: 'Fone Bluetooth', preco: 129.9 },
      'https://exemplo.com.br/produto/fone-bluetooth'
    )

    expect(texto).toContain('Fone Bluetooth')
    expect(texto).toContain('129,90')
    expect(texto).toContain('https://exemplo.com.br/produto/fone-bluetooth')
    expect(texto).toContain('afiliado')
    expect(texto).toContain('sujeito a alteração')
  })

  it('omite o preço quando não há valor', () => {
    const texto = buildShareText({ nome: 'Produto' }, 'https://exemplo.com.br')
    expect(texto).not.toContain('R$')
  })
})

describe('REL_AFILIADO', () => {
  it('marca o link como sponsored para o Google', () => {
    expect(REL_AFILIADO).toContain('sponsored')
    expect(REL_AFILIADO).toContain('nofollow')
  })
})

describe('trackOutboundClick', () => {
  it('não quebra quando não existe analytics na página', () => {
    expect(() => trackOutboundClick('fone', 'card')).not.toThrow()
  })
})
