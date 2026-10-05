<script setup>
// Página de produto.
//
// Uma rota por produto seria o ideal para SEO, mas com 500 páginas e o catálogo
// importando de um CSV, `/produto/<slug>` mantém o build em um passo e uma única
// fonte de verdade (o CSV). O slug continua descritivo e o canonical aponta para
// ela.
import { computed, watchEffect } from 'vue'
import { useRoute } from 'vue-router'

import ProductCard from '../components/ProductCard.vue'
import FotoAusente from '../components/FotoAusente.vue'
import { SITE } from '../data/site.js'
import { getCategoria } from '../data/categories.js'
import {
  getProductBySlug,
  getActiveProducts,
  getRelacionados,
} from '../engine/catalog.js'
import {
  buildAffiliateLink,
  REL_AFILIADO,
  trackOutboundClick,
} from '../engine/links.js'
import { formatBRL, formatarData, isPriceStale } from '../engine/format.js'

const route = useRoute()

const produto = computed(() => getProductBySlug(String(route.params.slug ?? '')))
const categoria = computed(() => (produto.value ? getCategoria(produto.value.categoria) : null))
const relacionados = computed(() => getRelacionados(produto.value))
const href = computed(() => (produto.value ? buildAffiliateLink(produto.value) : null))
const antique = computed(() => (produto.value ? isPriceStale(produto.value) : false))
const temFoto = computed(() => Boolean(produto.value?.imagens?.length))

const titulo = computed(() =>
  produto.value ? `${produto.value.nome} — ${SITE.nome}` : `Produto não encontrado — ${SITE.nome}`
)

const total = computed(() => getActiveProducts().length)

// `document` não existe durante o prerender do build, e o título também é
// sobrescrito pelo SEO helper lá. O guard evita ReferenceError sem desligar o
// SEO no navegador.
watchEffect(() => {
  if (typeof document !== 'undefined') document.title = titulo.value
})
</script>

<template>
  <main class="mx-auto w-full max-w-5xl px-4 py-6">
    <template v-if="!produto">
      <h1 class="text-2xl font-extrabold text-slate-50">Produto não encontrado</h1>
      <p class="mt-2 text-sm text-slate-400">
        O produto pode ter saído do catálogo. Veja o que há hoje.
      </p>
      <RouterLink
        :to="{ name: 'home' }"
        class="mt-6 inline-flex min-h-11 items-center rounded-xl bg-orange-500 px-4 font-bold text-white"
      >
        Ver todos os {{ total }} produtos
      </RouterLink>
    </template>

    <template v-else>
      <nav aria-label="Você está em" class="text-sm text-slate-500">
        <RouterLink :to="{ name: 'home' }" class="hover:text-slate-300">Todas</RouterLink>
        <span aria-hidden="true"> / </span>
        <RouterLink
          :to="{ name: 'categoria', params: { id: produto.categoria } }"
          class="hover:text-slate-300"
        >
          {{ categoria?.nome }}
        </RouterLink>
      </nav>

      <h1 class="mt-2 text-xl font-extrabold leading-snug text-slate-50">
        {{ produto.nome }}
      </h1>

      <div class="mt-4 grid gap-4 sm:grid-cols-2">
        <img
          v-if="temFoto"
          :src="produto.imagens[0]"
          :alt="produto.nome"
          :width="produto.largura"
          :height="produto.altura"
          class="aspect-square w-full rounded-2xl object-cover"
        />
        <FotoAusente v-else :produto="produto" detalhado />

        <div class="flex flex-col">
          <p class="text-3xl font-extrabold text-emerald-400">
            {{ formatBRL(produto.preco) }}
          </p>
          <p class="mt-1 text-sm text-slate-400">
            Preço de referência, conferido em {{ formatarData(produto.atualizadoEm) }}.
            O preço final é o da Shopee.
          </p>

          <p v-if="antique" class="mt-2 rounded-lg bg-amber-500/10 px-3 py-2 text-sm text-amber-300">
            Este preço pode estar velho. Confira na Shopee antes de decidir.
          </p>

          <dl class="mt-4 space-y-1 text-sm text-slate-400">
            <div v-if="produto.vendas" class="flex gap-2">
              <dt class="text-slate-500">Vendas</dt>
              <dd>{{ produto.vendas }}</dd>
            </div>
            <div v-if="produto.loja" class="flex gap-2">
              <dt class="text-slate-500">Vendido por</dt>
              <dd class="truncate">{{ produto.loja }}</dd>
            </div>
            <div v-if="categoria" class="flex gap-2">
              <dt class="text-slate-500">Categoria</dt>
              <dd>{{ categoria.nome }}</dd>
            </div>
          </dl>

          <div class="mt-5">
            <a
              :href="href"
              :rel="REL_AFILIADO"
              target="_blank"
              class="flex min-h-12 w-full items-center justify-center rounded-xl bg-orange-500 px-4 text-base font-extrabold text-white transition hover:bg-orange-400"
              data-testid="produto-cta"
              @click="trackOutboundClick(produto.slug, 'detalhe')"
            >
              Ver na Shopee
            </a>
            <p class="mt-2 text-center text-xs text-slate-500">
              Link de afiliado. Você paga o mesmo preço; nós recebemos comissão.
            </p>
          </div>
        </div>
      </div>

      <section v-if="relacionados.length" class="mt-12">
        <h2 class="mb-3 text-lg font-bold text-slate-100">
          Também em {{ categoria?.nome ?? 'outras categorias' }}
        </h2>
        <ul class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          <li v-for="p in relacionados" :key="p.slug">
            <ProductCard :produto="p" />
          </li>
        </ul>
      </section>
    </template>
  </main>
</template>

