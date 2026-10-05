# AGENTS.md

Convenções deste repositório. Vale para qualquer trabalho aqui.

## Idioma

Interface, comentários, nomes de teste e commit em **pt-BR**. Código e
identificadores em inglês/pt sem acento.

## Stack

Vue 3 (`<script setup>`) + Vite 8 + Tailwind CSS v4 (configuração CSS-first,
sem `tailwind.config.js`). Sem TypeScript. Sem estado global: os dados são
módulos estáticos em `src/data/` e a lógica pura mora em `src/engine/`.

## Onde cada coisa mora

| Caminho | Responsabilidade |
|---|---|
| `src/data/` | **fonte de verdade**. Editável, versionada, sem lógica |
| `src/engine/` | funções puras, sem import de Vue e sem DOM, 100% testadas |
| `src/views/` | uma rota por arquivo |
| `src/components/` | peças reutilizáveis |
| `scripts/` | ferramenta de linha de comando, roda fora do Vite |
| `data/*.csv` | entrada editorial humana; `src/data/products.js` é gerado |

`engine/` nunca importa de `views/` nem de `components/`. Se um cálculo precisa
de DOM, ele não vai para `engine/`.

## Dados: nunca editar `src/data/products.js` à mão

Ele é gerado por `scripts/from-csv.js` a partir de `data/produtos.csv`.
Editar à mão funciona até a próxima sincronização, e aí o dado some sem aviso.

Fluxo: editar o CSV → `npm run catalog:sync` → `npm run verify`.

## Regra do produto pendente

Um produto só pode aparecer na loja com `nome`, `categoria`, `preco` e
`imagens`. Enquanto faltar algum, `pendente` fica `true`, `getActiveProducts()`
o esconde e `scripts/check-links.js` **reprova o build**.

Isso não é burocracia. A Shopee bloqueia leitura automatizada (captcha no HTML,
403 na API), então nome, preço e imagem não podem ser preenchidos
automaticamente. Deduzir nome ou preço levaria o visitante a clicar achando que
compra o produto X e receber o Y, além de exibir preço diferente do real — o que
é problema de consumidor (CDC, art. 6º III), não só de UX.

**Se faltar dado de um produto, o produto fica de fora. Não se inventa o dado.**

## Link de afiliado

- Fonte única: `linkAfiliado` em `data/produtos.csv`. Nunca montar a URL em
  componente — sempre via `engine/links.js`.
- Nunca concatenar query string. A atribuição mora dentro da URL
  (`?sp_atk=`/`?xptdk=`/código do `s.shopee.com.br`). Reescrever a URL quebra a
  comissão em silêncio.
- Todo link de afiliado leva `rel="sponsored nofollow"` (`REL_AFILIADO`).
- `isValidAffiliateLink()` barra domínio que só contém "shopee".

## Conformidade

Requisitos de aceite, não polimento:

- Aviso de afiliado visível (CONAR, Anexo H): barra fixa no mobile, selo no
  header, texto ao lado de todo CTA.
- Preço sempre como **referência**, com a data da última conferência. Bloco
  `isPriceStale()` para sinalizar preço velho.
- Nada de prometer desconto inexistente. Cupom só entra se a Shopee fornecer.
- Política de Privacidade coerente com o comportamento: sem login, sem dado
  pessoal, sem cookie de rastreamento.

## Estilo

- Mobile-first. Alvo de toque mínimo de 44px.
- Um `<h1>` por página, sem pular nível.
- Toda imagem com `alt` descritivo e `width`/`height` (CLS).
- Foco visível vem de `src/style.css`, não de classe solta.
- Comentário explica **por quê**, nunca o óbvio. Prefira código claro a
  comentário.

## Antes de concluir

```bash
npm run verify
```

É o mesmo gate do CI: testes, validação do catálogo e build. Se `verify`
falhar porque há produto pendente, **o build está certo** — o catálogo é que
ainda não está pronto. Não contorne desligando o produto ou o validador.

Teste novo entra em `tests/unit/`. E2E e visual em `tests/e2e/`.
