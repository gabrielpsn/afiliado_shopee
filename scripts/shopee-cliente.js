// Chamada assinada ao GraphQL de afiliados, com nova tentativa.
//
// Mora em `scripts/` e não em `src/engine/` porque faz rede. A parte pura —
// assinatura, corpo, leitura da resposta — fica no engine e é testada sem rede;
// aqui só sobra o laço de tentativa, compartilhado por `buscar-imagens.js` e
// `catalogo-api.js` para os dois tratarem credencial ruim e limite de taxa igual.

import {
  ENDPOINT_GRAFQL,
  assinar,
  erroDaApi,
  CREDENCIAL_INVALIDA,
  TENTAR_DE_NOVO,
  dormir,
} from '../src/engine/shopee-api.js'

export class CredencialInvalida extends Error {}

/**
 * Envia `payload` e devolve um destes:
 *
 *   { tipo: 'ok', corpo }   resposta 200 sem erro de API
 *   { tipo: 'erro', codigo } a API recusou de forma permanente (parâmetro ruim)
 *   { tipo: 'transitorio' }  rede ou limite responderam mal até a última tentativa
 *
 * Credencial reprovada lança `CredencialInvalida`: tentar de novo 900 vezes só
 * transforma o erro em espera.
 */
export async function consultarApi({ appId, segredo, payload, tentativas = 3 }) {
  let espera = 500

  for (let tentativa = 1; tentativa <= tentativas; tentativa++) {
    const { authorization } = assinar({ appId, segredo, payload, timestamp: Math.floor(Date.now() / 1000) })

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
      throw new CredencialInvalida(
        `Credencial reprovada (erro ${codigo}). Confira SHOPEE_APP_ID e SHOPEE_APP_SECRET em .env.`
      )
    }

    if (resposta.ok && codigo === null && corpo) return { tipo: 'ok', corpo }

    if ((TENTAR_DE_NOVO.has(resposta.status) || codigo !== null) && tentativa < tentativas) {
      await dormir(espera)
      espera *= 2
      continue
    }

    return TENTAR_DE_NOVO.has(resposta.status) ? { tipo: 'transitorio' } : { tipo: 'erro', codigo }
  }

  return { tipo: 'transitorio' }
}

/** Enfileira tudo e limita quantas chamadas ficam em voo ao mesmo tempo. */
export async function comLimitador(itens, concorrencia, trabalhar) {
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

/** Credenciais do ambiente, ou `null` com a mensagem já impressa. */
export function credenciais() {
  const appId = process.env.SHOPEE_APP_ID
  const segredo = process.env.SHOPEE_APP_SECRET
  if (appId && segredo) return { appId, segredo }
  console.error(
    'Falta SHOPEE_APP_ID ou SHOPEE_APP_SECRET no ambiente.\n' +
      'Copie .env.example para .env e preencha com as credenciais do painel de afiliado.'
  )
  return null
}
