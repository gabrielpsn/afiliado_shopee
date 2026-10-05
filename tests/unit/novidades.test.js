import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'

import NovidadesView from '../../src/views/NovidadesView.vue'
import SiteHeader from '../../src/components/SiteHeader.vue'
import { routes } from '../../src/router.js'
import { isNovo, contarNovidades, dataMaisRecente } from '../../src/engine/novidades.js'
import { PRODUCTS } from '../../src/data/products.js'
import { gerarFeed, escaparXml, paraRfc822, main } from '../../scripts/gerar-feed.js'
import {
  extrairLinkCurto,
  lerArgumentos,
  validarProduto,
  montarLinhaManual,
  mesclarLinhaManuais,
  resolverLinkPublico,
} from '../../scripts/produto-add.js'

const REFERENCIA = new Date(2026, 9, 5)

const SITE_TESTE = {
  nome: 'Ofertas Shopee',
  tagline: 'tagline',
  descricao: 'descricao do site',
  url: 'https://exemplo-real.workers.dev',
}

describe('rotas', () => {
  it('tem uma rota nomeada para /novidades', () => {
    const r = routes.find((x) => x.name === 'novidades')
    expect(r).toBeDefined()
    expect(r.path).toBe('/novidades')
  })

  // /novidades precisa vir antes da rota curinga, senão o catch-all engole a
  // página e o visitante cai no 404.
  it('a rota vem antes do curinga', () => {
    const iNov = routes.findIndex((x) => x.name === 'novidades')
    const iCur = routes.findIndex((x) => x.name === 'nao-encontrado')
    expect(iNov).toBeLessThan(iCur)
  })
})

describe('NovidadesView', () => {
  const global = {
    stubs: { RouterLink: { template: '<a><slot /></a>' } },
    mocks: { $route: { query: {} } },
  }

  it('mostra um h1 só', () => {
    const w = mount(NovidadesView, { global })
    expect(w.findAll('h1')).toHaveLength(1)
    expect(w.find('h1').text()).toContain('Novidades')
  })

  it('oferece o feed para assinar', () => {
    const w = mount(NovidadesView, { global })
    const link = w.find('[data-testid="link-feed"]')
    expect(link.exists()).toBeTruthy()
    expect(link.attributes('href')).toMatch(/\/feed\.xml$/)
  })

  it('não usa <ul> dentro da grade sem produto', () => {
    const w = mount(NovidadesView, { global })
    // Com o catálogo real tem novidade; o que importa é que a grade só existe
    // quando há produto, nunca uma <ul> vazia.
    if (w.find('[data-testid="grade-produtos"]').exists()) {
      expect(w.findAll('[data-testid="grade-produtos"] > li').length).toBeGreaterThan(0)
    }
  })
})

describe('SiteHeader com badge de novidades', () => {
  const global = {
    stubs: { RouterLink: { template: '<a><slot /></a>' } },
    mocks: { $route: { query: {} } },
  }

  it('mostra o badge quando há novidade', () => {
    const w = mount(SiteHeader, { global })
    const badge = w.find('[data-testid="badge-novidades"]')
    if (contarNovidades(PRODUCTS.filter((p) => p.ativo)) > 0) {
      expect(badge.exists()).toBeTruthy()
      expect(badge.attributes('aria-label')).toContain('Novidades')
    }
  })

  it('mantém o selo de afiliado, que é exigência do CONAR', () => {
    const w = mount(SiteHeader, { global })
    expect(w.find('[data-testid="header-affiliate-badge"]').text()).toBe('Afiliado')
  })

  it('o alvo de toque do badge passa de 44px', () => {
    const w = mount(SiteHeader, { global })
    const badge = w.find('[data-testid="badge-novidades"]')
    if (badge.exists()) expect(badge.classes().join(' ')).toContain('min-h-11')
  })
})

describe('escape e data do feed', () => {
  it('escapa o & antes dos outros caracteres', () => {
    expect(escaparXml('A & B')).toBe('A &amp; B')
    expect(escaparXml('preço <b>')).toBe('preço &lt;b&gt;')
  })

  it('escapa aspas, que quebram atributo', () => {
    expect(escaparXml('diz "oi"')).toBe('diz &quot;oi&quot;')
  })

  it('devolve data em RFC 822, não ISO', () => {
    const r = paraRfc822('2026-10-02', REFERENCIA)
    expect(r).toContain('Oct 2026')
    expect(r).not.toMatch(/^\d{4}-\d{2}-\d{2}/)
  })

  it('sem data de produto, usa a referência em vez de data inválida', () => {
    expect(paraRfc822(null, REFERENCIA)).toBe(REFERENCIA.toUTCString())
    expect(paraRfc822('lixo', REFERENCIA)).toBe(REFERENCIA.toUTCString())
  })
})

describe('gerarFeed', () => {
  const produtos = [
    {
      slug: 'fone-novo',
      nome: 'Fone Bluetooth Novo',
      descricao: '',
      preco: 42.89,
      categoria: 'eletronicos',
      ativo: true,
      itemId: '200',
      adicionadoEm: '2026-10-04',
    },
    {
      slug: 'antigo',
      nome: 'Produto Antigo',
      preco: 10,
      categoria: 'pet',
      ativo: true,
      itemId: '100',
      adicionadoEm: '2026-01-01',
    },
  ]

  it('só entra no feed o que está na janela', () => {
    const xml = gerarFeed(produtos, { site: SITE_TESTE, referencia: REFERENCIA })
    expect(xml).toContain('Fone Bluetooth Novo')
    expect(xml).not.toContain('Produto Antigo')
  })

  it('usa link absoluto, para o leitor abrir sem depender do site', () => {
    const xml = gerarFeed(produtos, { site: SITE_TESTE, referencia: REFERENCIA })
    expect(xml).toContain('<link>https://exemplo-real.workers.dev/produto/fone-novo</link>')
  })

  it('o guid é o mesmo link, e permalink, para o leitor deduplicar', () => {
    const xml = gerarFeed(produtos, { site: SITE_TESTE, referencia: REFERENCIA })
    expect(xml).toMatch(/<guid isPermaLink="true">https:\/\/.*\/produto\/fone-novo<\/guid>/)
  })

  it('diz que é preço de referência, sem prometer desconto', () => {
    const xml = gerarFeed(produtos, { site: SITE_TESTE, referencia: REFERENCIA })
    expect(xml).toContain('Preço de referência')
    expect(xml).not.toMatch(/desconto de/i)
  })

  // lastBuildDate de new Date() muda a cada build; o leitor trata como conteúdo
  // novo e avisa o assinante sem motivo.
  it('lastBuildDate vem do produto mais recente, não de hoje', () => {
    const xml = gerarFeed(produtos, { site: SITE_TESTE, referencia: REFERENCIA })
    // 4 de outubro: a data do produto novo, não a referência (5/10) nem hoje.
    expect(xml).toContain('<lastBuildDate>Sun, 04 Oct 2026')
  })

  it('feed sem novidade é válido, com canal vazio', () => {
    const xml = gerarFeed(
      [{ ...produtos[0], adicionadoEm: '2020-01-01' }],
      { site: SITE_TESTE, referencia: REFERENCIA }
    )
    expect(xml).toContain('<channel>')
    expect(xml).not.toContain('<item>')
  })

  it('recusa gerar feed sem url configurada', () => {
    const r = main(produtos, { site: { ...SITE_TESTE, url: 'https://exemplo.com.br' } })
    expect(r.ok).toBe(false)
    expect(r.xml).toBeNull()
  })

  it('o site real tem url configurada, senão o deploy falharia', () => {
    const { SITE } = require('../../src/data/site.js')
    expect(SITE.url).not.toContain('exemplo.com.br')
  })
})

describe('produto-add: extracting link', () => {
  it('aceita o link inteiro colado do painel', () => {
    expect(extrairLinkCurto('https://s.shopee.com.br/abc123')).toBe('abc123')
  })

  it('aceita só o código', () => {
    expect(extrairLinkCurto('abc123')).toBe('abc123')
  })

  it('recusa link de outro domínio', () => {
    expect(extrairLinkCurto('https://minha-loja.com/produto/1')).toBeNull()
  })

  it('recusa entrada vazia', () => {
    expect(extrairLinkCurto('')).toBeNull()
    expect(extrairLinkCurto(null)).toBeNull()
  })
})

describe('produto-add: argumentos', () => {
  it('lê as duas formas de escrever flag', () => {
    expect(lerArgumentos(['--link', 'x', '--nome', 'Fone', '--preco', '1,00'])).toEqual({
      link: 'x',
      nome: 'Fone',
      preco: '1,00',
    })
    expect(lerArgumentos(['--nome=Fone X', '--preco=9,90'])).toEqual({
      nome: 'Fone X',
      preco: '9,90',
    })
  })

  it('rejeita opção desconhecida em vez de ignorar calada', () => {
    expect(() => lerArgumentos(['--preco-antigo', '1'])).toThrow(/desconhecida/)
  })
})

describe('produto-add: validação antes de gravar', () => {
  it('reprova produto incompleto', () => {
    const p = validarProduto({ nome: '', preco: null, categoria: '' }, { linkCurto: 'a' })
    expect(p).toContain('nome vazio')
    expect(p).toContain('preço não é número')
    expect(p).toContain('categoria vazia')
  })

  it('reprova preço abaixo do mínimo', () => {
    const p = validarProduto({ nome: 'X', preco: 0.2, categoria: 'pet' }, { linkCurto: 'a' })
    expect(p.join()).toMatch(/abaixo do mínimo/)
  })

  it('reprova categoria fora da taxonomia', () => {
    const p = validarProduto({ nome: 'X', preco: 10, categoria: 'inexistente' }, { linkCurto: 'a' })
    expect(p.join()).toMatch(/não existe em categories.js/)
  })

  it('reprova nome longo demais para o Google', () => {
    const p = validarProduto({ nome: 'a'.repeat(130), preco: 10, categoria: 'pet' }, { linkCurto: 'a' })
    expect(p.join()).toMatch(/acima de 120/)
  })

  it('aceita produto completo', () => {
    expect(validarProduto({ nome: 'X', preco: 10, categoria: 'pet' }, { linkCurto: 'a' })).toEqual([])
  })
})

describe('produto-add: linha do CSV de manuais', () => {
  const entrada = {
    linkCurto: 'abc',
    itemId: '900',
    nome: 'Fone',
    categoria: 'eletronicos',
    preco: 42.89,
    loja: 'Loja',
    vendas: '',
  }

  it('preenche adicionadoEm com a data de hoje, para o produto contar como novo', () => {
    const campos = montarLinhaManual(entrada, '2026-10-05').split(';')
    expect(campos[campos.length - 1]).toBe('2026-10-05')
  })

  it('grava o itemId, senão o produto nasce pendente', () => {
    expect(montarLinhaManual(entrada, '2026-10-05')).toContain('900')
  })

  it('grava preço com vírgula, como o resto do catálogo', () => {
    expect(montarLinhaManual(entrada, '2026-10-05')).toContain('42,89')
  })

  it('substitui a linha do mesmo linkCurto em vez de duplicar', () => {
    const antes = [{ linkCurto: 'abc', linha: 'velha' }, { linkCurto: 'zzz', linha: 'outra' }]
    const r = mesclarLinhaManuais(antes, { linkCurto: 'abc', linha: 'nova' })
    expect(r).toHaveLength(2)
    expect(r.find((x) => x.linkCurto === 'abc').linha).toBe('nova')
  })
})

describe('produto-add: linha de links resolvidos', () => {
  const resolvido = {
    itemId: '22898911318',
    shopId: '1603816379',
    shopName: 'minha-loja',
    urlPublica: 'https://shopee.com.br/minha-loja/1603816379/22898911318',
  }

  // Sem esta linha, from-csv.js não acha urlPublica e o produto entra
  // pendente — o build reprova por sintoma, não por causa.
  it('acrescenta a linha do produto manual ao CSV de links', () => {
    const csv = resolverLinkPublico('abc', [], resolvido)
    expect(csv).toContain('abc,OK,22898911318')
    expect(csv).toContain('https://shopee.com.br/minha-loja/1603816379/22898911318')
  })

  it('mantém as linhas que já existiam', () => {
    const antes = [{ linkCurto: 'zzz', status: 'OK', itemId: '1' }]
    const csv = resolverLinkPublico('abc', antes, resolvido)
    expect(csv).toContain('zzz,OK,1')
    expect(csv.split('\n')).toHaveLength(2)
  })

  it('protege nome de loja com vírgula, que quebraria a coluna', () => {
    const csv = resolverLinkPublico('abc', [], { ...resolvido, shopName: 'FOX SHOP, CONFIGS' })
    expect(csv).toContain('"FOX SHOP, CONFIGS"')
  })
})

describe('catálogo real e novidade', () => {
  it('todo produto ativo tem adicionadoEm, senão o aviso nunca funciona', () => {
    const semData = PRODUCTS.filter((p) => p.ativo && !p.adicionadoEm)
    expect(semData).toEqual([])
  })

  it('a data mais recente do catálogo é única por janela de importação', () => {
    const datas = new Set(PRODUCTS.map((p) => p.adicionadoEm))
    expect(datas.size).toBeLessThanOrEqual(2)
  })

  it('isNovo é coerente com a contagem do badge', () => {
    const ativos = PRODUCTS.filter((p) => p.ativo && !p.pendente)
    const manual = ativos.filter((p) => isNovo(p, { referencia: REFERENCIA })).length
    expect(contarNovidades(ativos, { referencia: REFERENCIA })).toBe(manual)
  })

  it('dataMaisRecente devolve data válida do catálogo real', () => {
    const d = dataMaisRecente(PRODUCTS)
    expect(d).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})
