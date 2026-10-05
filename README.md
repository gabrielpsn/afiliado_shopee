# Loja de Afiliado Shopee

Vitrine de produtos com **preço de referência** e **links de afiliado da Shopee**.
Nenhuma venda é processada aqui: o clique leva ao checkout da Shopee. Sem banco
de dados, sem backend, sem conta de usuário.

Interface em português (pt-BR).

> **Estado atual: Fases 0 e 1 concluídas.** O projeto compila e os testes
> passam, mas o catálogo está vazio — os 90 links foram resolvidos e estão
> aguardando nome, categoria, preço e imagem. Enquanto isso, o build
> **reprova de propósito**. Veja [Cadastrar produtos](#cadastrar-produtos).

## Stack

| Camada | Escolha |
|---|---|
| UI | Vue 3 (`<script setup>`) + `vue-router` (history) |
| Build | Vite 8 |
| Estilo | Tailwind CSS v4 (configuração CSS-first) |
| Dados | Módulos estáticos em `src/data/`, gerados de `data/produtos.csv` |
| SEO | Prerender estático no build (Fase 6) |
| Testes | Vitest + `@vue/test-utils` + `happy-dom`; Playwright p/ E2E e visual |
| Deploy | Cloudflare Worker com assets estáticos (Fase 7) |

## Comandos

```bash
npm install

npm run dev              # servidor de desenvolvimento
npm run build            # build de produção em dist/
npm run preview          # serve o dist/ localmente

npm run test             # testes unitários (Vitest)
npm run test:watch       # testes unitários em watch
npm run test:visual      # E2E com Playwright

npm run links:resolve    # confere se os links curtos continuam vivos
npm run catalog:sync     # data/produtos.csv -> src/data/products.js
npm run validate:catalog # reprova a publicação se o catálogo estiver inconsistente

npm run verify           # test + validate:catalog + build — o gate do CI
```

## Arquitetura

```
src/
├── main.js               ponto de entrada
├── App.vue               shell (placeholders das fases seguintes)
├── style.css             base Tailwind v4 + foco visível
├── data/
│   ├── site.js           nome, url canônica, contato, prazo de preço antigo
│   ├── categories.js     taxonomia (ids usados pelo CSV)
│   └── products.js       GERADO por scripts/from-csv.js
├── engine/               lógica pura, sem Vue e sem DOM
│   ├── format.js         moeda BRL, slug, datas, staleness de preço
│   ├── links.js          link de afiliado, validação, compartilhamento
│   └── catalog.js        leitura do catálogo
└── components/
    └── AffiliateNotice.vue  aviso de afiliado (CONAR Anexo H)

scripts/
├── resolve-links.js      s.shopee.com.br/<código> -> URL real do produto
├── from-csv.js           gera src/data/products.js
└── check-links.js        validação que reprova o build

data/
├── links.txt             os links curtos, um por linha
├── links-resolvidos.csv  saída do resolve-links
└── produtos.csv          O CATÁLOGO. É aqui que se edita.
```

## O link de afiliado

A atribuição de afiliado mora **dentro** da URL (`?sp_atk=`/`?xptdk=`, ou o
código do `s.shopee.com.br/<código>`). Por isso:

- **nunca** se monta a URL de afiliado em componente. Toda URL sai de
  `linkAfiliado`, via `engine/links.js`;
- **nunca** se concatena query string. Reescrever a URL quebra a comissão em
  silêncio, e o problema só aparece no payout;
- todo link sai com `rel="sponsored nofollow"` (`REL_AFILIADO`). O Google exige
  `sponsored` em links de afiliados;
- `isValidAffiliateLink()` recusa domínio que só contém "shopee"
  (`shopee.com.br.evil.com`).

## Cadastrar produtos

O catálogo se edita em **`data/produtos.csv`** (abra no Excel, Google Sheets ou
LibreOffice). Ele usa `;` como separador, que é o padrão do Excel pt-BR — e o
`catalog:sync` detecta `;` ou `,` sozinho, então não quebra se mudar.

| Coluna | Obrigatória | Como preencher |
|---|---|---|
| `linkCurto` | sim | já vem preenchido (`1gJ4vKhJO2`) |
| `nome` | **sim** | nome exato do produto na Shopee |
| `categoria` | **sim** | id de `src/data/categories.js`, ex. `eletronicos` |
| `preco` | **sim** | preço de referência, ex. `129,90` ou `129.90` |
| `precoAntes` | não | preço "de", só se for **maior** que o atual |
| `imagens` | **sim** | URLs separadas por `\|` |
| `tags` | não | separadas por `\|` |
| `destaques` | não | bullets separados por `\|` |
| `descricao` | não | texto, 2–4 parágrafos |
| `avaliacao` / `numAvaliacoes` | não | `4,8` e `1234` |
| `destaque` / `promocao` | não | `sim` / `nao` |
| `ativo` | não | `nao` deixa o produto pronto fora do ar |
| `atualizadoEm` | não | `YYYY-MM-DD`; preenchido sozinho com a data de hoje |

Depois de preencher:

```bash
npm run catalog:sync   # gera src/data/products.js
npm run verify         # valida e compila
```

### De onde vêm as imagens

A Shopee bloqueia leitura automatizada (captcha no HTML e 403 na API), então
**o site não consegue descobrir nome, preço e imagem sozinho** — eles são
digitados por você. Para pegar a URL de uma imagem:

1. abra o produto no app da Shopee;
2. toque na foto principal;
3. toque em **compartilhar → copiar link** (algas versões oferecem "copiar
   endereço da imagem") ou, no navegador, botão direito na foto → **copiar
   endereço da imagem**.

O link começa com `https://down-xx.shopee.com.br/...`. Cole na coluna
`imagens`, separando mais de uma com `|`.

Se as imagens do CDN da Shopee começarem a falhar (a empresa pode mudar o
`Referer` e a imagem não carregar), o caminho é baixar as fotos para
`public/img/` e usar caminho local `/img/nome.webp`. O validador aceita os dois
formatos. O `scripts/fetch-images.js` da Fase 2.1 automatiza a download.

### Por que o build reprova

Um produto só vai para a loja com `nome`, `categoria`, `preco` e `imagens`.
Enquanto faltar algum, `pendente` fica `true`, `getActiveProducts()` o esconde
e `npm run validate:catalog` **falha com código 1**.

Não é burocracia. Nome e preço errados levam o visitante a clicar achando que
compra o produto X e receber o Y, além de exibir preço diferente do real — o que
é problema de consumidor (CDC, art. 6º III), não só de experiência.

**Se faltar dado de um produto, o produto fica de fora. Não se inventa o dado.**

## Links resolvidos

`npm run links:resolve` lê `data/links.txt`, segue o redirecionamento de cada
link curto e grava `data/links-resolvidos.csv` com `itemId`, `shopId` e a URL
pública do produto. Serve para duas coisas:

- descobrir o identificador do produto, usado como slug provisório enquanto o
  nome não vem;
- checar se um link continua vivo antes de publicar.

Os 90 links foram resolvidos com sucesso, todos da loja `opaanlp`.

## Aviso legal

- **Afiliação**: os links são de afiliado. O aviso é visível na página, não
  escondido em rodapé (CONAR, Anexo H). Você paga o mesmo preço.
- **Preço**: sempre exibido como referência, com a data da última conferência.
- **LGPD**: o site não coleta dado pessoal, não tem login e não usa cookie de
  rastreamento. Se o Cloudflare Web Analytics for ligado (Fase 7), a Política
  de Privacidade precisa descrever o uso de dados agregados.
- **Marca**: não usamos o logo da Shopee como marca própria. O texto é
  "checkout na Shopee".
- Preço e disponibilidade são os da Shopee no momento do clique.

## O que falta

| Fase | Conteúdo |
|---|---|
| 2 | Busca, filtros e ordenação (`engine/catalog.js`) e o restante do `engine` |
| 3 | Layout, cabeçalho, rodapé, cards, filtros |
| 4 | Home, categoria, busca, página de produto e páginas legais |
| 5 | Meta por rota, Open Graph, JSON-LD, `sitemap.xml` |
| 6 | Prerender estático no build |
| 7 | Deploy no Cloudflare Worker + Web Analytics |
| 8 | E2E, acessibilidade, Lighthouse, revisão do plano de publicação |

O plano completo, com as decisões e os riscos, está em [`PLAN.md`](./PLAN.md).