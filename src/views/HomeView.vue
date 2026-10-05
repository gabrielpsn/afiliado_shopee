<script setup>
// Home: todas as categorias, com busca e ordenação.
//
// Busca e ordenação moram na query string, não em estado solto. O motivo é
// concreto: o visitante queachar um produto e compartilhar o link com alguém
// chega na mesma tela, e voltar do navegador não apaga o filtro. Estado em
// variável local resolveria a sessão e perderia o link.
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import CategoryNav from '../components/CategoryNav.vue'
import ProductGrid from '../components/ProductGrid.vue'
import { SITE } from '../data/site.js'
import { getActiveProducts, getCategoriasComContagem } from '../engine/catalog.js'
import { ORDENS, buscarProdutos } from '../engine/busca.js'

const route = useRoute()
const router = useRouter()

const produtos = getActiveProducts()
const categorias = getCategoriasComContagem()

const visiveis = ref(24)

const busca = computed(() => String(route.query.q ?? ''))
const ordem = computed(() => String(route.query.ordem ?? 'relevancia'))

const resultados = computed(() =>
  buscarProdutos(produtos, { busca: busca.value, ordem: ordem.value })
)

// Mudou o filtro, a lista voltou ao topo: manter 24 visíveis sobre um resultado
// novo esconderia o que a pessoa acabou de pedir.
watch([busca, ordem], () => {
  visiveis.value = 24
})

function mudarOrdem(evento) {
  const valor = evento.target.value
  router.replace({
    name: 'home',
    query: { ...route.query, ordem: valor === 'relevancia' ? undefined : valor },
  })
}
</script>

<template>
  <div>
    <CategoryNav :categorias="categorias" :ativa-id="null" />

    <main class="mx-auto w-full max-w-5xl px-4 py-6">
      <section class="mb-6">
        <h1 class="text-2xl font-extrabold leading-tight text-slate-50">
          {{ SITE.nome }}
        </h1>
        <p class="mt-1 text-sm text-slate-400">{{ SITE.tagline }}</p>
      </section>

      <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p class="text-sm text-slate-400" role="status" aria-live="polite">
          <template v-if="busca">
            {{ resultados.length }} resultado(s) para <strong class="text-slate-200">"{{ busca }}"</strong>
          </template>
          <template v-else>
            {{ produtos.length }} produtos
          </template>
        </p>

        <div class="flex items-center gap-2">
          <label for="ordem" class="text-sm text-slate-400">Ordenar</label>
          <select
            id="ordem"
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