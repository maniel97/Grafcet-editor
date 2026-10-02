import base from './playwright.config.js'
import { defineConfig } from '@playwright/test'

// Mediciones de rendimiento (npm run test:perf): un solo trabajador para no falsear tiempos.
export default defineConfig({ ...base, testDir: 'tests/perf', workers: 1, fullyParallel: false, timeout: 180_000 })
