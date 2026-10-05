// Construção e validação de links de afiliado.
//
// Regra central: a atribuição de afiliado mora dentro da URL
// (`?sp_atk=`/`?xptdk=` ou no código do `s.shopee.com.br/<codigo>`). Por isso
// NUNCA concatenamos query string aqui — se o link mudar no painel do
// afiliado, muda-se no catálogo e o site inteiro acompanha.

import { formatBRL } from './format.js'

const DOMINIOS_PERMITIDOS = ['shopee.com.br', 's.shopee.com.br', 'shopee.com']

// Todo link de afiliado sai com isto. O Google exige `sponsored` em links de
// afiliados; sem isso o site entra em risco de ação manual.
export const REL_AFILIADO = 'sponsored nofollow'

export function isValidAffiliateLink(url) {
  if (!url || typeof url !== 'string') {
    return { valido: false, motivo: 'link vazio' }
  }

  let parsed
  try {
    parsed = new URL(url)
  } catch {
    return { valido: false, motivo: 'URL inválida' }
  }

  if (parsed.protocol !== 'https:') {
    return { valido: false, motivo: 'precisa ser https' }
  }

  const dominioPermitido = DOMINIOS_PERMITIDOS.some(
    (d) => parsed.hostname === d || parsed.hostname.endsWith(`.${d}`)
  )
  if (!dominioPermitido) {
    return { valido: false, motivo: `domínio não permitido: ${parsed.hostname}` }
  }

  return { valido: true, motivo: null }
}

export function validateAffiliateLink(url) {
  return isValidAffiliateLink(url).valido
}

/**
 * URL de destino de um produto. É a única função que devolve o link usado no
 * `href` — componentes nunca montam a URL por conta própria.
 */
export function buildAffiliateLink(produto) {
  if (!produto?.linkAfiliado) return null
  return produto.linkAfiliado
}

/** URL pública e estável na Shopee, sem os parâmetros de rastreamento. */
export function buildShopeeUrl(produto) {
  if (!produto?.urlPublica) return null
  return produto.urlPublica
}

/** Texto pronto para colar no WhatsApp/Telegram. */
export function buildShareText(produto, urlSite) {
  const preco = produto?.preco ? ` por ${formatBRL(produto.preco)}` : ''

  const linha = `Vi ${produto?.nome ?? 'um produto'} na Shopee${preco}: ${urlSite}`
  return `${linha}\n\nPreço de referência, sujeito a alteração. Link de afiliado.`
}

/**
 * Registra o clique de saída no analytics.
 *
 * Sem banco de dados: só dispara um evento agregado no Cloudflare Web
 * Analytics, sem identificador de pessoa. Em desenvolvimento não faz nada,
 * para não poluir os números.
 */
export function trackOutboundClick(slug, posicao = 'card') {
  if (typeof window === 'undefined') return
  if (import.meta.env?.DEV) return
  if (typeof window._paq === 'undefined') return

  window._paq.push([
    'trackEvent',
    'outbound_click',
    { slug, posicao },
  ])
}
