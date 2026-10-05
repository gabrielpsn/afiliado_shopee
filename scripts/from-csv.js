#!/usr/bin/env node
// Gera `src/data/products.js` a partir de `data/produtos.csv`.
//
// O CSV é onde se edita o catálogo; o products.js é artefato gerado. Nunca
// edite products.js à mão — a próxima sincronização sobrescreve.
//
//   1. preencha data/produtos.csv
//   2. npm run catalog:sync
//   3. npm run verify

import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

import { PRODUCTS } from '../src/data/products.js'
import { CATEGORIAS } from '../src/data/categories.js'
import { slugify } from '../src/engine/format.js'
import { validateAffiliateLink } from '../src/engine/links.js'

const RAIZ = dirname(dirname(fileURLToPath(import.meta.url)))
const CSV_CATALOGO = join(RAIZ, 'data/produtos.csv')
const CSV_LINKS = join(RAIZ, 'data/links-resolvidos.csv')
const SAIDA = join(RAIZ, 'src/data/products.js')

/**
 * Parser de CSV com aspas e quebras de linha dentro do campo.
 *
 * O separador é detectado pelo cabeçalho: o Excel pt-BR grava `;` por padrão e
 * a diferença entre os dois é justamente o tipo de coisa que passabatada e faz
 * o catálogo inteiro virar uma coluna só.
 */
export function parseCsv(texto, separador = null) {
  const brutas = texto.replace(/^﻿/, '').replace(/\r\n/g, '\n').split('\n')
  const sep =
    separador ?? (brutas[0]?.includes(';') && !brutas[0].includes(',') ? ';' : ',')

  const registros = []
  let campo = ''
  let registro = []
  let dentroDeAspas = false

  for (let i = 0; i < texto.length; i++) {
    const char = texto[i]

    if (dentroDeAspas) {
      if (char === '"') {
        if (texto[i + 1] === '"') {
          campo += '"'
          i++
        } else {
          dentroDeAspas = false
        }
      } else {
        campo += char
      }
      continue
    }

    if (char === '"') {
      dentroDeAspas = true
    } else if (char === sep) {
      registro.push(campo)
      campo = ''
    } else if (char === '\n') {
      registro.push(campo)
      registros.push(registro)
      registro = []
      campo = ''
    } else {
      campo += char
    }
  }

  if (campo !== '' || registro.length) {
    registro.push(campo)
    registros.push(registro)
  }

  if (!registros.length) return { colunas: [], linhas: [], separador: sep }

  const [cabecalho, ...corpo] = registros
  const colunas = cabecalho.map((c) => c.trim())

  const linhas = corpo
    .map((r) => Object.fromEntries(colunas.map((c, i) => [c, (r[i] ?? '').trim()])))
    .filter((linha) => Object.values(linha).some(Boolean))

  return { colunas, linhas, separador: sep }
}

/** "sim"/"s"/"true"/"1" como true. Vazio cai no padrão informado. */
export function parseBooleano(valor, padrao = false) {
  const v = String(valor ?? '').trim().toLowerCase()
  if (!v) return padrao
  return ['sim', 's', 'true', '1', 'x'].includes(v)
}

/**
 * Lê número no formato brasileiro (ponto de milhar, vírgula decimal).
 *
 * Um ponto sozinho é ambíguo: "89.90" pode ser 89,90 ou 8.990. Ler como
 * milhar transformaria um preço digitado errado em valor absurdo e o erro
 * passaria pelo validador. Por isso, com um único ponto e um ou dois dígitos
 * depois, o ponto é decimal — o que cobre preço (2 casas) e nota (1 casa).
 * Com três ou mais dígitos, é milhar.
 */
export function parseNumero(valor) {
  if (valor === undefined || valor === null) return null

  let limpo = String(valor).trim().replace(/R\$\s*/gi, '')
  if (!limpo) return null

  if (!limpo.includes(',')) {
    const partes = limpo.split('.')
    if (partes.length === 2 && /^\d{1,2}$/.test(partes[1])) {
      limpo = partes.join('.')
    } else {
      limpo = partes.join('')
    }
  } else {
    limpo = limpo.replace(/\./g, '').replace(',', '.')
  }

  const n = Number(limpo)
  return Number.isFinite(n) ? n : null
}

/** Tags e destaques são separados por `|` para não brigar com a vírgula do CSV. */
export function parseLista(valor) {
  return String(valor ?? '')
    .split('|')
    .map((s) => s.trim())
    .filter(Boolean)
}

/**
 * Um produto está pronto para a vitrine quando tem nome, categoria, preço e ao
 * menos uma imagem. Faltando qualquer um deles, `pendente` é verdadeiro e o
 * produto não aparece na loja nem passa no build.
 */
export function avaliarLinha(linha, hoje) {
  const nome = linha.nome || ''
  const categoria = linha.categoria || ''
  const preco = parseNumero(linha.preco)
  const imagens = parseLista(linha.imagens)

  const faltando = []
  if (!nome) faltando.push('nome')
  if (!categoria) faltando.push('categoria')
  if (preco === null) faltando.push('preco')
  if (!imagens.length) faltando.push('imagens')

  return {
    nome,
    categoria,
    preco,
    imagens,
    faltando,
    pendente: faltando.length > 0,
    atualizadoEm: linha.atualizadoEm || hoje,
  }
}

export const COLUNAS_CATALOGO = [
  'linkCurto',
  'nome',
  'categoria',
  'preco',
  'precoAntes',
  'tags',
  'imagens',
  'destaques',
  'descricao',
  'avaliacao',
  'numAvaliacoes',
  'destaque',
  'promocao',
  'ativo',
  'atualizadoEm',
]

/**
 * Cria `data/produtos.csv` a partir dos links já resolvidos, com as colunas
 * editáveis vazias. Evita o passo manual de copiar 90 linhas, e faz o
 * comando se recuperar se o CSV for apagado.
 */
async function criarCsvSeFaltar(linksResolvidos) {
  try {
    await readFile(CSV_CATALOGO, 'utf8')
    return false
  } catch {
    // arquivo ausente: segue para criar
  }

  const cabecalho = COLUNAS_CATALOGO.join(';')
  const linhas = [...linksResolvidos.keys()].map(
    (linkCurto) => COLUNAS_CATALOGO.map((c) => (c === 'linkCurto' ? linkCurto : '')).join(';')
  )

  await writeFile(CSV_CATALOGO, [cabecalho, ...linhas].join('\n') + '\n', 'utf8')
  console.log(`data/produtos.csv criado com ${linhas.length} linha(s).\n`)
  return true
}

export function carregarLinksResolvidosDoTexto(texto) {
  const { linhas } = parseCsv(texto)
  const mapa = new Map()
  for (const l of linhas) {
    if (l.status === 'OK' && l.linkCurto) {
      mapa.set(l.linkCurto, {
        urlPublica: l.urlPublica,
        itemId: l.itemId,
        shopId: l.shopId,
        linkAfiliado: `https://s.shopee.com.br/${l.linkCurto}`,
      })
    }
  }
  return mapa
}

function gerarJs(produtos) {
  const corpo = produtos
    .map((p) => {
      const chaves = [
        'slug',
        'nome',
        'descricao',
        'preco',
        'precoAntes',
        'categoria',
        'tags',
        'imagens',
        'largura',
        'altura',
        'linkAfiliado',
        'urlPublica',
        'itemId',
        'destaques',
        'avaliacao',
        'numAvaliacoes',
        'destaque',
        'promocao',
        'ordem',
        'ativo',
        'pendente',
        'atualizadoEm',
      ]

      const linhas = chaves
        .filter((k) => p[k] !== undefined)
        .map((k) => `    ${k}: ${JSON.stringify(p[k])},`)

      return `  {\n${linhas.join('\n')}\n  },`
    })
    .join('\n')

  return `// ARQUIVO GERADO — não edite à mão.
//
// Fonte: data/produtos.csv
// Regenerar: npm run catalog:sync
//
// Um produto com \`pendente: true\` não aparece na loja e reprova o build.
// Enquanto ele existir, nenhum produto deve ser publicado.

export const PRODUCTS = [
${corpo}
]
`
}

/**
 * Converte as linhas do CSV em produtos.
 *
 * Separado do CLI para poder ser testado sem tocar o disco. Devolve também
 * os produtos sem link resolvido e os pendentes com a lista do que falta,
 * porque o relatório precisa disso e um segundo passe sobre o array seria
 * apenas uma chance a mais de errar.
 */
export function buildProducts({
  linhas,
  linksResolvidos = new Map(),
  categorias = CATEGORIAS,
  hoje = new Date().toISOString().slice(0, 10),
} = {}) {
  const categoriasValidas = new Set(categorias.map((c) => c.id))
  const avisos = []
  const semLink = []
  const pendentes = []
  const produtos = []

  linhas.forEach((linha, indice) => {
    const linkCurto = String(linha.linkCurto || '')
      .replace('https://s.shopee.com.br/', '')
      .trim()
    const link = linksResolvidos.get(linkCurto)

    if (!linkCurto) {
      semLink.push({ indice, motivo: 'sem linkCurto' })
      return
    }
    if (!link) {
      semLink.push({
        indice,
        linkCurto,
        motivo: 'link ainda não resolvido — rode `npm run links:resolve`',
      })
    }

    const info = avaliarLinha(linha, hoje)

    if (info.categoria && !categoriasValidas.has(info.categoria)) {
      info.faltando.push(`categoria "${info.categoria}" não existe em categories.js`)
      info.pendente = true
    }

    const linkAfiliado = link?.linkAfiliado ?? `https://s.shopee.com.br/${linkCurto}`
    if (!validateAffiliateLink(linkAfiliado)) {
      avisos.push({ linkCurto, motivo: 'link de afiliado inválido' })
    }

    const produto = {
      slug: info.nome ? slugify(info.nome) : `item-${link?.itemId ?? linkCurto}`,
      nome: info.nome,
      descricao: linha.descricao || '',
      preco: info.preco,
      precoAntes: parseNumero(linha.precoAntes),
      categoria: info.categoria,
      tags: parseLista(linha.tags),
      imagens: info.imagens,
      largura: parseNumero(linha.largura) ?? 800,
      altura: parseNumero(linha.altura) ?? 800,
      linkAfiliado,
      urlPublica: link?.urlPublica ?? null,
      itemId: link?.itemId ?? null,
      destaques: parseLista(linha.destaques),
      avaliacao: parseNumero(linha.avaliacao),
      numAvaliacoes: parseNumero(linha.numAvaliacoes),
      destaque: parseBooleano(linha.destaque),
      promocao: parseBooleano(linha.promocao),
      ordem: parseNumero(linha.ordem) ?? indice,
      // Sem `ativo` explícito no CSV, o produto entra no ar assim que fica
      // completo. Quem quiser rascunho escreve `nao` na coluna.
      ativo: parseBooleano(linha.ativo, !info.pendente),
      pendente: info.pendente,
      atualizadoEm: info.atualizadoEm,
    }

    if (info.pendente) {
      pendentes.push({ produto, faltando: info.faltando })
    }

    produtos.push(produto)
  })

  // Duas páginas com o mesmo slug colidiriam na URL. O sufixo mantém o
  // catálogo importável mesmo com nomes repetidos entre vendedores.
  const contagem = new Map()
  for (const p of produtos) {
    const n = (contagem.get(p.slug) ?? 0) + 1
    contagem.set(p.slug, n)
    if (n > 1) {
      avisos.push({ linkCurto: p.itemId, motivo: `slug duplicado "${p.slug}"` })
      p.slug = `${p.slug}-${n}`
    }
  }

  return { produtos, avisos, semLink, pendentes }
}

async function carregarLinksResolvidos() {
  try {
    return carregarLinksResolvidosDoTexto(await readFile(CSV_LINKS, 'utf8'))
  } catch {
    console.warn(
      '! data/links-resolvidos.csv não encontrado. Rode `npm run links:resolve` ' +
        'para resolver os links curtos.'
    )
    return new Map()
  }
}

function imprimir({ produtos, avisos, semLink, pendentes }, separador) {
  const ativos = produtos.filter((p) => p.ativo && !p.pendente)
  const usados = new Set(produtos.map((p) => p.categoria).filter(Boolean))
  const vazias = CATEGORIAS.filter((c) => !usados.has(c.id)).map((c) => c.nome)

  console.log(`separador do CSV: ${separador}`)
  console.log(`produtos gerados: ${produtos.length}`)
  console.log(`  no ar: ${ativos.length}`)
  console.log(`  pendentes: ${pendentes.length}`)
  console.log(`categorias sem produto: ${vazias.length ? vazias.join(', ') : 'nenhuma'}`)

  if (semLink.length) {
    console.log(`\nlinks com problema (${semLink.length}):`)
    for (const s of semLink.slice(0, 10)) {
      console.log(`  - linha ${s.indice + 2}${s.linkCurto ? ` (${s.linkCurto})` : ''}: ${s.motivo}`)
    }
    if (semLink.length > 10) console.log(`  ... e mais ${semLink.length - 10}`)
  }

  if (avisos.length) {
    console.log(`\navisos (${avisos.length}):`)
    for (const a of avisos) console.log(`  - ${a.linkCurto}: ${a.motivo}`)
  }

  if (pendentes.length) {
    console.log(`\nfaltam dados em ${pendentes.length} produto(s):`)
    for (const { produto, faltando } of pendentes.slice(0, 10)) {
      const ref = produto.linkAfiliado.replace('https://s.shopee.com.br/', '')
      console.log(`  - ${ref}: ${faltando.join(', ')}`)
    }
    if (pendentes.length > 10) console.log(`  ... e mais ${pendentes.length - 10}`)
    console.log('\nO build vai falhar enquanto houver pendente. Preencha e rode de novo.')
  }
}

async function main() {
  const linksResolvidos = await carregarLinksResolvidos()

  if (await criarCsvSeFaltar(linksResolvidos)) {
    console.log(
      'Preencha as colunas nome, categoria, preco e imagens de cada linha e rode ' +
        '`npm run catalog:sync` de novo.\n\n' +
        '  nome      — nome exato do produto na Shopee\n' +
        '  categoria — id de src/data/categories.js (ex.: eletronicos)\n' +
        '  preco     — preço de referência, sem R$ (ex.: 129,90)\n' +
        '  imagens   — URLs separadas por | (ex.: https://down-xx.shopee.com.br/a.jpg)\n' +
        '  tags      — separadas por |\n' +
        '  destaques — bullets separados por |\n\n' +
        'O arquivo usa ";" como separador, que é o padrão do Excel pt-BR.'
    )
    return 0
  }

  const { linhas, separador } = parseCsv(await readFile(CSV_CATALOGO, 'utf8'))

  if (!linhas.length) {
    console.error('data/produtos.csv não tem linhas. Nada foi apagado.')
    return 1
  }

  const resultado = buildProducts({ linhas, linksResolvidos })
  await writeFile(SAIDA, gerarJs(resultado.produtos), 'utf8')

  imprimir(resultado, separador === ';' ? ';' : ',')
  return 0
}

const ehCli = process.argv[1] && process.argv[1].endsWith('from-csv.js')

if (ehCli) {
  process.exit(await main())
}
