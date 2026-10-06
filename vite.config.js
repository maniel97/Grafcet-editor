import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
import { thirdPartyLicensesPlugin } from './scripts/thirdPartyLicenses.mjs'

// https://vite.dev/config/
export default defineConfig({
  // THIRD-PARTY-LICENSES.txt: licencias de las librerías incluidas (scripts/thirdPartyLicenses.mjs).
  plugins: [react(), tailwindcss(), thirdPartyLicensesPlugin()],
  // Dependencias: solo desde la aplicación (no desde dist-portable/grafcet-editor.html, que lleva
  // todo el código incrustado y el analizador de Vite no lo admite).
  optimizeDeps: { entries: ['index.html'] },
  // Rutas relativas: la compilación funciona igual en la raíz de un dominio que en una subcarpeta
  // (GitHub Pages publica en https://usuario.github.io/<repositorio>/).
  base: './',
  // Número de esta compilación: identifica la versión del service worker (lib/pwa.js).
  define: { 'import.meta.env.BUILD_ID': JSON.stringify(Date.now().toString(36)) },
  // PERF_NO_MINIFY=1: compilación sin minimizar, para que los perfiles de CPU muestren nombres reales.
  // asset-manifest.json: lista de archivos que el service worker guarda para funcionar sin conexión.
  build: process.env.PORTABLE
    ? // Versión portable (scripts/build-portable.mjs): un solo paquete, recursos como datos.
      {
        outDir: 'dist-portable',
        // Un solo archivo con todo: grande a propósito.
        chunkSizeWarningLimit: 6000,
        assetsInlineLimit: () => true,
        cssCodeSplit: false,
        modulePreload: false,
        rollupOptions: { output: { inlineDynamicImports: true } },
      }
    : {
        manifest: 'asset-manifest.json',
        // El bloque principal (React + React Flow) ronda 1 MB; lo que se carga bajo demanda va aparte.
        chunkSizeWarningLimit: 1600,
        ...(process.env.PERF_NO_MINIFY ? { minify: false } : {}),
      },
  // Pruebas unitarias (npm test). Las de navegador van aparte con Playwright (tests/e2e).
  test: {
    include: ['tests/unit/**/*.test.js'],
    // Guarda en disco el código ya transformado: las siguientes ejecuciones arrancan antes.
    fsModuleCache: true,
  },
})
