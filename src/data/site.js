// Configuração do site. É lido tanto pelo app quanto pelos scripts de build
// (prerender, sitemap), então não pode importar nada de Vue.

export const SITE = {
  nome: 'Ofertas Shopee',

  tagline: 'Produtos com preço de referência e links de afiliado da Shopee.',

  // Canonical e sitemap saem daqui. Só o aviso do build depende deste valor:
  // `isSiteUrlConfigurada()` reprova o placeholder, não a URL real.
  url: 'https://afiliado-shopee.gabrielpsn.workers.dev',

  descricao:
    'Vitrine de produtos com preço de referência e links de afiliado da Shopee. Você paga o mesmo preço; nós recebemos uma comissão.',

  // Sem canal de contato: o site não coleta dado pessoal (a Política de
  // Privacidade diz isso) e um e-mail de exemplo seria pior que nenhum.

  redes: {},

  // Prazo em dias depois do qual o preço de referência é marcado como antigo.
  diasParaPrecoAntigo: 30,
}

export function isSiteUrlConfigurada(url = SITE.url) {
  return !url.includes('exemplo.com.br') && /^https:\/\//.test(url)
}
