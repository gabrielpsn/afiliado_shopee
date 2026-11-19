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

// --- Busca de ofertas -------------------------------------------------------
//
// A mesma `productOfferV2` que dá a foto devolve tudo o que a exportação do
// painel traz: nome, preço, comissão, loja e o link de afiliado. Por isso a
// busca não inventa um formato novo — ela escreve um lote no formato do painel
// (`ofertaParaLinhaLote`) e o `catalog:import` segue sendo o único caminho para o
// catálogo, com a mesma deduplicação, categorização e validação.

/** `sortType` do GraphQL. O nome em português é o que vai no CSV de buscas. */
export const ORDENACAO = {
  relevancia: 1,
  vendas: 2,
  'maior-preco': 3,
  'menor-preco': 4,
  comissao: 5,
}

export const LIMITE_POR_PAGINA = 50

const CAMPOS_OFERTA =
  'itemId productName priceMin priceMax commissionRate commission sales shopName shopId productLink offerLink imageUrl periodEndTime'

/** Texto como literal GraphQL. A escapação de JSON vale em GraphQL e fecha injeção pela busca. */
function literal(texto) {
  return JSON.stringify(String(texto))
}

function inteiroPositivo(valor) {
  const n = Number(valor)
  return Number.isInteger(n) && n > 0 ? n : null
}

/**
 * Corpo de uma página de busca. Devolve string, não objeto: o que é assinado
 * tem de ser byte a byte o que é enviado.
 */
export function corpoBuscaOfertas({
  busca = '',
  categoriaShopee = '',
  lojaId = '',
  ordem = 'vendas',
  pagina = 1,
  limite = LIMITE_POR_PAGINA,
} = {}) {
  const args = []
  const texto = String(busca ?? '').trim()
  if (texto) args.push(`keyword: ${literal(texto)}`)
  const categoria = inteiroPositivo(categoriaShopee)
  if (categoria) args.push(`productCatId: ${categoria}`)
  const loja = inteiroPositivo(lojaId)
  if (loja) args.push(`shopId: ${loja}`)
  args.push(`sortType: ${ORDENACAO[ordem] ?? ORDENACAO.vendas}`)
  args.push(`page: ${inteiroPositivo(pagina) ?? 1}`)
  args.push(`limit: ${Math.min(inteiroPositivo(limite) ?? LIMITE_POR_PAGINA, LIMITE_POR_PAGINA)}`)

  const query = `{ productOfferV2(${args.join(', ')}) { nodes { ${CAMPOS_OFERTA} } pageInfo { hasNextPage } } }`
  return JSON.stringify({ query })
}

/** Corpo da conferência de preço de um item que já está no catálogo. */
export function corpoOfertaPorItem(itemId) {
  const id = inteiroPositivo(itemId) ?? 0
  return JSON.stringify({ query: `{ productOfferV2(itemId: ${id}) { nodes { ${CAMPOS_OFERTA} } } }` })
}

/** `{ ofertas, temMais }` de uma resposta; resposta torta vira lista vazia, não exceção. */
export function extrairOfertas(resposta) {
  const bloco = resposta?.data?.productOfferV2
  const ofertas = Array.isArray(bloco?.nodes) ? bloco.nodes.filter((n) => n && n.itemId) : []
  return { ofertas, temMais: bloco?.pageInfo?.hasNextPage === true }
}

/**
 * Preço de uma oferta.
 *
 * `priceMin ≠ priceMax` é produto com variação de preço (tamanho, kit). O card
 * mostra um valor só, então `faixa` deixa o chamador decidir: mostrar o menor
 * como se fosse o preço de toda variação é anunciar um valor que a maioria das
 * opções não tem.
 */
export function precoDaOferta(oferta) {
  const min = Number(oferta?.priceMin)
  const max = Number(oferta?.priceMax)
  if (!Number.isFinite(min) || min <= 0) return null
  const precoMax = Number.isFinite(max) && max > min ? max : min
  return { preco: min, precoMax, faixa: precoMax > min }
}

/** "0.075" → 7.5. A API manda a taxa como fração em string. */
export function comissaoPercentual(oferta) {
  if (oferta?.commissionRate === undefined || oferta?.commissionRate === null || oferta.commissionRate === '') return null
  const taxa = Number(oferta.commissionRate)
  if (!Number.isFinite(taxa) || taxa < 0) return null
  return Math.round(taxa * 10000) / 100
}

/** Oferta que vence nos próximos `dias` não vale a pena entrar: o link para de pagar logo depois. */
export function ofertaVencendo(oferta, { dias = 7, agora = Date.now() } = {}) {
  const fim = Number(oferta?.periodEndTime)
  if (!Number.isFinite(fim) || fim <= 0) return false
  return fim * 1000 < agora + dias * 86_400_000
}

function decimalBr(n) {
  return n.toFixed(2).replace('.', ',')
}

/** 15987 → "15mil+", no mesmo formato da coluna Sales do painel. */
export function formatarVendas(vendas) {
  if (vendas === undefined || vendas === null || vendas === '') return ''
  const n = Number(vendas)
  if (!Number.isFinite(n) || n < 0) return ''
  if (n >= 1_000_000) return `${Math.floor(n / 1_000_000)}mi+`
  if (n >= 1000) return `${Math.floor(n / 1000)}mil+`
  return String(Math.floor(n))
}

/** Cabeçalho da exportação "Links de produtos em lote", que o importador lê. */
export const COLUNAS_LOTE = [
  'Item Id',
  'Item Name',
  'Price',
  'Sales',
  'Nome da loja',
  'Commission Rate',
  'Commission',
  'Product Link',
  'Offer Link',
]

/**
 * Oferta da API → linha de lote no formato do painel.
 *
 * Nenhum campo é completado com palpite: sem nome, preço ou link de afiliado a
 * oferta volta com `erros` e fica fora do lote. O `Product Link` é o único
 * montado, e só quando a API não o manda no formato `/product/loja/item` — ele
 * é função direta dos dois ids que vieram na mesma resposta.
 */
export function ofertaParaLinhaLote(oferta) {
  const erros = []
  const itemId = String(oferta?.itemId ?? '').trim()
  const nome = String(oferta?.productName ?? '').trim()
  const preco = precoDaOferta(oferta)
  const pct = comissaoPercentual(oferta)
  const comissao = Number(oferta?.commission)
  const offerLink = String(oferta?.offerLink ?? '').trim()

  let productLink = String(oferta?.productLink ?? '').trim()
  if (!/^https:\/\/shopee\.com\.br\/product\/\d+\/\d+/.test(productLink) && oferta?.shopId && itemId) {
    productLink = `https://shopee.com.br/product/${oferta.shopId}/${itemId}`
  }

  if (!itemId) erros.push('itemId vazio')
  if (!nome) erros.push('productName vazio')
  if (!preco) erros.push(`preço ilegível ("${oferta?.priceMin}")`)
  if (!/^https:\/\/s\.shopee\.com\.br\/[^/?#]+$/.test(offerLink)) erros.push(`offerLink inválido ("${offerLink}")`)

  if (erros.length) return { linha: null, erros }

  return {
    erros,
    linha: {
      'Item Id': itemId,
      'Item Name': nome,
      Price: decimalBr(preco.preco),
      Sales: formatarVendas(oferta.sales),
      'Nome da loja': String(oferta.shopName ?? '').trim(),
      'Commission Rate': pct === null ? '' : `${String(pct).replace('.', ',')}%`,
      Commission: Number.isFinite(comissao) && oferta.commission !== null ? `R$${decimalBr(comissao)}` : '',
      'Product Link': productLink,
      'Offer Link': offerLink,
    },
  }
}
