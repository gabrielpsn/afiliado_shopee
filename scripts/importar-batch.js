#!/usr/bin/env node
// Importa a exportação de afiliado da Shopee para o catálogo editorial.
//
//   node scripts/importar-batch.js
//
// Os CSVs da Shopee já trazem o que não pode ser inventado — nome exato, preço,
// comissão e os dois links. Então a importação é cópia com saneamento, não
// criação de dado: o que o painel mandou entra como veio.
//
// O que este script NÃO faz, deliberadamente:
//
//   - Não busca imagem. A Shopee bloqueia leitura automatizada (captcha na página,
//     403 na API), e a exportação de afiliado não traz foto. Foto inventada é o
//     pior erro possível numa vitrine: o visitante clica achando que compra X e
//     recebe Y. Sem foto, o card mostra um placeholder honesto e o validador
//     reporta o quanto falta.
//   - Não reescreve URL. O `Offer Link` (com a atribuição dentro do código) e o
//     `Product Link` entram como vieram.
//
// A categorização é derivada do nome por `src/engine/categorizar.js` e gravada no
// CSV. O que o classificador errou, ou o nome que precisa ser encurtado, é
// corrigido em `data/ajustes-editoriais.csv` — porque editar `data/produtos.csv`
// direto funciona só até a próxima reimportação, e aí o ajuste some sem aviso.

import { readdir, readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

import {
  parseCsv,
  parseNumero,
  formatarLinhaCsv,
  escaparCampoCsv,
  COLUNAS_CATALOGO,
} from './from-csv.js'
import { normalizar } from '../src/engine/format.js'
import { categorizar } from '../src/engine/categorizar.js'
import { CATEGORIAS } from '../src/data/categories.js'

const RAIZ = dirname(dirname(fileURLToPath(import.meta.url)))
const DIR_BATCH = join(RAIZ, 'data/batch')
const CSV_CATALOGO = join(RAIZ, 'data/produtos.csv')
const CSV_LINKS = join(RAIZ, 'data/links-resolvidos.csv')
const CSV_AJUSTES = join(RAIZ, 'data/ajustes-editoriais.csv')

const PREFIXO_PRODUTOS = 'BatchProductLinks'
const PREFIXO_OFERTAS = 'BatchShopeeLinks'

const SUFIXO_MILHAR = {
  mil: 1000,
  mi: 1_000_000,
  milhao: 1_000_000,
  milhoes: 1_000_000,
}

/**
 * Preço no formato do painel.
 *
 * A exportação usa "4,0mil" para R$ 4.000,00 — o separador de milhar em vez de
 * "4.000,00". Ler isso com o parser normal devolveria null e o produto cairia
 * fora, então o sufixo é tratado aqui e o resto é delegado ao mesmo `parseNumero`
 * que valida o CSV editorial, para os dois caminhos concordarem sempre.
 *
 * A ordem das alternativas no regex não é decorativa: "mil" antes de "mi"
 * importa, porque "mil" contém "mi" e na ordem invertida "4,0mil" viraria
 * 4 milhões em vez de 4 mil.
 */
export function parsePrecoShopee(valor) {
  if (valor === undefined || valor === null) return null

  let limpo = String(valor).trim()
  if (!limpo) return null

  let multiplicador = 1
  const sufixo = limpo.match(/^(.*?)\s*(milhões|milhões|milhão|milhao|milhoes|mil|mi)\+?$/i)
  if (sufixo) {
    const chave = normalizar(sufixo[2])
    multiplicador = SUFIXO_MILHAR[chave] ?? 1000
    limpo = sufixo[1]
  }

  const numero = parseNumero(limpo)
  return numero === null ? null : numero * multiplicador
}

/** "15%" → 15. Null quando não é porcentagem. */
export function parsePercentual(valor) {
  const n = parseNumero(String(valor ?? '').replace('%', ''))
  return n
}

/** Código do link de afiliado: https://s.shopee.com.br/9V1wJ8tql3 → 9V1wJ8tql3 */
export function extrairLinkCurto(offerLink) {
  const m = String(offerLink ?? '').match(/s\.shopee\.com\.br\/([^/?#]+)/)
  return m ? m[1] : ''
}

/** shopId da URL pública: .../product/408715442/22499247158 → 408715442 */
export function extrairShopId(productLink) {
  const m = String(productLink ?? '').match(/\/product\/(\d+)\//)
  return m ? m[1] : ''
}

function ehLinkDeAfiliado(url) {
  return /^https:\/\/s\.shopee\.com\.br\/[^/?#]+$/.test(String(url ?? '').trim())
}

function ehLinkPublico(url) {
  return /^https:\/\/shopee\.com\.br\//.test(String(url ?? '').trim())
}

/**
 * Uma linha da exportação vira um registro normalizado.
 *
 * Separado do I/O para poder ser testado com uma linha pronta, sem planilha.
 * Devolve `erros` em vez de lançar: uma linha ruim de 520 não pode derrubar o
 * lote inteiro, mas precisa aparecer no relatório.
 */
export function normalizarLinha(linha) {
  const erros = []

  const itemId = String(linha['Item Id'] ?? '').trim()
  const nome = String(linha['Item Name'] ?? '').trim()
  const loja = String(linha['Nome da loja'] ?? '').trim()
  const preco = parsePrecoShopee(linha.Price)
  const vendas = String(linha.Sales ?? '').trim()
  const comissaoPct = parsePercentual(linha['Commission Rate'])
  const comissao = parsePrecoShopee(linha.Commission)
  const urlPublica = String(linha['Product Link'] ?? '').trim()
  const linkAfiliado = String(linha['Offer Link'] ?? '').trim()
  const linkCurto = extrairLinkCurto(linkAfiliado)

  if (!itemId) erros.push('Item Id vazio')
  if (!nome) erros.push('Item Name vazio')
  if (preco === null) erros.push(`Price ilegível ("${linha.Price}")`)
  if (!ehLinkDeAfiliado(linkAfiliado)) erros.push(`Offer Link inválido ("${linkAfiliado}")`)
  if (!ehLinkPublico(urlPublica)) erros.push(`Product Link inválido ("${urlPublica}")`)
  if (linkCurto && !ehLinkDeAfiliado(linkAfiliado)) erros.push('linkCurto não extraído')

  return {
    itemId,
    nome,
    loja,
    preco,
    vendas,
    comissaoPct,
    comissao,
    urlPublica,
    linkAfiliado,
    linkCurto,
    shopId: extrairShopId(urlPublica),
    categoria: categorizar(nome),
    erros,
  }
}

/**
 * Escolhe um registro por itemId quando o mesmo produto aparece em vários lotes.
 *
 * A mesma peça foi exportada duas vezes com dois `Offer Link` diferentes. Ambos
 * são válidos e pagam comissão igual, então a escolha é por Maior comissão e, em
 * empate, pelo link em ordem alfabética — sem isso o resultado mudaria conforme a
 * ordem de leitura dos arquivos e o `git diff` do catálogo viraria ruído.
 */
export function escolherMelhorOferta(registros) {
  const porItem = new Map()

  for (const r of registros) {
    const atual = porItem.get(r.itemId)
    if (!atual) {
      porItem.set(r.itemId, r)
      continue
    }

    const melhor = melhorOferta(atual, r)
    porItem.set(r.itemId, melhor)
  }

  return [...porItem.values()]
}

function melhorOferta(a, b) {
  const va = a.comissao ?? -1
  const vb = b.comissao ?? -1
  if (vb > va) return b
  if (va > vb) return a
  return a.linkAfiliado <= b.linkAfiliado ? a : b
}

/** Ordena por id para que o CSV seja estável entre importações. */
function ordenar(registros) {
  return [...registros].sort((a, b) => Number(a.itemId) - Number(b.itemId))
}

function linhaCsv(registro, atualizadoEm) {
  const valores = {
    linkCurto: registro.linkCurto,
    nome: registro.nome,
    categoria: registro.categoria,
    preco: registro.preco,
    precoAntes: '',
    tags: '',
    imagens: '',
    destaques: '',
    descricao: '',
    avaliacao: '',
    numAvaliacoes: '',
    destaque: 'nao',
    promocao: 'nao',
    loja: registro.loja,
    vendas: registro.vendas,
    ativo: 'sim',
    atualizadoEm,
  }

  return formatarLinhaCsv(valores, COLUNAS_CATALOGO, ';')
}

/** Colunas aceitas em `data/ajustes-editoriais.csv`. */
export const COLUNAS_AJUSTE = ['linkCurto', 'nome', 'categoria']

/**
 * Aplica os ajustes humanos depois de montar o catálogo.
 *
 * O ajuste serve para duas coisas que o importador não pode adivinhar: encurtar
 * um nome que o Google corta, e corrigir a categoria quando o classificador erra.
 * Não serve para escrever preço — preço que não veio do painel não vai para a
 * vitrine, e por isso `preco` nem é uma coluna aceita aqui.
 *
 * Devolve os três desfechos em vez de só a lista: um `linkCurto` digitado errado
 * não dá erro nenhum e o ajuste vira no-op silencioso, que é a falha que só se
 * percebe na próxima reimportação.
 */
export function aplicarAjustesEditorial(registros, linhas, colunas = COLUNAS_AJUSTE) {
  const porLink = new Map(registros.map((r) => [r.linkCurto, r]))
  const idsCategorias = new Set(CATEGORIAS.map((c) => c.id))

  const aplicados = []
  const semCorrespondencia = []
  const erros = []

  for (const coluna of colunas) {
    if (!COLUNAS_AJUSTE.includes(coluna)) {
      erros.push(`coluna "${coluna}" não existe em ajustes-editoriais.csv`)
    }
  }
  if (erros.length) return { registros, aplicados, semCorrespondencia, erros }

  for (const linha of linhas) {
    const linkCurto = String(linha.linkCurto ?? '').trim()
    const nome = String(linha.nome ?? '').trim()
    const categoria = String(linha.categoria ?? '').trim()

    if (!linkCurto) {
      erros.push('linha de ajuste sem linkCurto')
      continue
    }

    if (!porLink.has(linkCurto)) {
      semCorrespondencia.push(linkCurto)
      continue
    }

    if (!nome && !categoria) {
      erros.push(`${linkCurto}: ajuste sem nome e sem categoria, não faz nada`)
      continue
    }

    if (categoria && !idsCategorias.has(categoria)) {
      erros.push(`${linkCurto}: categoria "${categoria}" não existe em categories.js`)
      continue
    }

    aplicados.push(linkCurto)
  }

  if (erros.length || semCorrespondencia.length) {
    return { registros, aplicados, semCorrespondencia, erros }
  }

  const mapa = new Map(
    linhas.map((linha) => {
      const nome = String(linha.nome ?? '').trim()
      const categoria = String(linha.categoria ?? '').trim()
      return [String(linha.linkCurto ?? '').trim(), { nome, categoria }]
    })
  )

  const registrosAjustados = registros.map((r) => {
    const ajuste = mapa.get(r.linkCurto)
    if (!ajuste) return r

    return {
      ...r,
      nome: ajuste.nome || r.nome,
      categoria: ajuste.categoria || r.categoria,
    }
  })

  return { registros: registrosAjustados, aplicados, semCorrespondencia, erros }
}

/**
 * Lê `data/ajustes-editoriais.csv`. Arquivo ausente é o normal — quase sempre
 * não há ajuste nenhum — então devolve lista vazia em vez de estourar.
 */
export async function lerAjustesEditorial(caminho = CSV_AJUSTES) {
  try {
    const texto = await readFile(caminho, 'utf8')
    return parseCsv(texto)
  } catch (erro) {
    if (erro.code === 'ENOENT') return { colunas: COLUNAS_AJUSTE, linhas: [] }
    throw erro
  }
}

async function main() {
  const arquivos = await readdir(DIR_BATCH)
  const deProdutos = arquivos.filter((f) => f.startsWith(PREFIXO_PRODUTOS)).sort()
  const deOfertas = arquivos.filter((f) => f.startsWith(PREFIXO_OFERTAS)).sort()

  if (!deProdutos.length) {
    console.error(`Nenhum ${PREFIXO_PRODUTOS}*.csv em data/batch/`)
    return 1
  }

  const registros = []
  for (const arquivo of deProdutos) {
    const { linhas } = parseCsv(await readFile(join(DIR_BATCH, arquivo), 'utf8'))
    for (const linha of linhas) registros.push(normalizarLinha(linha))
  }

  const comErro = registros.filter((r) => r.erros.length)
  const uteis = registros.filter((r) => !r.erros.length)
  const unicos = ordenar(escolherMelhorOferta(uteis))
  const duplicados = uteis.length - unicos.length

  const hoje = new Date().toISOString().slice(0, 10)
  const idsCategorias = new Set(CATEGORIAS.map((c) => c.id))

  const { colunas: colunasAjuste, linhas: linhasAjuste } = await lerAjustesEditorial()
  const ajuste = aplicarAjustesEditorial(unicos, linhasAjuste, colunasAjuste)
  const finais = ajuste.registros

  const foraDaTaxonomia = finais.filter((r) => !idsCategorias.has(r.categoria))

  // links-resolvidos.csv: o script de resolução de link continua sendo quem
  // valida o domínio, mas aqui o painel já entregou o par completo.
  const cabecalhoLinks = 'linkCurto,status,itemId,shopId,loja,urlPublica'
  // Nome de loja tem vírgula ("FOX SHOP, CONFIGS"), então o campo precisa de
  // escape: sem aspas o nome invade a coluna seguinte e o itemId some.
  const linhasLinks = unicos.map((r) =>
    [
      r.linkCurto,
      'OK',
      r.itemId,
      r.shopId,
      escaparCampoCsv(r.loja, ','),
      r.urlPublica,
    ].join(',')
  )

  // Ajustes e taxonomia são validados ANTES de gravar: o CSV é a fonte de verdade
  // do catálogo, então uma importação que falha no fim não pode ter deixado o
  // arquivo pela metade — o próximo `catalog:sync` leria catálogo quebrado sem
  // nenhum sinal de onde veio o problema.
  if (ajuste.erros.length) {
    console.error(`\ndata/ajustes-editoriais.csv: ${ajuste.erros.length} ajuste(s) inválido(s):`)
    for (const e of ajuste.erros.slice(0, 20)) console.error(`  x ${e}`)
    console.error('Corrija o arquivo e rode de novo. Nada foi gravado.')
    return 1
  }

  if (ajuste.semCorrespondencia.length) {
    console.error(`\n${ajuste.semCorrespondencia.length} ajuste(s) sem produto correspondente:`)
    for (const link of ajuste.semCorrespondencia.slice(0, 20)) console.error(`  x ${link}`)
    console.error('O linkCurto não existe em data/batch/. Um ajuste órfão é um no-op')
    console.error('silencioso: o produto sairia com o dado errado e o build não acusa nada.')
    console.error('Nada foi gravado. Remova a linha ou corrija o linkCurto.')
    return 1
  }

  if (foraDaTaxonomia.length) {
    console.error(`\n${foraDaTaxonomia.length} produto(s) com categoria fora de categories.js`)
    return 1
  }

  const cabecalhoCatalogo = COLUNAS_CATALOGO.join(';')
  const linhasCatalogo = finais.map((r) => linhaCsv(r, hoje))

  await writeFile(CSV_LINKS, [cabecalhoLinks, ...linhasLinks].join('\n') + '\n', 'utf8')
  await writeFile(CSV_CATALOGO, [cabecalhoCatalogo, ...linhasCatalogo].join('\n') + '\n', 'utf8')

  console.log(`lote: ${deProdutos.length} arquivo(s), ${registros.length} linha(s)`)
  console.log(`  produtos únicos: ${unicos.length}`)
  console.log(`  duplicados entre lotes: ${duplicados}`)
  console.log(`  lojas distintas: ${new Set(unicos.map((r) => r.loja)).size}`)
  console.log(`  sem foto (placeholder na vitrine): ${unicos.length}`)
  console.log(`  preço de referência em: ${hoje}`)
  console.log(`  ajustes editoriais: ${ajuste.aplicados.length} aplicado(s)`)

  if (deOfertas.length) {
    console.log(`\nofertas de categoria (${deOfertas.length} arquivo(s)) em data/batch/:`)
    for (const arquivo of deOfertas) {
      const { linhas } = parseCsv(await readFile(join(DIR_BATCH, arquivo), 'utf8'))
      console.log(`  ${arquivo}: ${linhas.length} link(s) de vitrine`)
    }
    console.log('  Eles são link de vitrine por categoria, não de produto — não entram no catálogo.')
  }

  const porCategoria = new Map()
  for (const r of finais) porCategoria.set(r.categoria, (porCategoria.get(r.categoria) ?? 0) + 1)

  console.log('\npor categoria:')
  for (const c of [...CATEGORIAS].sort((a, b) => b.ordem - a.ordem)) {
    const n = porCategoria.get(c.id) ?? 0
    if (n) console.log(`  ${String(n).padStart(4)}  ${c.nome}`)
  }
  const semCategoria = (porCategoria.get('outros') ?? 0)
  if (semCategoria) console.log(`  ${String(semCategoria).padStart(4)}  em "outros" — revisar`)

  if (comErro.length) {
    console.error(`\n${comErro.length} linha(s) ignorada(s):`)
    for (const r of comErro.slice(0, 20)) {
      console.error(`  x ${r.itemId || 'sem id'}: ${r.erros.join(', ')}`)
    }
    return 1
  }

  console.log('\nRode `npm run catalog:sync` e depois `npm run verify`.')
  return 0
}

const ehCli = process.argv[1] && process.argv[1].endsWith('importar-batch.js')

if (ehCli) {
  process.exit(await main())
}

export { formatarLinhaCsv }
