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
  // Navegadores a la vez: la mitad de los hilos del equipo (12 en un Ryzen 9 5900X, 2 en GitHub);
  // PW_WORKERS para probar otro número.
  workers: Number(process.env.PW_WORKERS) || process.env.PW_WORKERS || '50%',
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${PORT}`,
    viewport: { width: 1500, height: 950 },
    acceptDownloads: true,
    // Sin service worker (la versión compilada lo registra): cada prueba, con la página recién servida.
    serviceWorkers: 'block',
    launchOptions: executablePath ? { executablePath } : {},
  },
  // Servidor propio para las pruebas: la versión compilada (lo mismo que se publica, y mucho más
  // rápida de servir a varios navegadores que el servidor de desarrollo); se cierra al terminar.
  webServer: {
    // Vite directamente con node (sin npm/npx): así no se imprime el aviso «npm warn ... allow-scripts»
    // de la configuración global de npm en cada arranque.
    command: `node node_modules/vite/bin/vite.js build && node node_modules/vite/bin/vite.js preview --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    timeout: 60_000,
  },
})
