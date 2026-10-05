// Configuração do site. É lido tanto pelo app quanto pelos scripts de build
// (prerender, sitemap), então não pode importar nada de Vue.

export const SITE = {
  nome: 'Ofertas Shopee',

  tagline: 'Produtos com preço de referência e links de afiliado da Shopee.',

  // TODO: trocar pelo domínio real. Canonical e sitemap dependem deste valor;
  // enquanto for o placeholder, o build emite um aviso.
  url: 'https://exemplo.com.br',

  descricao:
    'Vitrine de produtos com preço de referência e links de afiliado da Shopee. Você paga o mesmo preço; nós recebemos uma comissão.',

  contato: {
    email: 'contato@exemplo.com.br',
    whatsapp: '',
  },

  redes: {},

  // Prazo em dias depois do qual o preço de referência é marcado como antigo.
  diasParaPrecoAntigo: 30,
}

export function isSiteUrlConfigurada(url = SITE.url) {
  return !url.includes('exemplo.com.br') && /^https:\/\//.test(url)
}
