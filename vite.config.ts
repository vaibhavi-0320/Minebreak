import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 2035,
    host: true,
    strictPort: true,
  },
  preview: {
    port: 2035,
    host: true,
  },
  build: {
    target: 'esnext',
    sourcemap: true,
  },
})
