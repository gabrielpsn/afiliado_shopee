#!/usr/bin/env node
// Validação do catálogo. Roda no build e reprova a publicação.
//
// A regra que importa: enquanto existir produto com `pendente: true`, o build
// falha. Nome, categoria e preço não podem ser inventados — num site de afiliado,
// um produto com dados errados significa o visitante clicar achando que está
// comprando X e receber Y, além de exibir preço diferente do real (CDC, art.
// 6º, III).
//
// Foto não entra nessa regra: a Shopee bloqueia leitura automatizada, então
// ausência de foto é estado legítimo, não erro. Ela vira aviso agregado — o
// build passa e diz quantas faltam. O card mostra placeholder em vez de uma
// imagem inventada.

import { PRODUCTS } from '../src/data/products.js'
import { CATEGORIAS } from '../src/data/categories.js'
import { SITE, isSiteUrlConfigurada } from '../src/data/site.js'
import { isValidAffiliateLink } from '../src/engine/links.js'
import { daysSince } from '../src/engine/format.js'

export const PRECO_MINIMO = 0.5
export const MAX_NOME = 120
export const DIAS_MAXIMO = 180

/**
 * Aplica as regras do catálogo. Separado do CLI para poder ser testado: quem
 * importa este arquivo não quer publicar nada nem ver nada no console.
 */
export function validateCatalog({
  produtos = PRODUCTS,
  categorias = CATEGORIAS,
  site = SITE,
  referencia = new Date(),
} = {}) {
  const erros = []
  const avisos = []

  if (!isSiteUrlConfigurada(site.url)) {
    avisos.push(
      `SITE.url ainda é um placeholder ("${site.url}"). ` +
        'Canonical e sitemap sairão errados — defina antes de publicar.'
    )
  }

  const slugs = new Set()
  const idsCategorias = new Set()
  const semFoto = []
  const nomesLongos = []
  const precosAntigos = []

  for (const c of categorias) {
    if (idsCategorias.has(c.id)) erros.push(`categories.js: id duplicado "${c.id}"`)
    idsCategorias.add(c.id)
  }

  const categoriasValidas = new Set(categorias.map((c) => c.id))

  for (const p of produtos) {
    const ref = p.linkAfiliado?.replace('https://s.shopee.com.br/', '') || p.slug || 'sem-slug'

    if (slugs.has(p.slug)) erros.push(`${ref}: slug duplicado "${p.slug}"`)
    slugs.add(p.slug)

    if (p.pendente) {
      const faltando = []
      if (!p.nome) faltando.push('nome')
      if (!p.categoria) faltando.push('categoria')
      if (p.preco === null || p.preco === undefined) faltando.push('preco')
      if (!p.imagens?.length) faltando.push('imagens')
      erros.push(`${ref}: produto pendente — falta ${faltando.join(', ')}`)
      continue
    }

    if (p.nome.length > MAX_NOME) nomesLongos.push(`${ref} (${p.nome.length})`)

    if (!categoriasValidas.has(p.categoria)) {
      erros.push(`${ref}: categoria "${p.categoria}" não existe em src/data/categories.js`)
    }

    if (!(p.preco > PRECO_MINIMO)) {
      erros.push(`${ref}: preço precisa ser maior que ${PRECO_MINIMO} (veio ${p.preco})`)
    }

    if (p.precoAntes !== null && p.precoAntes !== undefined && p.precoAntes <= p.preco) {
      erros.push(
        `${ref}: precoAntes (${p.precoAntes}) precisa ser maior que preco (${p.preco}); ` +
          'o selo de desconto ficaria enganoso'
      )
    }

    const link = isValidAffiliateLink(p.linkAfiliado)
    if (!link.valido) erros.push(`${ref}: link de afiliado inválido — ${link.motivo}`)

    if (!p.urlPublica) {
      erros.push(`${ref}: urlPublica vazia — rode \`npm run links:resolve\``)
    }

    if (!p.imagens?.length) {
      semFoto.push(ref)
    } else {
      for (const img of p.imagens) {
        const ehUrl = /^https:\/\//.test(img)
        const ehCaminhoLocal = img.startsWith('/')
        if (!ehUrl && !ehCaminhoLocal) {
          erros.push(`${ref}: imagem inválida "${img}" (use https:// ou /img/...)`)
        }
      }
    }

    if (!p.ativo) avisos.push(`${ref}: completo mas com ativo=nao — não aparece na loja`)

    const idade = daysSince(p.atualizadoEm, referencia)
    if (idade === Infinity) {
      erros.push(`${ref}: atualizadoEm vazio ou inválido`)
    } else if (idade > DIAS_MAXIMO) {
      erros.push(
        `${ref}: preço sem confirmação há ${idade} dias (${p.atualizadoEm}). ` +
          'Reconfirme na Shopee e atualize a coluna atualizadoEm.'
      )
    } else if (idade > site.diasParaPrecoAntigo) {
      precosAntigos.push(`${ref} (há ${idade} dias)`)
    }
  }

  const ativos = produtos.filter((p) => p.ativo && !p.pendente)

  if (!ativos.length && !erros.some((e) => e.includes('pendente'))) {
    avisos.push('Nenhum produto ativo: a vitrine vai abrir vazia.')
  }

  // A partir de algumas centenas de produto, avisar por produto vira 500 linhas
  // de ruído e ninguém lê. O que importa é a contagem e um exemplo para caçar.
  if (semFoto.length) {
    avisos.push(
      `${semFoto.length} produto(s) sem foto — o card mostra placeholder e ` +
        `remete para a Shopee. Preenchimento: ${semFoto.slice(0, 3).join(', ')}` +
        `${semFoto.length > 3 ? ', ...' : ''}`
    )
  }

  if (nomesLongos.length) {
    avisos.push(
      `${nomesLongos.length} nome(s) com mais de ${MAX_NOME} caracteres, que o ` +
        `Google corta por volta de 70. Encurte em data/produtos.csv: ` +
        nomesLongos.slice(0, 3).join(', ') +
        `${nomesLongos.length > 3 ? ', ...' : ''}`
    )
  }

  if (precosAntigos.length) {
    avisos.push(
      `${precosAntigos.length} preço(s) sem confirmação há mais de ` +
        `${site.diasParaPrecoAntigo} dias: ${precosAntigos.slice(0, 3).join(', ')}` +
        `${precosAntigos.length > 3 ? ', ...' : ''}`
    )
  }

  return { erros, avisos, ativos, total: produtos.length, semFoto: semFoto.length }
}

function imprimir({ erros, avisos, ativos, total = 0, semFoto = 0 }) {
  if (avisos.length) {
    console.log(`avisos (${avisos.length}):`)
    for (const a of avisos) console.log(`  ~ ${a}`)
    console.log('')
  }

  if (erros.length) {
    console.error(`FALHA: ${erros.length} problema(s) no catálogo\n`)
    for (const e of erros.slice(0, 40)) console.error(`  x ${e}`)
    if (erros.length > 40) console.error(`  ... e mais ${erros.length - 40}`)
    console.error('\nA publicação está bloqueada. Corrija e rode `npm run verify`.')
    return 1
  }

  console.log(
    `catálogo ok: ${ativos.length} produto(s) no ar de ${total}, ` +
      `${CATEGORIAS.length} categoria(s)` +
      (semFoto ? `, ${semFoto} sem foto` : '')
  )
  return 0
}

const ehCli =
  process.argv[1] && process.argv[1].endsWith('check-links.js')

if (ehCli) {
  process.exit(imprimir(validateCatalog()))
}
