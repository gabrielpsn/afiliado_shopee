// Assinatura e leitura do Open API de afiliados da Shopee.
//
// A API não aceita token: cada chamada carrega uma assinatura que cobre o corpo
// que está sendo enviado. Assinar fora do corpo (ou assinar um corpo diferente do
// enviado) devolve 10020 "Invalid Credential" — e a mensagem não diz o que faltou,
// então a assinatura fica isolada aqui para ser testada sem rede.
//
// Payload é exatamente o JSON enviado, nem um byte a mais ou a menos. Trocar as
// chaves de lugar ou reformatar o objeto depois de assinar quebra a assinatura em
// silêncio: a requisição chega e o servidor recusa.

import { createHash } from 'node:crypto'

/** Endpoint do afiliado no Brasil. Não é o open.shopee.com.br da Shopee Lojista. */
export const ENDPOINT_GRAFQL = 'https://open-api.affiliate.shopee.com.br/graphql'

/**
 * Assina o corpo exato enviado ao GraphQL.
 *
 * `timestamp` em segundos; a validade é de minutos, então ele é computado na
 * chamada e nunca fixado em teste que vá à rede.
 */
export function assinar({ appId, segredo, payload, timestamp }) {
  const assinatura = createHash('sha256')
    .update(String(appId) + String(timestamp) + payload + String(segredo))
    .digest('hex')

  return {
    timestamp,
    authorization: `SHA256 Credential=${appId}, Timestamp=${timestamp}, Signature=${assinatura}`,
  }
}

/** Corpo de uma consulta de imagem. Só `itemId`: é o identificador que o catálogo já tem. */
export function corpoImagem(itemId) {
  const id = Number(itemId)
  const seguro = Number.isFinite(id) ? id : 0
  // Gerado como string e não como objeto serializado depois: o que é assinado
  // tem de ser byte a byte o que é enviado.
  return `{"query":"{ productOfferV2(itemId: ${seguro}) { nodes { itemId imageUrl } } }"}`
}

/**
 * Lê a imagem de um item, ou `null` quando a oferta não existe mais.
 *
 * `null` não é erro: item que saiu de campanha some do catálogo de afiliado e o
 * produto continua com o placeholder. Tratar isso como falha pararia a busca nos
 * primeiros itens removidos e deixaria 500 fotos por pular.
 */
export function extrairImagem(resposta, itemId) {
  const nodes = resposta?.data?.productOfferV2?.nodes
  if (!Array.isArray(nodes)) return null

  // Só a foto que corresponde ao item consultado. Pegar o primeiro nó quando o
  // item não está na resposta misturaria a foto de outro produto no card.
  const node = nodes.find((n) => Number(n?.itemId) === Number(itemId))
  if (!node) return null

  const url = String(node.imageUrl ?? '').trim()
  if (!url.startsWith('https://')) return null
  return url
}

/** Erro que só uma credencial ruim produz: adianta parar em vez de tentar 500 vezes. */
export const CREDENCIAL_INVALIDA = new Set([10020, 10035])

/**
 * Tira o motivo de uma resposta de erro da API.
 *
 * A Shopee devolve o erro dentro de `errors[].extensions`, que não é o formato
 * HTTP. Achar `10020` a partir do corpo é a única forma de distinguir "segredo
 * errado" de "produto não existe".
 */
export function erroDaApi(corpo) {
  const texto = typeof corpo === 'string' ? corpo : JSON.stringify(corpo ?? '')

  for (const erro of corpo?.errors ?? []) {
    const codigo = erro?.extensions?.code ?? erro?.code
    if (codigo !== undefined && codigo !== null) return Number(codigo)
  }

  if (/10020|10035|Invalid Credential/i.test(texto)) return 10020
  return null
}

/** Códigos transitórios que valem a pena tentar de novo. */
export const TENTAR_DE_NOVO = new Set([429, 500, 502, 503, 504])

export function dormir(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
