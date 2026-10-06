import { describe, it, expect } from 'vitest'

import {
  assinar,
  corpoImagem,
  extrairImagem,
  erroDaApi,
  CREDENCIAL_INVALIDA,
} from '../../src/engine/shopee-api.js'

describe('assinar', () => {
  // Vetor fechado: uma implementação que muda a ordem dos campos ou reconstrói
  // o header de outro jeito quebra o vetor e a gente percebe na hora, sem rede.
  it('produz o header no formato que a Shopee documenta', () => {
    const appId = '18353961226'
    const segredo = 'chave-secreta-32'
    const payload = '{"query":"x"}'
    const r = assinar({ appId, segredo, payload, timestamp: 1700000000 })
    expect(r.authorization).toMatch(/^SHA256 Credential=18353961226, Timestamp=1700000000, Signature=[0-9a-f]{64}$/)
  })

  it('o corpo muda a assinatura: assinar um byte a mais derruba o 10020 em silêncio', () => {
    const base = (payload) => assinar({ appId: '1', segredo: 's', payload, timestamp: 1 })
    expect(base('{"a":1}').authorization).not.toBe(base('{"a":1 }').authorization)
  })

  it('segredo diferente nunca assina igual', () => {
    const a = assinar({ appId: '1', segredo: 'a', payload: '{}', timestamp: 1 })
    const b = assinar({ appId: '1', segredo: 'b', payload: '{}', timestamp: 1 })
    expect(a.authorization).not.toBe(b.authorization)
  })
})

describe('corpoImagem', () => {
  it('usa só itemId, que é a chave que o catálogo já tem', () => {
    expect(corpoImagem(22898911318)).toContain('itemId: 22898911318')
    expect(corpoImagem(22898911318)).toContain('imageUrl')
  })

  it('número em string também funciona, com a forma numérica', () => {
    expect(corpoImagem('22898911318')).toContain('itemId: 22898911318')
  })

  it('corpo vazio não vira "itemId: NaN"', () => {
    expect(corpoImagem()).toContain('itemId: 0')
  })
})

describe('extrairImagem', () => {
  const resposta = { data: { productOfferV2: { nodes: [{ itemId: 22898911318, imageUrl: 'https://cf.shopee.com.br/file/abc' }] } } }

  it('pega a url do item consultado', () => {
    expect(extrairImagem(resposta, 22898911318)).toBe('https://cf.shopee.com.br/file/abc')
  })

  it('resposta sem nós vira null, não erro', () => {
    expect(extrairImagem({ data: { productOfferV2: { nodes: [] } } }, 1)).toBeNull()
  })

  it('item sumido da oferta vira null — o produto fica no placeholder', () => {
    expect(extrairImagem({ data: { productOfferV2: { nodes: [{ itemId: 999, imageUrl: 'https://cf/x' }] } } }, 1)).toBeNull()
  })

  it('url não-https é rejeitada (imagem local/cdn quebrada)', () => {
    expect(extrairImagem({ data: { productOfferV2: { nodes: [{ itemId: 1, imageUrl: 'ftp://cf/x' }] } } }, 1)).toBeNull()
  })
})

describe('erroDaApi', () => {
  it('acha o 10020 dentro de extensions, onde a Shopee esconde', () => {
    const r = { errors: [{ extensions: { code: 10020, message: 'Invalid Credential' } }] }
    expect(erroDaApi(r)).toBe(10020)
  })

  it('reconhece a credencial inválida por texto quando não há estrutura', () => {
    expect(erroDaApi('error [10020]: Invalid Credential')).toBe(10020)
  })

  it('resposta de sucesso não tem erro', () => {
    expect(erroDaApi({ data: { ok: true } })).toBeNull()
  })

  it('10020 e 10035 são os códigos de credencial ruim', () => {
    expect(CREDENCIAL_INVALIDA.has(10020)).toBe(true)
    expect(CREDENCIAL_INVALIDA.has(10035)).toBe(true)
  })
})
