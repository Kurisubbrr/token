import { existsSync, renameSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

const outputDirectory = resolve(__dirname, 'subscription-preview-dist')

export default defineConfig({
  base: './',
  publicDir: false,
  plugins: [
    vue(),
    {
      name: 'subscription-preview-index',
      apply: 'build',
      closeBundle() {
        const entry = resolve(outputDirectory, 'subscription-preview.html')
        if (existsSync(entry)) renameSync(entry, resolve(outputDirectory, 'index.html'))
      },
    },
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      'vue-i18n': 'vue-i18n/dist/vue-i18n.runtime.esm-bundler.js',
    },
  },
  define: { __INTLIFY_JIT_COMPILATION__: true },
  build: {
    outDir: outputDirectory,
    emptyOutDir: true,
    sourcemap: false,
    rollupOptions: { input: resolve(__dirname, 'subscription-preview.html') },
  },
  server: { host: '127.0.0.1', port: 4174, strictPort: true },
  preview: { host: '127.0.0.1', port: 4174, strictPort: true },
})
