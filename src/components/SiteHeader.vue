<script setup>
// Header com o selo de afiliado e o campo de busca.
//
// A busca fica no header em vez de em uma barra separada porque no mobile ela é
// a forma mais rápida de chegar no produto: digitar "fone" é mais barato que
// rolar 400 cards. O campo é um formulário de verdade (submit) para funcionar
// com Enter mesmo sem o JavaScript do roteador.
import { ref } from 'vue'
import { useRouter } from 'vue-router'

import { SITE } from '../data/site.js'
import { getActiveProducts } from '../engine/catalog.js'
import { contarNovidades } from '../engine/novidades.js'

const termo = ref('')
const router = useRouter()

const novidades = contarNovidades(getActiveProducts())

function buscar() {
  const q = termo.value.trim()
  router.push(q ? { name: 'home', query: { q } } : { name: 'home' })
}
</script>

<template>
  <header class="sticky top-0 z-30 border-b border-slate-800 bg-slate-950/90 backdrop-blur">
    <div class="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
      <RouterLink :to="{ name: 'home' }" class="min-w-0 shrink-0">
        <span class="block text-base font-extrabold leading-tight text-slate-100">
          {{ SITE.nome }}
        </span>
        <span
          class="mt-0.5 inline-block rounded-full border border-amber-500/40 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-300"
          data-testid="header-affiliate-badge"
        >
          Afiliado
        </span>
      </RouterLink>

      <!-- O selo só aparece com produto novo dentro da janela. Contagem alta
           significa catálogo recém-publicado, não novelty: o cap em 99 evita
           o header gritar "500 novos" quando é o site inteiro. -->
      <RouterLink
        v-if="novidades"
        :to="{ name: 'novidades' }"
        class="flex min-h-11 shrink-0 items-center gap-1 rounded-xl border border-emerald-500/40 px-3 text-sm font-bold text-emerald-300 transition hover:bg-emerald-500/10"
        :aria-label="`Novidades: ${novidades} produto(s) novo(s)`"
        data-testid="badge-novidades"
      >
        <span aria-hidden="true">✨</span>
        <span>{{ novidades > 99 ? '99+' : novidades }}</span>
      </RouterLink>

      <form class="ml-auto flex min-w-0 flex-1 items-center gap-2" role="search" @submit.prevent="buscar">
        <label class="sr-only" for="busca">Buscar produto</label>
        <input
          id="busca"
          v-model="termo"
          type="search"
          inputmode="search"
          placeholder="Buscar produto"
          class="min-h-11 w-full min-w-0 rounded-xl border border-slate-800 bg-slate-900 px-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-slate-600"
          data-testid="campo-busca"
        />
        <button
          type="submit"
          class="min-h-11 shrink-0 rounded-xl bg-slate-800 px-3 text-sm font-bold text-slate-100 transition hover:bg-slate-700"
        >
          Buscar
        </button>
      </form>
    </div>
  </header>
</template>