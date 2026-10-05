<script setup>
// Placeholder único para produto sem foto.
//
// Existe porque a foto não pôde ser obtida: a exportação de afiliado da Shopee
// não traz imagem e a plataforma bloqueia leitura automatizada (403 na API,
// captcha no HTML). Deduzir ou reaproveitar outra imagem seria pior que admitir
// a ausência.
//
// Compartilhado por card e página de produto para os dois dizerem exatamente a
// mesma coisa. Se este texto mudar, muda nos dois lugares.
import { computed } from 'vue'

import { getCategoria } from '../data/categories.js'
import { urlArteCategoria } from '../engine/arte-categoria.js'

const props = defineProps({
  produto: { type: Object, required: true },
  // A página de produto tem espaço para explicar; o card, só para avisar.
  detalhado: { type: Boolean, default: false },
})

const categoria = computed(() => getCategoria(props.produto.categoria))
const arte = computed(() => urlArteCategoria(props.produto.categoria))
</script>

<template>
  <div
    class="relative flex aspect-square w-full flex-col items-center justify-center gap-2 overflow-hidden p-4 text-center"
    :style="{ backgroundImage: arte }"
    data-testid="produto-sem-foto"
  >
    <!--
      O véu escurece a arte para o emoji e o texto ficarem legíveis sobre o
      degradê mais claro sem depender de uma segunda cor por categoria.
    -->
    <div class="absolute inset-0 bg-slate-950/45" aria-hidden="true" />

    <span
      class="relative text-5xl drop-shadow"
      :class="detalhado && 'text-7xl'"
      aria-hidden="true"
    >{{ categoria?.icone ?? '📦' }}</span>

    <p
      class="relative max-w-[22ch] text-xs font-semibold text-white/90"
      :class="detalhado && 'text-base'"
    >
      {{ detalhado ? 'Foto do produto na Shopee' : 'Foto na Shopee' }}
    </p>

    <p v-if="detalhado" class="relative max-w-xs text-sm text-white/70">
      Não conseguimos trazer a foto para cá. O botão abaixo abre o anúncio com as
      imagens, o preço e as opções de tamanho.
    </p>
  </div>
</template>
