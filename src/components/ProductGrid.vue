<script setup>
// Grade de produtos com "carregar mais".
//
// Paginação clássica (números de página) é péssima no celular: 500 produtos dão
// 25 páginas de link. "Carregar mais" mantém o card na tela e estende a lista
// abaixo, que é o que o dedo espera.
import { computed } from 'vue'

import ProductCard from './ProductCard.vue'

const props = defineProps({
  produtos: { type: Array, required: true },
  passo: { type: Number, default: 24 },
})

const visiveis = defineModel('visiveis', { type: Number, default: 0 })

const total = computed(() => props.produtos.length)
const terminou = computed(() => visiveis.value >= total.value)
const mostrados = computed(() => props.produtos.slice(0, visiveis.value))

function mostrarMais() {
  visiveis.value += props.passo
}
</script>

<template>
  <div>
    <p class="sr-only" role="status" aria-live="polite">
      Exibindo {{ mostrados.length }} de {{ total }} produtos
    </p>

    <ul
      v-if="total"
      class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4"
      data-testid="grade-produtos"
    >
      <li v-for="p in mostrados" :key="p.slug">
        <ProductCard :produto="p" />
      </li>
    </ul>

    <div v-else class="rounded-2xl border border-dashed border-slate-800 p-8 text-center">
      <p class="text-4xl" aria-hidden="true">🔍</p>
      <p class="mt-2 font-semibold text-slate-200">Nenhum produto encontrado</p>
      <p class="mt-1 text-sm text-slate-400">
        Tente outra palavra ou escolha uma categoria.
      </p>
    </div>

    <div v-if="!terminou" class="mt-6 flex justify-center">
      <button
        type="button"
        class="min-h-11 rounded-xl border border-slate-700 px-5 text-sm font-bold text-slate-100 transition hover:border-slate-500"
        data-testid="carregar-mais"
        @click="mostrarMais"
      >
        Carregar mais ({{ total - visiveis }} restantes)
      </button>
    </div>
  </div>
</template>