// Busca a imagem oficial de cada produto pelo Open API de afiliados.
//
// O que ele faz e o que ele não faz: pega só a foto. Nome e preço continuam
// vindo da exportação do painel, porque é a pessoa que editou esses campos e a
// API devolve o nome de vendedor com a grafia da Shopee — misturar as duas
// fontes faria o card dizer uma coisa e a página de produto outra.
//
// A resposta é gravada em `data/imagens-shopee.csv` e não só em
// `data/produtos.csv`. O `catalog:import` reconstrói o catálogo do zero a partir
// dos lotes, e sem o arquivo à parte a próxima importação apagaria as 500 fotos
// e o build continuaria verde com placeholder em tudo.
//
// Roda fora do Vite, sem dependência: as credenciais vêm do ambiente (npm inject
// .env via --env-file-if-exists) e a assinatura mora em engine/shopee-api.js.

import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

import { parseCsv, formatarLinhaCsv, COLUNAS_CATALOGO } from './from-csv.js'
import {
  ENDPOINT_GRAFQL,
  assinar,
  corpoImagem,
  extrairImagem,
  erroDaApi,
  CREDENCIAL_INVALIDA,
  TENTAR_DE_NOVO,
  dormir,
} from '../src/engine/shopee-api.js'

const RAIZ = dirname(dirname(fileURLToPath(import.meta.url)))
const CSV_CATALOGO = join(RAIZ, 'data/produtos.csv')
const CSV_LINKS = join(RAIZ, 'data/links-resolvidos.csv')
const CSV_CACHE = join(RAIZ, 'data/imagens-shopee.csv')

const CABECALHO_CACHE = ['itemId', 'imageUrl', 'capturadoEm']
const CONCORRENCIA_PADRAO = 4
const FLUSH_A_CADA = 25

/**
 * Pares `{ linha, itemId }` que ainda não têm foto.
 *
 * `data/produtos.csv` não tem coluna `itemId`: ele é editável e o id é ruido na
 * exportação. O id vive em `data/links-resolvidos.csv`, que é justamente onde o
 * `resolve-links.js` gravou o resultado do redirect. Sem id não há o que
 * consultar — e é o caso do produto cujo link nunca resolveu, que já está
 * pendente por outro motivo.
 */
export function alvoDaBusca(linhas, itemIds) {
  const alvo = []
  for (const linha of linhas) {
    if (String(linha.imagens ?? '').trim()) continue
    const itemId = String(itemIds.get(String(linha.linkCurto ?? '').trim()) ?? '').trim()
    if (itemId) alvo.push({ linha, itemId })
  }
  return alvo
}

/** `linkCurto → itemId` do CSV de links resolvidos. */
export async function lerItemIds(caminho = CSV_LINKS) {
  try {
    const { linhas } = parseCsv(await readFile(caminho, 'utf8'))
    const mapa = new Map()
    for (const l of linhas) {
      const linkCurto = String(l.linkCurto ?? '').trim()
      const itemId = String(l.itemId ?? '').trim()
      if (linkCurto && itemId) mapa.set(linkCurto, itemId)
    }
    return mapa
  } catch (erro) {
    if (erro.code === 'ENOENT') return new Map()
    throw erro
  }
}

export async function lerCache(caminho = CSV_CACHE) {
  try {
    const { linhas } = parseCsv(await readFile(caminho, 'utf8'))
    const mapa = new Map()
    for (const l of linhas) {
      const itemId = String(l.itemId ?? '').trim()
      const imageUrl = String(l.imageUrl ?? '').trim()
      if (itemId && imageUrl.startsWith('https://')) mapa.set(itemId, imageUrl)
    }
    return mapa
  } catch (erro) {
    if (erro.code === 'ENOENT') return new Map()
    throw erro
  }
}

function linhasCache(cache, capturadoEm) {
  return [...cache.entries()]
    .sort((a, b) => Number(a[0]) - Number(b[0]))
    .map(([itemId, imageUrl]) => ({ itemId, imageUrl, capturadoEm }))
}

/**
 * Grava as duas saídas, nesta ordem: o cache primeiro.
 *
 * Se a escrita do catálogo falhar no meio, o cache já está inteiro e a próxima
 * rodada não refaz chamada nenhuma. Se fosse ao contrário, um CSV cortado
 * derrubaria a validação do build com linhas quebradas.
 */
export async function gravar({ produtos, cache, capturadoEm, caminhoCatalogo = CSV_CATALOGO, caminhoCache = CSV_CACHE }) {
  const doCache = linhasCache(cache, capturadoEm)
  const corpoCache = [CABECALHO_CACHE.join(';'), ...doCache.map((c) => formatarLinhaCsv(c, CABECALHO_CACHE, ';'))].join('\n')
  const corpoCatalogo = [COLUNAS_CATALOGO.join(';'), ...produtos.map((p) => formatarLinhaCsv(p, COLUNAS_CATALOGO, ';'))].join('\n')
  await writeFile(caminhoCache, corpoCache + '\n', 'utf8')
  await writeFile(caminhoCatalogo, corpoCatalogo + '\n', 'utf8')
  return { cache: doCache.length, produtos: produtos.length }
}

/** Enfileira tudo e limita quantas chamadas estão em voo por vez. */
async function comLimitador(itens, concorrencia, trabalhar) {
  const proximo = { i: 0 }
  const resultado = new Array(itens.length)
  const fileiras = Array.from({ length: Math.max(1, concorrencia) }, async () => {
    for (;;) {
      const i = proximo.i++
      if (i >= itens.length) return
      resultado[i] = await trabalhar(itens[i])
    }
  })
  await Promise.all(fileiras)
  return resultado
}

async function chamarApi({ appId, segredo, itemId, tentativas = 3 }) {
  const payload = corpoImagem(itemId)
  let espera = 500

  // O retorno distingue os dois finais possíveis:
  //   ok          → achou a foto, grava no cache
  //   ausente     → resposta válida sem o item (saiu da oferta), não vale reclamar
  //   transitorio → a rede ou o limite respondeu mal até o fim; sai da rodada e
  //                 volta na próxima execução, que é o que faz justiça
  for (let tentativa = 1; tentativa <= tentativas; tentativa++) {
    const { timestamp, authorization } = assinar({ appId, segredo, payload, timestamp: Math.floor(Date.now() / 1000) })

    let resposta
    try {
      resposta = await fetch(ENDPOINT_GRAFQL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: authorization },
        body: payload,
      })
    } catch {
      if (tentativa === tentativas) return { tipo: 'transitorio' }
      await dormir(espera)
      espera *= 2
      continue
    }

    const corpo = await resposta.json().catch(() => null)
    const codigo = erroDaApi(corpo)

    if (CREDENCIAL_INVALIDA.has(codigo)) {
      throw new Error(
        'Credencial reprovada (erro ' + codigo + '). Confira SHOPEE_APP_ID e SHOPEE_APP_SECRET em .env — ' +
        'tentar de novo 500 vezes só transforma o erro em espera.'
      )
    }

    if (resposta.ok && !codigo) {
      const url = extrairImagem(corpo, itemId)
      // HTTP 200 com `nodes` vazio é o item fora da oferta. Classificar como
      // 'ok' sem url faria a rodada inteira contar como falha transitória um
      // produto que simplesmente saiu de campanha — e reconsultar sempre.
      return url ? { tipo: 'ok', url } : { tipo: 'ausente' }
    }

    if ((TENTAR_DE_NOVO.has(resposta.status) || codigo !== null) && tentativa < tentativas) {
      await dormir(espera)
      espera *= 2
      continue
    }

    return { tipo: 'ausente' }
  }

  return { tipo: 'transitorio' }
}

function lerArgumentos(argv) {
  const opcoes = { concorrencia: CONCORRENCIA_PADRAO, limite: Infinity }
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--concorrencia') opcoes.concorrencia = Number(argv[++i])
    if (argv[i] === '--limite') opcoes.limite = Number(argv[++i])
  }
  if (!Number.isFinite(opcoes.concorrencia) || opcoes.concorrencia < 1) opcoes.concorrencia = CONCORRENCIA_PADRAO
  if (!Number.isFinite(opcoes.limite) || opcoes.limite < 1) opcoes.limite = Infinity
  return opcoes
}

export async function main(argv = process.argv.slice(2)) {
  const opcoes = lerArgumentos(argv)
  const appId = process.env.SHOPEE_APP_ID
  const segredo = process.env.SHOPEE_APP_SECRET

  if (!appId || !segredo) {
    console.error(
      'Falta SHOPEE_APP_ID ou SHOPEE_APP_SECRET no ambiente.\n' +
      'Copie .env.example para .env e preencha com as credenciais do painel de afiliado.'
    )
    return 1
  }

  const { linhas } = parseCsv(await readFile(CSV_CATALOGO, 'utf8'))
  const [cache, itemIds] = await Promise.all([lerCache(), lerItemIds()])
  const faltando = alvoDaBusca(linhas, itemIds)
  const pendentes = faltando.slice(0, opcoes.limite)

  const daCache = pendentes.filter((p) => cache.has(p.itemId))
  const daApi = pendentes.filter((p) => !cache.has(p.itemId))

  console.log(`fotos faltando: ${faltando.length}`)
  console.log(`  já no cache:  ${daCache.length}`)
  console.log(`  a consultar:   ${daApi.length} (concorrência ${opcoes.concorrencia})`)

  if (pendentes.length === 0) {
    console.log('\nNada a buscar. Toda foto que a API oferece já está no catálogo.')
    return 0
  }

  const capturadoEm = new Date().toISOString().slice(0, 10)
  let concluidos = 0
  let achados = 0
  let ausentes = 0
  let transitorios = 0
  let escritas = 0

  const salvar = async () => {
    await gravar({ produtos: linhas, cache, capturadoEm })
    escritas++
  }

  const flushPeriodico = async () => {
    concluidos++
    if (concluidos % FLUSH_A_CADA === 0) await salvar()
  }

  try {
    await comLimitador(daApi, opcoes.concorrencia, async ({ linha, itemId }) => {
      try {
        const r = await chamarApi({ appId, segredo, itemId })
        if (r.tipo === 'ok' && r.url) {
          cache.set(itemId, r.url)
          linha.imagens = r.url
          achados++
        } else if (r.tipo === 'ausente') {
          ausentes++
        } else {
          transitorios++
        }
      } finally {
        await flushPeriodico()
      }
    })

    for (const { linha, itemId } of daCache) linha.imagens = cache.get(itemId)
    await salvar()
  } catch (erro) {
    // Falhou no meio: grava o que já veio para a próxima rodada não repetir
    // as chamadas que já deram certo.
    await salvar()
    console.error(`\nAbortado: ${erro.message}`)
    console.error(`O que já foi achado ficou gravado (${achados} foto(s)).`)
    return 1
  }

  const totalAgora = linhas.filter((l) => String(l.imagens ?? '').trim()).length
  console.log(`\nresultado:`)
  console.log(`  encontradas na API: ${achados}`)
  console.log(`  fora da oferta:     ${ausentes} (fica no placeholder)`)
  console.log(`  reaproveitadas do cache: ${daCache.length}`)
  console.log(`  fotos no catálogo agora: ${totalAgora}/${linhas.length}`)
  console.log(`  gravado(s): ${escritas} escrita(s) de ${CSV_CACHE.replace(RAIZ + '/', '')}`)
  console.log('\nRode `npm run catalog:sync` para gerar os dados da vitrine, depois `npm run verify`.')
  return 0
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().then((codigo) => process.exit(codigo ?? 0))
}
