// Leitura do catálogo. A busca, os filtros e a ordenação completa entram na
// Fase 2; aqui fica o acesso básico que as views já precisam.

import { CATEGORIAS, getCategoria } from '../data/categories.js'
import { PRODUCTS } from '../data/products.js'

export function getAllProducts() {
  return PRODUCTS
}

/**
 * Produtos que podem aparecer na vitrine.
 *
 * `pendente` é o guarda-fogo do projeto: enquanto um produto não tiver nome,
 * preço e imagem preenchidos, ele fica fora da loja. Não é apenas um filtro de
 * exibição — `scripts/check-links.js` reprova o build enquanto existir
 * qualquer produto pendente, então a loja não pode ser publicada com dados
 * inventados.
 */
export function getActiveProducts() {
  return PRODUCTS.filter((p) => p.ativo && !p.pendente)
}

export function getProductBySlug(slug) {
  return PRODUCTS.find((p) => p.slug === slug) || null
}

export function getPendentes() {
  return PRODUCTS.filter((p) => p.pendente)
}

export function getProductsByCategoria(categoriaId) {
  return getActiveProducts().filter((p) => p.categoria === categoriaId)
}

/** Categorias que têm ao menos um produto ativo, com a contagem. */
export function getCategoriasComContagem() {
  const ativos = getActiveProducts()

  return CATEGORIAS.map((c) => ({
    ...c,
    total: ativos.filter((p) => p.categoria === c.id).length,
  }))
    .filter((c) => c.total > 0)
    .sort((a, b) => a.ordem - b.ordem)
}

export { getCategoria }
