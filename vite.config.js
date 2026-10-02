import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Rutas relativas: la compilación funciona igual en la raíz de un dominio que en una subcarpeta
  // (GitHub Pages publica en https://usuario.github.io/<repositorio>/).
  base: './',
  // PERF_NO_MINIFY=1: compilación sin minimizar, para que los perfiles de CPU muestren nombres reales.
  build: process.env.PERF_NO_MINIFY ? { minify: false } : undefined,
  // Pruebas unitarias (npm test). Las de navegador van aparte con Playwright (tests/e2e).
  test: {
    include: ['tests/unit/**/*.test.js'],
  },
})
