import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'

import AffiliateNotice from '../../src/components/AffiliateNotice.vue'
import { CATEGORIAS, getCategoria, categoriasOrdenadas } from '../../src/data/categories.js'

describe('AffiliateNotice', () => {
  it('identifica o caráter de afiliado de forma visível', () => {
    // CONAR Anexo H: a identificação publicitária não pode ficar escondida em
    // rodapé. O texto precisa estar no DOM, legível, sem clique para revelar.
    const texto = mount(AffiliateNotice).text()

    expect(texto).toMatch(/afiliado/i)
    expect(texto).toMatch(/mesmo preço/i)
    expect(texto).toMatch(/comissão/i)
    expect(texto).toMatch(/Shopee/i)
  })

  it('aparece antes de qualquer conteúdo da loja', () => {
    const wrapper = mount(AffiliateNotice)
    expect(wrapper.find('[role="note"]').exists()).toBe(true)
  })

  it('tem variante compacta para o selo do cabeçalho', () => {
    expect(mount(AffiliateNotice, { props: { compact: true } }).classes()).toContain('text-xs')
    expect(mount(AffiliateNotice).classes()).not.toContain('text-xs')
  })
})

describe('categorias', () => {
  it('não tem id repetido, senão duas categorias viram a mesma URL', () => {
    const ids = CATEGORIAS.map((c) => c.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('id é seguro para URL e para coluna de CSV', () => {
    for (const c of CATEGORIAS) {
      expect(c.id).toMatch(/^[a-z0-9-]+$/)
    }
  })

  it('toda categoria tem nome, descrição e ordem', () => {
    for (const c of CATEGORIAS) {
      expect(c.nome).toBeTruthy()
      expect(c.descricao).toBeTruthy()
      expect(Number.isFinite(c.ordem)).toBe(true)
    }
  })

  it('getCategoria acha por id e devolve null no desconhecido', () => {
    expect(getCategoria('eletronicos').nome).toBe('Eletrônicos')
    expect(getCategoria('nao-existe')).toBeNull()
  })

  it('categoriasOrdenadas respeita o campo ordem', () => {
    const ordenadas = categoriasOrdenadas().map((c) => c.ordem)
    expect(ordenadas).toEqual([...ordenadas].sort((a, b) => a - b))
  })

  it('categoriasOrdenadas não reordena o array original', () => {
    const antes = CATEGORIAS.map((c) => c.id)
    categoriasOrdenadas()
    expect(CATEGORIAS.map((c) => c.id)).toEqual(antes)
  })
})
