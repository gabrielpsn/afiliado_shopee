import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  test: {
    // happy-dom é necessário para montar componentes Vue; o engine puro roda em
    // node sem problema, mas mistura os ambientes quebraria o mount.
    environment: 'happy-dom',
    include: ['tests/unit/**/*.test.js'],
    globals: false,
    restoreMocks: true
  }
})
