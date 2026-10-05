<script setup>
// Navegação por categoria.
//
// No mobile é uma faixa horizontal com rolagem por toque, não um menu que
// esconde as categorias atrás de um hamburger: com 17 categorias, esconder é o
// que faz o visitante desistir. A faixa acompanha a rolagem e o item ativo fica
// marcado, então a posição atual nunca exige memória.
//
// Recebe só as categorias que têm produto. `getCategoriasComContagem()` já
// filtra as vazias — renderizar link para categoria sem produto só projeta um
// clique que volta para uma página vazia.
defineProps({
  categorias: { type: Array, required: true },
  ativaId: { type: String, default: null },
})
</script>

<template>
  <nav aria-label="Categorias" class="border-b border-slate-800 bg-slate-950">
    <ul class="mx-auto flex max-w-5xl gap-2 overflow-x-auto px-4 py-2">
      <li class="shrink-0">
        <RouterLink
          :to="{ name: 'home' }"
          class="flex min-h-11 items-center gap-1.5 rounded-full border px-3 text-sm font-semibold transition"
          :class="
            ativaId === null
              ? 'border-orange-500 bg-orange-500 text-white'
              : 'border-slate-800 bg-slate-900 text-slate-300 hover:border-slate-600'
          "
          :aria-current="ativaId === null ? 'page' : undefined"
          data-testid="categoria-todas"
        >
          <span aria-hidden="true">✨</span>
          Todas
        </RouterLink>
      </li>

      <li v-for="c in categorias" :key="c.id" class="shrink-0">
        <RouterLink
          :to="{ name: 'categoria', params: { id: c.id } }"
          class="flex min-h-11 items-center gap-1.5 rounded-full border px-3 text-sm font-semibold transition"
          :class="
            ativaId === c.id
              ? 'border-orange-500 bg-orange-500 text-white'
              : 'border-slate-800 bg-slate-900 text-slate-300 hover:border-slate-600'
          "
          :aria-current="ativaId === c.id ? 'page' : undefined"
          :data-testid="`categoria-${c.id}`"
        >
          <span aria-hidden="true">{{ c.icone }}</span>
          {{ c.nome }}
          <span class="text-xs opacity-60">{{ c.total }}</span>
        </RouterLink>
      </li>
    </ul>
  </nav>
</template>