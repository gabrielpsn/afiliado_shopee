// Adiciona um produto ao catálogo a partir do link de afiliado.
//
//   npm run produto:add -- --link https://s.shopee.com.br/abc123 --nome "Fone Bluetooth" --preco 42,89
//
// O que este script faz e o que ele se recusa a fazer:
//
//   - Resolve o link curto por redirect (301) para tirar loja, shopId e itemId.
//     É o mesmo caminho de `resolve-links.js`, e é a única chamada de rede.
//   - Classifica pelo nome com `categorizar.js`, como o importador faz.
//   - Recusa qualquer coisa que deixaria o produto pendente: nome vazio, preço
//     zero, categoria que não existe.
//
// O que ele não faz, por decisão: não busca foto. A Shopee bloqueia leitura
// automatizada e não libera API sem App ID, então o produto entra com
// `semFoto: true` e o card mostra o placeholder honesto. Preço e nome são
// argumentos do usuário — o script não deduz nenhum dos dois, porque nome e
// preço errados são problema de consumidor.

import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

import { parseCsv, parseNumero, formatarLinhaCsv } from './from-csv.js'
import { resolveLink } from './resolve-links.js'
import { categorizar } from '../src/engine/categorizar.js'
import { CATEGORIAS } from '../src/data/categories.js'

const RAIZ = dirname(dirname(fileURLToPath(import.meta.url)))
const CSV_CATALOGO = join(RAIZ, 'data/produtos.csv')
const CSV_LINKS = join(RAIZ, 'data/links-resolvidos.csv')
const CSV_MANUAIS = join(RAIZ, 'data/produtos-manuais.csv')

const HEADERS_LINKS = ['linkCurto', 'status', 'itemId', 'shopId', 'loja', 'urlPublica']

/**
 * Aceita o link colado de qualquer lugar e devolve só o código curto.
 *
 * Quem copia do painel às vezes traz o link inteiro, às vezes só o código. Aceitar
 * os dois evita a falha mais irritante possível aqui: o comando rodar, não achar
 * nada, e a pessoa achar que digitou errado.
 */
export function extrairLinkCurto(entrada) {
  const texto = String(entrada ?? '').trim()
  if (!texto) return null

  const codigo = texto.match(/s\.shopee\.com\.br\/([A-Za-z0-9_-]+)/)?.[1]
  if (codigo) return codigo

  // Só o código, sem domínio.
  if (/^[A-Za-z0-9_-]+$/.test(texto)) return texto

  return null
}

/** Lê `--nome "Fone Bluetooth"` ou `--nome=Fone Bluetooth`. */
export function lerArgumentos(argv) {
  const opcoes = {}
  const aliases = { link: 'link', l: 'link', nome: 'nome', n: 'nome', preco: 'preco', p: 'preco', categoria: 'categoria', c: 'categoria' }

  for (let i = 0; i < argv.length; i++) {
    const bruto = argv[i]
    if (!bruto.startsWith('--')) continue

    const semTracos = bruto.slice(2)
    const [chaveCrua, ...resto] = semTracos.split('=')
    const chave = aliases[chaveCrua]
    if (!chave) throw new Error(`opção desconhecida: --${chaveCrua}`)

    opcoes[chave] = resto.length ? resto.join('=') : argv[++i]
  }

  return opcoes
}

/**
 * Confere o produto antes de gravar.
 *
 * Devolve lista de problemas em vez de estourar na primeira: quem roda o comando
 * com três erros de uma vez precisa ver os três, não corrigir e rodar de novo
 * três vezes.
 */
export function validarProduto(produto, { categorias = CATEGORIAS, linkCurto = '' } = {}) {
  const problemas = []

  if (!produto.nome) problemas.push('nome vazio')
  else if (produto.nome.length > 120) problemas.push(`nome com ${produto.nome.length} caracteres, acima de 120`)

  if (produto.preco === null) problemas.push('preço não é número')
  else if (produto.preco <= 0.5) problemas.push(`preço ${produto.preco} abaixo do mínimo de 0,50`)

  if (!produto.categoria) problemas.push('categoria vazia')
  else if (!categorias.some((c) => c.id === produto.categoria)) {
    problemas.push(`categoria "${produto.categoria}" não existe em categories.js`)
  }

  if (!linkCurto) problemas.push('link vazio')

  return problemas
}

/**
 * Reescreve `data/links-resolvidos.csv` com a linha do produto manual no lugar.
 *
 * Este CSV é o par (linkCurto → itemId, urlPublica) que `from-csv.js` usa para
 * dar `itemId` e `urlPublica` ao produto. Sem a linha aqui, o produto manual
 * entra como pendente e reprova o build — e `check-links.js` accuse urlPublica
 * vazia, que é sintoma, não causa.
 */
export function resolverLinkPublico(linkCurto, linhas, resolvido) {
  const semDuplicado = linhas.filter((l) => l.linkCurto !== linkCurto)

  const nova = {
    linkCurto,
    status: 'OK',
    itemId: resolvido.itemId,
    shopId: resolvido.shopId ?? '',
    loja: resolvido.shopName ?? '',
    urlPublica: resolvido.urlPublica,
  }

  return [...semDuplicado, nova]
    .map((l) => formatarLinhaCsv(l, HEADERS_LINKS, ','))
    .join('\n')
}

// `urlPublica` e `shopId` moram aqui porque o `catalog:import` reconstrói
// `data/links-resolvidos.csv` a partir do lote. Se o produto manual não trouxesse
// a url resolvida aqui, a reimportação a apagaria e o produto passaria a reprovar
// o build com "urlPublica vazia" — que é sintoma, não causa.
const CABECALHO_MANUAIS = [
  'linkCurto',
  'itemId',
  'nome',
  'categoria',
  'preco',
  'loja',
  'vendas',
  'shopId',
  'urlPublica',
  'atualizadoEm',
  'adicionadoEm',
]

/**
 * Acrescenta ou substitui a linha em `data/produtos-manuais.csv`.
 *
 * Guardar aqui e não em `data/produtos.csv` é o que faz o produto sobreviver ao
 * próximo `catalog:import`: o importador reconstrói o catálogo a partir do lote e
 * da lista de manuais, e ignora o que estiver só no catálogo.
 */
export function mesclarLinhaManuais(linhas, nova) {
  const semDuplicado = linhas.filter((l) => l.linkCurto !== nova.linkCurto)
  return [...semDuplicado, nova]
}

/** Mesma linha para o CSV de manuais, com a url já resolvida. */
export function montarLinhaManual(
  { linkCurto, nome, categoria, preco, loja, itemId, vendas, shopId, urlPublica },
  hoje
) {
  return formatarLinhaCsv(
    {
      linkCurto,
      itemId,
      nome,
      categoria,
      preco: String(preco).replace('.', ','),
      loja,
      vendas,
      shopId,
      urlPublica,
      atualizadoEm: hoje,
      adicionadoEm: hoje,
    },
    CABECALHO_MANUAIS,
    ';'
  )
}

async function main() {
  const opcoes = lerArgumentos(process.argv.slice(2))
  const hoje = new Date().toISOString().slice(0, 10)

  const faltando = ['link', 'nome', 'preco'].filter((c) => !opcoes[c])
  if (faltando.length) {
    console.error(`Falta: ${faltando.join(', ')}`)
    console.error('')
    console.error('Uso:')
    console.error('  npm run produto:add -- --link https://s.shopee.com.br/abc123 \\')
    console.error('      --nome "Fone Bluetooth TWS" --preco 42,89 [--categoria eletronicos]')
    return 1
  }

  const linkCurto = extrairLinkCurto(opcoes.link)
  if (!linkCurto) {
    console.error(`"${opcoes.link}" não parece um link de afiliado da Shopee.`)
    console.error('Exemplos aceitos: https://s.shopee.com.br/abc123  ou  abc123')
    return 1
  }

  const nome = String(opcoes.nome).trim()
  const preco = parseNumero(opcoes.preco)
  const categoria = opcoes.categoria
    ? String(opcoes.categoria).trim()
    : categorizar(nome)

  // 1. Link já está no catálogo, seja no lote ou na lista de manuais? Editar a
  //    linha existente é mais seguro que criar uma segunda entrada do mesmo
  //    produto.
  const { linhas } = parseCsv(await readFile(CSV_CATALOGO, 'utf8'))
  const jaExiste = linhas.find((l) => l.linkCurto === linkCurto)

  // O CSV de links é reescrito pelo `catalog:import` a partir do lote. A linha do
  // produto manual precisa entrar nele agora, senão o `from-csv.js` não acha
  // urlPublica e o produto nasce pendente.
  //
  // Recarrega do disco logo antes de gravar: o `catalog:import` roda entre a
  // checagem de duplicado e aqui, e usar a versão lida no começo sobrescreveria
  // a linha que o importador acabou de escrever para 500 produtos.
  const textoLinks = await readFile(CSV_LINKS, 'utf8').catch(() => null)
  const { linhas: linhasLinksAtuais } = textoLinks ? parseCsv(textoLinks) : { linhas: [] }

  console.log(`produto:  ${nome}`)
  console.log(`preço:    ${preco}`)
  console.log(`categoria: ${categoria} ${opcoes.categoria ? '(informada)' : '(inferida do nome)'}`)

  // 2. Resolve o link. O 301 traz loja, shopId e itemId sem precisar da API.
  //    `resolveLink` nunca lança: devolve { ok: false, motivo } no erro, então
  //    não há try/catch aqui por necessidade, e sim porque o motivo da falha
  //    chega pronto para ser mostrado a quem está usando o comando.
  const resolvido = await resolveLink(`https://s.shopee.com.br/${linkCurto}`)

  if (!resolvido.ok) {
    console.error('')
    console.error(`Falha ao resolver o link: ${resolvido.motivo}`)
    console.error('Sem itemId não dá para montar a urlPublica, e produto com')
    console.error('urlPublica vazia não passa no build. Nada foi gravado.')
    return 1
  }

  console.log(`itemId:   ${resolvido.itemId}`)
  console.log(`url:      ${resolvido.urlPublica}`)

  const produto = { nome, preco, categoria, linkCurto }

  // 3. Só grava se estiver completo. `linkCurto` entra na validação para que a
  //    linha de erro do link não fique separada da do resto.
  const problemas = validarProduto(produto, { linkCurto })
  if (jaExiste) {
    console.log('')
    console.log('ATENÇÃO: este linkCurto já existe no catálogo.')
    problemas.push('linkCurto duplicado')
  }

  if (problemas.length) {
    console.error('')
    console.error('Nada foi gravado. Corrija:')
    for (const p of problemas) console.error(`  x ${p}`)
    return 1
  }

  // Grava na lista de manuais e roda a mesclagem. Editar `data/produtos.csv`
  // direto resolveria hoje e apagaria o produto no próximo `catalog:import` —
  // o sumiço silencioso mais caro deste fluxo, porque o build continua verde.
  const textoManuais = await readFile(CSV_MANUAIS, 'utf8').catch(() => null)
  const { linhas: linhasManuais } = textoManuais ? parseCsv(textoManuais) : { linhas: [] }

  const novaLinha = montarLinhaManual(
    {
      linkCurto,
      nome,
      categoria,
      preco,
      loja: resolvido.shopName ?? '',
      itemId: resolvido.itemId,
      vendas: '',
      shopId: resolvido.shopId ?? '',
      urlPublica: resolvido.urlPublica,
    },
    hoje
  )

  const manuaisAtualizados = mesclarLinhaManuais(linhasManuais, { linkCurto, linha: novaLinha })

  await writeFile(
    CSV_MANUAIS,
    `${CABECALHO_MANUAIS.join(';')}\n${manuaisAtualizados.map((l) => l.linha).join('\n')}\n`,
    'utf8'
  )

  await writeFile(
    CSV_LINKS,
    `${HEADERS_LINKS.join(',')}\n${resolverLinkPublico(linkCurto, linhasLinksAtuais, resolvido)}\n`,
    'utf8'
  )

  console.log('')
  console.log(`gravado em data/produtos-manuais.csv (${jaExiste ? 'substituindo' : 'novo'})`)
  console.log('Sem foto: o card vai mostrar o placeholder até a imagem entrar pelo CSV.')
  console.log('')
  console.log('Rode `npm run catalog:import` e depois `npm run verify`.')
  console.log('O `catalog:sync` sozinho não pega produto novo.')
  return 0
}

const ehCli = process.argv[1] && process.argv[1].endsWith('produto-add.js')

if (ehCli) {
  process.exit(await main())
}
