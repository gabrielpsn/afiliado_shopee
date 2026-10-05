import { describe, it, expect } from 'vitest'

import {
  coresCategoriaArte,
  svgArteCategoria,
  urlArteCategoria,
} from '../../src/engine/arte-categoria.js'
import { CATEGORIAS } from '../../src/data/categories.js'
import { PRODUCTS } from '../../src/data/products.js'

describe('svgArteCategoria', () => {
  it('é SVG válido e completo', () => {
    const svg = svgArteCategoria('eletronicos')
    expect(svg.startsWith('<svg')).toBe(true)
    expect(svg.endsWith('</svg>')).toBe(true)
    expect(svg).toContain("xmlns='http://www.w3.org/2000/svg'")
    expect(svg).toContain('viewBox=')
  })

  it('não usa aspas duplas, que quebrariam o data URI no CSS', () => {
    // O SVG vai dentro de url("..."). Aspa dupla aqui fecha a string do CSS e o
    // card volta ao cinza sem nenhuma mensagem no console.
    for (const c of CATEGORIAS) {
      expect(svgArteCategoria(c.id), c.id).not.toContain('"')
    }
  })

  it('é determinístico: mesma categoria, mesmo desenho', () => {
    for (const c of CATEGORIAS) {
      expect(svgArteCategoria(c.id)).toBe(svgArteCategoria(c.id))
    }
  })

  it('categorias diferentes não produzem o mesmo desenho', () => {
    // Se todas dessem o mesmo SVG, o placeholder pareceria o mesmo 500 vezes.
    const svgs = CATEGORIAS.map((c) => svgArteCategoria(c.id))
    expect(new Set(svgs).size).toBe(CATEGORIAS.length)
  })

  it('cai em "outros" para id desconhecido, sem devolver desenho quebrado', () => {
    expect(urlArteCategoria('categoria-que-nao-existe')).toBe(urlArteCategoria('outros'))
    expect(urlArteCategoria(undefined)).toBe(urlArteCategoria('outros'))
  })

  it('toda categoria do site tem cor definida', () => {
    for (const c of CATEGORIAS) {
      const cores = coresCategoriaArte(c.id)
      expect(cores, c.id).toHaveLength(2)
      expect(cores[0]).toMatch(/^#[0-9a-f]{6}$/i)
      expect(cores[1]).toMatch(/^#[0-9a-f]{6}$/i)
    }
  })
})

describe('urlArteCategoria', () => {
  it('escapa o # da cor, senão o SVG não carrega', () => {
    const url = urlArteCategoria('pet')
    expect(url).not.toContain('#')
    expect(url).toContain('%23')
  })

  it('é um data URI de svg', () => {
    expect(urlArteCategoria('beleza').startsWith('url("data:image/svg+xml,')).toBe(true)
  })

  it('só usa caracteres aceitos em URL, para não quebrar o style', () => {
    const url = urlArteCategoria('casa-e-decoracao')
    const dentro = url.slice('url("data:image/svg+xml,'.length, -2)
    expect(encodeURIComponent(decodeURIComponent(dentro))).toBe(dentro)
  })

  it('cobre todas as categorias do catálogo real', () => {
    const ids = new Set(PRODUCTS.map((p) => p.categoria))
    for (const id of ids) {
      expect(urlArteCategoria(id), id).toContain('%23')
    }
    // Toda categoria real tem arte própria — nenhuma caiu no fallback junto com
    // "outros", que é o único id que pode se repetir.
    const artes = new Set([...ids].map((id) => urlArteCategoria(id)))
    expect(artes.size).toBe(ids.size)
  })
})
