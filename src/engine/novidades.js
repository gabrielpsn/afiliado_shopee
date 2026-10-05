// O que conta como "produto novo" na vitrine.
//
// Estas funções são puras de propósito: a data que decide o que é novidade fica
// em `produto.adicionadoEm`, que o importador nunca sobrescreve. Se o aviso de
// novidade se apoiasse em `atualizadoEm`, a próxima `catalog:import` reescreve
// essa data nos 500 produtos e a página /novidades viraria uma cópia da home.
//
// `atualizadoEm` continua existindo para o que é dele: avisar que o preço está
// velho. São duas perguntas diferentes — "desde quando está aqui" e "quando
// conferi o preço" — e misturá-las faz as duas responderem errado.

import { daysSince } from './format.js'

/** Janela padrão do aviso. Uma semana é o suficiente para o visitante ver e curto o bastante para não virar lista. */
export const DIAS_NOVIDADE = 7

/**
 * `true` quando o produto entrou na vitrine dentro da janela.
 *
 * Produto sem `adicionadoEm` não é novo. Tratar a data ausente como "hoje" faria
 * todo produto herdado do catálogo anterior aparecer como novidade assim que o
 * campo fosse criado.
 */
export function isNovo(produto, { dias = DIAS_NOVIDADE, referencia = new Date() } = {}) {
  if (!produto?.adicionadoEm) return false
  return daysSince(produto.adicionadoEm, referencia) <= dias
}

/**
 * Produtos novos, do mais recente para o mais antigo.
 *
 * O desempate por `itemId` importa: dois produtos podem ser adicionados no mesmo
 * `catalog:import` e trazer a mesma data. Sem um critério estável, a ordem do
 * feed mudaria entre builds e o RSS pareceria atualizado à toa.
 */
export function getNovidades(produtos, { dias = DIAS_NOVIDADE, limite = 30, referencia = new Date() } = {}) {
  return produtos
    .filter((p) => isNovo(p, { dias, referencia }))
    .sort(
      (a, b) =>
        (b.adicionadoEm ?? '').localeCompare(a.adicionadoEm ?? '') ||
        String(b.itemId ?? '').localeCompare(String(a.itemId ?? ''))
    )
    .slice(0, limite)
}

/** Só a contagem, para o badge do header. */
export function contarNovidades(produtos, opcoes = {}) {
  return getNovidades(produtos, { ...opcoes, limite: Number.MAX_SAFE_INTEGER }).length
}

/**
 * Data mais recente de adição do catálogo.
 *
 * O feed precisa de uma data para o cabeçalho, e usar `new Date()` faria o
 * `lastBuildDate` do RSS mudar a cada build mesmo sem novidade nenhuma — leitor
 * de feed trata isso como conteúdo novo e avisa o assinante à toa.
 */
export function dataMaisRecente(produtos) {
  const datas = produtos.map((p) => p.adicionadoEm).filter(Boolean).sort()
  return datas.at(-1) ?? null
}
