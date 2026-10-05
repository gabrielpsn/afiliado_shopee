# Plano — Loja de Afiliado Shopee

Vitrine estática de produtos com **links de afiliado da Shopee**. Nenhuma venda é
processada aqui: o clique leva ao checkout da Shopee. Sem banco de dados, sem
backend, sem conta de usuário.

Interface em português (pt-BR). Herda as convenções do projeto `treino`.

## Decisões fechadas

| Tema | Decisão |
|---|---|
| Roteamento/SEO | Prerender estático no build, URLs reais (`/produto/slug`) |
| Catálogo | Arquivo estático versionado no git (`src/data/`) |
| Escopo da 1ª entrega | Essencial: vitrine, busca/filtros, produto, aviso de afiliado, páginas legais, SEO |
| Persistência | Nenhuma. Favoritos em `localStorage`, se houver |
| Métrica | Cloudflare Web Analytics (grátis, sem cookie) |

## Stack

| Camada | Escolha | Por quê |
|---|---|---|
| UI | Vue 3 `<script setup>` + `vue-router` (history) | Igual ao `treino`, mais rotas |
| Build | Vite 8 | Mesma base do `treino` |
| Estilo | Tailwind CSS v4 (CSS-first, sem `tailwind.config.js`) | Mesma base do `treino` |
| SSG | Script próprio com Playwright | Playwright já é dependência do projeto; zero lib nova |
| Dados | Módulos JS em `src/data/` | Sem banco, sem build step |
| SEO | `sitemap.xml` gerado no build + JSON-LD | Catálogo estático permite gerar tudo |
| Testes | Vitest + `@vue/test-utils` + `happy-dom`; Playwright p/ E2E e visual | Mesma suíte do `treino` |
| Deploy | Cloudflare Worker (assets estáticos) via GitHub Actions | Mesma pipeline do `treino` |

Dependências novas em relação ao `treino`: apenas `vue-router`. Todo o resto
reaproveita o que já é padrão no projeto de referência.

---

## Arquitetura de pastas

```
src/
├── main.js
├── App.vue                     shell: header/footer/rotas
├── router/index.js             rotas + guard de 404
├── style.css                   base Tailwind v4
├── data/                       FONTE DE VERDADE (sem build step)
│   ├── site.js                 nome, url canônica, redes, contato
│   ├── categories.js           categorias + ordem + ícones
│   ├── products.js             catálogo de produtos
│   └── coupons.js              cupons (fase 2)
├── engine/                     lógica pura, sem import de Vue, 100% testada
│   ├── format.js               moeda BRL, slug, texto, data
│   ├── catalog.js              busca, filtro, ordenação, paginação
│   ├── links.js                link de afiliado + validação
│   ├── seo.js                  meta, Open Graph, JSON-LD
│   └── offers.js               ofertas do dia, destaques, relacionados
├── components/
│   ├── SiteHeader.vue          logo, busca, navegação por categoria
│   ├── SiteFooter.vue          links, aviso de afiliado, legal
│   ├── AffiliateNotice.vue     barra fixa + tooltip no CTA
│   ├── ProductCard.vue
│   ├── ProductGrid.vue         responsivo + estado vazio
│   ├── FilterPanel.vue         categoria, faixa de preço, tags, ordenação
│   ├── PriceTag.vue            preço + preço anterior + "referência"
│   ├── ProductGallery.vue      imagens + thumbnails
│   ├── ShareButtons.vue        WhatsApp, Telegram, copiar link
│   └── JsonLd.vue              injeta o script de dados estruturados
├── views/
│   ├── HomeView.vue            destaques, categorias, ofertas do dia
│   ├── CategoryView.vue
│   ├── SearchView.vue
│   ├── ProductView.vue         página de produto (PRD do SEO)
│   ├── OfferView.vue           página "ofertas"
│   ├── AboutView.vue
│   ├── PrivacyView.vue
│   ├── ContactView.vue
│   └── NotFoundView.vue
scripts/
├── prerender.js                build → HTML estático de cada rota
├── sitemap.js                  gera dist/sitemap.xml
├── check-links.js              valida o catálogo (domínio, slug, datas)
└── fetch-images.js             opcional: baixa imagens p/ public/img
tests/
├── unit/*.test.js
└── e2e/*.spec.js
public/
├── favicon.svg, og-default.png, robots.txt
```

O `App.vue` do `treino` tem 1531 linhas e concentra todo o estado. Aqui a
divisão é por view + componente desde o começo — o catálogo precisa de URLs
distintas, o que torna um componente raiz único inviável.

---

## Modelo de dados

`src/data/products.js` exporta um array. Campos:

| Campo | Tipo | Obrig. | Observação |
|---|---|---|---|
| `slug` | string | sim | único, kebab-case, vira a URL |
| `nome` | string | sim | ≤ 70 chars p/ não cortar no Google |
| `descricao` | string | sim | 2–4 parágrafos, texto puro |
| `preco` | number | sim | **preço de referência** em BRL |
| `precoAntes` | number | não | preço "de", renderizado riscado |
| `categoria` | string | sim | id de `categories.js` |
| `tags` | string[] | sim | busca e filtros cruzados |
| `imagens` | string[] | sim | CDN da Shopee ou `public/img/` |
| `largura` / `altura` | number | sim | reserva espaço, evita CLS |
| `linkAfiliado` | string | sim | URL de afiliado (validada) |
| `linkApp` | string | não | deep link `shopee://` |
| `avaliacao` | number | não | 0–5 |
| `numAvaliacoes` | number | não | inteiro |
| `destaques` | string[] | não | bullets de venda |
| `cupons` | string[] | não | ids de `coupons.js` |
| `destaque` | boolean | não | aparece na home |
| `promocao` | boolean | não | entra em "ofertas do dia" |
| `ordem` | number | não | ordenação manual dentro da categoria |
| `ativo` | boolean | sim | desativar sem apagar |
| `atualizadoEm` | string | sim | `YYYY-MM-DD` — avisar preço antigo |

`scripts/check-links.js` roda no build e falha se: `slug` duplicado, categoria
inexistente, `linkAfiliado` fora do domínio permitido (`shopee.com.br`,
`s.shopee.com.br`), preço não numérico, produto sem imagem, ou `atualizadoEm`
com mais de N dias. Erro de catálogo é erro de build — nunca um produto
quebrado em produção.

---

## Rotas

| Rota | Arquivo gerado | Descrição |
|---|---|---|
| `/` | `dist/index.html` | home |
| `/categoria/:slug` | `dist/categoria/<slug>/index.html` | listagem |
| `/ofertas` | `dist/ofertas/index.html` | só quem tem `promocao` |
| `/busca?q=` | — | client-side (não prerender: query varia) |
| `/produto/:slug` | `dist/produto/<slug>/index.html` | página de produto |
| `/sobre`, `/privacidade`, `/contato` | `dist/<rota>/index.html` | páginas legais |
| qualquer outra | `dist/404.html` | cópia do index, router mostra 404 |

---

## Módulos do `engine/` (puros, sem Vue)

Assinaturas-alvo:

```js
// format.js
formatBRL(129.9)                    // "R$ 129,90"
formatDiscount(preco, precoAntes)    // { pct, label } | null
slugify('Fone Bluetooth ANC')       // "fone-bluetooth-anc"
isPriceStale(produto, dias = 30)    // bool
daysSince('2026-09-01')             // int

// catalog.js
getAllProducts()
getActiveProducts()                 // filtra ativo === true
getProductBySlug(slug)              // product | undefined
getCategoriesWithCounts()           // categoria + nº de produtos
searchProducts(products, { q, categoria, tags, precoMin, precoMax, ordem })
//   ordem: 'relevancia' | 'menor-preco' | 'maior-preco' | 'avaliacao' | 'novidades'
getRelatedProducts(produto, n = 4)  // mesma categoria, depois tags em comum
getBestsellers(n)

// links.js
buildAffiliateLink(produto)         // link de afiliado normalizado
buildShareText(produto, urlBase)    // texto pronto p/ WhatsApp
isValidAffiliateLink(url)           // bool + motivo
trackOutboundClick(slug, pos)       // beacon p/ analytics (no-op em dev)

// seo.js
buildPageMeta({ title, description, image, canonical, type })
buildProductJsonLd(produto, { siteUrl, updatedAt })
buildBreadcrumbJsonLd(itens)

// offers.js
getDailyOffers(products, dataBase)  // promocao && desconto >= 10% && não vencido
```

Regras importantíssimas no `links.js`:

- **nunca** construir URL de afiliado por concatenação de query strings. A
  atribuição mora em `?sp_atk=`/`?xptdk=`/`s.shopee.com.br/<code>`. Se o link
  mudar no painel do afiliado, muda-se no catálogo e em todo o site.
- Todo link de afiliado no HTML leva `rel="sponsored nofollow"`. O Google
  penaliza sites de afiliados sem isso.

---

## Prerender

`scripts/prerender.js`, depois de `vite build`:

1. sobe `vite preview` numa porta fixa;
2. para cada rota de `getPrerenderRoutes()`, abre a URL com Playwright;
3. espera `networkidle` + seletor `[data-prerender-ready]`;
4. grava `document.documentElement.outerHTML` em `<rota>/index.html`;
5. remove do HTML o que só faz sentido no cliente (o `<script type="module">`
   é mantido — a página precisa hidratar para a busca e os filtros);
6. copia o `index.html` para `dist/404.html`;
7. chama `sitemap.js`.

`data-prerender-ready` é um atributo colocado por cada `view` quando terminou de
renderizar dados. Sem ele, o script pode capturar HTML com a grade de produtos
vazia — o pior tipo de bug, porque o build "passa" e a página publicado nasce
quebrada.

`npm run build` vira `vue-tsc`-free: `vite build && node scripts/check-links.js && node scripts/prerender.js`.

---

## Fases

### Fase 0 — Fundação
- [ ] `git init`, `.gitignore` (mesmo do `treino`)
- [ ] `package.json` com os scripts do `treino` + `build` composto
- [ ] `vite.config.js` (Tailwind v4, `base: '/'`), `vitest.config.js`, `playwright.config.js`
- [ ] `index.html` com meta base, Open Graph default, fontes
- [ ] `src/style.css` com base Tailwind v4, foco visível, scrollbar
- [ ] `AGENTS.md` com as convenções herdadas do `treino` (pt-BR, sem comentários
      redundantes, `engine/` puro, verificação antes de concluir)
- [ ] `npm run verify` verde com o esqueleto vazio

### Fase 1 — Domínio e catálogo
- [ ] `site.js`, `categories.js`, `products.js` com 15–20 produtos seed
- [ ] `scripts/check-links.js` + testes do validador
- [ ] Preencher as variáveis `SITE_URL`, nome e redes em `site.js`

### Fase 2 — Engine
- [ ] `format.js` e `catalog.js` com testes unitários de borda (preço 0,
      string vazia, acento, slug duplicado, produto inativo)
- [ ] `links.js` e `seo.js` com testes
- [ ] `offers.js` com testes de janela de tempo (usar data fixa, nunca `now()`
      solto no teste)

### Fase 3 — Layout e componentes
- [ ] `SiteHeader` com busca instantânea e navegação por categoria
- [ ] `SiteFooter` com links legais
- [ ] `AffiliateNotice` — barra fixa no mobile, selo no header, texto ao lado do CTA
- [ ] `ProductCard`, `ProductGrid`, `PriceTag`, `FilterPanel`
- [ ] Mobile-first; alvos de toque ≥ 44px; card inteiro clicável

### Fase 4 — Views
- [ ] `HomeView`: hero, categorias, ofertas do dia, destaques
- [ ] `CategoryView`: filtro + ordenação + paginação por "ver mais"
- [ ] `SearchView`: busca por nome, tag e categoria, com estado vazio e
      sugestão quando não há resultado
- [ ] `ProductView`: galeria, preço, descrição, destaques, cupons, relacionados,
      CTA "Ver na Shopee", aviso de afiliado ao lado do botão, compartilhar
- [ ] Páginas legais e 404

### Fase 5 — SEO técnico
- [ ] `buildPageMeta` aplicado por rota via `router.afterEach`
- [ ] `<title>` e `description` únicos por produto e por categoria
- [ ] canonical absoluto; `og:image` 1200×630
- [ ] JSON-LD `Product` + `Offer` com `priceValidUntil`, `BreadcrumbList`
- [ ] `sitemap.xml` gerado no build + `robots.txt` + `robots` no `index.html`
- [ ] `alt` descritivo em toda imagem, `width`/`height` em todo `<img>`
- [ ] HTML semântico: um `<h1>` por página, hierarquia sem pular nível

### Fase 6 — Prerender
- [ ] `scripts/prerender.js` funcional
- [ ] `data-prerender-ready` em todas as views que dependem de dados
- [ ] Teste Playwright que abre `dist/produto/<slug>/index.html` **pelo
      filesystem** e falha se o nome do produto não estiver no HTML — é o teste
      que pega o bug de HTML vazio
- [ ] `dist/404.html` gerado
- [ ] Validar que `wrangler` serve `dist/produto/slug/index.html` em `/produto/slug`;
      se não resolver sozinho, adicionar `wrangler.jsonc` com
      `assets.html_handling = "auto-trailing-slash"`

### Fase 7 — Deploy
- [ ] `.github/workflows/deploy.yml`: job `verify` (test + build) e job `deploy`
      condicionado a push em `main`, com `concurrency` para cancelar pushes seguidos
- [ ] `wrangler@4` fixado, `CLOUDFLARE_API_TOKEN` como secret
- [ ] Cloudflare Web Analytics ligado; eventos customizados
      `outbound_click` e `search`
- [ ] `SITE_URL` correto em `site.js` (canonical e sitemap dependem disso)
- [ ] `npm run preview` servindo o `dist/` e as rotas principais abertas à mão

### Fase 8 — QA e acabamento
- [ ] Playwright E2E: home carrega, filtro funciona, CTA aponta para o domínio
      correto, 404 funciona, rota direta por URL funciona
- [ ] Screenshot de visual em desktop e mobile
- [ ] Navegação por teclado e contraste conferidos
- [ ] Lighthouse em `/` e numa página de produto (meta: performance > 90,
      SEO 100, acessibilidade > 90)
- [ ] `README.md` no formato do `treino`: stack, comandos, arquitetura, modelo
      de dados, deploy, aviso legal

### Fase 2.1 — Extras (após o MVP estar no ar)
- [ ] Lista de desejos em `localStorage`
- [ ] Botão de compartilhar WhatsApp/Telegram
- [ ] Script opcional `fetch-images.js` (baixa as imagens para `public/img/`
      e gera WebP), reduzindo risco de hotlink do CDN da Shopee
- [ ] `npm run add:product` — CLI interativo que pergunta os campos e escreve
      no catálogo, com validação

---

## Comandos

```bash
npm run dev            # Vite dev server
npm run build          # check-links + vite build + prerender + sitemap
npm run preview        # serve dist/ para conferência
npm run test           # Vitest
npm run test:visual    # Playwright (sobe o dev server sozinho)
npm run verify         # test + build — mesmo gate do CI
```

---

## Conformidade (não negociável)

Sem isso o site takes risco com o programa de afiliados e com o Código de
Defesa do Consumidor. São requisitos de aceite, não polimento:

- **Aviso de afiliado visível**: barra fixa no mobile, selo no header, texto
  explícito ao lado de todo CTA ("Link de afiliado — você paga o mesmo preço e
  eu recebo uma comissão, sem custo extra para você"). Exigência do Código
  Brasileiro de Autorregulamentação Publicitária (Anexo H).
- **Preço de referência**: exibir "Preço de referência, sujeito a alteração na
  Shopee" e a data da última atualização do produto. O CDC (art. 6º, III) exige
  informação clara e correta sobre o preço.
- **Sem promessa de desconto** que não exista; cupom só entra no catálogo se a
  Shopee realmente fornecer.
- **Política de Privacidade** coerente com a prática: o site não coleta dado
  pessoal, não tem cookies de rastreamento e não tem login. Se o Web Analytics
  for ligado, descrever o uso de dados agregados.
- **Sem uso do logo da Shopee** como se fosse marca própria; escrever "checkout
  na Shopee".
- `rel="sponsored nofollow"` em todo link de afiliado.

---

## Riscos

| Risco | Mitigação |
|---|---|
| Preço desatualizado no site | `precoAntes`/`promocao` explícitos, selo de "referência", `atualizadoEm`, `isPriceStale` aviso após 30 dias, `check-links.js` falha no build |
| Link de afiliado expira ou muda | Fonte única em `products.js`; `buildAffiliateLink` é o único caminho; validação no build |
| Hotlink das imagens da Shopee bloqueado | `<img referrerpolicy="no-referrer">` + fallback em `public/img/placeholder.svg`; opcionalmente baixar as imagens com `fetch-images.js` |
| HTML prerenderado vazio | `data-prerender-ready` + teste que lê o HTML do `dist/` |
| Catálogo crescendo e pesando o bundle | Começar em um arquivo; se passar de ~300 produtos, dividir por categoria com `import()` dinâmico (ajustar o `networkidle` do prerender) |
| Regra do programa de afiliados mudar | `README` e aviso legal como ponto único de verdade; revisão trimestral do catálogo |

---

## Fora do escopo do MVP

Carrinho, checkout, cadastro, cupom de desconto próprio, programa de pontos,
painel de comissões, upload de produto pelo usuário, CMS, backend de click tracking.

---

## Definição de pronto

O MVP está publicável quando:

1. `npm run verify` passa (testes + build, incluindo prerender e validação);
2. `/`, `/categoria/<slug>` e `/produto/<slug>` têm HTML com conteúdo real no
   `dist/`, confirmado abrindo o arquivo gerado;
3. `dist/sitemap.xml` lista todas as URLs de produto;
4. todo link de afiliado tem `rel="sponsored nofollow"` e passa no
   `check-links.js`;
5. aviso de afiliado, aviso de preço de referência e páginas legais presentes;
6. o deploy automático sobe para o domínio e `/produto/<slug>` abre direto por
   URL, sem passar pela home;
7. o Web Analytics registra `outbound_click` ao clicar no CTA.
