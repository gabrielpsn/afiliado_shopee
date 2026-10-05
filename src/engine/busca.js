// Busca, filtro e ordenação do catálogo.
//
// Funções puras: recebem a lista e devolvem a lista. A view só guarda o estado
// (o que foi digitado, qual ordenação está ativa) e chama estas funções. Testar
// aqui é barato; testar através de um componente exige montar o app inteiro.

import { normalizar } from './format.js'

export const ORDENS = [
  { id: 'relevancia', rotulo: 'Relevância' },
  { id: 'vendidos', rotulo: 'Mais vendidos' },
  { id: 'menor-preco', rotulo: 'Menor preço' },
  { id: 'maior-preco', rotulo: 'Maior preço' },
]

/** "10mil+" → 10000. Serve só para ordenar; o card mostra o texto original. */
export function vendasNumericas(vendas) {
  const texto = normalizar(vendas)
  if (!texto) return -1

  const digitos = texto.replace(/[^\d]/g, '')
  // Number('') é 0, não NaN: sem esta guarda, "muitos" contaria como zero
  // vendido e o produto subiria no topo de "mais vendidos".
  if (!digitos) return -1

  const n = Number(digitos)
  if (!Number.isFinite(n)) return -1

  // "mil" precisa ser testado antes de "mi": "mil" contém "mi", então na ordem
  // invertida "10mil+" virava 10 milhões e a ordenação por mais vendidos ficava
  // por cima dos itens de 400 mil.
  if (texto.includes('mil')) return n * 1000
  if (texto.includes('mi')) return n * 1_000_000
  return n
}

/**
 * Pontua um produto contra os termos buscados.
 *
 * Soma por ocorrência, não por posição: quem digita "fone bluetooth" quer o
 * produto com as duas palavras, e um produto que repete "fone" no título não
 * deveria ganhar de outro que cita cada termo uma vez. Devolve 0 quando algum
 * termo não aparece — busca por termo ausente é ruído, não resultado.
 */
export function pontuarBusca(produto, termos) {
  if (!termos.length) return 1

  const alvo = normalizar(
    [produto.nome, produto.loja, produto.tags?.join(' ')].filter(Boolean).join(' ')
  )

  let soma = 0
  for (const termo of termos) {
    if (!alvo.includes(termo)) return 0

    let ocorrencias = 0
    let pos = alvo.indexOf(termo)
    while (pos !== -1 && ocorrencias < 5) {
      ocorrencias++
      pos = alvo.indexOf(termo, pos + termo.length)
    }

    soma += ocorrencias
    // Bônus pequeno: casar no começo do nome pesa mais que casar no fim.
    if (produto.nome && normalizar(produto.nome).startsWith(termo)) soma += 3
  }

  return soma
}

export function filtrarProdutos(produtos, { busca = '', categoria = null } = {}) {
  const termos = normalizar(busca).split(' ').filter(Boolean)

  return produtos
    .filter((p) => (categoria ? p.categoria === categoria : true))
    .map((p) => ({ produto: p, pontos: pontuarBusca(p, termos) }))
    .filter((r) => r.pontos > 0)
    .sort((a, b) => b.pontos - a.pontos)
    .map((r) => r.produto)
}

export function ordenarProdutos(produtos, ordem = 'relevancia') {
  const lista = [...produtos]

  switch (ordem) {
    case 'vendidos':
      // Empate vai para o preço mais baixo: mesma faixa de vendas, mostra o
      // produto que dá para comprar.
      return lista.sort(
        (a, b) => vendasNumericas(b.vendas) - vendasNumericas(a.vendas) || a.preco - b.preco
      )
    case 'menor-preco':
      return lista.sort((a, b) => a.preco - b.preco)
    case 'maior-preco':
      return lista.sort((a, b) => b.preco - a.preco)
    default:
      return lista
  }
}

export function buscarProdutos(produtos, opcoes = {}) {
  const filtrados = filtrarProdutos(produtos, opcoes)
  return ordenarProdutos(filtrados, opcoes.ordem)
}

/** Corpo da vitrine. Corta nomes absurdos para o card respirar. */
export function nomeCurto(nome, maximo = 64) {
  const texto = String(nome ?? '').trim()
  if (texto.length <= maximo) return texto

  const cortado = texto.slice(0, maximo)
  const ultimoEspaco = cortado.lastIndexOf(' ')
  const base = ultimoEspaco > maximo * 0.6 ? cortado.slice(0, ultimoEspaco) : cortado

  return `${base.trimEnd()}…`
}