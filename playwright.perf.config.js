import base from './playwright.config.js'
import { defineConfig } from '@playwright/test'

// Mediciones de rendimiento (npm run test:perf): un solo trabajador para no falsear tiempos y
// contra la versión de PRODUCCIÓN (build + preview). En desarrollo React va en modo depuración,
// varias veces más lento y con otro reparto de costes: medir ahí lleva a conclusiones erróneas.
export default defineConfig({
  ...base,
  testDir: 'tests/perf',
  workers: 1,
  fullyParallel: false,
  timeout: 180_000,
  webServer: {
    ...base.webServer,
    command: 'npm run build && npx vite preview --port 5199 --strictPort',
    timeout: 120_000,
  },
})
