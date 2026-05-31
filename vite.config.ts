import { defineConfig } from 'vite'

export default defineConfig({
  base: '/',
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('pdf-lib')) return 'pdf-lib'
          if (id.includes('pdfjs-dist')) return 'pdfjs'
        },
      },
    },
  },
})
