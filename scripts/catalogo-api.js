// Abastece o catálogo pelo Open API de afiliados, sem baixar planilha do painel.
//
//   npm run catalog:api                 # buscas de data/buscas-api.csv → lote novo em data/batch/
//   npm run catalog:api -- --simular    # mostra o que entraria, sem gravar nada
//   npm run precos:atualizar            # reconfere o preço de todo item do catálogo
//
// As duas tarefas escrevem arquivos que o `catalog:import` já sabe ler, e nunca
// o catálogo direto:
//
//   buscar  → data/batch/BatchProductLinksApi<data>.csv, no formato do painel.
//             O importador trata como mais um lote: mesma deduplicação,
//             categorização e validação. Item que já está no catálogo é pulado
//             para o produto não ganhar um segundo link — o `linkCurto` é a chave
//             de `adicionadoEm` e dos ajustes editoriais.
//   precos  → data/precos-shopee.csv (itemId → preço conferido e data). O
//             importador usa a observação mais recente de cada item, então o
//             `atualizadoEm` passa a dizer quando o preço foi de fato conferido.
//
// A foto vem na mesma resposta e vai direto para data/imagens-shopee.csv.

import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

import { parseCsv, parseNumero, formatarLinhaCsv } from './from-csv.js'
import { lerCache, lerItemIds, gravarCacheImagens } from './buscar-imagens.js'
import { lerManuais } from './importar-batch.js'
import {
  ORDENACAO,
  LIMITE_POR_PAGINA,
  COLUNAS_LOTE,
  corpoBuscaOfertas,
  corpoOfertaPorItem,
  extrairOfertas,
  precoDaOferta,
  comissaoPercentual,
  ofertaVencendo,
  ofertaParaLinhaLote,
} from '../src/engine/shopee-api.js'
import { consultarApi, comLimitador, CredencialInvalida, credenciais } from './shopee-cliente.js'
import { dormir } from '../src/engine/shopee-api.js'

const RAIZ = dirname(dirname(fileURLToPath(import.meta.url)))
const CSV_BUSCAS = join(RAIZ, 'data/buscas-api.csv')
const CSV_PRECOS = join(RAIZ, 'data/precos-shopee.csv')
const DIR_BATCH = join(RAIZ, 'data/batch')

export const COLUNAS_PRECOS = ['itemId', 'preco', 'precoMax', 'comissaoPct', 'situacao', 'conferidoEm']

/** Teto de páginas por busca: uma busca genérica tem milhares de páginas. */
const PAGINAS_MAX = 10

/**
 * Valida uma linha de `data/buscas-api.csv`.
 *
 * Linha sem busca, categoria nem loja consultaria a vitrine inteira da Shopee;
 * é erro, não um "tudo" implícito.
 */
export function validarBusca(linha) {
  const erros = []
  const busca = String(linha.busca ?? '').trim()
  const categoriaShopee = String(linha.categoriaShopee ?? '').trim()
  const lojaId = String(linha.lojaId ?? '').trim()
  const ordem = String(linha.ordem ?? '').trim() || 'vendas'
  const quantidade = parseNumero(linha.quantidade) ?? 20
  const comissaoMinima = parseNumero(String(linha.comissaoMinima ?? '').replace('%', '')) ?? 0

  if (!busca && !categoriaShopee && !lojaId) erros.push('sem busca, categoriaShopee nem lojaId')
  if (categoriaShopee && !/^\d+$/.test(categoriaShopee)) erros.push(`categoriaShopee não numérica ("${categoriaShopee}")`)
  if (lojaId && !/^\d+$/.test(lojaId)) erros.push(`lojaId não numérico ("${lojaId}")`)
  if (!(ordem in ORDENACAO)) erros.push(`ordem "${ordem}" não existe (use ${Object.keys(ORDENACAO).join(', ')})`)
  if (!Number.isInteger(quantidade) || quantidade < 1 || quantidade > 500) erros.push(`quantidade fora de 1–500 ("${linha.quantidade}")`)

  return { busca, categoriaShopee, lojaId, ordem, quantidade, comissaoMinima, erros }
}

/**
 * Separa as ofertas de uma página em aceitas e recusadas, com o motivo.
 *
 * `conhecidos` é mutado: a oferta aceita entra nele para a próxima página ou a
 * próxima busca não aceitar o mesmo item de novo.
 */
export function selecionarOfertas(ofertas, { conhecidos, comissaoMinima = 0, aceitarFaixa = false, agora = Date.now() }) {
  const aceitas = []
  const recusadas = { jaNoCatalogo: 0, faixaDePreco: 0, comissaoBaixa: 0, vencendo: 0, invalida: 0 }

  for (const oferta of ofertas) {
    const itemId = String(oferta.itemId)
    if (conhecidos.has(itemId)) {
      recusadas.jaNoCatalogo++
      continue
    }
    const { linha, erros } = ofertaParaLinhaLote(oferta)
    if (erros.length) {
      recusadas.invalida++
      continue
    }
    if (!aceitarFaixa && precoDaOferta(oferta)?.faixa) {
      recusadas.faixaDePreco++
      continue
    }
    if ((comissaoPercentual(oferta) ?? 0) < comissaoMinima) {
      recusadas.comissaoBaixa++
      continue
    }
    if (ofertaVencendo(oferta, { agora })) {
      recusadas.vencendo++
      continue
    }
    conhecidos.add(itemId)
    aceitas.push({ linha, imageUrl: String(oferta.imageUrl ?? '').trim() })
  }

  return { aceitas, recusadas }
}

/** Resultado da conferência de um item → linha de `precos-shopee.csv`. */
export function linhaDePreco(itemId, oferta, conferidoEm) {
  const preco = oferta ? precoDaOferta(oferta) : null
  if (!preco) return { itemId: String(itemId), preco: '', precoMax: '', comissaoPct: '', situacao: 'fora-da-oferta', conferidoEm }
  return {
    itemId: String(itemId),
    preco: preco.preco,
    precoMax: preco.precoMax,
    comissaoPct: comissaoPercentual(oferta) ?? '',
    situacao: 'ok',
    conferidoEm,
  }
}

export async function lerPrecosGravados(caminho = CSV_PRECOS) {
  try {
    const { linhas } = parseCsv(await readFile(caminho, 'utf8'))
    return new Map(linhas.filter((l) => String(l.itemId ?? '').trim()).map((l) => [String(l.itemId).trim(), l]))
  } catch (erro) {
    if (erro.code === 'ENOENT') return new Map()
    throw erro
  }
}

async function gravarPrecos(mapa, caminho = CSV_PRECOS) {
  const linhas = [...mapa.values()].sort((a, b) => Number(a.itemId) - Number(b.itemId))
  const corpo = [COLUNAS_PRECOS.join(';'), ...linhas.map((l) => formatarLinhaCsv(l, COLUNAS_PRECOS, ';'))].join('\n')
  await writeFile(caminho, corpo + '\n', 'utf8')
}

function carimbo(data = new Date()) {
  return data.toISOString().replace(/\D/g, '').slice(0, 14)
}

export function lerArgumentos(argv) {
  const opcoes = { tarefa: 'buscar', simular: false, aceitarFaixa: false, concorrencia: 4, limite: Infinity }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === 'buscar' || a === 'precos') opcoes.tarefa = a
    else if (a === '--simular') opcoes.simular = true
    else if (a === '--aceitar-faixa') opcoes.aceitarFaixa = true
    else if (a === '--concorrencia') opcoes.concorrencia = Number(argv[++i])
    else if (a === '--limite') opcoes.limite = Number(argv[++i])
  }
  if (!Number.isInteger(opcoes.concorrencia) || opcoes.concorrencia < 1) opcoes.concorrencia = 4
  if (!Number.isFinite(opcoes.limite) || opcoes.limite < 1) opcoes.limite = Infinity
  return opcoes
}

/** Todo itemId que o catálogo já conhece: lotes resolvidos e produtos manuais. */
async function itensConhecidos() {
  const ids = new Set((await lerItemIds()).values())
  for (const m of await lerManuais()) if (m.itemId) ids.add(m.itemId)
  return ids
}

async function buscar({ appId, segredo }, opcoes) {
  let texto
  try {
    texto = await readFile(CSV_BUSCAS, 'utf8')
  } catch (erro) {
    if (erro.code !== 'ENOENT') throw erro
    console.error('Falta data/buscas-api.csv. Cada linha é uma busca: busca;categoriaShopee;lojaId;ordem;quantidade;comissaoMinima')
    return 1
  }

  const buscas = parseCsv(texto, ';').linhas.map(validarBusca)
  const invalidas = buscas.filter((b) => b.erros.length)
  if (invalidas.length) {
    console.error('data/buscas-api.csv tem linha inválida. Nada foi consultado.')
    for (const b of invalidas) console.error(`  x ${b.busca || b.categoriaShopee || b.lojaId || '(vazia)'}: ${b.erros.join(', ')}`)
    return 1
  }

  const conhecidos = await itensConhecidos()
  const imagens = await lerCache()
  const lote = []
  const totalRecusas = { jaNoCatalogo: 0, faixaDePreco: 0, comissaoBaixa: 0, vencendo: 0, invalida: 0 }

  for (const b of buscas) {
    const rotulo = b.busca || (b.categoriaShopee ? `categoria ${b.categoriaShopee}` : `loja ${b.lojaId}`)
    let aceitasNaBusca = 0
    let pagina = 1
    let temMais = true

    while (aceitasNaBusca < b.quantidade && temMais && pagina <= PAGINAS_MAX) {
      const r = await consultarApi({
        appId,
        segredo,
        payload: corpoBuscaOfertas({ ...b, pagina, limite: LIMITE_POR_PAGINA }),
      })
      if (r.tipo !== 'ok') {
        console.error(`  ! "${rotulo}" página ${pagina}: ${r.tipo === 'erro' ? `erro ${r.codigo} da API` : 'sem resposta'} — busca interrompida`)
        break
      }

      const pag = extrairOfertas(r.corpo)
      temMais = pag.temMais
      const { aceitas, recusadas } = selecionarOfertas(pag.ofertas, {
        conhecidos,
        comissaoMinima: b.comissaoMinima,
        aceitarFaixa: opcoes.aceitarFaixa,
      })
      for (const [k, v] of Object.entries(recusadas)) totalRecusas[k] += v

      for (const a of aceitas.slice(0, b.quantidade - aceitasNaBusca)) {
        lote.push(a.linha)
        if (a.imageUrl.startsWith('https://')) imagens.set(a.linha['Item Id'], a.imageUrl)
        aceitasNaBusca++
      }
      pagina++
    }

    console.log(`  ${String(aceitasNaBusca).padStart(4)} novo(s)  ← ${rotulo} (${b.ordem})`)
  }

  console.log(`\nofertas novas: ${lote.length}`)
  console.log('recusadas:')
  console.log(`  já no catálogo:      ${totalRecusas.jaNoCatalogo}`)
  console.log(`  faixa de preço:      ${totalRecusas.faixaDePreco}${opcoes.aceitarFaixa ? '' : ' (use --aceitar-faixa para incluir pelo menor preço)'}`)
  console.log(`  comissão abaixo:     ${totalRecusas.comissaoBaixa}`)
  console.log(`  oferta vencendo:     ${totalRecusas.vencendo}`)
  console.log(`  sem nome/preço/link: ${totalRecusas.invalida}`)

  if (!lote.length) {
    console.log('\nNada novo para gravar.')
    return 0
  }

  if (opcoes.simular) {
    console.log('\n--simular: nada gravado. Primeiras ofertas:')
    for (const l of lote.slice(0, 15)) console.log(`  R$ ${l.Price.padStart(8)}  ${l['Commission Rate'].padStart(5)}  ${l['Item Name'].slice(0, 70)}`)
    return 0
  }

  const arquivo = `BatchProductLinksApi${carimbo()}.csv`
  const corpo = [COLUNAS_LOTE.join(','), ...lote.map((l) => formatarLinhaCsv(l, COLUNAS_LOTE, ','))].join('\n')
  await writeFile(join(DIR_BATCH, arquivo), corpo + '\n', 'utf8')
  await gravarCacheImagens(imagens, new Date().toISOString().slice(0, 10))

  console.log(`\ngravado: data/batch/${arquivo}`)
  console.log('Rode `npm run catalog:import`, `npm run catalog:sync` e `npm run verify`.')
  return 0
}

async function precos({ appId, segredo }, opcoes) {
  const ids = [...new Set((await lerItemIds()).values())]
  for (const m of await lerManuais()) if (m.itemId && !ids.includes(m.itemId)) ids.push(m.itemId)
  const alvo = ids.slice(0, opcoes.limite)

  const gravados = await lerPrecosGravados()
  const imagens = await lerCache()
  const hoje = new Date().toISOString().slice(0, 10)
  const cont = { ok: 0, fora: 0, transitorio: 0, mudou: 0, faixa: 0 }

  console.log(`conferindo ${alvo.length} item(ns) (concorrência ${opcoes.concorrencia})`)

  // `null` = sem resposta; a linha antiga continua valendo e o item volta na
  // próxima rodada.
  const conferir = async (itemId) => {
    const r = await consultarApi({ appId, segredo, payload: corpoOfertaPorItem(itemId) })
    if (r.tipo === 'transitorio') return null
    const oferta = r.tipo === 'ok'
      ? extrairOfertas(r.corpo).ofertas.find((o) => String(o.itemId) === String(itemId))
      : undefined
    return { linha: linhaDePreco(itemId, oferta, hoje), oferta }
  }

  const resultados = new Map()
  let feitos = 0

  try {
    await comLimitador(alvo, opcoes.concorrencia, async (itemId) => {
      resultados.set(itemId, await conferir(itemId))
      if (++feitos % 100 === 0) console.log(`  ${feitos}/${alvo.length}`)
    })

    // A API devolve `nodes: []` de vez em quando para item que está na oferta —
    // na primeira rodada real, um quarto dos "fora da oferta" voltou ao
    // consultar de novo. Uma segunda passada, devagar, separa o sumiço de
    // verdade do soluço.
    const suspeitos = [...resultados].filter(([, r]) => r?.linha.situacao === 'fora-da-oferta').map(([id]) => id)
    if (suspeitos.length) {
      console.log(`  segunda passada em ${suspeitos.length} item(ns) sem oferta`)
      await comLimitador(suspeitos, 1, async (itemId) => {
        await dormir(250)
        const r = await conferir(itemId)
        if (r) resultados.set(itemId, r)
      })
    }
  } catch (erro) {
    if (erro instanceof CredencialInvalida) {
      console.error(`\nAbortado: ${erro.message}`)
      return 1
    }
    throw erro
  }

  for (const [itemId, r] of resultados) {
    if (!r) {
      cont.transitorio++
      continue
    }
    const { linha, oferta } = r
    const anterior = gravados.get(String(itemId))
    if (linha.situacao !== 'ok') {
      cont.fora++
      // Uma conferência antiga que achou preço é informação verdadeira, com a
      // data dela; trocá-la por "fora" só apagaria a observação.
      if (anterior?.situacao === 'ok') continue
      gravados.set(String(itemId), linha)
      continue
    }
    cont.ok++
    if (anterior?.situacao === 'ok' && Number(anterior.preco) !== linha.preco) cont.mudou++
    if (linha.precoMax > linha.preco) cont.faixa++
    gravados.set(String(itemId), linha)
    if (!imagens.has(String(itemId)) && String(oferta.imageUrl ?? '').startsWith('https://')) {
      imagens.set(String(itemId), String(oferta.imageUrl).trim())
    }
  }

  if (!opcoes.simular) {
    await gravarPrecos(gravados)
    await gravarCacheImagens(imagens, hoje)
  }

  console.log('\nresultado:')
  console.log(`  preço conferido:        ${cont.ok} (${cont.mudou} mudaram desde a última conferência)`)
  console.log(`  com faixa de preço:     ${cont.faixa} (vale o menor, igual à exportação do painel)`)
  console.log(`  fora da oferta:         ${cont.fora} (preço segue com a data antiga)`)
  console.log(`  sem resposta (tentar de novo): ${cont.transitorio}`)
  console.log(opcoes.simular ? '\n--simular: nada gravado.' : '\nRode `npm run catalog:import`, `npm run catalog:sync` e `npm run verify`.')
  return 0
}

export async function main(argv = process.argv.slice(2)) {
  const opcoes = lerArgumentos(argv)
  const cred = credenciais()
  if (!cred) return 1
  try {
    return opcoes.tarefa === 'precos' ? await precos(cred, opcoes) : await buscar(cred, opcoes)
  } catch (erro) {
    if (erro instanceof CredencialInvalida) {
      console.error(`\nAbortado: ${erro.message}`)
      return 1
    }
    throw erro
  }
}

if (process.argv[1] && process.argv[1].endsWith('catalogo-api.js')) {
  process.exit(await main())
}
