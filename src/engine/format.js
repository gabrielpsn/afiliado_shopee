// Formatação e datas. Funções puras, sem Vue e sem DOM.

const MOEDA = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

export function formatBRL(valor) {
  if (!Number.isFinite(valor)) return '—'
  return MOEDA.format(valor)
}

export function formatNumero(valor, casas = 0) {
  if (!Number.isFinite(valor)) return '—'
  return valor.toLocaleString('pt-BR', {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
  })
}

/**
 * Desconto percentual entre o preço "de" e o preço atual.
 * Devolve null quando não há preço anterior válido ou quando o "de" não é
 * maior que o preço atual — nesse caso o selo de desconto seria enganoso.
 */
export function formatDiscount(preco, precoAntes) {
  if (!Number.isFinite(preco) || !Number.isFinite(precoAntes)) return null
  if (precoAntes <= preco) return null

  const pct = Math.round(((precoAntes - preco) / precoAntes) * 100)
  if (pct <= 0) return null

  return { pct, label: `-${pct}%` }
}

export function slugify(texto) {
  return String(texto)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/** Remove acentos e caixa para busca tolerante. */
export function normalizar(texto) {
  return String(texto)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

export function formatarData(iso) {
  const data = new Date(`${iso}T12:00:00`)
  if (Number.isNaN(data.getTime())) return '—'

  return data.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

/** Dias entre hoje e a data ISO. Devolve Infinity para datas ausentes. */
export function daysSince(iso, referencia = new Date()) {
  if (!iso) return Infinity

  const alvo = new Date(`${iso}T12:00:00`)
  if (Number.isNaN(alvo.getTime())) return Infinity

  const hoje = new Date(
    Date.UTC(referencia.getFullYear(), referencia.getMonth(), referencia.getDate())
  )
  const alvoDia = new Date(
    Date.UTC(alvo.getFullYear(), alvo.getMonth(), alvo.getDate())
  )

  return Math.round((hoje - alvoDia) / 86400000)
}

/**
 * Preço de referência mais antigo que o tolerado. O site nunca esconde a data
 * do preço, mas sinalizar o tempo passado evita que o visitante trate um valor
 * de dois meses atrás como oferta do dia.
 */
export function isPriceStale(produto, limiteDias = 30, referencia = new Date()) {
  return daysSince(produto.atualizadoEm, referencia) > limiteDias
}

export function formatarAvaliacao(nota, quantidade) {
  const n = formatNumero(nota, 1)
  if (!quantidade) return n
  return `${n} (${formatNumero(quantidade)} avaliações)`
}
