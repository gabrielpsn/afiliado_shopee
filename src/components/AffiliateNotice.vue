<script setup>
// Aviso de afiliado obrigatório (CONAR, Anexo H): a identificação do caráter
// publicitário precisa estar visível onde a decisão acontece, não escondida no
// rodapé. Aparece como barra fixa no mobile, selo no header e texto ao lado do
// CTA de cada card.
defineProps({
  compact: { type: Boolean, default: false },
})
</script>

<template>
  <aside
    class="border-b border-amber-500/30 bg-amber-500/10 text-amber-200"
    :class="compact ? 'px-4 py-2 text-xs' : 'px-4 py-3 text-sm'"
    role="note"
    data-testid="affiliate-notice"
  >
    <p class="mx-auto max-w-5xl">
      <strong class="font-bold">Site de afiliados.</strong>
      Os links abaixo são de afiliado: a compra é concluída na Shopee e você paga
      o mesmo preço. Recebemos uma comissão, sem custo extra para você.
    </p>
  </aside>
</template>