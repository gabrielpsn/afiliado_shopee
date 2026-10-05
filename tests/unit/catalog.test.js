import { describe, it, expect } from 'vitest'

import { CATEGORIAS } from '../../src/data/categories.js'
import {
  getAllProducts,
  getActiveProducts,
  getProductBySlug,
  getPendentes,
  getProductsByCategoria,
  getCategoriasComContagem,
  getRelacionados,
} from '../../src/engine/catalog.js'
import { isValidAffiliateLink } from '../../src/engine/links.js'

describe('getActiveProducts', () => {
  it('esconde produto pendente, mesmo com ativo verdadeiro', () => {
    // O guarda contra dado inventado: um produto sem nome/preço não pode
    // aparecer na vitrine mesmo que alguém marque ativo na mão.
    const pendente = { slug: 'p', ativo: true, pendente: true }
    const completo = { slug: 'q', ativo: true, pendente: false }
    const desligado = { slug: 'r', ativo: false, pendente: false }

    const ativos = [pendente, completo, desligado].filter(
      (p) => p.ativo && !p.pendente
    )
    expect(ativos).toEqual([completo])
  })

  it('o catálogo real está todo publicável', () => {
    // O CSV importado da Shopee tem nome, preço e link em todos os 500 itens,
    // então não pode sobrar pendente — e se sobrar, é porque o importador
    // gravou algo errado.
    expect(getAllProducts().length).toBeGreaterThan(0)
    expect(getPendentes()).toEqual([])
    expect(getActiveProducts().length).toBe(getAllProducts().length)
  })

  it('todo produto publicado tem nome, preço e link de afiliado válido', () => {
    for (const p of getActiveProducts()) {
      expect(p.nome, p.slug).toBeTruthy()
      expect(p.preco, p.slug).toBeGreaterThan(0)
      expect(isValidAffiliateLink(p.linkAfiliado).valido, p.slug).toBe(true)
    }
  })

  it('todo slug é único, para não colidir na URL', () => {
    const slugs = new Set(getAllProducts().map((p) => p.slug))
    expect(slugs.size).toBe(getAllProducts().length)
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
    const encontrados = getProductsByCategoria('eletronicos')
    expect(encontrados.length).toBeGreaterThan(0)
    expect(encontrados.every((p) => p.categoria === 'eletronicos')).toBe(true)
    expect(encontrados.every((p) => !p.pendente && p.ativo)).toBe(true)
  })
})

describe('getCategoriasComContagem', () => {
  it('omite categoria sem produto, para não mostrar seção vazia', () => {
    const comContagem = getCategoriasComContagem()
    const ids = new Set(CATEGORIAS.map((c) => c.id))

    expect(comContagem.length).toBeGreaterThan(0)
    expect(comContagem.every((c) => c.total > 0)).toBe(true)
    expect(comContagem.every((c) => ids.has(c.id))).toBe(true)
    // `papelaria` e `livros` vieram sem produto nesta exportação: entram fora da
    // vitrine, mas continuam no catálogo para quando algo aparecer.
    expect(comContagem.some((c) => c.total === 0)).toBe(false)
  })

  it('a contagem bate com o número de produtos de cada categoria', () => {
    for (const c of getCategoriasComContagem()) {
      expect(c.total).toBe(getProductsByCategoria(c.id).length)
    }
  })

  it('nenhuma categoria concentra tudo, para a vitrine não virar uma prateleira só', () => {
    const total = getActiveProducts().length
    const maior = Math.max(...getCategoriasComContagem().map((c) => c.total))
    expect(maior / total).toBeLessThan(0.4)
  })
})

describe('getRelacionados', () => {
  it('prioriza a mesma categoria e nunca devolve o próprio produto', () => {
    const alvo = getProductsByCategoria('eletronicos')[0]
    const relacionados = getRelacionados(alvo, 8)

    expect(relacionados).toHaveLength(8)
    expect(relacionados.some((p) => p.slug === alvo.slug)).toBe(false)
    expect(relacionados.filter((p) => p.categoria === alvo.categoria).length).toBeGreaterThan(0)
  })

  it('completa com outras categorias quando a própria é pequena', () => {
    const pequenos = getCategoriasComContagem().filter((c) => c.total <= 8)
    for (const c of pequenos) {
      const alvo = getProductsByCategoria(c.id)[0]
      expect(getRelacionados(alvo, 8).length, c.id).toBe(8)
    }
  })

  it('devolve lista vazia sem produto', () => {
    expect(getRelacionados(null)).toEqual([])
  })
})