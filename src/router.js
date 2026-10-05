// Rotas da vitrine.
//
// Tudo é `import.meta.glob` eager para que o bundle do cliente já venha com as
// páginas: são cinco arquivos e o conteúdo é o mesmo que o servidor renderiza,
// então dividir em chunk só adicionaria uma ida ao rede no 3G.
//
// `vue-router` em modo `history` exige que o servidor sirva `index.html` para
// qualquer URL desconhecida. Isso é papel do Worker, não deste arquivo.

import { createRouter, createWebHistory } from 'vue-router'

import HomeView from './views/HomeView.vue'
import NovidadesView from './views/NovidadesView.vue'
import CategoryView from './views/CategoryView.vue'
import ProductView from './views/ProductView.vue'
import NotFoundView from './views/NotFoundView.vue'

export const routes = [
  { path: '/', name: 'home', component: HomeView },
  { path: '/novidades', name: 'novidades', component: NovidadesView },
  { path: '/categoria/:id', name: 'categoria', component: CategoryView },
  { path: '/produto/:slug', name: 'produto', component: ProductView },
  { path: '/:pathMatch(.*)*', name: 'nao-encontrado', component: NotFoundView },
]

export function createAppRouter() {
  return createRouter({
    history: createWebHistory(),
    routes,
    scrollBehavior(para, de, guardada) {
      if (guardada) return guardada
      if (para.hash) return { el: para.hash }
      // Trocar de categoria volta ao topo; sem isto a pessoa cai no meio da
      // próxima lista, com a rolagem preservada da anterior.
      return { top: 0 }
    },
  })
}