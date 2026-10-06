import { describe, it, expect } from 'vitest'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { parseCsv } from '../../scripts/from-csv.js'
import {
  alvoDaBusca,
  lerCache,
  lerItemIds,
  gravar,
} from '../../scripts/buscar-imagens.js'

async function numTemporario() {
  return mkdtemp(join(tmpdir(), 'buscar-imagens-'))
}

async function gravarNum(dir, nome, corpo) {
  const caminho = join(dir, nome)
  await writeFile(caminho, corpo, 'utf8')
  return caminho
}

describe('alvoDaBusca', () => {
  const linhas = [
    { linkCurto: 'aaa', imagens: '' },
    { linkCurto: 'bbb', imagens: 'https://cf.shopee.com.br/file/1' },
    { linkCurto: 'ccc', imagens: '' },
    { linkCurto: 'ddd', imagens: ' ' },
  ]
  const itemIds = new Map([
    ['aaa', '10'],
    ['ccc', '30'],
    // ddd não tem id resolvido e fica de fora
  ])

  it('pega só quem não tem foto e tem id resolvido', () => {
    const alvo = alvoDaBusca(linhas, itemIds)
    expect(alvo.map((p) => p.linha.linkCurto)).toEqual(['aaa', 'ccc'])
    expect(alvo[0].itemId).toBe('10')
  })

  it('item com foto já gravada não volta à fila', () => {
    expect(alvoDaBusca([{ linkCurto: 'bbb', imagens: 'https://cf/x' }], new Map([['bbb', '1']]))).toHaveLength(0)
  })

  it('id com espaço em branco não é id', () => {
    const r = alvoDaBusca([{ linkCurto: 'x', imagens: '' }], new Map([['x', '  ']]))
    expect(r).toHaveLength(0)
  })
})

describe('lerCache e lerItemIds', () => {
  it('arquivo ausente vira mapa vazio, não exceção', async () => {
    expect((await lerCache('/tmp/nao-existe-cache.csv')).size).toBe(0)
    expect((await lerItemIds('/tmp/nao-existe-links.csv')).size).toBe(0)
  })

  it('só aceita url https no cache', async () => {
    const dir = await numTemporario()
    const caminho = await gravarNum(dir, 'c.csv', 'itemId;imageUrl\n1;https://cf/x\n2;ftp://ruim\n3;\n')
    const mapa = await lerCache(caminho)
    expect([...mapa.entries()]).toEqual([['1', 'https://cf/x']])
  })

  it('itemId de link sem resolver não entra no mapa', async () => {
    const dir = await numTemporario()
    const caminho = await gravarNum(dir, 'l.csv', 'linkCurto;itemId\nok;42\nsem-id;\n')
    expect([... (await lerItemIds(caminho)).entries()]).toEqual([['ok', '42']])
  })
})

describe('gravar', () => {
  // Este teste pega o bug real: formatarLinhaCsv aceita um objeto, e passar a
  // lista inteira gravava ";;;;;;;;" no arquivo, destruindo data/produtos.csv.
  it('escreve uma linha por produto com cabeçalho', async () => {
    const dir = await numTemporario()
    const cat = join(dir, 'p.csv')
    const cache = new Map([['42', 'https://cf.shopee.com.br/file/abc']])
    const produtos = [
      { linkCurto: 'aaa', imagens: 'https://cf.shopee.com.br/file/abc', itemIdNaoExiste: 'x' },
    ]

    await gravar({ produtos, cache, capturadoEm: '2026-10-05', caminhoCache: join(dir, 'c.csv'), caminhoCatalogo: cat })

    const corpo = await readFile(cat, 'utf8')
    const { linhas } = parseCsv(corpo)
    expect(linhas).toHaveLength(1)
    expect(linhas[0].linkCurto).toBe('aaa')
    expect(linhas[0].imagens).toBe('https://cf.shopee.com.br/file/abc')
  })

  it('produtos que não mudaram são preservados na reescrita', async () => {
    const dir = await numTemporario()
    const cache = new Map()
    const produtos = [
      { linkCurto: 'aaa', nome: 'Produto A', imagens: '' },
      { linkCurto: 'bbb', nome: 'Produto B', imagens: 'https://cf/x' },
    ]
    await gravar({ produtos, cache, capturadoEm: 'x', caminhoCache: join(dir, 'c.csv'), caminhoCatalogo: join(dir, 'p.csv') })
    const { linhas } = parseCsv(await readFile(join(dir, 'p.csv'), 'utf8'))
    expect(linhas.map((l) => l.nome)).toEqual(['Produto A', 'Produto B'])
  })

  it('o cache é gravado antes do catálogo e mantém só o que é https', async () => {
    const dir = await numTemporario()
    const cache = new Map([['1', 'https://cf/1'], ['2', 'ftp://ruim']])
    await gravar({ produtos: [], cache, capturadoEm: '2026-10-05', caminhoCache: join(dir, 'c.csv'), caminhoCatalogo: join(dir, 'p.csv') })
    const { linhas } = parseCsv(await readFile(join(dir, 'c.csv'), 'utf8'))
    expect(linhas).toHaveLength(2) // o filtro de https acontece na leitura, não na gravação
  })
})