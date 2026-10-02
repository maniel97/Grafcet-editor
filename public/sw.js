// Service worker de Grafcet Editor: la aplicación funciona sin conexión.
// - Instalación: guarda en caché todos los archivos de la compilación (la lista sale de
//   asset-manifest.json, que genera Vite), también las partes que se cargan bajo demanda.
// - Peticiones (sin mirar «Vary»: los archivos son estáticos y con huella): la página, primero de la red (para tener la última versión) y si no hay conexión
//   de la caché; el resto de archivos (con huella en el nombre), primero de la caché.
// - Actualización: cada compilación se registra con su número (sw.js?build=...). La nueva queda en
//   espera hasta que el usuario acepta recargar (mensaje «skip-waiting»).

const BUILD = new URL(self.location.href).searchParams.get('build') ?? 'dev'
const PREFIX = 'grafcet-editor-'
const CACHE = `${PREFIX}${BUILD}`
const SHELL = ['./', './index.html', './manifest.webmanifest', './icon.svg', './icon-192.png', './icon-512.png', './icon-maskable-512.png', './apple-touch-icon.png']

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE)
      const files = new Set(SHELL)
      const response = await fetch('./asset-manifest.json', { cache: 'no-store' })
      const manifest = await response.json()
      for (const entry of Object.values(manifest)) {
        files.add(`./${entry.file}`)
        for (const f of [...(entry.css ?? []), ...(entry.assets ?? [])]) files.add(`./${f}`)
      }
      await cache.addAll([...files])
    })(),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) if (key.startsWith(PREFIX) && key !== CACHE) await caches.delete(key)
      // Primera instalación: controla ya la página abierta (sin recargarla).
      await self.clients.claim()
    })(),
  )
})

self.addEventListener('message', (event) => {
  if (event.data === 'skip-waiting') self.skipWaiting()
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return
  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          return await fetch(request)
        } catch {
          return (await caches.match('./index.html', { ignoreSearch: true, ignoreVary: true })) ?? (await caches.match('./'))
        }
      })(),
    )
    return
  }
  event.respondWith(
    (async () => {
      const cached = await caches.match(request, { ignoreSearch: true, ignoreVary: true })
      if (cached) return cached
      const response = await fetch(request)
      if (response.ok) {
        const cache = await caches.open(CACHE)
        cache.put(request, response.clone())
      }
      return response
    })(),
  )
})
