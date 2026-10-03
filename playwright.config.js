import { existsSync } from 'node:fs'
import { defineConfig } from '@playwright/test'

// Pruebas de navegador (npm run test:e2e). Usan un navegador Chromium ya instalado en el equipo
// (Brave, Chrome o Edge) para no tener que descargar uno; se puede forzar otro con
// PW_BROWSER_PATH. Si no hay ninguno: `npx playwright install chromium`.
const CANDIDATES = [
  process.env.PW_BROWSER_PATH,
  'C:/Program Files/BraveSoftware/Brave-Browser/Application/brave.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
]
const executablePath = CANDIDATES.find((p) => p && existsSync(p))
const PORT = 5199

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  fullyParallel: true,
  workers: 3,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${PORT}`,
    viewport: { width: 1500, height: 950 },
    acceptDownloads: true,
    launchOptions: executablePath ? { executablePath } : {},
  },
  // Servidor propio para las pruebas: se arranca limpio y se cierra al terminar.
  webServer: {
    // Vite directamente con node (sin npm/npx): así no se imprime el aviso «npm warn ... allow-scripts»
    // de la configuración global de npm en cada arranque.
    command: `node node_modules/vite/bin/vite.js --port ${PORT} --strictPort --force`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    timeout: 60_000,
  },
})
