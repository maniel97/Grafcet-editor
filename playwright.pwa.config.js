import base from './playwright.config.js'
import { defineConfig } from '@playwright/test'

// Pruebas de la PWA (npm run test:pwa): el service worker solo se registra en la versión
// compilada, así que se prueban contra build + preview (puerto propio).
export default defineConfig({
  ...base,
  testDir: 'tests/pwa',
  workers: 1,
  fullyParallel: false,
  timeout: 120_000,
  use: { ...base.use, baseURL: 'http://localhost:5198' },
  webServer: {
    ...base.webServer,
    command: 'node node_modules/vite/bin/vite.js build && node node_modules/vite/bin/vite.js preview --port 5198 --strictPort',
    url: 'http://localhost:5198',
    timeout: 120_000,
  },
})
