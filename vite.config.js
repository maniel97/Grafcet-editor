import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Pruebas unitarias (npm test). Las de navegador van aparte con Playwright (tests/e2e).
  test: {
    include: ['tests/unit/**/*.test.js'],
  },
})
