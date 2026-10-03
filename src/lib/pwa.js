// Registro del service worker (public/sw.js): solo en la versión compilada (en desarrollo
// estorbaría: serviría archivos viejos). Avisa de las versiones nuevas sin recargar por su cuenta:
// la recarga la decide el usuario (components/UpdateBanner.jsx).

const listeners = new Set()
let pending = null // función que activa la versión nueva

export function onUpdateAvailable(fn) {
  listeners.add(fn)
  if (pending) fn(pending)
  return () => listeners.delete(fn)
}

export function registerServiceWorker() {
  // Ni en desarrollo ni abierto como archivo (versión portable: file://).
  if (!import.meta.env.PROD || !('serviceWorker' in navigator) || location.protocol === 'file:') return
  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register(`./sw.js?build=${import.meta.env.BUILD_ID}`)
      let accepted = false
      const announce = (worker) => {
        pending = () => {
          accepted = true
          worker.postMessage('skip-waiting')
        }
        listeners.forEach((fn) => fn(pending))
      }
      // Solo hay «versión nueva» si ya había una controlando la página.
      if (registration.waiting && navigator.serviceWorker.controller) announce(registration.waiting)
      registration.addEventListener('updatefound', () => {
        const worker = registration.installing
        worker?.addEventListener('statechange', () => {
          if (worker.state === 'installed' && navigator.serviceWorker.controller) announce(worker)
        })
      })
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (accepted) window.location.reload()
      })
    } catch {
      // Sin service worker (navegador antiguo, modo privado restringido...): funciona igual, con conexión.
    }
  })
}
