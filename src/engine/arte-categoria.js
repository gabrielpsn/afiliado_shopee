// Arte de placeholder por categoria.
//
// Por que desenhar em vez de baixar foto de banco: a foto do produto não existe
// (a exportação de afiliado não traz e a Shopee bloqueia leitura automatizada).
// Uma foto de banco que "representa" a categoria entraria na vitrine parecendo
// foto do item — que é exatamente o problema de consumidor que este placeholder
// existe para evitar.
//
// Então é um desenho: degradê na cor da categoria com um padrão geométrico. Não é
// foto de nada, dispensa atribuição de licença, não sai do lugar quando a foto
// real chegar e pesa ~400 bytes por categoria.
//
// Puro e determinístico: mesma categoria, mesmo desenho, sempre.

const PALETA_ARTE = {
  'casa-e-cozinha': ['#f59e0b', '#b45309'],
  'moda-feminina': ['#f472b6', '#9d174d'],
  eletronicos: ['#38bdf8', '#075985'],
  'casa-e-decoracao': ['#a78bfa', '#5b21b6'],
  eletrodomesticos: ['#22d3ee', '#0e7490'],
  beleza: ['#fb7185', '#9f1239'],
  automotivo: ['#94a3b8', '#334155'],
  pet: ['#34d399', '#065f46'],
  calcados: ['#fbbf24', '#92400e'],
  'moda-masculina': ['#60a5fa', '#1e3a8a'],
  infantil: ['#f0abfc', '#86198f'],
  ferramentas: ['#f87171', '#7f1d1d'],
  fitness: ['#4ade80', '#14532d'],
  saude: ['#2dd4bf', '#134e4a'],
  'camping-viagem': ['#a3e635', '#3f6212'],
  papelaria: ['#818cf8', '#312e81'],
  livros: ['#cbd5e1', '#475569'],
  outros: ['#6b7280', '#1f2937'],
}

/** Cores da categoria, com fallback em "outros" para id desconhecido. */
export function coresCategoriaArte(id) {
  return PALETA_ARTE[id] ?? PALETA_ARTE.outros
}

/**
 * SVG da arte. A posição do desenho vem de uma soma dos caracteres do id: não
 * precisa ser aleatório, só precisa ser diferente entre categorias para o
 * placeholder não parecer o mesmo 500 vezes.
 */
export function svgArteCategoria(id) {
  const [c1, c2] = coresCategoriaArte(id)

  // A semente vem do id resolvido, não do id recebido: um id inválido tem que
  // dar o mesmo desenho de "outros", e não um padrão arbitrário que só ele tem.
  const base = PALETA_ARTE[id] ? String(id) : 'outros'
  const semente = [...base].reduce((soma, c) => soma + c.charCodeAt(0), 0)
  const cx = 26 + (semente % 44)
  const cy = 30 + ((semente >> 3) % 38)
  const raio = 52 + (semente % 18)

  return [
    "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 160 160' preserveAspectRatio='xMidYMid slice'>",
    '<defs>',
    `<linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>`,
    `<stop offset='0' stop-color='${c1}'/>`,
    `<stop offset='1' stop-color='${c2}'/>`,
    '</linearGradient>',
    '</defs>',
    `<rect width='160' height='160' fill='url(#g)'/>`,
    `<circle cx='${cx}' cy='${cy}' r='${raio}' fill='#fff' opacity='0.10'/>`,
    `<circle cx='${160 - cx}' cy='${160 - cy}' r='${raio * 0.7}' fill='#000' opacity='0.10'/>`,
    "<path d='M0 118 L160 74 L160 160 L0 160 Z' fill='#fff' opacity='0.06'/>",
    '</svg>',
  ].join('')
}

/**
 * A arte como `background-image` pronta para o style.
 *
 * `encodeURIComponent` não é opcional: sem ele o `#` das cores vira fragmento de
 * URL e o SVG inteiro não carrega — o card volta ao cinza sem erro no console.
 */
export function urlArteCategoria(id) {
  return `url("data:image/svg+xml,${encodeURIComponent(svgArteCategoria(id))}")`
}
