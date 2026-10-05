<script setup>
// Página de categoria. A diferença para a home é o contexto: título, descrição e
// o total da categoria, para a pessoa saber o que encontrou antes de rolar.
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import CategoryNav from '../components/CategoryNav.vue'
import ProductGrid from '../components/ProductGrid.vue'
import { getActiveProducts, getCategoriasComContagem } from '../engine/catalog.js'
import { getCategoria } from '../data/categories.js'
import { ORDENS, buscarProdutos } from '../engine/busca.js'

const route = useRoute()
const router = useRouter()

const produtos = getActiveProducts()
const categorias = getCategoriasComContagem()

const visiveis = ref(24)

const id = computed(() => String(route.params.id ?? ''))
const categoria = computed(() => getCategoria(id.value))

const busca = computed(() => String(route.query.q ?? ''))
const ordem = computed(() => String(route.query.ordem ?? 'relevancia'))

const resultados = computed(() =>
  buscarProdutos(produtos, {
    busca: busca.value,
    categoria: id.value,
    ordem: ordem.value,
  })
)

watch([id, busca, ordem], () => {
  visiveis.value = 24
})

function mudarOrdem(evento) {
  const valor = evento.target.value
  router.replace({
    name: 'categoria',
    params: { id: id.value },
    query: { ...route.query, ordem: valor === 'relevancia' ? undefined : valor },
  })
}
</script>

<template>
  <div>
    <CategoryNav :categorias="categorias" :ativa-id="id" />

    <main class="mx-auto w-full max-w-5xl px-4 py-6">
      <template v-if="categoria">
        <nav aria-label="Você está em" class="text-sm text-slate-500">
          <RouterLink :to="{ name: 'home' }" class="hover:text-slate-300">Todas</RouterLink>
          <span aria-hidden="true"> / </span>
          <span class="text-slate-300">{{ categoria.nome }}</span>
        </nav>

        <h1 class="mt-1 text-2xl font-extrabold leading-tight text-slate-50">
          <span aria-hidden="true">{{ categoria.icone }}</span>
          {{ categoria.nome }}
        </h1>
        <p class="mt-1 text-sm text-slate-400">{{ categoria.descricao }}</p>
      </template>

      <div class="mb-4 mt-6 flex flex-wrap items-center justify-between gap-3">
        <p class="text-sm text-slate-400" role="status" aria-live="polite">
          {{ resultados.length }} produto(s)
          <span v-if="busca"> para "{{ busca }}"</span>
        </p>

        <div class="flex items-center gap-2">
          <label for="ordem-categoria" class="text-sm text-slate-400">Ordenar</label>
          <select
            id="ordem-categoria"
            :value="ordem"
            class="min-h-11 rounded-xl border border-slate-800 bg-slate-900 px-3 text-sm text-slate-100"
            data-testid="seletor-ordem"
            @change="mudarOrdem"
          >
            <option v-for="o in ORDENS" :key="o.id" :value="o.id">{{ o.rotulo }}</option>
          </select>
        </div>
      </div>

      <ProductGrid v-model:visiveis="visiveis" :produtos="resultados" />
    </main>
  </div>
</template>