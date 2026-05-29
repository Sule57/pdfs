import { defineConfig } from 'vite'

const crossOriginHeaders = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
}

export default defineConfig({
  base: '/',
  server: {
    headers: crossOriginHeaders,
  },
  preview: {
    headers: crossOriginHeaders,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('pdf-lib')) return 'pdf-lib'
          if (id.includes('jszip')) return 'jszip'
          if (id.includes('libreoffice-converter')) return 'converter-wasm'
        },
      },
    },
  },
})
