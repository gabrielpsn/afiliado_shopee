<script setup>
import { SITE } from './data/site.js'
import { getAllProducts, getActiveProducts } from './engine/catalog.js'
import AffiliateNotice from './components/AffiliateNotice.vue'

const total = getAllProducts().length
const ativos = getActiveProducts().length
const pendentes = total - ativos
</script>

<template>
  <AffiliateNotice />

  <main class="mx-auto w-full max-w-5xl px-4 py-12">
    <h1 class="text-3xl font-extrabold">{{ SITE.nome }}</h1>
    <p class="mt-2 text-slate-400">{{ SITE.tagline }}</p>

    <!--
      Placeholder da Fase 0. A vitrine real (views e componentes) entra na
      Fase 3 e Fase 4; aqui só precisamos provar que o build, o Tailwind e o
      catálogo estão de pé.
    -->
    <section class="mt-8 rounded-2xl border border-slate-800 bg-slate-900/50 p-6">
      <h2 class="text-lg font-bold">Estado do catálogo</h2>
      <dl class="mt-4 grid grid-cols-3 gap-4 text-center">
        <div class="rounded-xl bg-slate-950 p-4">
          <dt class="text-xs uppercase tracking-wide text-slate-500">No catálogo</dt>
          <dd class="mt-1 text-2xl font-extrabold">{{ total }}</dd>
        </div>
        <div class="rounded-xl bg-slate-950 p-4">
          <dt class="text-xs uppercase tracking-wide text-slate-500">Publicados</dt>
          <dd class="mt-1 text-2xl font-extrabold text-emerald-400">{{ ativos }}</dd>
        </div>
        <div class="rounded-xl bg-slate-950 p-4">
          <dt class="text-xs uppercase tracking-wide text-slate-500">Pendentes</dt>
          <dd class="mt-1 text-2xl font-extrabold text-amber-400">{{ pendentes }}</dd>
        </div>
      </dl>
      <p class="mt-4 text-sm text-slate-400">
        Preencha <code class="text-slate-200">data/produtos.csv</code> e rode
        <code class="text-slate-200">npm run catalog:sync</code> para publicar.
      </p>
    </section>
  </main>
</template>
