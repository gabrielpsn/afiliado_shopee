import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

export default defineConfig({
  // O site é servido na raiz do domínio. Fixar isso evita que o base mude
  // silenciosamente e quebre os links absolutos das páginas prerenderizadas.
  base: '/',
  plugins: [vue(), tailwindcss()],
})
