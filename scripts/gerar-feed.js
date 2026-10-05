// Gera `public/feed.xml` — RSS 2.0 com os produtos novos da vitrine.
//
//   npm run feed:gerar
//
// Roda dentro do `npm run verify`, antes do build, e o Vite copia `public/` para
// `dist/` sozinho. Gerar no build e não no deploy evita o arquivo desatualizado:
// um feed que promete novidade que saiu da janela de sete dias faz o leitor
// mostrar produto como "novo" quando já é velho.
//
// O aviso de produto novo não depende de cadastro, e-mail ou cookie: o visitante
// assina o feed no leitor dele. Isso mantém a Política de Privacidade coerente
// com o comportamento do site.

import { mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

import { SITE, isSiteUrlConfigurada } from '../src/data/site.js'
import { getActiveProducts } from '../src/engine/catalog.js'
import { getNovidades, dataMaisRecente, DIAS_NOVIDADE } from '../src/engine/novidades.js'
import { normalizar } from '../src/engine/format.js'

const RAIZ = dirname(dirname(fileURLToPath(import.meta.url)))
const DIR_PUBLIC = join(RAIZ, 'public')
const ARQUIVO_FEED = join(DIR_PUBLIC, 'feed.xml')

const LIMITE_ITENS = 30

/**
 * Escapa para XML.
 *
 * `&` vem primeiro de propósito: escapar os outros caracteres antes deixaria o
 * `&` que o próprio escape introduzido ser escapado de novo, e o XML quebraria.
 */
export function escaparXml(texto) {
  return String(texto ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/** Data ISO em RFC 822, formato que o RSS exige (`lastBuildDate` não aceita ISO). */
export function paraRfc822(iso, referencia = new Date()) {
  const alvo = iso ? new Date(`${iso}T12:00:00`) : referencia
  if (Number.isNaN(alvo.getTime())) return referencia.toUTCString()
  return alvo.toUTCString()
}

/** Descrição do item. Só entra o que a vitrine mostra, sem prometer nada. */
export function descricaoItem(produto) {
  const preco =
    typeof produto.preco === 'number'
      ? produto.preco.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
      : 'preço de referência na Shopee'

  const partes = [
    produto.descricao?.trim() || produto.nome,
    preco,
    'Preço de referência conferido no catálogo. Você paga o mesmo preço na Shopee.',
  ]
  return partes.join(' ')
}

export function gerarFeed(produtos, { site = SITE, limite = LIMITE_ITENS, referencia = new Date() } = {}) {
  const novidades = getNovidades(produtos, { limite, referencia })
  const titulo = site.nome
  const descricao = site.descricao || site.tagline

  // `lastBuildDate` vem da data do produto mais recente, não de `new Date()`.
  // Reader de feed trata build sem mudança como conteúdo novo e notifica o
  // assinante sem motivo.
  const maisRecente = dataMaisRecente(produtos)
  const ultima = paraRfc822(maisRecente, referencia)

  const itens = novidades
    .map((p) => {
      const url = `${site.url}/produto/${p.slug}`
      return `    <item>
      <title>${escaparXml(p.nome)}</title>
      <link>${escaparXml(url)}</link>
      <guid isPermaLink="true">${escaparXml(url)}</guid>
      <description>${escaparXml(descricaoItem(p))}</description>
      <pubDate>${paraRfc822(p.adicionadoEm, referencia)}</pubDate>
    </item>`
    })
    .join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<!-- ARQUIVO GERADO por scripts/gerar-feed.js. Não edite à mão. -->
<rss version="2.0">
  <channel>
    <title>${escaparXml(titulo)} — novidades</title>
    <link>${escaparXml(site.url)}/novidades</link>
    <description>${escaparXml(descricao)}</description>
    <language>pt-BR</language>
    <lastBuildDate>${ultima}</lastBuildDate>
    <generator>scripts/gerar-feed.js</generator>
    <ttl>60</ttl>
${itens}
  </channel>
</rss>
`
}

/** Resumo para o console. Devolve também o XML para os testes. */
export function main(produtos = getActiveProducts(), opcoes = {}) {
  const site = opcoes.site ?? SITE

  if (!isSiteUrlConfigurada(site.url)) {
    // Link absoluto num feed sem domínio base resolve para o leitor local, e o
    // item abre como página inexistente. Melhor um feed explícito do que um
    // feed quebrado em silêncio.
    console.error('SITE.url não está configurada. Os links do feed ficariam relativos.')
    console.error('Defina a url real em src/data/site.js antes de publicar.')
    return { xml: null, total: 0, ok: false }
  }

  const xml = gerarFeed(produtos, { site, ...opcoes })
  const total = getNovidades(produtos, { referencia: opcoes.referencia }).length

  return { xml, total, ok: true, dias: DIAS_NOVIDADE }
}

const ehCli = process.argv[1] && process.argv[1].endsWith('gerar-feed.js')

if (ehCli) {
  const resultado = main()

  if (!resultado.ok) {
    process.exit(1)
  }

  await mkdir(DIR_PUBLIC, { recursive: true })
  await writeFile(ARQUIVO_FEED, resultado.xml, 'utf8')

  console.log(`public/feed.xml gerado: ${resultado.total} novidade(s) em ${resultado.dias} dias`)
  if (!resultado.total) {
    console.log('  Nenhum produto na janela: o feed sai com o canal vazio, o que é válido.')
  }
}

export { ARQUIVO_FEED, LIMITE_ITENS }
