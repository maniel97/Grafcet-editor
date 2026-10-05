// Tiradores para dimensionar los elementos de la planta arrastrando (ratón, dedo o lápiz), en vez
// de escribir la medida. Puro: se prueba sin navegador.
//
// - Elementos lineales (crecen a lo largo de su eje local x desde el origen, girados con rot):
//   un tirador en el extremo y, si no tienen anclaje fijo, otro en el principio (que mueve el
//   origen para que el extremo se quede quieto).
// - Elementos con ancho y alto (imagen): laterales y esquinas; con keepRatio (Mayús), mantienen
//   la proporción.
// - Rótulo: una esquina que cambia el tamaño de la letra.
// Las medidas se ajustan a la rejilla (GRID) y no bajan de un mínimo.
import { rotate } from './scene'

export const GRID = 10
const BODY = 80 // cuerpo del cilindro (scene.js)

// type -> { param, x0, y, start } (start: si se puede estirar también desde el principio)
const LINEAR = {
  conveyor: { param: 'length', x0: 0, y: 0, start: true, min: 60, fallback: 240 },
  ramp: { param: 'length', x0: 0, y: 0, start: true, min: 40, fallback: 120 },
  platform: { param: 'length', x0: 0, y: 7, start: true, min: 30, fallback: 160 },
  pipe: { param: 'length', x0: 0, y: 0, start: true, min: 20, fallback: 160 },
  diverter: { param: 'length', x0: 0, y: 0, start: false, min: 30, fallback: 80 }, // gira sobre su anclaje
  barrier: { param: 'length', x0: 0, y: -18, start: false, min: 40, fallback: 140 }, // bisagra en el origen
  cylinder: { param: 'stroke', x0: BODY, y: 18, start: false, min: 20, fallback: 100 }, // carrera: el final de la guía
  sensor: { param: 'range', x0: 10, y: 0, start: false, min: 10, fallback: 60 }, // alcance del haz
  distance: { param: 'range', x0: 12, y: 0, start: false, min: 20, fallback: 200 },
}

const snap = (v) => Math.round(v / GRID) * GRID
const toWorld = (e, lx, ly) => {
  const [dx, dy] = rotate(lx, ly, e.rot)
  return { x: e.x + dx, y: e.y + dy }
}
// Punto de la escena -> coordenadas locales del elemento (deshace el giro).
const toLocal = (e, p) => rotate(p.x - e.x, p.y - e.y, -(e.rot ?? 0))

// Ángulo en pantalla de la dirección en que se arrastra (para el cursor de redimensionar).
const angleOf = (e, deg) => (((deg + (Number(e.rot) || 0)) % 180) + 180) % 180
export function resizeCursor(angle) {
  const a = ((angle % 180) + 180) % 180
  if (a < 22.5 || a >= 157.5) return 'ew-resize'
  if (a < 67.5) return 'nwse-resize'
  if (a < 112.5) return 'ns-resize'
  return 'nesw-resize'
}

// Tiradores del elemento: [{ id, x, y, cursor }] en coordenadas de la escena ([] si no tiene).
export function resizeHandles(e) {
  const lin = LINEAR[e.type]
  if (lin) {
    const len = Number(e[lin.param]) || lin.fallback
    const cursor = resizeCursor(angleOf(e, 0))
    return [
      { id: 'end', ...toWorld(e, lin.x0 + len, lin.y), cursor },
      ...(lin.start ? [{ id: 'start', ...toWorld(e, lin.x0, lin.y), cursor }] : []),
    ]
  }
  if (e.type === 'image') {
    const w = Number(e.width) || 300
    const h = Number(e.height) || 200
    const at = { n: [w / 2, 0], s: [w / 2, h], w: [0, h / 2], e: [w, h / 2], nw: [0, 0], ne: [w, 0], sw: [0, h], se: [w, h] }
    const cursors = { n: 'ns-resize', s: 'ns-resize', w: 'ew-resize', e: 'ew-resize', nw: 'nwse-resize', se: 'nwse-resize', ne: 'nesw-resize', sw: 'nesw-resize' }
    return Object.entries(at).map(([id, [lx, ly]]) => ({ id, x: e.x + lx, y: e.y + ly, cursor: cursors[id] }))
  }
  if (e.type === 'label') {
    const size = Number(e.size) || 16
    const width = Math.max(20, String(e.text ?? '').length * size * 0.6)
    return [{ id: 'se', x: e.x + width, y: e.y + size * 0.3, cursor: 'nwse-resize' }]
  }
  return []
}

// Elemento con el tirador `handle` llevado al punto `p` de la escena.
export function applyResize(e, handle, p, { keepRatio = false } = {}) {
  const lin = LINEAR[e.type]
  if (lin) {
    const len = Number(e[lin.param]) || lin.fallback
    const [lx] = toLocal(e, p)
    if (handle === 'end') return { ...e, [lin.param]: Math.max(lin.min, snap(lx - lin.x0)) }
    if (handle === 'start' && lin.start) {
      // El extremo se queda quieto: el origen se mueve a lo largo del eje.
      const end = lin.x0 + len
      const next = Math.max(lin.min, snap(end - lx))
      const shift = end - next - lin.x0
      const o = toWorld(e, shift, 0)
      return { ...e, x: Math.round(o.x), y: Math.round(o.y), [lin.param]: next }
    }
    return e
  }
  if (e.type === 'image') {
    const w = Number(e.width) || 300
    const h = Number(e.height) || 200
    let left = e.x
    let top = e.y
    let right = e.x + w
    let bottom = e.y + h
    if (handle.includes('w')) left = Math.min(snap(p.x), right - 20)
    if (handle.includes('e')) right = Math.max(snap(p.x), left + 20)
    if (handle.includes('n')) top = Math.min(snap(p.y), bottom - 20)
    if (handle.includes('s')) bottom = Math.max(snap(p.y), top + 20)
    let nw = right - left
    let nh = bottom - top
    if (keepRatio && handle.length === 2) {
      // Esquina con Mayús: manda la medida que más ha cambiado; la otra, en proporción.
      const ratio = w / h
      if (Math.abs(nw - w) / w >= Math.abs(nh - h) / h) nh = Math.round(nw / ratio)
      else nw = Math.round(nh * ratio)
      if (handle.includes('w')) left = right - nw
      if (handle.includes('n')) top = bottom - nh
    }
    return { ...e, x: left, y: top, width: nw, height: nh }
  }
  if (e.type === 'label') {
    const chars = Math.max(1, String(e.text ?? '').length)
    const size = Math.min(96, Math.max(8, Math.round((p.x - e.x) / (chars * 0.6))))
    return { ...e, size }
  }
  return e
}

// Medida que se enseña mientras se arrastra (sin unidades: píxeles de la escena; el rótulo, en pt).
export function resizeMeasure(e) {
  const lin = LINEAR[e.type]
  if (lin) return String(Number(e[lin.param]) || lin.fallback)
  if (e.type === 'image') return `${e.width} × ${e.height}`
  if (e.type === 'label') return `${e.size} pt`
  return ''
}
