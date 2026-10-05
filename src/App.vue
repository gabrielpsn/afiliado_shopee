<script setup>
// Casca da aplicação: header, área de conteúdo e rodapé.
//
// A barra de afiliado é fixa no mobile e some depois do primeiro scroll. O
// objetivo é ocupar o começo da tela (é requisito do CONAR) sem comer 60 px de
// uma viewport de 844 px pelo resto da navegação.
import { onMounted, onUnmounted, ref } from 'vue'

import AffiliateNotice from './components/AffiliateNotice.vue'
import SiteHeader from './components/SiteHeader.vue'
import SiteFooter from './components/SiteFooter.vue'

const rolou = ref(false)

function aoRolar() {
  rolou.value = window.scrollY > 120
}

onMounted(() => {
  aoRolar()
  window.addEventListener('scroll', aoRolar, { passive: true })
})

onUnmounted(() => window.removeEventListener('scroll', aoRolar))
</script>

<template>
  <a
    href="#conteudo"
    class="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-orange-500 focus:px-4 focus:py-2 focus:font-bold focus:text-white"
  >
    Pular para o conteúdo
  </a>

  <SiteHeader />

  <!-- some ao rolar para devolver altura, mas volta se a pessoa subir -->
  <div :class="rolou ? 'hidden' : 'block'">
    <AffiliateNotice />
  </div>

  <div id="conteudo">
    <RouterView />
  </div>

  <SiteFooter />
</template>