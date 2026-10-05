<script setup>
// Card de produto. Aparece na home, na categoria e nos relacionados.
//
// Dois links, e a distinção é deliberada:
//
//   - A imagem e o nome vão para a página interna do produto. É o que dá
//     contexto antes de decidir e o que cria os links internos que o buscador
//     precisa para achar as 500 páginas.
//   - O botão vai direto para a Shopee com a atribuição de afiliado. É onde a
//     venda acontece; não faz sentido pôr um passo no meio.
//
// O placeholder não é decoração: a Shopee bloqueia leitura automatizada e a
// exportação de afiliado não traz foto, então a maioria dos produtos entra aqui
// sem imagem. O card assume isso e diz para onde ir, em vez de fingir que tem foto.
import { computed } from 'vue'

import { buildAffiliateLink, REL_AFILIADO, trackOutboundClick } from '../engine/links.js'
import { getCategoria } from '../data/categories.js'
import { formatBRL, isPriceStale } from '../engine/format.js'
import { nomeCurto } from '../engine/busca.js'

const props = defineProps({
  produto: { type: Object, required: true },
})

const categoria = computed(() => getCategoria(props.produto.categoria))
const antique = computed(() => isPriceStale(props.produto))
const href = computed(() => buildAffiliateLink(props.produto))
const interno = computed(() => ({ name: 'produto', params: { slug: props.produto.slug } }))
const temFoto = computed(() => Boolean(props.produto.imagens?.length))
</script>

<template>
  <article
    class="group flex flex-col overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/60 transition hover:border-slate-700"
    data-testid="produto-card"
  >
    <RouterLink :to="interno" class="flex flex-col">
      <img
        v-if="temFoto"
        :src="produto.imagens[0]"
        :alt="produto.nome"
        :width="produto.largura"
        :height="produto.altura"
        loading="lazy"
        decoding="async"
        class="aspect-square w-full object-cover"
      />

      <!--
        Sem foto: bloco honesto com o ícone da categoria. Não é imagem de erro
        genérica — diz o que está faltando e mantém a proporção da foto, para o
        grid não dançar quando as fotos chegarem.
      -->
      <div
        v-else
        class="flex aspect-square w-full flex-col items-center justify-center gap-2 bg-slate-800/60 p-4 text-center"
        data-testid="produto-sem-foto"
      >
        <span class="text-4xl" aria-hidden="true">{{ categoria?.icone ?? '📦' }}</span>
        <span class="text-xs font-medium text-slate-400">Foto na Shopee</span>
      </div>

      <div class="flex flex-1 flex-col gap-1 p-3">
        <p class="text-xs text-slate-500">{{ categoria?.nome }}</p>
        <h3 class="text-sm font-semibold leading-snug text-slate-100 group-hover:text-white">
          {{ nomeCurto(produto.nome) }}
        </h3>

        <p class="mt-1 text-lg font-extrabold text-emerald-400">
          {{ formatBRL(produto.preco) }}
        </p>

        <p class="text-[11px] leading-snug text-slate-500">
          <span v-if="produto.vendas">{{ produto.vendas }} vendidos</span>
          <span v-if="produto.vendas && produto.loja"> · </span>
          <span v-if="produto.loja">{{ produto.loja }}</span>
        </p>

        <p v-if="antique" class="text-[11px] text-amber-400/90">
          Preço antigo — confira na Shopee
        </p>
      </div>
    </RouterLink>

    <!--
      O texto de afiliado fica ao lado do CTA, não escondido no rodapé: é
      requisito do CONAR (Anexo H) e o card é onde a decisão de compra acontece.
    -->
    <div class="mt-auto border-t border-slate-800 p-3">
      <a
        :href="href"
        :rel="REL_AFILIADO"
        target="_blank"
        class="flex min-h-11 w-full items-center justify-center gap-1.5 rounded-xl bg-orange-500 px-3 py-2 text-sm font-bold text-white transition hover:bg-orange-400"
        data-testid="produto-cta"
        @click="trackOutboundClick(produto.slug, 'card-cta')"
      >
        Ver na Shopee
        <span class="sr-only"> — {{ produto.nome }} (link de afiliado)</span>
      </a>
      <p class="mt-1.5 text-center text-[11px] text-slate-500">Link de afiliado</p>
    </div>
  </article>
</template>