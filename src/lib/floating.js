// Paneles flotantes del simulador (cronograma, espacio-fase, escenarios): una sección del panel de
// simulación sacada al lienzo, que se mueve y se redimensiona. Su sitio y su tamaño se recuerdan
// por usuario (en este navegador), no en el proyecto. Puro, salvo leer y guardar.

export const MIN_SIZE = { w: 260, h: 160 }
export const DEFAULT_SIZE = { w: 460, h: 300 }
const KEY = 'grafcet-editor:floating'

// { [id]: { x, y, w, h, open } }
export function loadFloating() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY))
    return raw && typeof raw === 'object' ? raw : {}
  } catch {
    return {}
  }
}

export function saveFloating(layout) {
  try {
    localStorage.setItem(KEY, JSON.stringify(layout))
  } catch {
    // Sin almacenamiento (modo privado…): se recuerda solo mientras dura la sesión.
  }
}

// Ajusta un rectángulo a la zona disponible (host: { w, h }): tamaño mínimo, no más grande que la
// zona y siempre entero dentro de ella (la barra de título, al menos, a la vista).
export function clampRect({ x, y, w, h }, host) {
  const width = Math.max(MIN_SIZE.w, Math.min(w, host.w))
  const height = Math.max(MIN_SIZE.h, Math.min(h, host.h))
  return {
    x: Math.round(Math.max(0, Math.min(x, host.w - width))),
    y: Math.round(Math.max(0, Math.min(y, host.h - height))),
    w: Math.round(width),
    h: Math.round(height),
  }
}

// Redimensionar desde un borde o esquina: edge ⊂ 'nsew' (p. ej. 'se', 'w'); dx, dy: lo movido.
export function resizeRect(rect, edge, dx, dy) {
  let { x, y, w, h } = rect
  if (edge.includes('e')) w += dx
  if (edge.includes('s')) h += dy
  if (edge.includes('w')) {
    const nw = Math.max(MIN_SIZE.w, w - dx)
    x += w - nw
    w = nw
  }
  if (edge.includes('n')) {
    const nh = Math.max(MIN_SIZE.h, h - dy)
    y += h - nh
    h = nh
  }
  return { x, y, w: Math.max(MIN_SIZE.w, w), h: Math.max(MIN_SIZE.h, h) }
}
