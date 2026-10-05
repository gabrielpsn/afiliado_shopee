import { describe, it, expect } from 'vitest'

import { validateCatalog } from '../../scripts/check-links.js'
import { CATEGORIAS } from '../../src/data/categories.js'

const REFERENCIA = new Date(2026, 9, 2) // 2 de outubro de 2026

const siteDeTeste = { url: 'https://loja.real.com.br', diasParaPrecoAntigo: 30 }

function produto(over = {}) {
  return {
    slug: 'fone-bluetooth',
    nome: 'Fone Bluetooth',
    descricao: 'Texto',
    preco: 129.9,
    precoAntes: 199.9,
    categoria: 'eletronicos',
    tags: [],
    imagens: ['https://down-abc.shopee.com.br/a.jpg'],
    linkAfiliado: 'https://s.shopee.com.br/1gJ4vKhJO2',
    urlPublica: 'https://shopee.com.br/loja/1/2',
    ativo: true,
    pendente: false,
    atualizadoEm: '2026-09-20',
    ...over,
  }
}

const valida = (produtos, site = siteDeTeste) =>
  validateCatalog({ produtos, categorias: CATEGORIAS, site, referencia: REFERENCIA })

describe('validateCatalog — produto completo', () => {
  it('aceita um produto bem formado', () => {
    const { erros } = valida([produto()])
    expect(erros).toEqual([])
  })

  it('reprova preço zero ou negativo', () => {
    expect(valida([produto({ preco: 0 })]).erros.join()).toMatch(/preço/)
    expect(valida([produto({ preco: -5 })]).erros.join()).toMatch(/preço/)
  })

  it('reprova precoAntes menor que o preço', () => {
    // selo de desconto negativo apareceria na vitrine.
    const { erros } = valida([produto({ preco: 100, precoAntes: 80 })])
    expect(erros.join()).toMatch(/precoAntes/)
  })

  it('reprova categoria inexistente', () => {
    const { erros } = valida([produto({ categoria: 'nao-existe' })])
    expect(erros.join()).toMatch(/não existe/)
  })

  it('reprova link de afiliado fora da Shopee', () => {
    const { erros } = valida([
      produto({ linkAfiliado: 'https://shopee.com.br.evil.com/x' }),
    ])
    expect(erros.join()).toMatch(/inválido/)
  })

  it('reprova slug duplicado', () => {
    const { erros } = valida([produto(), produto({ nome: 'Outro' })])
    expect(erros.join()).toMatch(/slug duplicado/)
  })

  it('reprova imagem que não é URL nem caminho local', () => {
    const { erros } = valida([produto({ imagens: ['down/abc.jpg'] })])
    expect(erros.join()).toMatch(/imagem inválida/)
  })

  it('aceita imagem local servida pelo próprio projeto', () => {
    const { erros } = valida([produto({ imagens: ['/img/a.webp'] })])
    expect(erros).toEqual([])
  })

  it('reprova urlPublica vazia, que só o links:resolve preenche', () => {
    const { erros } = valida([produto({ urlPublica: null })])
    expect(erros.join()).toMatch(/urlPublica/)
  })
})

describe('validateCatalog — preço desatualizado', () => {
  it('reprova preço sem confirmação há mais de 180 dias', () => {
    const { erros } = valida([produto({ atualizadoEm: '2026-01-01' })])
    expect(erros.join()).toMatch(/sem confirmação há/)
  })

  it('avisa, mas não reprova, entre 30 e 180 dias', () => {
    const r = valida([produto({ atualizadoEm: '2026-08-01' })])
    expect(r.erros).toEqual([])
    expect(r.avisos.join()).toMatch(/confirmado há/)
  })

  it('reprova atualizadoEm ausente', () => {
    expect(valida([produto({ atualizadoEm: '' })]).erros.join()).toMatch(/atualizadoEm/)
  })
})

describe('validateCatalog — produto pendente', () => {
  it('bloqueia a publicação enquanto existir pendente', () => {
    const { erros } = valida([produto(), produto({ nome: '', pendente: true })])
    expect(erros.join()).toMatch(/pendente/)
  })

  it('nomeia exatamente os campos que faltam', () => {
    const { erros } = valida([
      produto({ nome: '', categoria: '', preco: null, imagens: [], pendente: true }),
    ])
    expect(erros[0]).toContain('nome, categoria, preco, imagens')
  })

  it('pendente nunca publica, mesmo marcado ativo', () => {
    const { ativos } = valida([produto({ pendente: true, ativo: true })])
    expect(ativos).toEqual([])
  })
})

describe('validateCatalog — site', () => {
  it('avisa enquanto SITE.url for placeholder', () => {
    const { avisos } = validateCatalog({
      produtos: [produto()],
      categorias: CATEGORIAS,
      site: { url: 'https://exemplo.com.br', diasParaPrecoAntigo: 30 },
      referencia: REFERENCIA,
    })
    expect(avisos.join()).toMatch(/placeholder/)
  })

  it('avisa quando a vitrine fica sem nenhum produto ativo', () => {
    const { avisos } = valida([produto({ ativo: false })])
    expect(avisos.join()).toMatch(/vitrine vai abrir vazia/)
  })

  it('avisa sobre produto completo que está desligado', () => {
    const { avisos } = valida([produto({ ativo: false })])
    expect(avisos.join()).toMatch(/ativo=nao/)
  })
})

describe('validateCatalog — categorias', () => {
  it('reprova id de categoria duplicado', () => {
    const categorias = [
      ...CATEGORIAS,
      { id: 'eletronicos', nome: 'Repetida', descricao: '', icone: '', ordem: 50 },
    ]
    const { erros } = validateCatalog({
      produtos: [produto()],
      categorias,
      site: siteDeTeste,
      referencia: REFERENCIA,
    })
    expect(erros.join()).toMatch(/id duplicado/)
  })
})
