<script setup>
import { SITE } from '../data/site.js'
import { getActiveProducts } from '../engine/catalog.js'

const total = getActiveProducts().length
</script>

<template>
  <main class="mx-auto w-full max-w-5xl px-4 py-10 text-center">
    <p class="text-5xl" aria-hidden="true">🧭</p>
    <h1 class="mt-3 text-2xl font-extrabold text-slate-50">Página não encontrada</h1>
    <p class="mx-auto mt-2 max-w-md text-sm text-slate-400">
      O endereço não existe ou mudou. Dê uma olhada nas {{ total }} produtos de
      {{ SITE.nome }}.
    </p>
    <RouterLink
      :to="{ name: 'home' }"
      class="mt-6 inline-flex min-h-11 items-center rounded-xl bg-orange-500 px-4 font-bold text-white"
    >
      Ir para a vitrine
    </RouterLink>
  </main>
</template>