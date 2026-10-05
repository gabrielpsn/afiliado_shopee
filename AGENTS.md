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
| `data/batch/` | exportação bruta da Shopee, só entrada do importador |
| `data/produtos-manuais.csv` | produto adicionado fora do painel; entra no catálogo via importador |
| `data/*.csv` | entrada editorial humana; `src/data/products.js` é gerado |

`engine/` nunca importa de `views/` nem de `components/`. Se um cálculo precisa
de DOM, ele não vai para `engine/`.

## Dados: nunca editar `src/data/products.js` à mão

Ele é gerado por `scripts/from-csv.js` a partir de `data/produtos.csv`.
Editar à mão funciona até a próxima sincronização, e aí o dado some sem aviso.

Fluxo: editar o CSV → `npm run catalog:sync` → `npm run verify`.

O CSV, por sua vez, é gerado por `scripts/importar-batch.js` a partir de
`data/batch/`. Rebaixar a exportação do painel é o único jeito de trazer produto
novo:

```bash
npm run catalog:import   # data/batch/*.csv + produtos-manuais.csv → data/produtos.csv
npm run catalog:sync     # data/produtos.csv → src/data/products.js
npm run verify
```

O importador deduplica por `itemId`: quando o mesmo produto aparece em dois
lotes, vence a **maior comissão** e, no empate, o `Offer Link` em ordem
alfabética. Sem esse desempate o catálogo mudaria conforme a ordem de leitura dos
arquivos e o `git diff` viraria ruído.

## Duas datas que não podem se misturar

| Coluna | Pergunta que responde | Quem escreve |
|---|---|---|
| `adicionadoEm` | desde quando isto está na vitrine | `produto:add`, uma vez; preservada pelo importador |
| `atualizadoEm` | quando o preço foi conferido pela última vez | o importador, a cada `catalog:import` |

Notificar novidade por `atualizadoEm` faria a próxima reimportação marcar os 501
produtos como novos, e a página /novidades viraria cópia da home — sem aviso e
sem erro. Já o contrário também quebra: um produto que já vem no lote continua com a
data original, então o aviso não se move sozinho com o tempo.

`adicionadoEm` só é preenchida uma vez. O importador lê o valor já gravado no
catálogo e reescreve; produto que ainda não tem data recebe a de hoje, que é
verdadeira na primeira importação. O backfill dos produtos anteriores ao campo
usou a data real de entrada (02/10/2026, dia dos lotes), não a data em que a
coluna foi criada.

## Produto fora da exportação do painel

```bash
npm run produto:add -- --link https://s.shopee.com.br/abc123 --nome "Fone Bluetooth" --preco 42,89
npm run catalog:import     # mescla o produto manual no catálogo
npm run verify
```

O comando resolve o link por redirect (301) para tirar `itemId`, `shopId` e
`urlPublica` — não é API, é o mesmo caminho de `resolve-links.js`. Não busca foto:
a Shopee bloqueia leitura automatizada e não libera API sem App ID, então o
produto entra com `semFoto: true` e o placeholder honesto.

O produto vai para `data/produtos-manuais.csv`, **não** para `data/produtos.csv`.
O importador reconstrói o catálogo do zero; gravar direto faria o produto sumir no
próximo `catalog:import` com o build ainda verde. Mesmo motivo do arquivo existir
separado para `ajustes-editoriais.csv`.

O `catalog:sync` sozinho **não** pega produto novo: ele lê `data/produtos.csv`.
Depois do `produto:add`, é `catalog:import` que reconstrói.

A url resolvida fica gravada no arquivo de manuais porque o importador reescreve
`links-resolvidos.csv` do zero. Perder a url faria o produto reprovar o build com
"urlPublica vazia" — sintoma, não causa.

## Regra do produto pendente

Um produto só pode aparecer na loja com `nome`, `categoria`, `preco` e
`linkAfiliado`. Enquanto faltar algum, `pendente` fica `true`,
`getActiveProducts()` o esconde e `scripts/check-links.js` **reprova o build**.

Isso não é burocracia. A Shopee bloqueia leitura automatizada (captcha no HTML,
403 na API), então nome, preço e imagem não podem ser preenchidos
automaticamente. Deduzir nome ou preço levaria o visitante a clicar achando que
compra o produto X e receber o Y, além de exibir preço diferente do real — o que
é problema de consumidor (CDC, art. 6º III), não só de UX.

**Se faltar dado de um produto, o produto fica de fora. Não se inventa o dado.**

### Foto ausente é aviso, não bloqueio

`imagens` vazio **não** reprova o build. A exportação de afiliado não traz foto e
não há como obtê-la sem furar os termos da Shopee; exigir foto deixaria a
vitrine inteira fora do ar. O produto entra com `semFoto: true`, o card e a
página de produto mostram "Foto na Shopee" com o ícone da categoria, e
`check-links.js` reporta o total como aviso.

A distinção é deliberada: **nome, preço e categoria inventados são problema de
consumidor; foto faltando é imprecisão visual.** Um é proibido, o outro é
sinalizado. Quando vier foto, ela entra pelo CSV editorial e o placeholder some
sozinho.

## Categoria é derivada, não digitada

`engine/categorizar.js` classifica pelo nome, de forma determinística, e o
importador grava o resultado no CSV para permitir ajuste manual. Três armadilhas
já custaram produto na prateleira errada:

- **Termo degenerado.** `['po:', MODO_TEXTO]` virava o substring `po` e casava
  com "Polo", "Portátil" e "Polvo". `casa()` rejeita alvo vazio.
- **Variante de acento.** `sabao` e `sabão` normalizam para o mesmo alvo, então a
  segunda linha nunca roda. O teste de duplicatas compara pela chave normalizada.
- **Plural e gênero.** `camiseta` no plural não casa em modo `palavra`, e não dá
  para pluralizar por regra genérica: `camisetas masculinas` precisa cair em moda
  masculina, não na feminina.

A ordem das regras é semântica. `pet` vem antes de `beleza` (shampoo de cachorro
é pet) e `eletronicos` antes de `fitness` (fone gamer de academia é eletrônico).
Mover uma regra mexe no catálogo inteiro — rode `catalog:import` e confira a
distribuição por categoria depois.

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
