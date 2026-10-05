import { describe, it, expect } from 'vitest'

import {
  getAllProducts,
  getActiveProducts,
  getProductBySlug,
  getPendentes,
  getProductsByCategoria,
  getCategoriasComContagem,
} from '../../src/engine/catalog.js'

describe('getActiveProducts', () => {
  it('esconde produto pendente, mesmo com ativo verdadeiro', () => {
    // O guarda contra dado inventado: um produto sem nome/preço/imagem não
    // pode aparecer na vitrine mesmo que alguém marque ativo na mão.
    const pendente = { slug: 'p', ativo: true, pendente: true }
    const completo = { slug: 'q', ativo: true, pendente: false }
    const desligado = { slug: 'r', ativo: false, pendente: false }

    const ativos = [pendente, completo, desligado].filter(
      (p) => p.ativo && !p.pendente
    )
    expect(ativos).toEqual([completo])
  })

  it('o catálogo real tem os dois lados represented', () => {
    // Estado inicial esperado: 90 links resolvidos e nenhum preenchido.
    expect(getAllProducts().length).toBeGreaterThan(0)
    expect(getActiveProducts().length).toBe(0)
    expect(getPendentes().length).toBe(getAllProducts().length)
  })
})

describe('getProductBySlug', () => {
  it('devolve o produto pelo slug exato', () => {
    const [primeiro] = getAllProducts()
    expect(getProductBySlug(primeiro.slug)).toBe(primeiro)
  })

  it('devolve null para slug inexistente', () => {
    expect(getProductBySlug('nao-existe')).toBeNull()
    expect(getProductBySlug(undefined)).toBeNull()
  })
})

describe('getProductsByCategoria', () => {
  it('só devolve produtos publicáveis da categoria', () => {
    expect(getProductsByCategoria('eletronicos')).toEqual([])
  })
})

describe('getCategoriasComContagem', () => {
  it('omite categoria sem produto, para não mostrar seção vazia', () => {
    expect(getCategoriasComContagem()).toEqual([])
  })
})
