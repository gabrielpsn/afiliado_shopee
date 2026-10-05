<script setup>
// Rodapé: política de privacidade e o aviso de afiliado.
//
// Política e comportamento precisam concordar. Aqui não há login, não há cookie
// de rastreamento e nenhum dado pessoal é coletado — então o texto diz
// exatamente isso. Prometer o que o site não faz (ou esconder o que faz) é o
// jeito mais rápido de perder a confiança de quem lê.
import { SITE } from '../data/site.js'
</script>

<template>
  <footer class="mt-12 border-t border-slate-800 bg-slate-950">
    <div class="mx-auto max-w-5xl space-y-6 px-4 py-10">
      <section>
        <h2 class="text-sm font-bold uppercase tracking-wide text-slate-300">
          Aviso de afiliado
        </h2>
        <p class="mt-2 text-sm text-slate-400">
          Este site participa do programa de afiliados da Shopee. Os links são
          marcados como patrocinados e a compra acontece dentro da Shopee. O
          preço exibido aqui é referência, pode mudar a qualquer momento e a
          confirmação é sempre a da Shopee. Não cobrimos nem alteramos o preço.
        </p>
      </section>

      <section>
        <h2 class="text-sm font-bold uppercase tracking-wide text-slate-300">
          Privacidade
        </h2>
        <p class="mt-2 text-sm text-slate-400">
          Sem cadastro, sem login e sem cookie de rastreamento. Não coletamos
          nome, e-mail nem documento. A única informação registrada é a visita
          agregada, sem identificar você.
        </p>
      </section>

      <section>
        <h2 class="text-sm font-bold uppercase tracking-wide text-slate-300">
          Como o catálogo é mantido
        </h2>
        <p class="mt-2 text-sm text-slate-400">
          Nome, preço e link vêm da exportação de afiliados da Shopee. Produto
          sem foto aparece com placeholder e remete para a Shopee — nunca
          mostramos a foto de outro produto para preencher o lugar.
        </p>
      </section>

      <p class="border-t border-slate-800 pt-6 text-xs text-slate-500">
        {{ SITE.nome }} · {{ SITE.tagline }}
      </p>
    </div>
  </footer>
</template>