import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'XQDocViewer',
      formats: ['iife'],
      fileName: () => 'xq-doc-viewer.iife.js',
    },
    outDir: 'dist',
    emptyOutDir: false,
  },
})
