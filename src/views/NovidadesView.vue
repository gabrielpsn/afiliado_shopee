<script setup>
// Novidades: o que entrou na vitrine na última semana.
//
// Existe uma página e não só um selo porque o selo some depois de sete dias. Quem
// assina o feed recebe no leitor; quem abre o site precisa de um lugar para ver
// o que entrou sem precisar saber a data.
//
// A janela vem de `novidades.js`, o mesmo módulo do badge e do feed. Três lugares
// com regras diferentes fariam o visitante ver "novo" no card e não aparecer na
// lista.
import { computed, ref } from 'vue'

import ProductGrid from '../components/ProductGrid.vue'
import { SITE } from '../data/site.js'
import { getActiveProducts } from '../engine/catalog.js'
import { DIAS_NOVIDADE, getNovidades } from '../engine/novidades.js'

const produtos = getActiveProducts()

// O limite padrão de 30 existe para o RSS. A página não pode herdar esse teto: o
// grid já pagina com "carregar mais", e truncando aqui ela anunciaria "501
// entraram" para mostrar 30 e nunca revelaria o resto.
const novidades = computed(() => getNovidades(produtos, { limite: Number.MAX_SAFE_INTEGER }))
const total = computed(() => novidades.value.length)

// ProductGrid começa em zero e cresce com o botão. Sem isto a página abriria
// vazia, porque o grid não tem valor inicial próprio.
const visiveis = ref(24)
</script>

<template>
  <main class="mx-auto w-full max-w-5xl px-4 py-6">
    <section class="mb-6">
      <h1 class="text-2xl font-extrabold leading-tight text-slate-50">Novidades</h1>
      <p class="mt-1 text-sm text-slate-400">
        <template v-if="total">
          {{ total }} produto(s) entraram na vitrine nos últimos {{ DIAS_NOVIDADE }} dias.
        </template>
        <template v-else>
          Nada novo nos últimos {{ DIAS_NOVIDADE }} dias. O catálogo inteiro está na
          <RouterLink :to="{ name: 'home' }" class="underline hover:text-slate-200">página inicial</RouterLink>.
        </template>
      </p>
    </section>

    <!-- Feed sem cadastro, e-mail nem cookie: o aviso chega pelo leitor do
         visitante, e o site segue sem coletar nada sobre ele. -->
    <section
      v-if="total"
      class="mb-6 rounded-xl border border-slate-800 bg-slate-900/60 p-4"
      aria-labelledby="titulo-feed"
    >
      <h2 id="titulo-feed" class="text-sm font-bold text-slate-100">Quer ser avisado?</h2>
      <p class="mt-1 text-sm text-slate-400">
        Assine o feed e receba no seu leitor quando entrar produto novo. Sem cadastro e sem
        e-mail: o aviso vem pelo leitor que você já usa.
      </p>
      <a
        :href="`${SITE.url}/feed.xml`"
        class="mt-3 inline-flex min-h-11 items-center rounded-xl bg-slate-800 px-4 text-sm font-bold text-slate-100 transition hover:bg-slate-700"
        data-testid="link-feed"
      >
        Assinar o feed
      </a>
    </section>

    <ProductGrid v-if="total" v-model:visiveis="visiveis" :produtos="novidades" />
  </main>
</template>
