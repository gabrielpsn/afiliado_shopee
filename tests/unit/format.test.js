import { describe, it, expect } from 'vitest'

import {
  formatBRL,
  formatNumero,
  formatDiscount,
  slugify,
  normalizar,
  formatarData,
  daysSince,
  isPriceStale,
  formatarAvaliacao,
} from '../../src/engine/format.js'

// `Intl` usa espaço não separável entre "R$" e o número em pt-BBR. Os testes
// comparam o texto visível, então o caractere precisa ser normalizado.
const semNbsp = (s) => s.replace(/\u00a0/g, ' ')

describe('formatBRL', () => {
  it('formata em reais com duas casas', () => {
    expect(semNbsp(formatBRL(129.9))).toBe('R$ 129,90')
    expect(semNbsp(formatBRL(1000))).toBe('R$ 1.000,00')
    expect(semNbsp(formatBRL(0))).toBe('R$ 0,00')
  })

  it('devolve traço em vez de NaN ou R$ NaN', () => {
    expect(formatBRL(null)).toBe('—')
    expect(formatBRL(undefined)).toBe('—')
    expect(formatBRL('abc')).toBe('—')
  })
})

describe('formatNumero', () => {
  it('arredonda conforme as casas pedidas', () => {
    expect(formatNumero(1234.567)).toBe('1.235')
    expect(formatNumero(4.85, 1)).toBe('4,9')
    expect(formatNumero(12345)).toBe('12.345')
  })

  it('devolve traço para valor inválido', () => {
    expect(formatNumero(null)).toBe('—')
  })
})

describe('formatDiscount', () => {
  it('calcula a porcentagem e monta o selo', () => {
    expect(formatDiscount(80, 100)).toEqual({ pct: 20, label: '-20%' })
    expect(formatDiscount(50, 100)).toEqual({ pct: 50, label: '-50%' })
    // 70/199,9 = 35,02% — arredonda para 35.
    expect(formatDiscount(129.9, 199.9).pct).toBe(35)
  })

  it('devolve null quando não há desconto real', () => {
    // Preço "de" menor que o atual renderizaria um selo de desconto falso.
    expect(formatDiscount(100, 80)).toBeNull()
    expect(formatDiscount(100, 100)).toBeNull()
    expect(formatDiscount(100, null)).toBeNull()
    expect(formatDiscount(null, 100)).toBeNull()
  })

  it('devolve null quando o desconto arredonda para zero', () => {
    // Um selo de -0% na vitrine é ruído, não informação.
    expect(formatDiscount(99.9, 100)).toBeNull()
  })
})

describe('slugify', () => {
  it('remove acento, baixa a caixa e troca separador por hífen', () => {
    expect(slugify('Fone Bluetooth ANC')).toBe('fone-bluetooth-anc')
    expect(slugify('Café Torrado & Moído')).toBe('cafe-torrado-moido')
    expect(slugify('  Çadeira  Gamer  ')).toBe('cadeira-gamer')
  })

  it('não deixa hífen nas pontas nem duplicado', () => {
    expect(slugify('---Hello---World---')).toBe('hello-world')
    expect(slugify('a  b   c')).toBe('a-b-c')
  })

  it('devolve string vazia quando não sobra nada utilizável', () => {
    expect(slugify('!!!')).toBe('')
  })
})

describe('normalizar', () => {
  it('tira acento e caixa para a busca', () => {
    expect(normalizar('Fone Àmbar')).toBe('fone ambar')
  })
})

describe('formatarData', () => {
  it('formata ISO em pt-BR', () => {
    expect(formatarData('2026-09-01')).toBe('01 de set. de 2026')
  })

  it('devolve traço para data inválida', () => {
    expect(formatarData('nao-e-data')).toBe('—')
    expect(formatarData(undefined)).toBe('—')
  })
})

describe('daysSince', () => {
  const hoje = new Date(2026, 9, 2) // 2 de outubro de 2026

  it('conta dias a partir de uma data ISO', () => {
    expect(daysSince('2026-10-02', hoje)).toBe(0)
    expect(daysSince('2026-09-02', hoje)).toBe(30)
    expect(daysSince('2026-10-05', hoje)).toBe(-3)
  })

  it('devolve Infinity quando a data falta ou é inválida', () => {
    expect(daysSince('', hoje)).toBe(Infinity)
    expect(daysSince(undefined, hoje)).toBe(Infinity)
    expect(daysSince('lixo', hoje)).toBe(Infinity)
  })

  it('ignora a hora: a data é do dia local, não do instante', () => {
    expect(daysSince('2026-10-02', new Date(2026, 9, 2, 23, 59))).toBe(0)
    expect(daysSince('2026-10-02', new Date(2026, 9, 2, 0, 1))).toBe(0)
  })
})

describe('isPriceStale', () => {
  const hoje = new Date(2026, 9, 2)

  it('marcavelho quando passa do limite', () => {
    expect(isPriceStale({ atualizadoEm: '2026-09-25' }, 30, hoje)).toBe(false)
    expect(isPriceStale({ atualizadoEm: '2026-08-01' }, 30, hoje)).toBe(true)
  })

  it('trata produto sem data como antigo, não como novo', () => {
    expect(isPriceStale({ atualizadoEm: null }, 30, hoje)).toBe(true)
  })
})

describe('formatarAvaliacao', () => {
  it('junta nota e quantidade quando há avaliações', () => {
    expect(formatarAvaliacao(4.8, 1234)).toBe('4,8 (1.234 avaliações)')
  })

  it('mostra só a nota quando não há contagem', () => {
    expect(formatarAvaliacao(4.8, 0)).toBe('4,8')
  })
})
