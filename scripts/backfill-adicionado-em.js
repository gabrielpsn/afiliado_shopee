#!/usr/bin/env node
// Preenche `adicionadoEm` nos produtos que já estavam na vitrine antes de a
// coluna existir. Migração de uso único.
//
//   node scripts/backfill-adicionado-em.js 2026-10-05
//
// A data precisa ser a data em que os produtos entraram na vitrine, não a de
// hoje. Marcar 500 produtos comoadded hoje faria a página /novidades abrir com
// a loja inteira listada como novidade e o badge mostraria "500 novos" — o que
// não é novidade, é o lançamento do catálogo.
//
// Uso único: o script sai assim que a coluna existir no CSV. Ele fica versionado
// porque a data escolhida é uma decisão editorial e precisa ser auditável —
// daqui a três meses, "por que estes 500 têm a mesma data?" se responde lendo
// este arquivo, não adivinhando.

import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

import { parseCsv, formatarLinhaCsv, COLUNAS_CATALOGO } from './from-csv.js'

const RAIZ = dirname(dirname(fileURLToPath(import.meta.url)))
const CSV_CATALOGO = join(RAIZ, 'data/produtos.csv')

/** Valida formato e recusa data impossível, para não gravar lixo no catálogo. */
export function validarData(iso) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(iso ?? ''))) {
    throw new Error(`data inválida: "${iso}". Use AAAA-MM-DD.`)
  }

  const alvo = new Date(`${iso}T12:00:00`)
  if (Number.isNaN(alvo.getTime())) throw new Error(`data inexistente: "${iso}"`)

  return iso
}

/**
 * Devolve as linhas com `adicionadoEm` preenchido.
 *
 * Não reordena nem descarta nada: quem já tem data mantém a sua, porque é a
 * data verdadeira de entrada. Só entra data onde não havia.
 */
export function aplicarBackfill(linhas, data) {
  const valida = validarData(data)
  let preenchidas = 0
  let preservadas = 0

  const novas = linhas.map((linha) => {
    if (String(linha.adicionadoEm ?? '').trim()) {
      preservadas++
      return linha
    }
    preenchidas++
    return { ...linha, adicionadoEm: valida }
  })

  return { linhas: novas, preenchidas, preservadas }
}

async function main() {
  const data = process.argv[2]

  if (!data) {
    console.error('Informe a data em que os produtos entraram na vitrine.')
    console.error('Uso: node scripts/backfill-adicionado-em.js AAAA-MM-DD')
    console.error('')
    console.error('Use a data em que eles apareceram pela primeira vez, não a de hoje.')
    return 1
  }

  const { linhas } = parseCsv(await readFile(CSV_CATALOGO, 'utf8'))

  if (!linhas.length) {
    console.error('O CSV está vazio.')
    return 1
  }

  const resultado = aplicarBackfill(linhas, data)
  const cabecalho = COLUNAS_CATALOGO.join(';')
  const corpo = resultado.linhas
    .map((linha) => formatarLinhaCsv(linha, COLUNAS_CATALOGO, ';'))
    .join('\n')

  await writeFile(CSV_CATALOGO, `${cabecalho}\n${corpo}\n`, 'utf8')

  console.log(`produtos com data preservada: ${resultado.preservadas}`)
  console.log(`produtos preenchidos: ${resultado.preenchidas}`)
  console.log(`data usada: ${validarData(data)}`)
  console.log('')
  console.log('Rode `npm run catalog:sync` e depois `npm run verify`.')
  return 0
}

const ehCli = process.argv[1] && process.argv[1].endsWith('backfill-adicionado-em.js')

if (ehCli) {
  process.exit(await main())
}
